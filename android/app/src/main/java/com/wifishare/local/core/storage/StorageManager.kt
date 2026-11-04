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
    fun queryFileMetadata(uri: Uri): FileTransferItem {
        Log.i(tag, "--> queryFileMetadata invoked for URI: $uri [scheme=${uri.scheme}, authority=${uri.authority}]")

        return try {
            // Safely attempt to take persistable URI permission
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
                Log.d(tag, "Persistable URI permission acquired for: $uri")
            } catch (ignored: Exception) {
                // Expected for transient or gallery picker URIs
            }

            var name = "file_${System.currentTimeMillis()}"
            var size = 0L

            // Safely resolve MIME type
            val mimeType = try {
                contentResolver.getType(uri) ?: "application/octet-stream"
            } catch (e: Exception) {
                Log.w(tag, "contentResolver.getType failed: ${e.message}")
                "application/octet-stream"
            }

            // 1. Query OpenableColumns
            val openableProjection = arrayOf(
                OpenableColumns.DISPLAY_NAME,
                OpenableColumns.SIZE
            )

            try {
                contentResolver.query(uri, openableProjection, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

                        if (nameIndex != -1 && !cursor.isNull(nameIndex)) {
                            try {
                                val extractedName = cursor.getString(nameIndex)
                                if (!extractedName.isNullOrBlank()) {
                                    name = extractedName
                                    Log.d(tag, "Resolved display name from cursor: $name")
                                }
                            } catch (e: Exception) {
                                Log.w(tag, "Failed reading display name column: ${e.message}")
                            }
                        }

                        if (sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
                            try {
                                val extractedSize = cursor.getLong(sizeIndex)
                                if (extractedSize > 0L) {
                                    size = extractedSize
                                    Log.d(tag, "Resolved size from cursor: $size bytes")
                                }
                            } catch (e: Exception) {
                                Log.w(tag, "Failed reading size column: ${e.message}")
                            }
                        }
                    }
                }
            } catch (t: Throwable) {
                Log.w(tag, "OpenableColumns cursor query failed for $uri: ${t.message}")
            }

            // 2. Fallback probe: AssetFileDescriptor (highly compatible with MediaStore / Photos)
            if (size <= 0L) {
                try {
                    contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                        val len = afd.length
                        if (len > 0L) {
                            size = len
                            Log.d(tag, "Resolved size via openAssetFileDescriptor: $size bytes")
                        }
                    }
                } catch (ignored: Exception) {
                }
            }

            // 3. Fallback probe: ParcelFileDescriptor
            if (size <= 0L) {
                try {
                    contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                        val statSize = pfd.statSize
                        if (statSize > 0L) {
                            size = statSize
                            Log.d(tag, "Resolved size via openFileDescriptor: $size bytes")
                        }
                    }
                } catch (ignored: Exception) {
                }
            }

            // 4. Fallback probe: InputStream available bytes
            if (size <= 0L) {
                try {
                    contentResolver.openInputStream(uri)?.use { stream ->
                        val available = stream.available().toLong()
                        if (available > 0L) {
                            size = available
                            Log.d(tag, "Estimated size via stream.available(): $size bytes")
                        }
                    }
                } catch (ignored: Exception) {
                }
            }

            // 5. Fallback name from URI path if still default
            if (name.startsWith("file_") || name.startsWith("unknown_file_")) {
                val lastSegment = uri.lastPathSegment
                if (!lastSegment.isNullOrBlank()) {
                    val cleanSegment = lastSegment.substringAfterLast('/')
                    if (cleanSegment.isNotBlank() && cleanSegment.contains('.')) {
                        name = cleanSegment
                        Log.d(tag, "Fallback name extracted from URI path: $name")
                    }
                }
            }

            // 6. Ensure extension is present
            if (!name.contains('.')) {
                val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
                if (!ext.isNullOrBlank()) {
                    name = "$name.$ext"
                } else if (mimeType.startsWith("image/")) {
                    name = "$name.jpg"
                } else if (mimeType.startsWith("video/")) {
                    name = "$name.mp4"
                } else if (mimeType.startsWith("audio/")) {
                    name = "$name.mp3"
                }
            }

            val sanitizedName = HashUtils.sanitizeFileName(name)
            val fileItem = FileTransferItem(
                id = UUID.randomUUID().toString(),
                name = sanitizedName,
                size = size,
                mimeType = mimeType,
                uriString = uri.toString()
            )

            Log.i(tag, "<-- Successfully extracted FileTransferItem: name=${fileItem.name}, size=${fileItem.size} B, mime=${fileItem.mimeType}")
            fileItem
        } catch (t: Throwable) {
            Log.e(tag, "Outer exception in queryFileMetadata for URI: $uri, returning fallback item", t)
            val fallbackName = HashUtils.sanitizeFileName(uri.lastPathSegment?.substringAfterLast('/') ?: "image_${System.currentTimeMillis()}.jpg")
            FileTransferItem(
                id = UUID.randomUUID().toString(),
                name = fallbackName,
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
