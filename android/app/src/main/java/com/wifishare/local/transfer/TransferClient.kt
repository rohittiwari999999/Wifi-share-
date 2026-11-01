package com.wifishare.local.transfer

import android.content.Context
import android.net.Uri
import android.util.Log
import com.wifishare.local.core.security.HashUtils
import com.wifishare.local.core.storage.StorageManager
import com.wifishare.local.data.database.AppDatabase
import com.wifishare.local.data.database.TransferEntity
import com.wifishare.local.data.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.utils.io.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.security.MessageDigest

class TransferClient(
    private val context: Context,
    private val storageManager: StorageManager,
    private val database: AppDatabase
) {
    private val tag = "TransferClient"

    private val httpClient = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                encodeDefaults = true
            })
        }
        engine {
            config {
                retryOnConnectionFailure(true)
            }
        }
    }

    private val _clientProgress = MutableStateFlow<TransferProgress?>(null)
    val clientProgress: StateFlow<TransferProgress?> = _clientProgress.asStateFlow()

    private var isCancelled = false

    fun cancelTransfer(sessionId: String, targetIp: String, targetPort: Int) {
        isCancelled = true
        _clientProgress.value = _clientProgress.value?.copy(state = TransferState.CANCELLED)
    }

    /**
     * Executes the complete end-to-end sender transfer pipeline.
     */
    suspend fun executeTransfer(
        targetDevice: DeviceInfo,
        senderName: String,
        files: List<FileTransferItem>
    ): Boolean = withContext(Dispatchers.IO) {
        isCancelled = false
        val totalBytes = files.sumOf { it.size }
        val baseUrl = "http://${targetDevice.ipAddress}:${targetDevice.port}"

        try {
            // 1. Session Handshake
            Log.d(tag, "Connecting to $baseUrl/api/v1/session")
            val handshakeResponse: SessionHandshakeResponse = httpClient.post("$baseUrl/api/v1/session") {
                contentType(ContentType.Application.Json)
                setBody(SessionHandshakeRequest(
                    senderId = targetDevice.id,
                    senderName = senderName
                ))
            }.body()

            val sessionId = handshakeResponse.sessionId

            // 2. Request Transfer Approval
            _clientProgress.value = TransferProgress(
                sessionId = sessionId,
                fileId = files.firstOrNull()?.id ?: "",
                fileName = files.firstOrNull()?.name ?: "",
                bytesTransferred = 0,
                totalBytes = totalBytes,
                bytesPerSecond = 0,
                estimatedRemainingSeconds = 0,
                currentFileIndex = 0,
                totalFiles = files.size,
                state = TransferState.PENDING_APPROVAL
            )

            Log.d(tag, "Sending transfer request to receiver for approval...")
            val transferResp: HttpResponse = httpClient.post("$baseUrl/api/v1/transfer/request") {
                contentType(ContentType.Application.Json)
                setBody(TransferRequest(
                    sessionId = sessionId,
                    senderName = senderName,
                    files = files,
                    totalBytes = totalBytes
                ))
            }

            if (transferResp.status != HttpStatusCode.OK) {
                _clientProgress.value = _clientProgress.value?.copy(
                    state = TransferState.REJECTED,
                    errorMessage = "Transfer was rejected by ${targetDevice.name}"
                )
                return@withContext false
            }

            val approvedData: TransferResponse = transferResp.body()
            val transferToken = approvedData.transferToken

            // 3. Upload Each File with Real-Time Streaming
            var overallBytesTransferred = 0L

            files.forEachIndexed { index, fileItem ->
                if (isCancelled) return@withContext false

                val uri = Uri.parse(fileItem.uriString ?: "")
                val inputStream = storageManager.openInputStream(uri)
                    ?: throw IllegalStateException("Cannot open input stream for ${fileItem.name}")

                val digest = MessageDigest.getInstance("SHA-256")
                var lastUpdateTime = System.currentTimeMillis()
                var bytesSinceLastUpdate = 0L

                // Stream directly using ChannelWriter
                val uploadResponse: HttpResponse = httpClient.post("$baseUrl/api/v1/transfer/upload") {
                    parameter("sessionId", sessionId)
                    parameter("fileId", fileItem.id)
                    parameter("fileName", fileItem.name)
                    parameter("fileSize", fileItem.size)
                    header("X-Transfer-Token", transferToken)

                    setBody(object : OutgoingContent.WriteChannelContent() {
                        override val contentType: ContentType = ContentType.Application.OctetStream
                        override val contentLength: Long = fileItem.size

                        override suspend fun writeTo(channel: ByteWriteChannel) {
                            val buffer = ByteArray(64 * 1024)
                            var bytesRead: Int
                            inputStream.use { stream ->
                                while (stream.read(buffer).also { bytesRead = it } != -1) {
                                    if (isCancelled) break
                                    channel.writeFully(buffer, 0, bytesRead)
                                    digest.update(buffer, 0, bytesRead)

                                    overallBytesTransferred += bytesRead
                                    bytesSinceLastUpdate += bytesRead

                                    val now = System.currentTimeMillis()
                                    val elapsed = now - lastUpdateTime
                                    if (elapsed >= 250) {
                                        val speed = if (elapsed > 0) (bytesSinceLastUpdate * 1000) / elapsed else 0L
                                        val remaining = (totalBytes - overallBytesTransferred).coerceAtLeast(0)
                                        val eta = if (speed > 0) remaining / speed else 0L

                                        _clientProgress.value = TransferProgress(
                                            sessionId = sessionId,
                                            fileId = fileItem.id,
                                            fileName = fileItem.name,
                                            bytesTransferred = overallBytesTransferred,
                                            totalBytes = totalBytes,
                                            bytesPerSecond = speed,
                                            estimatedRemainingSeconds = eta,
                                            currentFileIndex = index + 1,
                                            totalFiles = files.size,
                                            state = TransferState.IN_PROGRESS
                                        )
                                        lastUpdateTime = now
                                        bytesSinceLastUpdate = 0L
                                    }
                                }
                            }
                        }
                    })
                }

                if (uploadResponse.status != HttpStatusCode.OK) {
                    throw IllegalStateException("Upload failed with status ${uploadResponse.status}")
                }

                val calculatedHash = digest.digest().joinToString("") { "%02x".format(it) }

                // Record sent file in Room database
                database.transferDao().insertTransfer(
                    TransferEntity(
                        sessionId = sessionId,
                        fileName = fileItem.name,
                        fileSize = fileItem.size,
                        mimeType = fileItem.mimeType,
                        direction = "SENT",
                        peerName = targetDevice.name,
                        status = "SUCCESS",
                        sha256 = calculatedHash
                    )
                )
            }

            _clientProgress.value = TransferProgress(
                sessionId = sessionId,
                fileId = files.last().id,
                fileName = "All files transferred",
                bytesTransferred = totalBytes,
                totalBytes = totalBytes,
                bytesPerSecond = 0,
                estimatedRemainingSeconds = 0,
                currentFileIndex = files.size,
                totalFiles = files.size,
                state = TransferState.COMPLETED
            )
            return@withContext true
        } catch (e: Exception) {
            Log.e(tag, "Transfer error", e)
            _clientProgress.value = _clientProgress.value?.copy(
                state = TransferState.FAILED,
                errorMessage = e.message ?: "Network transfer error"
            )
            return@withContext false
        }
    }
}
