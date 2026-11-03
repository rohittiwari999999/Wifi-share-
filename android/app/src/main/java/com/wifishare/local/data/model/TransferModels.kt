package com.wifishare.local.data.model

import kotlinx.serialization.Serializable

/**
 * Protocol version to ensure forward/backward compatibility.
 */
const val PROTOCOL_VERSION = "1.0.0"
const val DEFAULT_SERVER_PORT = 8945
const val NSD_SERVICE_TYPE = "_wifishare._tcp"

@Serializable
enum class DeviceType {
    PHONE,
    TABLET,
    BROWSER,
    UNKNOWN
}

@Serializable
data class DeviceInfo(
    val id: String,
    val name: String,
    val ipAddress: String,
    val port: Int,
    val deviceType: DeviceType = DeviceType.PHONE,
    val protocolVersion: String = PROTOCOL_VERSION,
    val isAvailable: Boolean = true,
    val lastSeenTimestamp: Long = System.currentTimeMillis()
)

@Serializable
data class FileTransferItem(
    val id: String,
    val name: String,
    val size: Long,
    val mimeType: String,
    val sha256: String = "",
    val uriString: String? = null // local content Uri on sender
)

@Serializable
data class SessionHandshakeRequest(
    val senderId: String,
    val senderName: String,
    val protocolVersion: String = PROTOCOL_VERSION
)

@Serializable
data class SessionHandshakeResponse(
    val sessionId: String,
    val receiverName: String,
    val accepted: Boolean,
    val message: String = ""
)

@Serializable
data class TransferRequest(
    val sessionId: String,
    val senderName: String,
    val files: List<FileTransferItem>,
    val totalBytes: Long
)

@Serializable
data class TransferResponse(
    val sessionId: String,
    val accepted: Boolean,
    val transferToken: String = "",
    val message: String = ""
)

@Serializable
enum class TransferState {
    PENDING_APPROVAL,
    APPROVED,
    IN_PROGRESS,
    PAUSED,
    COMPLETED,
    FAILED,
    REJECTED,
    CANCELLED
}

@Serializable
data class TransferProgress(
    val sessionId: String,
    val fileId: String,
    val fileName: String,
    val bytesTransferred: Long,
    val totalBytes: Long,
    val bytesPerSecond: Long,
    val estimatedRemainingSeconds: Long,
    val currentFileIndex: Int,
    val totalFiles: Int,
    val state: TransferState,
    val errorMessage: String? = null
)

/**
 * Browser transfer session data.
 */
const val BROWSER_SERVER_PORT = 8946

@Serializable
data class BrowserSession(
    val token: String,
    val senderName: String,
    val files: List<FileTransferItem>,
    val totalBytes: Long,
    val serverPort: Int = BROWSER_SERVER_PORT,
    val localIp: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (30 * 60 * 1000), // 30 min expiry
    val isApproved: Boolean = false,
    val isRejected: Boolean = false,
    val isCancelled: Boolean = false
)

@Serializable
data class BrowserTransferProgress(
    val sessionId: String = "",
    val currentFileId: String = "",
    val currentFileName: String = "",
    val fileIndex: Int = 0,
    val totalFiles: Int = 0,
    val bytesTransferred: Long = 0L,
    val totalFileBytes: Long = 0L,
    val sessionTotalBytes: Long = 0L,
    val sessionBytesTransferred: Long = 0L,
    val speedBytesPerSec: Long = 0L,
    val isApproved: Boolean = false,
    val isRejected: Boolean = false,
    val isCompleted: Boolean = false,
    val isCancelled: Boolean = false,
    val activeDownloadsCount: Int = 0,
    val errorMessage: String? = null
)
