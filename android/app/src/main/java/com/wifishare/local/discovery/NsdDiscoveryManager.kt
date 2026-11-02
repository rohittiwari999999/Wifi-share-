package com.wifishare.local.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Log
import com.wifishare.local.data.model.DEFAULT_SERVER_PORT
import com.wifishare.local.data.model.DeviceInfo
import com.wifishare.local.data.model.DeviceType
import com.wifishare.local.data.model.NSD_SERVICE_TYPE
import com.wifishare.local.data.model.SessionHandshakeResponse
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.net.URL

class NsdDiscoveryManager(private val context: Context) {

    private val tag = "NsdDiscoveryManager"
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    private val _discoveredDevices = MutableStateFlow<Map<String, DeviceInfo>>(emptyMap())
    val discoveredDevices: StateFlow<Map<String, DeviceInfo>> = _discoveredDevices.asStateFlow()

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var registeredServiceName: String? = null

    // Multicast Lock to prevent Android Wi-Fi driver from dropping mDNS packets
    private var multicastLock: WifiManager.MulticastLock? = null

    // Resolve queue to avoid NsdManager.FAILURE_ALREADY_ACTIVE concurrent resolve crash
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var isResolving = false

    private val discoveryScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var subnetScanJob: Job? = null

    private fun acquireMulticastLock() {
        try {
            if (multicastLock == null && wifiManager != null) {
                multicastLock = wifiManager.createMulticastLock("WiFiShareMulticastLock").apply {
                    setReferenceCounted(true)
                }
            }
            if (multicastLock?.isHeld == false) {
                multicastLock?.acquire()
                Log.d(tag, "Acquired WifiManager MulticastLock")
            }
        } catch (e: Exception) {
            Log.w(tag, "Could not acquire MulticastLock: ${e.message}")
        }
    }

    private fun releaseMulticastLock() {
        try {
            if (multicastLock?.isHeld == true && !_isAdvertising.value && !_isDiscovering.value) {
                multicastLock?.release()
                Log.d(tag, "Released WifiManager MulticastLock")
            }
        } catch (e: Exception) {
            Log.w(tag, "Error releasing MulticastLock: ${e.message}")
        }
    }

