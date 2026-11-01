package com.wifishare.local.discovery

import com.wifishare.local.data.model.DeviceInfo
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class DiscoveryRepository(private val nsdManager: NsdDiscoveryManager) {

    val discoveredDevicesList: Flow<List<DeviceInfo>> = nsdManager.discoveredDevices.map { map ->
        map.values.toList().sortedByDescending { it.lastSeenTimestamp }
    }

    val isScanning: Flow<Boolean> = nsdManager.isDiscovering
    val isAdvertising: Flow<Boolean> = nsdManager.isAdvertising

    fun startScanning() = nsdManager.startDiscovery()
    fun stopScanning() = nsdManager.stopDiscovery()

    fun startAdvertising(deviceName: String, port: Int) = nsdManager.startAdvertising(deviceName, port)
    fun stopAdvertising() = nsdManager.stopAdvertising()

    fun addManualDevice(name: String, ip: String, port: Int) = nsdManager.addManualDevice(name, ip, port)
}
