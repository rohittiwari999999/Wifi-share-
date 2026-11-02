package com.wifishare.local.transfer

import android.content.Context
import android.util.Log
import com.wifishare.local.core.security.HashUtils
import com.wifishare.local.core.security.TokenGenerator
import com.wifishare.local.core.storage.StorageManager
import com.wifishare.local.data.database.AppDatabase
import com.wifishare.local.data.database.TransferEntity
import com.wifishare.local.data.model.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.security.MessageDigest

class TransferServer(
    private val context: Context,
    private val storageManager: StorageManager,
    private val database: AppDatabase
) {
    private val tag = "TransferServer"
    private var server: EmbeddedServer<*, *>? = null

    // Pending incoming request waiting for receiver UI decision
    private val _pendingRequest = MutableStateFlow<TransferRequest?>(null)
    val pendingRequest: StateFlow<TransferRequest?> = _pendingRequest.asStateFlow()

    // Deferred decision: true = accepted, false = rejected
    private var pendingDecisionDeferred: CompletableDeferred<Boolean>? = null

    // Active session transfer tokens: sessionId -> transferToken
    private val approvedSessions = mutableMapOf<String, String>()

    // Current transfer progress for UI
    private val _serverProgress = MutableStateFlow<TransferProgress?>(null)
    // Current device name returned in handshakes and ping responses
    @Volatile
    var currentDeviceName: String = "WiFiShare Peer"

    fun updateDeviceName(name: String) {
        if (name.isNotBlank()) {
            currentDeviceName = name
        }
    }

    fun startServer(port: Int = DEFAULT_SERVER_PORT) {
        if (server != null) return

        server = embeddedServer(Netty, port = port) {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                    prettyPrint = true
                })
            }
            install(CORS) {
                anyHost()
                allowHeader(HttpHeaders.ContentType)
                allowHeader("X-Transfer-Token")
            }

            routing {
                // Ping endpoint for fast subnet peer discovery and AP isolation fallback
                get("/api/v1/ping") {
                    call.respond(
                        HttpStatusCode.OK,
                        SessionHandshakeResponse(
                            sessionId = "ping",
                            receiverName = currentDeviceName,
                            accepted = true,
                            message = "pong"
                        )
                    )
                }

                // Handshake endpoint
                post("/api/v1/session") {
                    val req = call.receive<SessionHandshakeRequest>()
                    val sessionId = TokenGenerator.generateUniqueId()
                    call.respond(
                        HttpStatusCode.OK,
                        SessionHandshakeResponse(
                            sessionId = sessionId,
                            receiverName = currentDeviceName,
                            accepted = true,
                            message = "Handshake successful"
                        )
                    )
                }

                // Transfer request approval endpoint (Requires explicit receiver approval!)
                post("/api/v1/transfer/request") {
                    val req = call.receive<TransferRequest>()
                    Log.d(tag, "Incoming transfer request from ${req.senderName} for ${req.files.size} files")

                    // Check storage before asking user
                    val hasStorage = storageManager.hasEnoughStorage(req.totalBytes)
                    if (!hasStorage) {
                        call.respond(
                            HttpStatusCode.InsufficientStorage,
                            TransferResponse(
                                sessionId = req.sessionId,
                                accepted = false,
                                message = "Receiver device does not have sufficient free storage space."
                            )
                        )
                        return@post
                    }

                    // Prompt receiver user in UI
                    _pendingRequest.value = req
                    val deferred = CompletableDeferred<Boolean>()
                    pendingDecisionDeferred = deferred

                    // Suspend and wait for user's explicit accept/reject click
                    val userAccepted = deferred.await()
                    _pendingRequest.value = null

                    if (userAccepted) {
                        val token = TokenGenerator.generateSessionToken()
                        approvedSessions[req.sessionId] = token
                        call.respond(
                            HttpStatusCode.OK,
                            TransferResponse(
                                sessionId = req.sessionId,
                                accepted = true,
                                transferToken = token,
                                message = "Transfer accepted by receiver"
                            )
                        )
                    } else {
                        call.respond(
                            HttpStatusCode.Forbidden,
                            TransferResponse(
                                sessionId = req.sessionId,
                                accepted = false,
                                message = "Transfer was rejected by receiver"
                            )
                        )
                    }
                }

                // File upload endpoint (Streams directly to disk, does NOT buffer full file in RAM)
                post("/api/v1/transfer/upload") {
                    val sessionId = call.request.queryParameters["sessionId"]
                    val fileId = call.request.queryParameters["fileId"]
                    val expectedSha256 = call.request.queryParameters["sha256"] ?: ""
                    val fileName = call.request.queryParameters["fileName"] ?: "received_file"
                    val fileSizeStr = call.request.queryParameters["fileSize"]
                    val fileSize = fileSizeStr?.toLongOrNull() ?: 0L
                    val token = call.request.headers["X-Transfer-Token"]

                    // Validate session token
                    val validToken = approvedSessions[sessionId]
                    if (validToken == null || validToken != token) {
                        call.respond(HttpStatusCode.Unauthorized, "Invalid or expired transfer token.")
                        return@post
                    }

                    Log.d(tag, "Starting streaming upload for: $fileName ($fileSize bytes)")
                    val (destFile, outputStream) = storageManager.createReceivedFileOutputStream(fileName)
                    val digest = MessageDigest.getInstance("SHA-256")

                    var totalBytesReceived = 0L
                    var lastUpdateTime = System.currentTimeMillis()
                    var bytesSinceLastUpdate = 0L

                    try {
                        withContext(Dispatchers.IO) {
                            val inputStream = call.receive<InputStream>()
                            val buffer = ByteArray(64 * 1024) // 64 KB buffer for streaming

                            inputStream.use { input ->
                                outputStream.use { out ->
                                    var read: Int
                                    while (input.read(buffer).also { read = it } != -1) {
                                        if (read <= 0) continue

                                        out.write(buffer, 0, read)
                                        digest.update(buffer, 0, read)

                                        totalBytesReceived += read
                                        bytesSinceLastUpdate += read

                                        val now = System.currentTimeMillis()
                                        val elapsed = now - lastUpdateTime
                                        if (elapsed >= 300) { // Update progress UI every 300ms
                                            val speed = if (elapsed > 0) (bytesSinceLastUpdate * 1000) / elapsed else 0L
                                            val remainingBytes = (fileSize - totalBytesReceived).coerceAtLeast(0L)
                                            val eta = if (speed > 0) remainingBytes / speed else 0L

                                            _serverProgress.value = TransferProgress(
                                                sessionId = sessionId ?: "",
                                                fileId = fileId ?: "",
                                                fileName = fileName,
                                                bytesTransferred = totalBytesReceived,
                                                totalBytes = fileSize,
                                                bytesPerSecond = speed,
                                                estimatedRemainingSeconds = eta,
                                                currentFileIndex = 1,
                                                totalFiles = 1,
                                                state = TransferState.IN_PROGRESS
                                            )

                                            lastUpdateTime = now
                                            bytesSinceLastUpdate = 0L
                                        }
                                    }
                                    out.flush()
                                }
                            }
                        }

                        // Verify SHA-256
                        val calculatedHash = digest.digest().joinToString("") { "%02x".format(it) }
                        val hashMatches = expectedSha256.isEmpty() || calculatedHash.equals(expectedSha256, ignoreCase = true)

                        if (!hashMatches) {
                            destFile.delete()
                            call.respond(HttpStatusCode.BadRequest, "File integrity check failed (SHA-256 mismatch).")
                            return@post
                        }

                        // Record in Room Database
                        database.transferDao().insertTransfer(
                            TransferEntity(
                                sessionId = sessionId ?: "",
                                fileName = fileName,
                                fileSize = totalBytesReceived,
                                mimeType = "application/octet-stream",
                                direction = "RECEIVED",
                                peerName = "Sender Device",
                                status = "SUCCESS",
                                sha256 = calculatedHash,
                                filePath = destFile.absolutePath
                            )
                        )

                        _serverProgress.value = TransferProgress(
                            sessionId = sessionId ?: "",
                            fileId = fileId ?: "",
                            fileName = fileName,
                            bytesTransferred = totalBytesReceived,
                            totalBytes = fileSize,
                            bytesPerSecond = 0,
                            estimatedRemainingSeconds = 0,
                            currentFileIndex = 1,
                            totalFiles = 1,
                            state = TransferState.COMPLETED
                        )

                        call.respond(HttpStatusCode.OK, "Upload complete and verified.")
                    } catch (e: Exception) {
                        try { outputStream.close() } catch (ignored: Exception) {}
                        destFile.delete()
                        Log.e(tag, "Upload error", e)
                        call.respond(HttpStatusCode.InternalServerError, "Streaming error: ${e.message}")
                    }
                }

                // Transfer cancellation
                post("/api/v1/transfer/cancel") {
                    val sessionId = call.request.queryParameters["sessionId"]
                    if (sessionId != null) {
                        approvedSessions.remove(sessionId)
                    }
                    _serverProgress.value = _serverProgress.value?.copy(state = TransferState.CANCELLED)
                    call.respond(HttpStatusCode.OK, "Transfer cancelled.")
                }
            }
        }.start(wait = false)
        Log.d(tag, "Ktor TransferServer started on port $port")
    }

    /**
     * Receiver UI calls this when user taps Accept.
     */
    fun acceptPendingRequest() {
        pendingDecisionDeferred?.complete(true)
    }

    /**
     * Receiver UI calls this when user taps Reject.
     */
    fun rejectPendingRequest() {
        pendingDecisionDeferred?.complete(false)
    }

    fun stopServer() {
        try {
            server?.stop(1000, 2000)
            server = null
            approvedSessions.clear()
            _pendingRequest.value = null
            _serverProgress.value = null
        } catch (e: Exception) {
            Log.e(tag, "Error stopping TransferServer", e)
        }
    }
}
