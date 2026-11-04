package com.wifishare.local.core.permissions

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

class PermissionManager(private val context: Context) {

    /**
     * Determines required runtime permissions based on device Android OS version.
     */
    fun getRequiredPermissions(): List<String> {
        val permissions = mutableListOf<String>()

        // Android 13+ (API 33+) requires NEARBY_WIFI_DEVICES for local device networking
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        return permissions
    }

    /**
     * Checks if all mandatory permissions are granted.
     */
    fun hasAllRequiredPermissions(): Boolean {
        return getRequiredPermissions().all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Explains why a permission is necessary.
     */
    fun getPermissionRationale(permission: String): String {
        return when (permission) {
            Manifest.permission.NEARBY_WIFI_DEVICES ->
                "Required to discover and connect to other WiFi Share devices on your local network without accessing your GPS location."
            Manifest.permission.POST_NOTIFICATIONS ->
                "Required to display persistent transfer progress and notify you when file transfers complete."
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_EXTERNAL_STORAGE ->
                "Required to access and share photos, videos, and files from your Gallery."
            else -> "Required for local network file transfer."
        }
    }
}
