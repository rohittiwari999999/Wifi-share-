package com.wifishare.local

import com.wifishare.local.core.security.HashUtils
import com.wifishare.local.core.security.TokenGenerator
import com.wifishare.local.data.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream

class TransferUnitTest {

    @Test
    fun testTokenGenerator_createsUniqueTokens() {
        val token1 = TokenGenerator.generateSessionToken(32)
        val token2 = TokenGenerator.generateSessionToken(32)

        assertEquals(32, token1.length)
        assertEquals(32, token2.length)
        assertNotEquals(token1, token2)
    }

    @Test
    fun testFilenameSanitization_removesDangerousCharacters() {
        val dangerous = "../../../etc/passwd"
        val sanitized = HashUtils.sanitizeFileName(dangerous)
        assertFalse(sanitized.contains("/"))
        assertFalse(sanitized.contains("\\"))
        assertEquals("......etc_passwd", sanitized)

        val windowsPath = "C:\\Windows\\System32\\file.exe"
        val sanitizedWin = HashUtils.sanitizeFileName(windowsPath)
        assertFalse(sanitizedWin.contains(":"))
        assertFalse(sanitizedWin.contains("\\"))
    }

    @Test
    fun testSha256Streaming_calculatesAccurateHash() {
        val sampleData = "WiFiShare Direct Transfer Protocol Payload".toByteArray(Charsets.UTF_8)
        val inputStream = ByteArrayInputStream(sampleData)
        val hash = HashUtils.calculateSha256(inputStream)

        assertNotNull(hash)
        assertEquals(64, hash.length) // SHA-256 hex string is 64 characters
    }

    @Test
    fun testTransferRequestSerialization() {
        val json = Json { ignoreUnknownKeys = true }
        val request = TransferRequest(
            sessionId = "sess_12345",
            senderName = "Pixel 9 Pro",
            files = listOf(
                FileTransferItem(
                    id = "file_1",
                    name = "vacation_video.mp4",
                    size = 104857600L,
                    mimeType = "video/mp4"
                )
            ),
            totalBytes = 104857600L
        )

        val encoded = json.encodeToString(request)
        assertTrue(encoded.contains("sess_12345"))
        assertTrue(encoded.contains("vacation_video.mp4"))

        val decoded: TransferRequest = json.decodeFromString(encoded)
        assertEquals(request.sessionId, decoded.sessionId)
        assertEquals(1, decoded.files.size)
        assertEquals(request.totalBytes, decoded.totalBytes)
    }

    @Test
    fun testBrowserSessionExpiry() {
        val session = BrowserSession(
            token = "browser_tok_abc",
            senderName = "Galaxy S24",
            files = emptyList(),
            totalBytes = 0L,
            createdAt = System.currentTimeMillis(),
            expiresAt = System.currentTimeMillis() + 60000
        )
        assertFalse(System.currentTimeMillis() > session.expiresAt)
    }
}
