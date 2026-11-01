import JSZip from 'jszip';
import { ANDROID_FILES } from '../data/androidProjectTree';

/**
 * Creates and downloads a complete, runnable Android Studio project zip file.
 */
export async function exportAndroidProjectZip() {
  const zip = new JSZip();

  // Root folder
  const projectFolder = zip.folder('WiFiShare-Android');
  if (!projectFolder) return;

  // Add all Android files
  ANDROID_FILES.forEach((file) => {
    projectFolder.file(file.path, file.content);
  });

  // Add gradlew stub and README
  projectFolder.file(
    'README.md',
    `# WiFi Share – Local Wi-Fi File Transfer for Android

Native Android application built with Kotlin and Jetpack Compose for direct peer-to-peer file transfers without internet, cloud, or third-party servers.

## Features
- **NSD Service Discovery**: Automatic peer discovery on local Wi-Fi via mDNS (_wifishare._tcp.)
- **Mode A (App-to-App)**: Direct high-speed streaming between two Android devices with explicit approval and SHA-256 integrity verification.
- **Mode B (Browser Receiver)**: Send files to any phone without the app installed via mobile Chrome and QR code.
- **Ktor Local Server**: Embedded HTTP server for streaming files directly to disk without loading full files into RAM.
- **SAF & Room Database**: Safe storage access and transfer history.
- **Foreground Service**: Persistent notification with real-time transfer progress and wake lock.

## How to Build in Android Studio
1. Open Android Studio (Ladybug / Iguana or later).
2. Select **Open Project** and navigate to this folder.
3. Allow Gradle to sync dependencies from \`gradle/libs.versions.toml\`.
4. Connect an Android device (API 26+) or launch an emulator.
5. Click **Run 'app'**.

## How to Generate Signed APK on GitHub (CI/CD)
1. Push this repository to GitHub.
2. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
3. Add the following repository secrets:
   - \`KEYSTORE_BASE64\`: Base64 encoded string of your release keystore (\`base64 -w 0 release.jks\`)
   - \`KEYSTORE_PASSWORD\`: Your keystore password
   - \`KEY_ALIAS\`: Your key alias
   - \`KEY_PASSWORD\`: Your key password
4. Go to the **Actions** tab on GitHub, click **Build & Sign Android APK / AAB**, and click **Run workflow**.
5. Once completed, download the signed APK and AAB from the **Artifacts** section!
6. Pushing a tag like \`v1.0.0\` will automatically publish a GitHub Release with the APK attached.

`
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'WiFiShare-Android-Kotlin-Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
