package com.wifishare.local.browser

import com.wifishare.local.core.security.HashUtils
import com.wifishare.local.data.model.BrowserSession
import com.wifishare.local.data.model.FileTransferItem
import java.net.URLEncoder

object BrowserPortal {

    private fun formatBytes(bytes: Long): String {
        return when {
            bytes >= 1024 * 1024 * 1024 -> "%.2f GB".format(bytes / (1024.0 * 1024.0 * 1024.0))
            bytes >= 1024 * 1024 -> "%.2f MB".format(bytes / (1024.0 * 1024.0))
            bytes >= 1024 -> "%.1f KB".format(bytes / 1024.0)
            else -> "$bytes B"
        }
    }

    private fun getFileCategoryIcon(mimeType: String, fileName: String): String {
        val lowerMime = mimeType.lowercase()
        val ext = fileName.substringAfterLast('.', "").lowercase()
        return when {
            lowerMime.startsWith("image/") || ext in listOf("jpg", "jpeg", "png", "webp", "gif", "svg") -> "🖼️"
            lowerMime.startsWith("video/") || ext in listOf("mp4", "mkv", "mov", "avi", "webm") -> "🎬"
            lowerMime.startsWith("audio/") || ext in listOf("mp3", "wav", "m4a", "flac", "ogg") -> "🎵"
            lowerMime.contains("pdf") || ext == "pdf" -> "📄"
            lowerMime.contains("zip") || lowerMime.contains("tar") || ext in listOf("zip", "rar", "7z", "tar", "gz") -> "📦"
            lowerMime.startsWith("text/") || ext in listOf("txt", "md", "json", "xml", "csv") -> "📝"
            ext in listOf("apk", "aab") -> "📱"
            else -> "📁"
        }
    }

    /**
     * Builds responsive, self-contained HTML/CSS/JS served directly to any mobile browser.
     * Contains zero external dependencies, CDN links, or internet requirements.
     */
    fun buildPortalHtml(session: BrowserSession): String {
        val totalFormatted = formatBytes(session.totalBytes)
        val filesCount = session.files.size
        val safeSender = session.senderName.replace("<", "&lt;").replace(">", "&gt;")

        val filesJsonArray = session.files.joinToString(separator = ",", prefix = "[", postfix = "]") { file ->
            val safeName = HashUtils.sanitizeFileName(file.name).replace("\"", "\\\"")
            """{"id":"${file.id}","name":"$safeName","size":${file.size},"sizeStr":"${formatBytes(file.size)}","mime":"${file.mimeType}"}"""
        }

        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#090d16">
    <title>WiFi Share – Incoming Files</title>
    <style>
        :root {
            --bg-color: #090d16;
            --surface-color: #131b2e;
            --surface-card: #1c2742;
            --surface-border: #2a3b63;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --success: #10b981;
            --success-dark: #059669;
            --danger: #ef4444;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: var(--font-family);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }

        .container {
            width: 100%;
            max-width: 460px;
            background: var(--surface-color);
            border: 1px solid var(--surface-border);
            border-radius: 20px;
            padding: 24px 20px;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
        }

        .brand-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--surface-border);
        }

        .brand-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .brand-title {
            font-size: 19px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.3px;
        }

