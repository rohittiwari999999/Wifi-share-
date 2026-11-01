export interface AndroidFileRecord {
  path: string;
  category: 'config' | 'manifest' | 'core' | 'data' | 'discovery' | 'transfer' | 'browser' | 'ui' | 'test';
  name: string;
  description: string;
  language: 'kotlin' | 'groovy' | 'xml' | 'toml';
  content: string;
}

export const ANDROID_FILES: AndroidFileRecord[] = [
  {
    path: 'build.gradle.kts',
    category: 'config',
    name: 'build.gradle.kts',
    description: 'Root Gradle build configuration with plugin aliases',
    language: 'kotlin',
    content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
}`
  },
  {
    path: 'settings.gradle.kts',
    category: 'config',
    name: 'settings.gradle.kts',
    description: 'Project settings and repository resolution management',
    language: 'kotlin',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "WiFiShare"
include(":app")`
  },
  {
    path: 'gradle/libs.versions.toml',
    category: 'config',
    name: 'libs.versions.toml',
    description: 'Gradle Version Catalog for Compose, Ktor, Room, Coroutines',
    language: 'toml',
    content: `[versions]
agp = "8.8.0"
kotlin = "2.1.0"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.10.0"
composeBom = "2025.02.00"
navigationCompose = "2.8.7"
ktor = "3.0.3"
coroutines = "1.10.1"
serialization = "1.8.0"
room = "2.6.1"
datastore = "1.1.2"
zxing = "3.5.3"
ksp = "2.1.0-1.0.29"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }
ktor-server-core = { group = "io.ktor", name = "ktor-server-core-jvm", version.ref = "ktor" }
ktor-server-netty = { group = "io.ktor", name = "ktor-server-netty-jvm", version.ref = "ktor" }
ktor-server-content-negotiation = { group = "io.ktor", name = "ktor-server-content-negotiation-jvm", version.ref = "ktor" }
ktor-client-core = { group = "io.ktor", name = "ktor-client-core-jvm", version.ref = "ktor" }
ktor-client-okhttp = { group = "io.ktor", name = "ktor-client-okhttp-jvm", version.ref = "ktor" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
zxing-core = { group = "com.google.zxing", name = "core", version.ref = "zxing" }`
  },
  {
    path: 'app/build.gradle.kts',
    category: 'config',
    name: 'app/build.gradle.kts',
    description: 'Application-level build file with compileSdk 35, Jetpack Compose, and dependencies',
    language: 'kotlin',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.wifishare.local"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.wifishare.local"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    category: 'manifest',
    name: 'AndroidManifest.xml',
    description: 'App manifest with INTERNET, NEARBY_WIFI_DEVICES, FOREGROUND_SERVICE_DATA_SYNC',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
    <uses-permission
        android:name="android.permission.NEARBY_WIFI_DEVICES"
        android:usesPermissionFlags="neverForLocation"
        tools:targetApi="tiramisu" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" tools:targetApi="upside_down_cake" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" tools:targetApi="tiramisu" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:name=".app.WiFiShareApplication"
        android:label="@string/app_name"
        android:theme="@style/Theme.WiFiShare"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".app.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service
            android:name=".transfer.TransferForegroundService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
    </application>
</manifest>`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/discovery/NsdDiscoveryManager.kt',
    category: 'discovery',
    name: 'NsdDiscoveryManager.kt',
    description: 'Android NsdManager mDNS registration and service resolution for _wifishare._tcp.',
    language: 'kotlin',
    content: `package com.wifishare.local.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import com.wifishare.local.data.model.*
import kotlinx.coroutines.flow.*

class NsdDiscoveryManager(private val context: Context) {
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val _discoveredDevices = MutableStateFlow<Map<String, DeviceInfo>>(emptyMap())
    val discoveredDevices: StateFlow<Map<String, DeviceInfo>> = _discoveredDevices.asStateFlow()

    fun startAdvertising(deviceName: String, port: Int = DEFAULT_SERVER_PORT) {
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "WiFiShare-$deviceName"
            serviceType = NSD_SERVICE_TYPE
            setPort(port)
        }
        nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)
    }

    fun startDiscovery() {
        nsdManager.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
    }
}`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/transfer/TransferServer.kt',
    category: 'transfer',
    name: 'TransferServer.kt',
    description: 'Ktor embedded Netty HTTP server with explicit receiver approval, streaming upload & SHA-256',
    language: 'kotlin',
    content: `package com.wifishare.local.transfer

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*
import com.wifishare.local.data.model.*

