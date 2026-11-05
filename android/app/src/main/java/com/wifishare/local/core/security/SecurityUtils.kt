package com.wifishare.local.core.security

import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

object TokenGenerator {
    private val secureRandom = SecureRandom()
    private val charPool: List<Char> = ('a'..'z') + ('A'..'Z') + ('0'..'9')

    /**
     * Generates a cryptographically strong random token for short-lived sessions.
     */
    fun generateSessionToken(length: Int = 32): String {
        val bytes = ByteArray(length)
        secureRandom.nextBytes(bytes)
        return (1..length)
            .map { secureRandom.nextInt(charPool.size) }
            .map(charPool::get)
            .joinToString("")
    }

    /**
     * Generates a unique UUID string for device or file tracking.
     */
    fun generateUniqueId(): String = UUID.randomUUID().toString()
}

object HashUtils {
    /**
     * Streams an input stream through SHA-256 without loading entire file into RAM.
     */
    fun calculateSha256(inputStream: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024) // 64 KB buffer
        var bytesRead: Int
        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
            digest.update(buffer, 0, bytesRead)
        }
        val hashBytes = digest.digest()
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Sanitizes filename to prevent directory traversal or unsafe filesystem characters.
     * Uses explicit character matching (no regex) to prevent any PatternSyntaxException.
     */
    fun sanitizeFileName(fileName: String): String {
        val illegalChars = setOf('/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', '\u0000')
        val clean = buildString {
            for (ch in fileName) {
                if (ch in illegalChars || ch.code < 32) {
                    append('_')
                } else {
                    append(ch)
                }
            }
        }.trim()
        return clean.ifEmpty { "download_${System.currentTimeMillis()}" }
    }
}
