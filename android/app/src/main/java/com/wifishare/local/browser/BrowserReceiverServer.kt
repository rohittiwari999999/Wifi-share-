package com.wifishare.local.browser

import android.content.Context
import android.net.Uri
import android.util.Log
import com.wifishare.local.core.storage.StorageManager
import com.wifishare.local.data.model.BrowserSession
import com.wifishare.local.data.model.DEFAULT_SERVER_PORT
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.InputStream

class BrowserReceiverServer(
    private val context: Context,
    private val storageManager: StorageManager
) {
    private val tag = "BrowserReceiverServer"
    private var server: EmbeddedServer<*, *>? = null

    private val _currentSession = MutableStateFlow<BrowserSession?>(null)
    val currentSession: StateFlow<BrowserSession?> = _currentSession.asStateFlow()

    fun startSession(session: BrowserSession, port: Int = DEFAULT_SERVER_PORT) {
        stopSession()
        _currentSession.value = session

        server = embeddedServer(Netty, port = port) {
            install(CORS) {
                anyHost()
            }

            routing {
                // Serves responsive HTML portal
                get("/receive/{token}") {
                    val token = call.parameters["token"]
                    val active = _currentSession.value

                    if (active == null || active.token != token) {
                        call.respondText(
                            "<h3>Session expired or invalid.</h3>",
                            ContentType.Text.Html,
                            HttpStatusCode.NotFound
                        )
                        return@get
                    }

                    if (System.currentTimeMillis() > active.expiresAt) {
                        call.respondText(
                            "<h3>Transfer session has expired.</h3>",
                            ContentType.Text.Html,
                            HttpStatusCode.Gone
                        )
                        return@get
                    }

                    val html = BrowserPortal.buildPortalHtml(active)
                    call.respondText(html, ContentType.Text.Html)
                }

                // API: Accept transfer
                post("/api/v1/browser/accept/{token}") {
                    val token = call.parameters["token"]
                    val active = _currentSession.value
                    if (active != null && active.token == token) {
                        _currentSession.value = active.copy(isApproved = true)
                        call.respond(HttpStatusCode.OK, "Approved")
                    } else {
                        call.respond(HttpStatusCode.NotFound, "Invalid token")
                    }
                }

                // API: Reject transfer
                post("/api/v1/browser/reject/{token}") {
                    val token = call.parameters["token"]
                    val active = _currentSession.value
                    if (active != null && active.token == token) {
                        _currentSession.value = active.copy(isRejected = true)
                        call.respond(HttpStatusCode.OK, "Rejected")
                    } else {
                        call.respond(HttpStatusCode.NotFound, "Invalid token")
                    }
                }

                // API: Download file (Requires approval first!)
                get("/api/v1/browser/download/{token}/{fileId}") {
                    val token = call.parameters["token"]
                    val fileId = call.parameters["fileId"]
                    val active = _currentSession.value

                    if (active == null || active.token != token) {
                        call.respond(HttpStatusCode.Unauthorized, "Session unauthorized")
                        return@get
                    }

                    if (!active.isApproved) {
                        call.respond(HttpStatusCode.Forbidden, "Transfer was not approved by receiver")
                        return@get
                    }

                    val fileItem = active.files.find { it.id == fileId }
                    if (fileItem == null || fileItem.uriString == null) {
                        call.respond(HttpStatusCode.NotFound, "File not found")
                        return@get
                    }

                    val uri = Uri.parse(fileItem.uriString)
                    val inputStream: InputStream = storageManager.openInputStream(uri) ?: run {
                        call.respond(HttpStatusCode.InternalServerError, "Cannot read file from device storage")
                        return@get
                    }

                    call.response.header(
                        HttpHeaders.ContentDisposition,
                        ContentDisposition.Attachment
                            .withParameter(ContentDisposition.Parameters.FileName, fileItem.name)
                            .toString()
                    )
                    call.respondOutputStream(
                        contentType = ContentType.parse(fileItem.mimeType),
                        contentLength = fileItem.size
                    ) {
                        val buffer = ByteArray(64 * 1024)
                        var read: Int
                        inputStream.use { input ->
                            while (input.read(buffer).also { read = it } != -1) {
                                write(buffer, 0, read)
                            }
                        }
                    }
                }
            }
        }.start(wait = false)
        Log.d(tag, "Browser receiver HTTP server started on port $port")
    }

    fun stopSession() {
        try {
            server?.stop(500, 1000)
            server = null
            _currentSession.value = null
        } catch (e: Exception) {
            Log.e(tag, "Error stopping browser server", e)
        }
    }
}
