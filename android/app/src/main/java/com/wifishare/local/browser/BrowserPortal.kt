package com.wifishare.local.browser

import com.wifishare.local.data.model.BrowserSession

object BrowserPortal {

    /**
     * Builds responsive, modern HTML/CSS/JS served directly to Chrome or mobile browsers
     * without internet access or external CDN dependencies.
     */
    fun buildPortalHtml(session: BrowserSession): String {
        val totalMb = "%.2f".format(session.totalBytes / (1024.0 * 1024.0))

        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>WiFi Share – Incoming Files</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { background: #0f172a; color: #f8fafc; padding: 20px; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; width: 100%; max-width: 440px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .logo-icon { width: 44px; height: 44px; border-radius: 10px; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; }
        .subtitle { font-size: 13px; color: #94a3b8; }
        .session-info { background: #0f172a; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 13px; border: 1px solid #334155; }
        .session-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .session-row:last-child { margin-bottom: 0; }
        .label { color: #94a3b8; }
        .value { color: #f8fafc; font-weight: 600; }
        .file-list { margin-bottom: 24px; max-height: 240px; overflow-y: auto; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0f172a; border-radius: 8px; margin-bottom: 8px; border: 1px solid #1e293b; }
        .file-name { font-size: 14px; font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .file-size { font-size: 12px; color: #64748b; }
        .actions { display: flex; gap: 12px; }
        .btn { flex: 1; padding: 14px; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .btn-accept { background: #22c55e; color: #052e16; }
        .btn-accept:hover { background: #16a34a; }
        .btn-reject { background: #ef4444; color: #450a0a; }
        .btn-reject:hover { background: #dc2626; }
        .btn-download { background: #3b82f6; color: #ffffff; width: 100%; text-decoration: none; display: block; text-align: center; margin-top: 8px; }
        .status-msg { text-align: center; margin-top: 16px; font-size: 14px; }
        .footer-note { text-align: center; font-size: 11px; color: #64748b; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card" id="mainCard">
        <div class="header">
            <div class="logo-icon">⚡</div>
            <div>
                <div class="title">WiFi Share</div>
                <div class="subtitle">Direct Local Transfer</div>
            </div>
        </div>

        <div class="session-info">
            <div class="session-row">
                <span class="label">Sender Device:</span>
                <span class="value">${session.senderName}</span>
            </div>
            <div class="session-row">
                <span class="label">Total Files:</span>
                <span class="value">${session.files.size}</span>
            </div>
            <div class="session-row">
                <span class="label">Total Size:</span>
                <span class="value">${totalMb} MB</span>
            </div>
        </div>

        <div class="file-list">
            ${session.files.joinToString("") { file ->
                val sizeMb = "%.2f".format(file.size / (1024.0 * 1024.0))
                """
                <div class="file-item">
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${sizeMb} MB</div>
                    </div>
                </div>
                """
            }}
        </div>

        <div id="actionButtons" class="actions">
            <button class="btn btn-reject" onclick="rejectTransfer()">Decline</button>
            <button class="btn btn-accept" onclick="acceptTransfer()">Accept Files</button>
        </div>

        <div id="downloadsArea" style="display: none;">
            <div style="font-size: 14px; font-weight: 600; color: #4ade80; margin-bottom: 12px; text-align: center;">
                ✓ Transfer approved! Click below to download:
            </div>
            ${session.files.joinToString("") { file ->
                """
                <a class="btn btn-download" href="/api/v1/browser/download/${session.token}/${file.id}" download="${file.name}">
                    Download ${file.name}
                </a>
                """
            }}
        </div>

        <div id="statusMessage" class="status-msg"></div>

        <div class="footer-note">
            Direct peer-to-peer Wi-Fi connection. No internet or external cloud involved.
        </div>
    </div>

    <script>
        async function acceptTransfer() {
            try {
                const res = await fetch('/api/v1/browser/accept/${session.token}', { method: 'POST' });
                if (res.ok) {
                    document.getElementById('actionButtons').style.display = 'none';
                    document.getElementById('downloadsArea').style.display = 'block';
                } else {
                    document.getElementById('statusMessage').innerText = 'Session expired or rejected.';
                }
            } catch (e) {
                document.getElementById('statusMessage').innerText = 'Network error: ' + e.message;
            }
        }

        async function rejectTransfer() {
            try {
                await fetch('/api/v1/browser/reject/${session.token}', { method: 'POST' });
                document.getElementById('actionButtons').style.display = 'none';
                document.getElementById('statusMessage').innerText = 'You declined the transfer.';
                document.getElementById('statusMessage').style.color = '#ef4444';
            } catch (e) {
                // Ignore
            }
        }
    </script>
</body>
</html>
        """.trimIndent()
    }
}
