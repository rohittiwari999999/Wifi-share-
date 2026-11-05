package com.wifishare.local.core.storage

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import com.wifishare.local.core.security.HashUtils
import com.wifishare.local.data.model.FileTransferItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

class StorageManager(private val context: Context) {

    private val tag = "StorageManager"
    private val contentResolver: ContentResolver = context.contentResolver

    /**
     * Extracts metadata (name, size, mimeType) from a content Uri using SAF or MediaStore.
     * Guaranteed to return a valid FileTransferItem and never throw an unhandled exception.
     */
    /**
     * Staged diagnostic file processing implementing TEST A, B, C, D on Dispatchers.IO.
     * Fully safe against SecurityException, IOException, IllegalArgumentException, and nulls.
     */
    suspend fun processFileUriWithDiagnostics(uri: Uri): FileTransferItem = withContext(Dispatchers.IO) {
        val uriStr = uri.toString()
        
        // TEST A: Receive selected URI and log its string representation. Do not open it.
        Log.i(tag, "[TEST A] Received selected URI: $uriStr [scheme=${uri.scheme}, authority=${uri.authority}, path=${uri.path}]")

        // Safely attempt persistable URI permission grant (expected to throw SecurityException for photo picker)
        try {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            Log.d(tag, "[TEST A] Persistable URI permission acquired for: $uriStr")
        } catch (se: SecurityException) {
            Log.d(tag, "[TEST A] Persistable URI permission not granted (expected for photo picker): ${se.message}")
        } catch (ignored: Throwable) {
        }

        // TEST B: Read MIME type using ContentResolver.getType(uri)
        var mimeType = "application/octet-stream"
        try {
            val resolved = contentResolver.getType(uri)
            if (!resolved.isNullOrBlank()) {
                mimeType = resolved
            }
            Log.i(tag, "[TEST B] Read MIME type via contentResolver.getType: '$mimeType' for URI: $uriStr")
        } catch (t: Throwable) {
            Log.w(tag, "[TEST B] Exception reading MIME type for URI: $uriStr: ${t.javaClass.simpleName}: ${t.message}", t)
        }

        // TEST C: Read display name and size safely using OpenableColumns
        var displayName = "photo_${System.currentTimeMillis()}"
        var fileSize = 0L

        try {
            val projection = arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
            contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIdx != -1 && !cursor.isNull(nameIdx)) {
                        val n = cursor.getString(nameIdx)
                        if (!n.isNullOrBlank()) {
                            displayName = n
                            Log.d(tag, "[TEST C] Resolved DISPLAY_NAME from cursor: '$displayName'")
                        }
                    }
                    val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIdx != -1 && !cursor.isNull(sizeIdx)) {
                        val s = cursor.getLong(sizeIdx)
                        if (s > 0L) {
                            fileSize = s
                            Log.d(tag, "[TEST C] Resolved SIZE from cursor: $fileSize bytes")
                        }
                    }
                }
            }
            Log.i(tag, "[TEST C] Result from OpenableColumns: name='$displayName', size=$fileSize B")
        } catch (t: Throwable) {
            Log.w(tag, "[TEST C] OpenableColumns cursor query failed for $uriStr: ${t.javaClass.simpleName}: ${t.message}", t)
        }

        // Fallback size probes if 0
        if (fileSize <= 0L) {
            try {
                contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                    val len = afd.length
                    if (len > 0L) {
                        fileSize = len
                        Log.d(tag, "[TEST C-Fallback] Resolved size via openAssetFileDescriptor: $fileSize bytes")
                    }
                }
            } catch (ignored: Throwable) {}
        }
        if (fileSize <= 0L) {
            try {
                contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                    val statSize = pfd.statSize
                    if (statSize > 0L) {
                        fileSize = statSize
                        Log.d(tag, "[TEST C-Fallback] Resolved size via openFileDescriptor: $fileSize bytes")
                    }
                }
            } catch (ignored: Throwable) {}
        }

        // Fallback display name resolution
        if (displayName.startsWith("photo_") || displayName.startsWith("file_")) {
            val lastSegment = uri.lastPathSegment
            if (!lastSegment.isNullOrBlank()) {
                val clean = lastSegment.substringAfterLast('/')
                if (clean.isNotBlank() && clean.contains('.')) {
                    displayName = clean
                    Log.d(tag, "[TEST C-Fallback] Fallback name from URI path: '$displayName'")
                }
            }
        }
        if (!displayName.contains('.')) {
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
            displayName = when {
                !ext.isNullOrBlank() -> "$displayName.$ext"
                mimeType.startsWith("image/") -> "$displayName.jpg"
                mimeType.startsWith("video/") -> "$displayName.mp4"
                mimeType.startsWith("audio/") -> "$displayName.mp3"
                else -> "$displayName.bin"
            }
        }
        val sanitizedName = HashUtils.sanitizeFileName(displayName)

        // TEST D: Open ContentResolver.openInputStream(uri), read a small buffer and close it
        try {
            contentResolver.openInputStream(uri)?.use { stream ->
                val testBuffer = ByteArray(64)
                val bytesRead = stream.read(testBuffer)
                Log.i(tag, "[TEST D] Successfully opened InputStream and read test buffer: $bytesRead bytes read from URI: $uriStr")
            } ?: Log.w(tag, "[TEST D] openInputStream returned null for URI: $uriStr")
        } catch (t: Throwable) {
            Log.w(tag, "[TEST D] Exception opening/reading InputStream for URI: $uriStr: ${t.javaClass.simpleName}: ${t.message}", t)
        }

        val item = FileTransferItem(
            id = UUID.randomUUID().toString(),
            name = sanitizedName,
            size = fileSize,
            mimeType = mimeType,
            uriString = uriStr
        )
        Log.i(tag, "<-- Diagnostic pipeline produced FileTransferItem: name='${item.name}', size=${item.size} B, mime='${item.mimeType}', id=${item.id}")
        return@withContext item
    }

    /**
     * Extracts metadata (name, size, mimeType) from a content Uri.
     */
    fun queryFileMetadata(uri: Uri): FileTransferItem {
        return try {
            val uriStr = uri.toString()
            var name = "file_${System.currentTimeMillis()}"
            var size = 0L

            val mimeType = try {
                contentResolver.getType(uri) ?: "application/octet-stream"
            } catch (e: Throwable) {
                "application/octet-stream"
            }

            try {
                contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                        if (nameIndex != -1 && !cursor.isNull(nameIndex)) {
                            val extracted = cursor.getString(nameIndex)
                            if (!extracted.isNullOrBlank()) name = extracted
                        }
                        if (sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
                            val extractedSize = cursor.getLong(sizeIndex)
                            if (extractedSize > 0L) size = extractedSize
                        }
                    }
                }
            } catch (ignored: Throwable) {}

            if (!name.contains('.')) {
                val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
                name = if (!ext.isNullOrBlank()) "$name.$ext" else "$name.jpg"
            }

            FileTransferItem(
                id = UUID.randomUUID().toString(),
                name = HashUtils.sanitizeFileName(name),
                size = size,
                mimeType = mimeType,
                uriString = uriStr
            )
        } catch (t: Throwable) {
            FileTransferItem(
                id = UUID.randomUUID().toString(),
                name = "file_${System.currentTimeMillis()}.jpg",
                size = 0L,
                mimeType = "image/jpeg",
                uriString = uri.toString()
            )
        }
    }

    /**
     * Opens an input stream for reading the file content.
     */
    fun openInputStream(uri: Uri): InputStream? {
        return try {
            contentResolver.openInputStream(uri)
        } catch (e: Exception) {
            Log.e(tag, "Error opening InputStream for URI: $uri", e)
            null
        }
    }

    /**
     * Returns the dedicated directory for received files (Downloads/WiFiShare).
     */
    fun getWiFiShareDownloadDirectory(): File {
        val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val appFolder = File(downloadDir, "WiFiShare")
        if (!appFolder.exists()) {
            appFolder.mkdirs()
        }
        return appFolder
    }

    /**
     * Creates an output stream for a received file with collision renaming.
     */
    fun createReceivedFileOutputStream(fileName: String): Pair<File, OutputStream> {
        val sanitized = HashUtils.sanitizeFileName(fileName)
        val directory = getWiFiShareDownloadDirectory()
        var destination = File(directory, sanitized)

        // Prevent overwriting existing files
        var counter = 1
        val dotIndex = sanitized.lastIndexOf('.')
        val baseName = if (dotIndex > 0) sanitized.substring(0, dotIndex) else sanitized
        val extension = if (dotIndex > 0) sanitized.substring(dotIndex) else ""

        while (destination.exists()) {
            destination = File(directory, "${baseName}_$counter$extension")
            counter++
        }

        return Pair(destination, FileOutputStream(destination))
    }

    /**
     * Checks if sufficient free storage is available before accepting a file transfer.
     */
    suspend fun hasEnoughStorage(requiredBytes: Long): Boolean = withContext(Dispatchers.IO) {
        val freeBytes = getWiFiShareDownloadDirectory().usableSpace
        // Require at least requiredBytes + 50MB buffer
        return@withContext freeBytes > (requiredBytes + 50 * 1024 * 1024)
    }
}
