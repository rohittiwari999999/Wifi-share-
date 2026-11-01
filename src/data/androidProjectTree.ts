export interface AndroidFileRecord {
  path: string;
  category: 'config' | 'manifest' | 'core' | 'data' | 'discovery' | 'transfer' | 'browser' | 'ui' | 'test' | 'cicd';
  name: string;
  description: string;
  language: 'kotlin' | 'groovy' | 'xml' | 'toml' | 'yaml' | 'properties' | 'shell';
  content: string;
}

export const ANDROID_FILES: AndroidFileRecord[] = [
  {
    path: '.github/workflows/build-signed-apk.yml',
    category: 'cicd',
    name: 'build-signed-apk.yml',
    description: 'GitHub Actions workflow to automatically build and sign release APK/AAB and publish GitHub Releases',
    language: 'yaml',
    content: `name: Build & Sign Android APK / AAB

on:
  push:
    branches: [ "main", "master" ]
    tags:
      - 'v*'
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-and-sign:
    name: Build Signed Release APK & AAB
    runs-on: ubuntu-latest
    env:
      KEYSTORE_BASE64: \${{ secrets.KEYSTORE_BASE64 }}
      KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
      KEY_ALIAS: \${{ secrets.KEY_ALIAS }}
      KEY_PASSWORD: \${{ secrets.KEY_PASSWORD }}
      KEYSTORE_FILE: "release.jks"

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'gradle'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.10.2'

      # Auto-detect whether Android project is in root or in android/ subdirectory
      - name: Detect Android Project Directory
        id: detect-dir
        run: |
          if [ -f "build.gradle.kts" ] || [ -f "build.gradle" ]; then
            echo "PROJECT_DIR=." >> $GITHUB_ENV
            echo "Selected project directory: Root (.)"
          elif [ -f "android/build.gradle.kts" ] || [ -f "android/build.gradle" ]; then
            echo "PROJECT_DIR=android" >> $GITHUB_ENV
            echo "Selected project directory: android/"
          else
            echo "PROJECT_DIR=." >> $GITHUB_ENV
            echo "Falling back to Root (.)"
          fi

      # Ensure gradlew exists, is executable, and upgraded to Gradle 8.10.2 (AGP 8.8.0 requirement)
      - name: Setup & Upgrade Gradle Wrapper to 8.10.2
        run: |
          cd $PROJECT_DIR
          # Auto-upgrade gradle-wrapper.properties to 8.10.2 in case repo had an older version
          if [ -f "gradle/wrapper/gradle-wrapper.properties" ]; then
            echo "Upgrading existing gradle-wrapper.properties to 8.10.2..."
            sed -i 's/gradle-[0-9.]\+-\(bin\|all\)\.zip/gradle-8.10.2-bin.zip/g' gradle/wrapper/gradle-wrapper.properties
            cat gradle/wrapper/gradle-wrapper.properties
          fi
          # Ensure gradlew is generated with 8.10.2
          gradle wrapper --gradle-version 8.10.2 --distribution-type bin
          chmod +x gradlew
          echo "Verified Gradle wrapper version:"
          ./gradlew --version

      # 1. Decode Release Keystore from GitHub Secrets if available
      - name: Decode Release Keystore
        if: env.KEYSTORE_BASE64 != ''
        run: |
          mkdir -p $PROJECT_DIR/app
          echo "$KEYSTORE_BASE64" | base64 --decode > $PROJECT_DIR/app/release.jks
          echo "Keystore successfully decoded to $PROJECT_DIR/app/release.jks"

      # 2. Build Release APK and Android App Bundle (AAB)
      - name: Build Release APK & Bundle
        run: |
          cd $PROJECT_DIR
          ./gradlew assembleRelease bundleRelease --stacktrace

      # 3. Sign APK using r0adkll/sign-android-release if Keystore secret is provided
      - name: Sign Release APK
        if: env.KEYSTORE_BASE64 != ''
        uses: r0adkll/sign-android-release@v1
        id: sign_apk
        with:
          releaseDirectory: \${{ env.PROJECT_DIR }}/app/build/outputs/apk/release
          signingKeyBase64: \${{ secrets.KEYSTORE_BASE64 }}
          alias: \${{ secrets.KEY_ALIAS }}
          keyStorePassword: \${{ secrets.KEYSTORE_PASSWORD }}
          keyPassword: \${{ secrets.KEY_PASSWORD }}
        env:
          BUILD_TOOLS_VERSION: "35.0.0"

      # 4. Prepare and collect artifacts for download
      - name: Prepare Artifacts
        run: |
          mkdir -p release-output
          # Collect all generated APKs
          if [ -n "\${{ steps.sign_apk.outputs.signedReleaseFile }}" ] && [ -f "\${{ steps.sign_apk.outputs.signedReleaseFile }}" ]; then
            cp "\${{ steps.sign_apk.outputs.signedReleaseFile }}" release-output/WiFiShare-signed.apk
          fi
          if [ -f "$PROJECT_DIR/app/build/outputs/apk/release/app-release.apk" ]; then
            cp "$PROJECT_DIR/app/build/outputs/apk/release/app-release.apk" release-output/WiFiShare-release.apk
          fi
          find "$PROJECT_DIR/app/build/outputs/apk" -name "*.apk" -exec cp -u {} release-output/ \; 2>/dev/null || true

          # Collect AAB (for Google Play)
          if [ -f "$PROJECT_DIR/app/build/outputs/bundle/release/app-release.aab" ]; then
            cp "$PROJECT_DIR/app/build/outputs/bundle/release/app-release.aab" release-output/WiFiShare-release.aab
          fi
          find "$PROJECT_DIR/app/build/outputs/bundle" -name "*.aab" -exec cp -u {} release-output/ \; 2>/dev/null || true

          echo "Prepared artifacts:"
          ls -la release-output/

      # 5. Upload Signed APK to GitHub Actions Artifacts
      - name: Upload Signed APK
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-Signed-APK
          path: release-output/*.apk
          retention-days: 30

      # 6. Upload App Bundle (AAB) to GitHub Actions Artifacts
      - name: Upload App Bundle (AAB)
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-Release-AAB
          path: release-output/*.aab
          retention-days: 30

      # 7. Auto-Publish Release when a git tag (e.g. v1.0.0) is pushed
      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            release-output/*.apk
            release-output/*.aab
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`
  },
  {
    path: 'gradlew',
    category: 'config',
    name: 'gradlew',
    description: 'POSIX Gradle wrapper script to bootstrap build on Linux/macOS and GitHub Actions',
    language: 'shell',
    content: `#!/bin/sh
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=\`ls -ld "$PRG"\`
    link=\`expr "$ls" : '.*-> \\(.*\\)$'\`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=\`dirname "$PRG"\`"/$link"
    fi
done
SAVED="\`pwd\`"
cd "\`dirname \\"$PRG\\"\`" >/dev/null
APP_HOME="\`pwd -P\`"
cd "$SAVED" >/dev/null

APP_NAME="Gradle"
APP_BASE_NAME=\`basename "$0"\`
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

if [ ! -r "$CLASSPATH" ]; then
    if command -v gradle >/dev/null 2>&1; then
        exec gradle "$@"
    else
        mkdir -p "$APP_HOME/gradle/wrapper"
        curl -sSL "https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar" -o "$CLASSPATH" 2>/dev/null || true
    fi
fi

exec java $DEFAULT_JVM_OPTS -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"`
  },
  {
    path: 'gradle/wrapper/gradle-wrapper.properties',
    category: 'config',
    name: 'gradle-wrapper.properties',
    description: 'Gradle wrapper version and distribution URL configuration (Gradle 8.10.2 required by AGP 8.8.0)',
    language: 'properties',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`
  },
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