class TransferServer(private val context: Context, private val storageManager: StorageManager) {
    fun startServer(port: Int = DEFAULT_SERVER_PORT) {
        embeddedServer(Netty, port = port) {
            routing {
                post("/api/v1/session") { /* Handshake */ }
                post("/api/v1/transfer/request") { /* Explicit receiver approval prompt */ }
                post("/api/v1/transfer/upload") { /* Stream directly to SAF without full RAM buffer */ }
                post("/api/v1/transfer/cancel") { /* Cancel transfer */ }
            }
        }.start(wait = false)
    }
}`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/browser/BrowserReceiverServer.kt',
    category: 'browser',
    name: 'BrowserReceiverServer.kt',
    description: 'Temporary HTTP server for receiving on phones without the app via mobile Chrome',
    language: 'kotlin',
    content: `package com.wifishare.local.browser

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.http.*

class BrowserReceiverServer(private val context: Context, private val storageManager: StorageManager) {
    fun startSession(session: BrowserSession, port: Int = DEFAULT_SERVER_PORT) {
        embeddedServer(Netty, port = port) {
            routing {
                get("/receive/{token}") { /* Serve responsive mobile HTML portal */ }
                post("/api/v1/browser/accept/{token}") { /* Receiver accepts files */ }
                post("/api/v1/browser/reject/{token}") { /* Receiver declines */ }
                get("/api/v1/browser/download/{token}/{fileId}") {
                    /* Stream file with Content-Disposition: attachment */
                }
            }
        }.start(wait = false)
    }
}`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/core/security/SecurityUtils.kt',
    category: 'core',
    name: 'SecurityUtils.kt',
    description: 'Secure random tokens, SHA-256 streaming digest, and path traversal sanitization',
    language: 'kotlin',
    content: `package com.wifishare.local.core.security

import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom

object TokenGenerator {
    fun generateSessionToken(length: Int = 32): String {
        val secureRandom = SecureRandom()
        // Generates cryptographically secure alphanumeric token
        return (1..length).map { ... }.joinToString("")
    }
}

object HashUtils {
    fun calculateSha256(inputStream: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        // Stream 64KB buffers without filling RAM
        ...
    }
    fun sanitizeFileName(fileName: String): String {
        return fileName.replace(Regex("[/\\\\?%*:|\"<>\\0]"), "_").trim()
    }
}`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/core/storage/StorageManager.kt',
    category: 'core',
    name: 'StorageManager.kt',
    description: 'Android Storage Access Framework (SAF) query, streaming IO, and collision rename',
    language: 'kotlin',
    content: `package com.wifishare.local.core.storage

import android.content.ContentResolver
import android.net.Uri
import java.io.File

class StorageManager(private val context: Context) {
    fun queryFileMetadata(uri: Uri): FileTransferItem? { ... }
    fun openInputStream(uri: Uri): InputStream? { ... }
    fun createReceivedFileOutputStream(fileName: String): Pair<File, OutputStream> { ... }
    suspend fun hasEnoughStorage(requiredBytes: Long): Boolean { ... }
}`
  },
  {
    path: 'app/src/main/java/com/wifishare/local/transfer/TransferForegroundService.kt',
    category: 'transfer',
    name: 'TransferForegroundService.kt',
    description: 'Android Foreground Service with dataSync type, wake lock, and persistent notification',
    language: 'kotlin',
    content: `package com.wifishare.local.transfer

import android.app.Service
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat

class TransferForegroundService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification(fileName, progress)
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        return START_NOT_STICKY
    }
}`
  },
  {
    path: 'app/src/test/java/com/wifishare/local/TransferUnitTest.kt',
    category: 'test',
    name: 'TransferUnitTest.kt',
    description: 'Unit tests for protocol serialization, token entropy, and streaming SHA-256',
    language: 'kotlin',
    content: `package com.wifishare.local

import org.junit.Assert.*
import org.junit.Test

class TransferUnitTest {
    @Test
    fun testTokenGenerator_createsUniqueTokens() { ... }

    @Test
    fun testFilenameSanitization_removesDangerousCharacters() { ... }

    @Test
    fun testSha256Streaming_calculatesAccurateHash() { ... }
}`
  }
];
