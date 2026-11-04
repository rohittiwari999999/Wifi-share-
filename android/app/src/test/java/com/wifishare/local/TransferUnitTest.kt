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

    @Test
    fun testBrowserPortalHtml_containsSecurityAndFiles() {
        val testFiles = listOf(
            FileTransferItem(
                id = "doc1",
                name = "quarterly_report.pdf",
                size = 2048576L,
                mimeType = "application/pdf"
            ),
            FileTransferItem(
                id = "img1",
                name = "photo.jpg",
                size = 5242880L,
                mimeType = "image/jpeg"
            )
        )

        val session = BrowserSession(
            token = "sec_token_9876",
            senderName = "Engineering Pixel",
            files = testFiles,
            totalBytes = 7291456L
        )

        val html = com.wifishare.local.browser.BrowserPortal.buildPortalHtml(session)

        // Verify sender and file details are in HTML
        assertTrue("Must contain sender name", html.contains("Engineering Pixel"))
        assertTrue("Must contain file name 1", html.contains("quarterly_report.pdf"))
        assertTrue("Must contain file name 2", html.contains("photo.jpg"))
        assertTrue("Must contain token endpoint", html.contains("sec_token_9876"))
        assertTrue("Must have accept API endpoint", html.contains("/api/v1/browser/accept/"))
        assertTrue("Must have reject API endpoint", html.contains("/api/v1/browser/reject/"))
        assertTrue("Must have download API endpoint", html.contains("/api/v1/browser/download/"))
        assertTrue("Must contain responsive viewport", html.contains("viewport"))
        // Zero external script or font dependencies
        assertFalse("No external CDN scripts", html.contains("https://cdn"))
        assertFalse("No external Google fonts", html.contains("fonts.googleapis.com"))
    }

    @Test
    fun testFileSelectionQueue_handlesSpecialCharactersAndSizes() {
        val rawName = "DCIM/Camera/IMG_20261103_102434:backup<orig>.jpg"
        val cleanName = HashUtils.sanitizeFileName(rawName)

        // Verify all illegal path traversal and filesystem characters are replaced
        assertFalse(cleanName.contains("/"))
        assertFalse(cleanName.contains(":"))
        assertFalse(cleanName.contains("<"))
        assertFalse(cleanName.contains(">"))

        val item = FileTransferItem(
            id = "test_item_1",
            name = cleanName,
            size = 15360000L,
            mimeType = "image/jpeg",
            uriString = "content://media/external/images/media/42"
        )

        assertEquals("test_item_1", item.id)
        assertTrue(item.size > 0L)
        assertEquals("image/jpeg", item.mimeType)
        assertTrue(item.uriString!!.startsWith("content://"))
    }
}
