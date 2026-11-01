package com.wifishare.local.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log
import com.wifishare.local.data.model.DEFAULT_SERVER_PORT
import com.wifishare.local.data.model.DeviceInfo
import com.wifishare.local.data.model.DeviceType
import com.wifishare.local.data.model.NSD_SERVICE_TYPE
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class NsdDiscoveryManager(private val context: Context) {

    private val tag = "NsdDiscoveryManager"
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

    private val _discoveredDevices = MutableStateFlow<Map<String, DeviceInfo>>(emptyMap())
    val discoveredDevices: StateFlow<Map<String, DeviceInfo>> = _discoveredDevices.asStateFlow()

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var registeredServiceName: String? = null

    /**
     * Registers this device's receiving service via mDNS.
     */
    fun startAdvertising(deviceName: String, port: Int = DEFAULT_SERVER_PORT) {
        if (_isAdvertising.value) return

        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "WiFiShare-$deviceName"
            serviceType = NSD_SERVICE_TYPE
            setPort(port)
        }

        registrationListener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                registeredServiceName = serviceInfo.serviceName
                _isAdvertising.value = true
                Log.d(tag, "NSD Service registered: ${serviceInfo.serviceName} on port $port")
            }

            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(tag, "NSD Registration failed with error: $errorCode")
                _isAdvertising.value = false
            }

            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                _isAdvertising.value = false
                Log.d(tag, "NSD Service unregistered successfully")
            }

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(tag, "NSD Unregistration failed: $errorCode")
            }
        }

        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
        } catch (e: Exception) {
            Log.e(tag, "Failed to register NSD service", e)
        }
    }

    /**
     * Stops advertising the receiving service.
     */
    fun stopAdvertising() {
        if (!_isAdvertising.value || registrationListener == null) return
        try {
            nsdManager.unregisterService(registrationListener)
        } catch (e: Exception) {
            Log.e(tag, "Error unregistering service", e)
        } finally {
            registrationListener = null
            registeredServiceName = null
            _isAdvertising.value = false
        }
    }

    /**
     * Starts discovering other WiFi Share devices on the local network.
     */
    fun startDiscovery() {
        if (_isDiscovering.value) return

        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(tag, "Discovery failed to start: $errorCode")
                _isDiscovering.value = false
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(tag, "Discovery failed to stop: $errorCode")
            }

            override fun onDiscoveryStarted(serviceType: String) {
                _isDiscovering.value = true
                Log.d(tag, "NSD Discovery started for $serviceType")
            }

            override fun onDiscoveryStopped(serviceType: String) {
                _isDiscovering.value = false
                Log.d(tag, "NSD Discovery stopped")
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                Log.d(tag, "Service found: ${serviceInfo.serviceName}")
                // Ignore self
                if (serviceInfo.serviceName == registeredServiceName) return

                if (serviceInfo.serviceType.contains("wifishare")) {
                    resolveService(serviceInfo)
                }
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                Log.d(tag, "Service lost: ${serviceInfo.serviceName}")
                _discoveredDevices.update { current ->
                    current.filterValues { it.name != serviceInfo.serviceName.removePrefix("WiFiShare-") }
                }
            }
        }

        try {
            nsdManager.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
        } catch (e: Exception) {
            Log.e(tag, "Failed to initiate discovery", e)
        }
    }

    private fun resolveService(serviceInfo: NsdServiceInfo) {
        val resolveListener = object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(tag, "Resolve failed for ${serviceInfo.serviceName}: $errorCode")
            }

            override fun onServiceResolved(resolvedInfo: NsdServiceInfo) {
                val host = resolvedInfo.host?.hostAddress ?: return
                val port = resolvedInfo.port
                val rawName = resolvedInfo.serviceName
                val cleanName = rawName.removePrefix("WiFiShare-")

                val device = DeviceInfo(
                    id = "$host:$port",
                    name = cleanName,
                    ipAddress = host,
                    port = port,
                    deviceType = DeviceType.PHONE,
                    isAvailable = true,
                    lastSeenTimestamp = System.currentTimeMillis()
                )

                _discoveredDevices.update { current ->
                    current + (device.id to device)
                }
            }
        }

        try {
            nsdManager.resolveService(serviceInfo, resolveListener)
        } catch (e: Exception) {
            Log.e(tag, "Error resolving service", e)
        }
    }

    /**
     * Stops active device discovery.
     */
    fun stopDiscovery() {
        if (!_isDiscovering.value || discoveryListener == null) return
        try {
            nsdManager.stopServiceDiscovery(discoveryListener)
        } catch (e: Exception) {
            Log.e(tag, "Error stopping discovery", e)
        } finally {
            discoveryListener = null
            _isDiscovering.value = false
        }
    }

    /**
     * Manually adds a device via direct IP/Port or QR code scan.
     */
    fun addManualDevice(name: String, ipAddress: String, port: Int = DEFAULT_SERVER_PORT) {
        val id = "$ipAddress:$port"
        val device = DeviceInfo(
            id = id,
            name = name.ifEmpty { "Manual Device ($ipAddress)" },
            ipAddress = ipAddress,
            port = port,
            deviceType = DeviceType.PHONE,
            isAvailable = true
        )
        _discoveredDevices.update { it + (id to device) }
    }
}
