package com.wifishare.local.transfer

import android.content.Context
import com.wifishare.local.browser.BrowserReceiverServer
import com.wifishare.local.core.network.NetworkStateMonitor
import com.wifishare.local.core.security.TokenGenerator
import com.wifishare.local.core.storage.StorageManager
import com.wifishare.local.data.database.AppDatabase
import com.wifishare.local.data.model.*
import com.wifishare.local.data.preferences.SettingsRepository
import com.wifishare.local.discovery.NsdDiscoveryManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class TransferManager(
    private val context: Context,
    private val storageManager: StorageManager,
    private val database: AppDatabase,
    private val settingsRepository: SettingsRepository,
    val networkMonitor: NetworkStateMonitor,
    val nsdManager: NsdDiscoveryManager
) {
    val server = TransferServer(context, storageManager, database)
    val client = TransferClient(context, storageManager, database)
    val browserServer = BrowserReceiverServer(context, storageManager)

    private val scope = CoroutineScope(Dispatchers.Main)

    private val _isReceiveModeActive = MutableStateFlow(false)
    val isReceiveModeActive: StateFlow<Boolean> = _isReceiveModeActive.asStateFlow()

    fun enableReceiveMode(deviceName: String, port: Int = DEFAULT_SERVER_PORT) {
        if (_isReceiveModeActive.value) return
        server.startServer(port)
        nsdManager.startAdvertising(deviceName, port)
        _isReceiveModeActive.value = true
    }

    fun disableReceiveMode() {
        if (!_isReceiveModeActive.value) return
        nsdManager.stopAdvertising()
        server.stopServer()
        _isReceiveModeActive.value = false
    }

    /**
     * Prepares and starts a Browser Receiver session for a recipient without the app.
     */
    fun startBrowserSession(
        senderName: String,
        files: List<FileTransferItem>,
        port: Int = DEFAULT_SERVER_PORT
    ): BrowserSession {
        val token = TokenGenerator.generateSessionToken(16)
        val totalBytes = files.sumOf { it.size }
        val session = BrowserSession(
            token = token,
            senderName = senderName,
            files = files,
            totalBytes = totalBytes
        )
        browserServer.startSession(session, port)
        return session
    }

    fun stopBrowserSession() {
        browserServer.stopSession()
    }
}
