package com.wifishare.local.ui.devices

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.wifishare.local.data.model.DeviceInfo

@Composable
fun DevicesScreen(
    devices: List<DeviceInfo>,
    isScanning: Boolean,
    localIpAddress: String?,
    onStartScan: () -> Unit,
    onStopScan: () -> Unit,
    onSelectDevice: (DeviceInfo) -> Unit,
    onAddManualDevice: (name: String, ip: String, port: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    var showManualDialog by remember { mutableStateOf(false) }
    var manualName by remember { mutableStateOf("") }
    var manualIp by remember { mutableStateOf("") }
    var manualPort by remember { mutableStateOf("8945") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Top Controls Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(
                    text = "Nearby Devices",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = if (isScanning) "Searching peers on Wi-Fi subnet..." else "${devices.size} devices discovered",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { showManualDialog = true }) {
                    Icon(
                        imageVector = Icons.Default.AddLink,
                        contentDescription = "Manual IP Connect",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }

                Button(
                    onClick = { if (isScanning) onStopScan() else onStartScan() },
                    modifier = Modifier.defaultMinSize(minWidth = 84.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isScanning) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(
                        imageVector = if (isScanning) Icons.Default.Stop else Icons.Default.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isScanning) "Stop" else "Scan",
                        maxLines = 1,
                        softWrap = false
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Device IP banner
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Wifi,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Your IP: ${localIpAddress ?: "Resolving..."}:8945",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = "Discoverable",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (devices.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.padding(horizontal = 16.dp)
                ) {
                    if (isScanning) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(40.dp)
                        )
                        Text(
                            text = "Scanning mDNS & local subnet on port 8945...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f)
                        )
                        Text(
                            text = "Make sure both phones are connected to the same Wi-Fi network and have this app open.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                            modifier = Modifier.padding(horizontal = 16.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.DevicesOther,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                        Text(
                            text = "No WiFi Share devices found yet",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = "Ensure both phones are on the same Wi-Fi. If your router blocks mDNS (Client Isolation), tap 'Connect by IP' to pair instantly.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                            modifier = Modifier.padding(horizontal = 16.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }

                    OutlinedButton(
                        onClick = { showManualDialog = true },
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AddLink,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Connect by IP Address")
                    }
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(devices) { device ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Smartphone,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(32.dp)
                                )
                                Column {
                                    Text(
                                        text = device.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = "${device.ipAddress}:${device.port}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                    )
                                }
                            }

                            Button(onClick = { onSelectDevice(device) }) {
                                Text("Send")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showManualDialog) {
        AlertDialog(
            onDismissRequest = { showManualDialog = false },
            title = { Text("Connect by IP") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Enter the IP address shown on the other phone's screen:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = manualName,
                        onValueChange = { manualName = it },
                        label = { Text("Device Name (Optional)") },
                        placeholder = { Text("e.g. Pixel, Galaxy, OnePlus") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = manualIp,
                        onValueChange = { manualIp = it },
                        label = { Text("IP Address") },
                        placeholder = { Text("e.g. 192.168.1.50") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = manualPort,
                        onValueChange = { manualPort = it },
                        label = { Text("Port") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    val port = manualPort.toIntOrNull() ?: 8945
                    if (manualIp.isNotBlank()) {
                        onAddManualDevice(manualName, manualIp.trim(), port)
                        showManualDialog = false
                    }
                }) {
                    Text("Add Device")
                }
            },
            dismissButton = {
                TextButton(onClick = { showManualDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
