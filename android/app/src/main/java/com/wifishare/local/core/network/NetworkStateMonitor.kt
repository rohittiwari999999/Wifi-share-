package com.wifishare.local.core.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.Inet4Address
import java.net.NetworkInterface

data class NetworkIpInfo(
    val ip: String,
    val interfaceName: String,
    val type: String // "Wi-Fi", "Hotspot", "Direct", "Ethernet"
)

data class NetworkStatus(
    val isWifiConnected: Boolean = false,
    val localIpAddress: String? = null,
    val ssid: String? = null,
    val isMulticastLockAcquired: Boolean = false,
    val interfaceName: String? = null,
    val isHotspot: Boolean = false,
    val availableIps: List<NetworkIpInfo> = emptyList()
)

class NetworkStateMonitor(private val context: Context) {

    private val tag = "NetworkStateMonitor"
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val wifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private var multicastLock: WifiManager.MulticastLock? = null

    private val _networkStatus = MutableStateFlow(NetworkStatus())
    val networkStatus: StateFlow<NetworkStatus> = _networkStatus.asStateFlow()

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            updateStatus()
        }

        override fun onLost(network: Network) {
            updateStatus()
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            updateStatus()
        }
    }

    fun startMonitoring() {
        try {
            // Register for network state changes
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            connectivityManager.registerNetworkCallback(request, networkCallback)
        } catch (e: Exception) {
            try {
                connectivityManager.registerDefaultNetworkCallback(networkCallback)
            } catch (ignored: Exception) {
                Log.w(tag, "Could not register default network callback", ignored)
            }
        }

        acquireMulticastLock()
        updateStatus()
    }

    fun stopMonitoring() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (ignored: Exception) {
            // Already unregistered
        }
        releaseMulticastLock()
    }

    private fun acquireMulticastLock() {
        try {
            if (multicastLock == null) {
                multicastLock = wifiManager.createMulticastLock("WiFiShareMulticastLock").apply {
                    setReferenceCounted(true)
                }
            }
            multicastLock?.acquire()
        } catch (ignored: Exception) {
            // Permission or hardware restriction
        }
    }

    private fun releaseMulticastLock() {
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (ignored: Exception) {
            // Ignore
        }
    }

    fun updateStatus() {
        val allIps = getAvailableLocalIpv4Addresses()
        val primary = allIps.firstOrNull()

        val isHotspot = primary?.type == "Hotspot" || primary?.ip?.startsWith("192.168.43.") == true
        val isConnected = primary != null

        _networkStatus.value = NetworkStatus(
            isWifiConnected = isConnected,
            localIpAddress = primary?.ip,
            interfaceName = primary?.interfaceName,
            isHotspot = isHotspot,
            availableIps = allIps,
            isMulticastLockAcquired = multicastLock?.isHeld == true
        )
    }

    /**
     * Scans all network interfaces and extracts valid local IPv4 addresses,
     * strictly prioritizing Wi-Fi and Hotspot over cellular or virtual interfaces.
     */
    fun getAvailableLocalIpv4Addresses(): List<NetworkIpInfo> {
        val result = mutableListOf<NetworkIpInfo>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return emptyList()
            for (intf in interfaces) {
                if (!intf.isUp || intf.isLoopback) continue
                val name = intf.name.lowercase()

                // Exclude carrier cellular and VPN/virtual interfaces
                if (name.startsWith("rmnet") ||
                    name.startsWith("ccmni") ||
                    name.startsWith("pdp") ||
                    name.startsWith("dummy") ||
                    name.startsWith("tun") ||
                    name.startsWith("tap") ||
                    name.startsWith("sit") ||
                    name.startsWith("radio")
                ) {
                    continue
                }

                val type = when {
                    name.startsWith("ap") || name.startsWith("softap") || name.startsWith("swlan") -> "Hotspot"
                    name.startsWith("wlan") -> "Wi-Fi"
                    name.startsWith("p2p") -> "Direct"
                    name.startsWith("eth") || name.startsWith("rndis") -> "Ethernet"
                    else -> "Local"
                }

                val addresses = intf.inetAddresses
                for (addr in addresses) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val hostAddress = addr.hostAddress
                        if (hostAddress != null &&
                            !hostAddress.startsWith("127.") &&
                            !hostAddress.startsWith("169.254.") // link-local autoconf
                        ) {
                            val resolvedType = if (hostAddress.startsWith("192.168.43.") || hostAddress.startsWith("192.168.49.")) {
                                "Hotspot"
                            } else {
                                type
                            }
                            result.add(NetworkIpInfo(hostAddress, intf.name, resolvedType))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Error discovering local IPv4 interfaces", e)
        }

        // Sort: Wi-Fi first, then Hotspot, then Direct, then Ethernet
        return result.sortedBy { item ->
            when (item.type) {
                "Wi-Fi" -> 1
                "Hotspot" -> 2
                "Direct" -> 3
                "Ethernet" -> 4
                else -> 5
            }
        }
    }

    /**
     * Resolves the device's primary local IPv4 address on Wi-Fi or Hotspot.
     */
    fun getLocalIpv4Address(): String? {
        return getAvailableLocalIpv4Addresses().firstOrNull()?.ip
    }
}
