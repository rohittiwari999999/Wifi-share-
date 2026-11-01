package com.wifishare.local.app

import android.app.Application
import com.wifishare.local.core.network.NetworkStateMonitor
import com.wifishare.local.core.storage.StorageManager
import com.wifishare.local.data.database.AppDatabase
import com.wifishare.local.data.preferences.SettingsRepository
import com.wifishare.local.discovery.DiscoveryRepository
import com.wifishare.local.discovery.NsdDiscoveryManager
import com.wifishare.local.transfer.TransferManager

class WiFiShareApplication : Application() {

    lateinit var database: AppDatabase private set
    lateinit var settingsRepository: SettingsRepository private set
    lateinit var storageManager: StorageManager private set
    lateinit var networkMonitor: NetworkStateMonitor private set
    lateinit var nsdManager: NsdDiscoveryManager private set
    lateinit var discoveryRepository: DiscoveryRepository private set
    lateinit var transferManager: TransferManager private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getDatabase(this)
        settingsRepository = SettingsRepository(this)
        storageManager = StorageManager(this)
        networkMonitor = NetworkStateMonitor(this).apply { startMonitoring() }
        nsdManager = NsdDiscoveryManager(this)
        discoveryRepository = DiscoveryRepository(nsdManager)
        transferManager = TransferManager(
            this,
            storageManager,
            database,
            settingsRepository,
            networkMonitor,
            nsdManager
        )
    }

    override fun onTerminate() {
        super.onTerminate()
        networkMonitor.stopMonitoring()
        transferManager.disableReceiveMode()
        transferManager.stopBrowserSession()
    }
}