    /**
     * Registers this device's receiving service via mDNS.
     */
    fun startAdvertising(deviceName: String, port: Int = DEFAULT_SERVER_PORT) {
        if (_isAdvertising.value) return

        acquireMulticastLock()

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
                releaseMulticastLock()
            }

            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                _isAdvertising.value = false
                Log.d(tag, "NSD Service unregistered successfully")
                releaseMulticastLock()
            }

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(tag, "NSD Unregistration failed: $errorCode")
                releaseMulticastLock()
            }
        }

        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
        } catch (e: Exception) {
            Log.e(tag, "Failed to register NSD service", e)
            _isAdvertising.value = false
            releaseMulticastLock()
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
            releaseMulticastLock()
        }
    }

    /**
     * Starts discovering other WiFi Share devices on the local network via mDNS + fast subnet scan.
     */
    fun startDiscovery() {
        if (_isDiscovering.value) return

        acquireMulticastLock()
        _isDiscovering.value = true

        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(tag, "Discovery failed to start: $errorCode")
                _isDiscovering.value = false
                releaseMulticastLock()
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
                releaseMulticastLock()
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                val serviceName = serviceInfo.serviceName ?: ""
                val serviceType = serviceInfo.serviceType ?: ""
                Log.d(tag, "Service found: name=$serviceName, type=$serviceType")

                // Ignore self
                if (registeredServiceName != null && serviceName == registeredServiceName) return

                val isWiFiShare = serviceType.contains("wifishare", ignoreCase = true) ||
                        serviceName.startsWith("WiFiShare", ignoreCase = true)

                if (isWiFiShare) {
                    queueResolveService(serviceInfo)
                }
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                val lostName = serviceInfo.serviceName ?: ""
                Log.d(tag, "Service lost: $lostName")
                val cleanName = lostName.removePrefix("WiFiShare-")
                _discoveredDevices.update { current ->
                    current.filterValues { it.name != cleanName }
                }
            }
        }

        try {
            nsdManager.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
        } catch (e: Exception) {
            Log.e(tag, "Failed to initiate NSD discovery", e)
        }

        // Parallel fallback: Scan local subnet on port 8945 to handle AP Isolation or mDNS packet drops
        triggerSubnetScan()
    }

    private fun queueResolveService(serviceInfo: NsdServiceInfo) {
        synchronized(resolveQueue) {
            if (!resolveQueue.any { it.serviceName == serviceInfo.serviceName }) {
                resolveQueue.add(serviceInfo)
            }
            if (!isResolving) {
                processNextResolve()
            }
        }
    }

    private fun processNextResolve() {
        val next: NsdServiceInfo?
        synchronized(resolveQueue) {
            next = resolveQueue.removeFirstOrNull()
            isResolving = (next != null)
        }
        if (next == null) return

        try {
            nsdManager.resolveService(next, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    Log.w(tag, "Resolve failed for ${serviceInfo.serviceName}: $errorCode")
                    synchronized(resolveQueue) {
                        isResolving = false
                    }
                    processNextResolve()
                }

                override fun onServiceResolved(resolvedInfo: NsdServiceInfo) {
                    try {
                        val host = resolvedInfo.host?.hostAddress ?: return
                        val port = resolvedInfo.port
                        val rawName = resolvedInfo.serviceName ?: "Unknown"
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
                        Log.d(tag, "Resolved device: ${device.name} at ${device.ipAddress}:${device.port}")
                    } finally {
                        synchronized(resolveQueue) {
                            isResolving = false
                        }
                        processNextResolve()
                    }
                }
            })
        } catch (e: Exception) {
            Log.e(tag, "Exception during resolveService", e)
            synchronized(resolveQueue) {
                isResolving = false
            }
            processNextResolve()
        }
    }

    /**
     * Fast subnet sweep to find peers even when routers block mDNS multicast or enforce AP isolation.
     */
    fun triggerSubnetScan() {
        subnetScanJob?.cancel()
        subnetScanJob = discoveryScope.launch {
            val myIp = getLocalIpv4Address() ?: return@launch
            val dotIndex = myIp.lastIndexOf('.')
            if (dotIndex == -1) return@launch
            val subnetPrefix = myIp.substring(0, dotIndex + 1) // e.g. "192.168.1."

            val json = Json { ignoreUnknownKeys = true }

            (1..254).map { host ->
                async(Dispatchers.IO) {
                    val targetIp = "$subnetPrefix$host"
                    if (targetIp == myIp) return@async

                    // Rapid socket check on default server port
                    var socket: Socket? = null
                    try {
                        socket = Socket()
                        socket.connect(InetSocketAddress(targetIp, DEFAULT_SERVER_PORT), 250)
                        socket.close()

                        // Port open! Now ping HTTP endpoint to get device name
                        val url = URL("http://$targetIp:$DEFAULT_SERVER_PORT/api/v1/ping")
                        val conn = (url.openConnection() as HttpURLConnection).apply {
                            connectTimeout = 500
                            readTimeout = 500
                            requestMethod = "GET"
                            setRequestProperty("Accept", "application/json")
                        }

                        if (conn.responseCode == 200) {
                            val body = conn.inputStream.bufferedReader().use { it.readText() }
                            val response = json.decodeFromString<SessionHandshakeResponse>(body)
                            val peer = DeviceInfo(
                                id = "$targetIp:$DEFAULT_SERVER_PORT",
                                name = response.receiverName.ifBlank { "WiFiShare ($targetIp)" },
                                ipAddress = targetIp,
                                port = DEFAULT_SERVER_PORT,
                                deviceType = DeviceType.PHONE,
                                isAvailable = true,
                                lastSeenTimestamp = System.currentTimeMillis()
                            )
                            _discoveredDevices.update { it + (peer.id to peer) }
                            Log.d(tag, "Subnet probe found peer: ${peer.name} at ${peer.ipAddress}")
                        }
                        conn.disconnect()
                    } catch (e: Exception) {
                        try { socket?.close() } catch (ignored: Exception) {}
                    }
                }
            }.awaitAll()
        }
    }

    private fun getLocalIpv4Address(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            for (intf in interfaces) {
                if (!intf.isUp || intf.isLoopback) continue
                for (addr in intf.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val host = addr.hostAddress
                        if (host != null && !host.startsWith("127.")) {
                            return host
                        }
                    }
                }
            }
        } catch (e: Exception) {}
        return null
    }

    /**
     * Stops active device discovery.
     */
    fun stopDiscovery() {
        subnetScanJob?.cancel()
        subnetScanJob = null
        if (!_isDiscovering.value || discoveryListener == null) return
        try {
            nsdManager.stopServiceDiscovery(discoveryListener)
        } catch (e: Exception) {
            Log.e(tag, "Error stopping discovery", e)
        } finally {
            discoveryListener = null
            _isDiscovering.value = false
            releaseMulticastLock()
        }
    }

    /**
     * Manually adds a device via direct IP/Port or QR code scan.
     */
    fun addManualDevice(name: String, ipAddress: String, port: Int = DEFAULT_SERVER_PORT) {
        val cleanIp = ipAddress.trim()
        val id = "$cleanIp:$port"
        val device = DeviceInfo(
            id = id,
            name = name.ifBlank { "Device ($cleanIp)" },
            ipAddress = cleanIp,
            port = port,
            deviceType = DeviceType.PHONE,
            isAvailable = true,
            lastSeenTimestamp = System.currentTimeMillis()
        )
        _discoveredDevices.update { it + (id to device) }
    }
}