        .brand-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            padding: 2px 8px;
            border-radius: 999px;
            margin-top: 2px;
        }

        .info-card {
            background: var(--surface-card);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 18px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 14px;
        }

        .info-row:last-child {
            margin-bottom: 0;
        }

        .info-label {
            color: var(--text-muted);
        }

        .info-value {
            color: var(--text-main);
            font-weight: 600;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }

        .file-list {
            max-height: 250px;
            overflow-y: auto;
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 2px;
        }

        .file-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--surface-card);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 12px;
            gap: 12px;
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            flex: 1;
        }

        .file-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .file-details {
            min-width: 0;
            flex: 1;
        }

        .file-name {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .file-meta {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 20px;
            font-size: 15px;
            font-weight: 600;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            user-select: none;
        }

        .btn:active {
            transform: scale(0.98);
        }

        .btn-success {
            background: var(--success);
            color: #ffffff;
            width: 100%;
        }

        .btn-success:hover {
            background: var(--success-dark);
        }

        .btn-danger {
            background: transparent;
            color: var(--danger);
            border: 1px solid var(--danger);
            width: 100%;
        }

        .btn-primary {
            background: var(--primary);
            color: #ffffff;
            width: 100%;
        }

        .btn-primary:hover {
            background: var(--primary-hover);
        }

        .btn-download-item {
            padding: 8px 14px;
            font-size: 13px;
            background: var(--primary);
            color: #ffffff;
            border-radius: 8px;
            flex-shrink: 0;
        }

        .actions-group {
            display: flex;
            gap: 12px;
        }

        /* Progress Card */
        .progress-box {
            display: none;
            background: var(--surface-card);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 18px;
            border: 1px solid var(--surface-border);
        }

        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            margin-bottom: 8px;
        }

        .progress-bar-container {
            width: 100%;
            height: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 999px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .progress-bar-fill {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #10b981);
            border-radius: 999px;
            transition: width 0.3s ease;
        }

        .progress-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-muted);
        }

        .speed-badge {
            color: #38bdf8;
            font-weight: 600;
        }

        .alert-box {
            display: none;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 16px;
        }

        .alert-danger {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid var(--danger);
            color: #fca5a5;
        }

        .alert-success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid var(--success);
            color: #6ee7b7;
        }

        .footer-info {
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 18px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="brand-header">
            <div class="brand-icon">⚡</div>
            <div>
                <div class="brand-title">WiFi Share</div>
                <div class="brand-badge">● Direct Local Wi-Fi</div>
            </div>
        </div>

        <!-- Sender & Session Info -->
        <div class="info-card">
            <div class="info-row">
                <span class="info-label">Sender Device</span>
                <span class="info-value">$safeSender</span>
            </div>
            <div class="info-row">
                <span class="info-label">Files Offered</span>
                <span class="info-value">$filesCount file(s)</span>
            </div>
            <div class="info-row">
                <span class="info-label">Total Transfer Size</span>
                <span class="info-value">$totalFormatted</span>
            </div>
            <div class="info-row">
                <span class="info-label">Security</span>
                <span class="info-value" style="color: #34d399;">✓ Verified One-Time Token</span>
            </div>
        </div>

        <div class="section-title">Files to Receive ($filesCount)</div>

        <!-- File List -->
        <div class="file-list">
            ${session.files.joinToString("") { file ->
                val safeName = HashUtils.sanitizeFileName(file.name).replace("<", "&lt;").replace(">", "&gt;")
                val icon = getFileCategoryIcon(file.mimeType, file.name)
                val formattedSize = formatBytes(file.size)
                """
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-icon">$icon</div>
                        <div class="file-details">
                            <div class="file-name" title="$safeName">$safeName</div>
                            <div class="file-meta">$formattedSize</div>
                        </div>
                    </div>
                    <a id="btn_file_${file.id}" 
                       class="btn btn-download-item" 
                       style="display: none;" 
                       href="/api/v1/browser/download/${session.token}/${file.id}" 
                       download="$safeName"
                       onclick="startFileDownload('${file.id}')">
                       Download
                    </a>
                </div>
                """
            }}
        </div>

        <!-- Alert messages -->
        <div id="alertBox" class="alert-box"></div>

        <!-- Live Progress Box (Shown after approval) -->
        <div id="progressBox" class="progress-box">
            <div class="progress-header">
                <span id="progressTitle" style="font-weight: 600;">Preparing transfer...</span>
                <span id="progressPercent" style="font-weight: 700; color: #38bdf8;">0%</span>
            </div>
            <div class="progress-bar-container">
                <div id="progressBarFill" class="progress-bar-fill"></div>
            </div>
            <div class="progress-meta">
                <span id="transferredBytesLabel">0 MB / $totalFormatted</span>
                <span id="speedLabel" class="speed-badge">⚡ 0 MB/s</span>
            </div>
        </div>

        <!-- Pre-Approval Decision Actions -->
        <div id="decisionActions" class="actions-group">
            <button class="btn btn-danger" onclick="rejectSession()">Decline</button>
            <button class="btn btn-success" onclick="acceptSession()">Accept & Receive</button>
        </div>

        <!-- Post-Approval Actions (Downloads) -->
        <div id="approvedActions" style="display: none; flex-direction: column; gap: 10px;">
            <button id="btnDownloadAll" class="btn btn-primary" onclick="downloadAllFiles()">
                ⬇ Download All Files ($filesCount)
            </button>
            <div style="font-size: 12px; color: var(--text-muted); text-align: center;">
                Tap individual "Download" buttons above, or download all sequentially.
            </div>
        </div>

        <div class="footer-info">
            Direct peer-to-peer Wi-Fi transfer. No internet connection or cellular data required.
        </div>
    </div>

    <script>
        const token = "${session.token}";
        const totalSessionBytes = ${session.totalBytes};
        const filesList = $filesJsonArray;
        let isApproved = ${session.isApproved};
        let isRejected = ${session.isRejected};
        let progressInterval = null;

        function formatBytes(bytes) {
            if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
            if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
            if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return bytes + ' B';
        }

        async function acceptSession() {
            try {
                const res = await fetch('/api/v1/browser/accept/' + token, { method: 'POST' });
                if (res.ok) {
                    onApproved();
                } else {
                    showAlert('Session expired or unavailable.', 'danger');
                }
            } catch (e) {
                showAlert('Connection error: ' + e.message, 'danger');
            }
        }

        async function rejectSession() {
            try {
                await fetch('/api/v1/browser/reject/' + token, { method: 'POST' });
                document.getElementById('decisionActions').style.display = 'none';
                showAlert('You declined this transfer. The sender has been notified.', 'danger');
            } catch (e) {
                // Ignore
            }
        }

        function onApproved() {
            isApproved = true;
            document.getElementById('decisionActions').style.display = 'none';
            document.getElementById('approvedActions').style.display = 'flex';
            document.getElementById('progressBox').style.display = 'block';

            // Show individual download buttons
            filesList.forEach(file => {
                const btn = document.getElementById('btn_file_' + file.id);
                if (btn) btn.style.display = 'inline-flex';
            });

            showAlert('Transfer approved! Click below to download your files.', 'success');
            startProgressPolling();
        }

        function showAlert(msg, type) {
            const box = document.getElementById('alertBox');
            box.innerText = msg;
            box.className = 'alert-box alert-' + type;
            box.style.display = 'block';
        }

        function startProgressPolling() {
            if (progressInterval) clearInterval(progressInterval);
            progressInterval = setInterval(async () => {
                try {
                    const res = await fetch('/api/v1/browser/progress/' + token);
                    if (res.ok) {
                        const data = await res.json();
                        updateProgressUI(data);
                    }
                } catch (e) {
                    // Poll silently
                }
            }, 600);
        }

        function updateProgressUI(data) {
            if (data.isCancelled) {
                showAlert('Session was cancelled by the sender.', 'danger');
                if (progressInterval) clearInterval(progressInterval);
                return;
            }

            const title = document.getElementById('progressTitle');
            const percent = document.getElementById('progressPercent');
            const fill = document.getElementById('progressBarFill');
            const bytesLabel = document.getElementById('transferredBytesLabel');
            const speedLabel = document.getElementById('speedLabel');

            if (data.bytesTransferred > 0 && data.totalFileBytes > 0) {
                const pct = Math.min(100, Math.round((data.bytesTransferred / data.totalFileBytes) * 100));
                title.innerText = 'Transferring ' + (data.currentFileName || 'file') + '...';
                percent.innerText = pct + '%';
                fill.style.width = pct + '%';
                bytesLabel.innerText = formatBytes(data.bytesTransferred) + ' / ' + formatBytes(data.totalFileBytes);
                
                const speedMb = (data.speedBytesPerSec / (1024 * 1024)).toFixed(1);
                speedLabel.innerText = '⚡ ' + speedMb + ' MB/s';
            }

            if (data.isCompleted) {
                title.innerText = '✓ Download completed';
                percent.innerText = '100%';
                fill.style.width = '100%';
                speedLabel.innerText = 'Finished';
            }
        }

        function startFileDownload(fileId) {
            // Triggered when user taps an individual file
            const file = filesList.find(f => f.id === fileId);
            if (file) {
                document.getElementById('progressTitle').innerText = 'Downloading ' + file.name + '...';
            }
        }

        async function downloadAllFiles() {
            const btn = document.getElementById('btnDownloadAll');
            btn.disabled = true;
            btn.innerText = 'Downloading files sequentially...';

            for (let i = 0; i < filesList.length; i++) {
                const file = filesList[i];
                document.getElementById('progressTitle').innerText = 'Downloading (' + (i + 1) + '/' + filesList.length + '): ' + file.name;
                
                // Trigger download
                const link = document.createElement('a');
                link.href = '/api/v1/browser/download/' + token + '/' + file.id;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Small delay to allow mobile browser to process download stream without blocking popups
                if (i < filesList.length - 1) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            btn.disabled = false;
            btn.innerText = '✓ Download Triggered';
        }

        // Initialize state if already approved
        if (isApproved) {
            onApproved();
        } else if (isRejected) {
            document.getElementById('decisionActions').style.display = 'none';
            showAlert('You declined this transfer.', 'danger');
        }
    </script>
</body>
</html>
        """.trimIndent()
    }
}
