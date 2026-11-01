package com.wifishare.local.core.storage

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
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

    private val contentResolver: ContentResolver = context.contentResolver

    /**
     * Extracts metadata (name, size, mimeType) from a content Uri using SAF.
     */
    fun queryFileMetadata(uri: Uri): FileTransferItem? {
        var name = "unknown_file_${System.currentTimeMillis()}"
        var size = 0L
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"

        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

                if (nameIndex != -1) {
                    name = cursor.getString(nameIndex) ?: name
                }
                if (sizeIndex != -1) {
                    size = cursor.getLong(sizeIndex)
                }
            }
        }

        return FileTransferItem(
            id = UUID.randomUUID().toString(),
            name = HashUtils.sanitizeFileName(name),
            size = size,
            mimeType = mimeType,
            uriString = uri.toString()
        )
    }

    /**
     * Opens an input stream for reading the file content.
     */
    fun openInputStream(uri: Uri): InputStream? {
        return contentResolver.openInputStream(uri)
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
