package com.wifishare.local.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.lifecycleScope
import com.wifishare.local.core.permissions.PermissionManager
import com.wifishare.local.data.model.DeviceInfo
import com.wifishare.local.data.model.FileTransferItem
import com.wifishare.local.data.preferences.AppSettings
import com.wifishare.local.ui.browser.BrowserShareModal
import com.wifishare.local.ui.devices.DevicesScreen
import com.wifishare.local.ui.history.HistoryScreen
import com.wifishare.local.ui.home.HomeScreen
import com.wifishare.local.ui.receive.ReceiveScreen
import com.wifishare.local.ui.send.SendScreen
import com.wifishare.local.ui.settings.SettingsScreen
import com.wifishare.local.ui.theme.WiFiShareTheme
import com.wifishare.local.ui.transfer.TransferScreen
import kotlinx.coroutines.launch

enum class Screen(val title: String, val icon: ImageVector) {
    HOME("Home", Icons.Default.Home),
    DEVICES("Devices", Icons.Default.Devices),
    SEND("Send", Icons.Default.Upload),
    RECEIVE("Receive", Icons.Default.Download),
    TRANSFER("Transfer", Icons.Default.Sync),
    HISTORY("History", Icons.Default.History),
    SETTINGS("Settings", Icons.Default.Settings)
}

class MainActivity : ComponentActivity() {

    private val tag = "MainActivity"
    private lateinit var app: WiFiShareApplication
    private lateinit var permissionManager: PermissionManager

