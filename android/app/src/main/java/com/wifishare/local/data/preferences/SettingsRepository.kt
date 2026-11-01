package com.wifishare.local.data.preferences

import android.content.Context
import android.os.Build
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "wifi_share_settings")

data class AppSettings(
    val deviceName: String,
    val autoDisableReceive: Boolean,
    val maxConcurrentTransfers: Int,
    val requireApprovalAlways: Boolean
)

class SettingsRepository(private val context: Context) {

    private object PreferencesKeys {
        val DEVICE_NAME = stringPreferencesKey("device_name")
        val AUTO_DISABLE_RECEIVE = booleanPreferencesKey("auto_disable_receive")
        val MAX_CONCURRENT_TRANSFERS = intPreferencesKey("max_concurrent_transfers")
        val REQUIRE_APPROVAL_ALWAYS = booleanPreferencesKey("require_approval_always")
    }

    private val defaultDeviceName: String
        get() = "${Build.MANUFACTURER.capitalize()} ${Build.MODEL}"

    val settingsFlow: Flow<AppSettings> = context.dataStore.data.map { preferences ->
        AppSettings(
            deviceName = preferences[PreferencesKeys.DEVICE_NAME] ?: defaultDeviceName,
            autoDisableReceive = preferences[PreferencesKeys.AUTO_DISABLE_RECEIVE] ?: false,
            maxConcurrentTransfers = preferences[PreferencesKeys.MAX_CONCURRENT_TRANSFERS] ?: 3,
            requireApprovalAlways = preferences[PreferencesKeys.REQUIRE_APPROVAL_ALWAYS] ?: true
        )
    }

    suspend fun updateDeviceName(name: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.DEVICE_NAME] = name.trim()
        }
    }

    suspend fun updateAutoDisableReceive(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_DISABLE_RECEIVE] = enabled
        }
    }

    suspend fun updateMaxConcurrentTransfers(count: Int) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.MAX_CONCURRENT_TRANSFERS] = count.coerceIn(1, 5)
        }
    }
}
