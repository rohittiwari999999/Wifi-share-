package com.wifishare.local.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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

    private lateinit var app: WiFiShareApplication
    private lateinit var permissionManager: PermissionManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        if (!allGranted) {
            Toast.makeText(this, "Local network permissions are required for discovery", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        app = application as WiFiShareApplication
        permissionManager = PermissionManager(this)

        requestNeededPermissions()

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
                                    // Start browser session flow
                                    currentScreen = Screen.SEND
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
                                    val newItems = uris.mapNotNull { app.storageManager.queryFileMetadata(it) }
                                    selectedFiles = selectedFiles + newItems
                                },
                                onRemoveFile = { item ->
                                    selectedFiles = selectedFiles.filter { it.id != item.id }
                                },
                                onClearFiles = { selectedFiles = emptyList() },
                                onSelectTargetDevice = { currentScreen = Screen.DEVICES },
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
            }
        }
    }

    private fun requestNeededPermissions() {
        val needed = permissionManager.getRequiredPermissions()
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }
}