    // Shared files state when intent received from Gallery or file picker
    private var pendingIntentUris = mutableStateOf<List<Uri>>(emptyList())

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        if (!allGranted) {
            Log.w(tag, "Some permissions were not granted: $results")
            Toast.makeText(this, "Local network & storage permissions are recommended for full transfer support", Toast.LENGTH_LONG).show()
        } else {
            Log.i(tag, "All requested permissions granted successfully.")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        app = application as WiFiShareApplication
        permissionManager = PermissionManager(this)

        requestNeededPermissions()
        handleIncomingSendIntent(intent)

        setContent {
            WiFiShareTheme {
                val networkStatus by app.networkMonitor.networkStatus.collectAsState()
                val discoveredDevicesMap by app.nsdManager.discoveredDevices.collectAsState()
                val discoveredDevices = discoveredDevicesMap.values.toList()
                val isScanning by app.nsdManager.isDiscovering.collectAsState()
                val isReceiveModeActive by app.transferManager.isReceiveModeActive.collectAsState()
                val pendingRequest by app.transferManager.server.pendingRequest.collectAsState()
                val serverProgress by app.transferManager.server.serverProgress.collectAsState()
                val clientProgress by app.transferManager.client.clientProgress.collectAsState()
                val historyTransfers by app.database.transferDao().getAllTransfers().collectAsState(initial = emptyList())
                val appSettings by app.settingsRepository.settingsFlow.collectAsState(
                    initial = AppSettings("Android Phone", false, 3, true)
                )

                var currentScreen by remember { mutableStateOf(Screen.HOME) }
                var selectedTargetDevice by remember { mutableStateOf<DeviceInfo?>(null) }
                var selectedFiles by remember { mutableStateOf<List<FileTransferItem>>(emptyList()) }

                val activeBrowserSession by app.transferManager.browserServer.currentSession.collectAsState()
                val browserProgress by app.transferManager.browserServer.transferProgress.collectAsState()
                var showBrowserModal by remember { mutableStateOf(false) }

                // Check and process any incoming shared files from Android Gallery
                val incomingUris by pendingIntentUris
                LaunchedEffect(incomingUris) {
                    if (incomingUris.isNotEmpty()) {
                        Log.i(tag, "Processing ${incomingUris.size} incoming intent URIs from Gallery")
                        val items = mutableListOf<FileTransferItem>()
                        for (uri in incomingUris) {
                            try {
                                app.storageManager.queryFileMetadata(uri)?.let { items.add(it) }
                            } catch (t: Throwable) {
                                Log.e(tag, "Error processing incoming intent URI: $uri", t)
                            }
                        }
                        if (items.isNotEmpty()) {
                            selectedFiles = selectedFiles + items
                            currentScreen = Screen.SEND
                            Log.i(tag, "Added ${items.size} files from Gallery intent. Navigated to SEND screen.")
                        }
                        pendingIntentUris.value = emptyList()
                    }
                }

                // File picker for Browser Share workflow
                val browserFilePicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.OpenMultipleDocuments()
                ) { uris ->
                    Log.i(tag, "browserFilePicker callback received ${uris.size} URIs")
                    if (uris.isNotEmpty()) {
                        val items = mutableListOf<FileTransferItem>()
                        for (uri in uris) {
                            try {
                                Log.d(tag, "browserFilePicker extracting metadata for: $uri")
                                app.storageManager.queryFileMetadata(uri)?.let { items.add(it) }
                            } catch (t: Throwable) {
                                Log.e(tag, "FATAL error in browserFilePicker for URI: $uri", t)
                            }
                        }

                        if (items.isNotEmpty()) {
                            Log.i(tag, "browserFilePicker: successfully extracted ${items.size} items. Launching Browser Share session.")
                            selectedFiles = items
                            app.transferManager.startBrowserSession(appSettings.deviceName, items)
                            showBrowserModal = true
                        } else {
                            Log.w(tag, "browserFilePicker: 0 items extracted from ${uris.size} URIs")
                            Toast.makeText(this@MainActivity, "Could not open selected files", Toast.LENGTH_SHORT).show()
                        }
                    }
                }

                // Auto-switch to transfer screen when active transfer starts
                val activeProgress = clientProgress ?: serverProgress
                LaunchedEffect(activeProgress) {
                    if (activeProgress != null && currentScreen != Screen.TRANSFER) {
                        currentScreen = Screen.TRANSFER
                    }
                }

                // Automatically ensure local transfer server and discovery are active
                LaunchedEffect(appSettings.deviceName) {
                    app.transferManager.ensureServerRunning(appSettings.deviceName)
                }

                // When user navigates to DEVICES screen, auto-start discovery and advertising
                LaunchedEffect(currentScreen) {
                    if (currentScreen == Screen.DEVICES) {
                        app.transferManager.ensureServerRunning(appSettings.deviceName)
                        app.nsdManager.startDiscovery()
                    }
                }

                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            listOf(Screen.HOME, Screen.DEVICES, Screen.RECEIVE, Screen.HISTORY, Screen.SETTINGS).forEach { screen ->
                                NavigationBarItem(
                                    icon = { Icon(screen.icon, contentDescription = screen.title) },
                                    label = { Text(screen.title) },
                                    selected = currentScreen == screen,
                                    onClick = { currentScreen = screen }
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        when (currentScreen) {
                            Screen.HOME -> HomeScreen(
                                networkStatus = networkStatus,
                                recentTransfers = historyTransfers,
                                onNavigateToSend = { currentScreen = Screen.SEND },
                                onNavigateToReceive = { currentScreen = Screen.RECEIVE },
                                onNavigateToBrowserShare = {
                                    Log.i(tag, "HomeScreen: onNavigateToBrowserShare clicked. Launching browserFilePicker.")
                                    browserFilePicker.launch(arrayOf("*/*"))
                                },
                                onNavigateToDevices = { currentScreen = Screen.DEVICES }
                            )

                            Screen.DEVICES -> DevicesScreen(
                                devices = discoveredDevices,
                                isScanning = isScanning,
                                localIpAddress = networkStatus.localIpAddress,
                                onStartScan = { app.nsdManager.startDiscovery() },
                                onStopScan = { app.nsdManager.stopDiscovery() },
                                onSelectDevice = { device ->
                                    selectedTargetDevice = device
                                    currentScreen = Screen.SEND
                                },
                                onAddManualDevice = { name, ip, port ->
                                    app.nsdManager.addManualDevice(name, ip, port)
                                }
                            )

                            Screen.SEND -> SendScreen(
                                targetDevice = selectedTargetDevice,
                                selectedFiles = selectedFiles,
                                onAddFiles = { uris ->
                                    Log.i(tag, "SendScreen: onAddFiles callback received ${uris.size} URIs: $uris")
                                    val newItems = mutableListOf<FileTransferItem>()
                                    for (uri in uris) {
                                        try {
                                            Log.d(tag, "onAddFiles extracting metadata for URI: $uri")
                                            app.storageManager.queryFileMetadata(uri)?.let { newItems.add(it) }
                                        } catch (t: Throwable) {
                                            Log.e(tag, "FATAL error in onAddFiles for URI: $uri", t)
                                        }
                                    }
                                    if (newItems.isNotEmpty()) {
                                        Log.i(tag, "onAddFiles successfully extracted ${newItems.size} items. Updating selectedFiles.")
                                        selectedFiles = selectedFiles + newItems
                                    } else {
                                        Log.w(tag, "onAddFiles: 0 items extracted.")
                                    }
                                },
                                onRemoveFile = { item ->
                                    selectedFiles = selectedFiles.filter { it.id != item.id }
                                },
                                onClearFiles = { selectedFiles = emptyList() },
                                onSelectTargetDevice = { currentScreen = Screen.DEVICES },
                                onShareToBrowser = {
                                    if (selectedFiles.isNotEmpty()) {
                                        Log.i(tag, "SendScreen: onShareToBrowser with ${selectedFiles.size} files")
                                        app.transferManager.startBrowserSession(appSettings.deviceName, selectedFiles)
                                        showBrowserModal = true
                                    }
                                },
                                onStartTransfer = {
                                    val target = selectedTargetDevice
                                    if (target != null && selectedFiles.isNotEmpty()) {
                                        currentScreen = Screen.TRANSFER
                                        lifecycleScope.launch {
                                            app.transferManager.client.executeTransfer(
                                                targetDevice = target,
                                                senderName = appSettings.deviceName,
                                                files = selectedFiles
                                            )
                                        }
                                    }
                                }
                            )

                            Screen.RECEIVE -> ReceiveScreen(
                                isReceiveModeActive = isReceiveModeActive,
                                deviceName = appSettings.deviceName,
                                networkStatus = networkStatus,
                                pendingRequest = pendingRequest,
                                currentProgress = serverProgress,
                                onToggleReceiveMode = { enabled ->
                                    if (enabled) {
                                        app.transferManager.enableReceiveMode(appSettings.deviceName)
                                    } else {
                                        app.transferManager.disableReceiveMode()
                                    }
                                },
                                onAcceptRequest = { app.transferManager.server.acceptPendingRequest() },
                                onRejectRequest = { app.transferManager.server.rejectPendingRequest() }
                            )

                            Screen.TRANSFER -> TransferScreen(
                                progress = activeProgress,
                                onCancelTransfer = {
                                    // Cancel transfer
                                },
                                onDone = {
                                    selectedFiles = emptyList()
                                    currentScreen = Screen.HOME
                                }
                            )

                            Screen.HISTORY -> HistoryScreen(
                                transfers = historyTransfers,
                                onClearHistory = {
                                    lifecycleScope.launch { app.database.transferDao().clearHistory() }
                                }
                            )

                            Screen.SETTINGS -> SettingsScreen(
                                settings = appSettings,
                                onUpdateDeviceName = { newName ->
                                    lifecycleScope.launch { app.settingsRepository.updateDeviceName(newName) }
                                },
                                onUpdateAutoDisable = { autoDisable ->
                                    lifecycleScope.launch { app.settingsRepository.updateAutoDisableReceive(autoDisable) }
                                }
                            )
                        }
                    }
                }

                if (showBrowserModal && activeBrowserSession != null) {
                    BrowserShareModal(
                        session = activeBrowserSession!!,
                        progress = browserProgress,
                        availableIps = networkStatus.availableIps,
                        onDismiss = {
                            app.transferManager.stopBrowserSession()
                            showBrowserModal = false
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingSendIntent(intent)
    }

    /**
     * Intercepts and parses incoming SEND and SEND_MULTIPLE intents when user shares
     * photos or videos directly from Android Gallery or Photos app.
     */
    private fun handleIncomingSendIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action ?: return
        Log.i(tag, "handleIncomingSendIntent: action=$action, type=${intent.type}")

        val receivedUris = mutableListOf<Uri>()

        if (Intent.ACTION_SEND == action) {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                ?: intent.clipData?.let { if (it.itemCount > 0) it.getItemAt(0)?.uri else null }
            if (uri != null) {
                receivedUris.add(uri)
                Log.i(tag, "Extracted URI from ACTION_SEND: $uri")
            }
        } else if (Intent.ACTION_SEND_MULTIPLE == action) {
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            if (!uris.isNullOrEmpty()) {
                receivedUris.addAll(uris)
                Log.i(tag, "Extracted ${uris.size} URIs from ACTION_SEND_MULTIPLE EXTRA_STREAM")
            } else if (intent.clipData != null) {
                val count = intent.clipData?.itemCount ?: 0
                for (i in 0 until count) {
                    intent.clipData?.getItemAt(i)?.uri?.let { receivedUris.add(it) }
                }
                Log.i(tag, "Extracted ${receivedUris.size} URIs from ACTION_SEND_MULTIPLE clipData")
            }
        }

        if (receivedUris.isNotEmpty()) {
            pendingIntentUris.value = receivedUris
        }
    }

    private fun requestNeededPermissions() {
        val needed = permissionManager.getRequiredPermissions()
        if (needed.isNotEmpty()) {
            Log.d(tag, "Requesting needed runtime permissions: $needed")
            permissionLauncher.launch(needed.toTypedArray())
        }
    }
}
