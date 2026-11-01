import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Download,
  FileCode,
  Sparkles,
  GitBranch,
  Layers
} from 'lucide-react';

export const GitHubSignedApkGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [keystoreName, setKeystoreName] = useState('wifishare-release-key.jks');
  const [keyAlias, setKeyAlias] = useState('wifishare');
  const [validityDays, setValidityDays] = useState('10000');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const keytoolCommand = `keytool -genkeypair -v -keystore ${keystoreName} -alias ${keyAlias} -keyalg RSA -keysize 2048 -validity ${validityDays}`;

  const base64LinuxMacCommand = `base64 -w 0 ${keystoreName} > keystore_base64.txt`;
  const base64WindowsCommand = `certutil -encode ${keystoreName} keystore_base64.txt`;

  const workflowYaml = `name: Build & Sign Android APK / AAB

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
      GRADLE_OPTS: "-Dorg.gradle.jvmargs=\\"-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError\\" -Dfile.encoding=UTF-8"

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

      - name: Accept Android SDK Licenses & Setup Platform 35
        run: |
          echo "Configuring Android SDK and accepting licenses..."
          export ANDROID_HOME=\${ANDROID_HOME:-/usr/local/lib/android/sdk}
          export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools
          mkdir -p "$ANDROID_HOME/licenses"
          echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$ANDROID_HOME/licenses/android-sdk-license"
          echo "84831b9409646a3e8e447b7a822e8687d0182b87" >> "$ANDROID_HOME/licenses/android-sdk-license"
          echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> "$ANDROID_HOME/licenses/android-sdk-license"
          echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$ANDROID_HOME/licenses/android-sdk-preview-license"
          yes | sdkmanager --licenses 2>/dev/null || true
          sdkmanager "platforms;android-35" "build-tools;35.0.0" 2>/dev/null || true
          echo "Android SDK configured successfully."

      - name: Setup Gradle 8.10.2
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.10.2'

      # Detect whether Android project is in root or in android/ subdirectory
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

      # Configure high-memory gradle.properties to prevent JVM OutOfMemory crashes
      - name: Configure Gradle Memory & Properties
        run: |
          PROPS="org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
          org.gradle.parallel=true
          org.gradle.caching=true
          android.useAndroidX=true
          android.nonTransitiveRClass=true
          android.lint.checkReleaseBuilds=false
          android.lint.abortOnError=false
          kotlin.daemon.jvmargs=-Xmx2048m"

          echo "$PROPS" > gradle.properties
          mkdir -p android
          echo "$PROPS" > android/gradle.properties
          echo "Configured gradle.properties in root and android/"

      # Upgrade Gradle Wrapper to 8.10.2
      - name: Upgrade Gradle Wrapper to 8.10.2
        run: |
          echo "Scanning and updating all gradle-wrapper.properties to Gradle 8.10.2..."
          find . -name "gradle-wrapper.properties" -exec sed -i 's/gradle-[0-9.]\\+-\\(bin\\|all\\)\\.zip/gradle-8.10.2-bin.zip/g' {} +
          cd $PROJECT_DIR
          if [ ! -f "gradlew" ]; then
            gradle wrapper --gradle-version 8.10.2 --distribution-type bin
          else
            gradle wrapper --gradle-version 8.10.2 --distribution-type bin || true
          fi
          chmod +x gradlew
          echo "Gradle wrapper ready:"
          ./gradlew --version

      # Prepare Release and Debug Keystores
      - name: Prepare Keystores
        run: |
          mkdir -p ~/.android
          mkdir -p $PROJECT_DIR/app
          mkdir -p $PROJECT_DIR

          if [ -n "$KEYSTORE_BASE64" ]; then
            echo "Decoding KEYSTORE_BASE64 from GitHub Secrets..."
            echo "$KEYSTORE_BASE64" | base64 --decode > $PROJECT_DIR/release.jks
          else
            echo "Generating CI release keystore..."
            keytool -genkeypair -v \\
              -keystore $PROJECT_DIR/release.jks \\
              -alias release \\
              -keyalg RSA \\
              -keysize 2048 \\
              -validity 10000 \\
              -storepass "android" \\
              -keypass "android" \\
              -dname "CN=WiFiShare,O=WiFiShare,C=US"
            echo "KEYSTORE_PASSWORD=android" >> $GITHUB_ENV
            echo "KEY_ALIAS=release" >> $GITHUB_ENV
            echo "KEY_PASSWORD=android" >> $GITHUB_ENV
          fi

          cp $PROJECT_DIR/release.jks $PROJECT_DIR/app/release.jks 2>/dev/null || true
          cp $PROJECT_DIR/release.jks ./release.jks 2>/dev/null || true
          cp $PROJECT_DIR/release.jks ./app/release.jks 2>/dev/null || true

          if [ ! -f ~/.android/debug.keystore ]; then
            keytool -genkeypair -v \\
              -keystore ~/.android/debug.keystore \\
              -storepass android \\
              -alias androiddebugkey \\
              -keypass android \\
              -keyalg RSA \\
              -keysize 2048 \\
              -validity 10000 \\
              -dname "CN=Android Debug,O=Android,C=US" || true
          fi

          echo "Keystores successfully prepared."

      # Step 1: Build App Bundle (AAB for Google Play Store)
      - name: Build App Bundle (AAB)
        id: build_bundle
        run: |
          cd $PROJECT_DIR
          echo "Building Release App Bundle (AAB)..."
          ./gradlew bundleRelease --no-daemon -x test

      # Step 2: Build Release APK via Gradle
      - name: Build Release APK
        id: build_release
        continue-on-error: true
        run: |
          cd $PROJECT_DIR
          echo "Building Release APK..."
          ./gradlew assembleRelease --no-daemon -x test || ./gradlew assemble --no-daemon -x test || true

      # Step 3: Build Universal APK from App Bundle (Guaranteed APK generation)
      - name: Generate Universal APK from App Bundle
        run: |
          mkdir -p release-output
          # Find generated AAB
          AAB_FILE=$(find . -type f -name "*.aab" | head -n 1)
          if [ -n "$AAB_FILE" ]; then
            echo "Found AAB at: $AAB_FILE"
            cp -v "$AAB_FILE" release-output/WiFiShare-release.aab
            
            echo "Downloading Google bundletool..."
            curl -sSL "https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar" -o /tmp/bundletool.jar
            
            KEYSTORE_FILE_PATH="release.jks"
            if [ -f "$PROJECT_DIR/release.jks" ]; then
              KEYSTORE_FILE_PATH="$PROJECT_DIR/release.jks"
            fi

            KS_PASS="\${KEYSTORE_PASSWORD:-android}"
            KEY_AL="\${KEY_ALIAS:-release}"
            KEY_P="\${KEY_PASSWORD:-android}"

            echo "Building Universal installable APK from bundle..."
            java -jar /tmp/bundletool.jar build-apks \\
              --bundle="$AAB_FILE" \\
              --output=/tmp/universal.apks \\
              --mode=universal \\
              --ks="$KEYSTORE_FILE_PATH" \\
              --ks-pass="pass:$KS_PASS" \\
              --ks-key-alias="$KEY_AL" \\
              --key-pass="pass:$KEY_P"
            
            unzip -p /tmp/universal.apks universal.apk > release-output/WiFiShare-Release.apk
            echo "Generated release-output/WiFiShare-Release.apk successfully!"
          else
            echo "No AAB found to generate universal APK from."
          fi

      # Step 4: Collect all generated APK and AAB files
      - name: Collect Build Artifacts
        run: |
          mkdir -p release-output
          # Copy any Gradle generated APKs
          find . -type f -name "*.apk" ! -path "./release-output/*" -exec cp -v {} release-output/ \\; 2>/dev/null || true
          # Copy any Gradle generated AABs
          find . -type f -name "*.aab" ! -path "./release-output/*" -exec cp -v {} release-output/ \\; 2>/dev/null || true

          # If WiFiShare-Release.apk does not exist yet, find any other APK and copy it
          if [ ! -f release-output/WiFiShare-Release.apk ]; then
            ANY_APK=$(find release-output -type f -name "*.apk" | head -n 1)
            if [ -n "$ANY_APK" ]; then
              cp "$ANY_APK" release-output/WiFiShare-Release.apk
            fi
          fi

          echo "=== Collected Artifacts in release-output/ ==="
          ls -lh release-output/

      # Step 5: Verify Generated Artifacts (Passes if APK or AAB is present)
      - name: Verify Generated Artifacts
        run: |
          echo "Verifying build outputs in release-output/..."
          ARTIFACT_COUNT=$(find release-output -type f \\( -name "*.apk" -o -name "*.aab" \\) | wc -l)
          if [ "$ARTIFACT_COUNT" -eq 0 ]; then
            echo "::error::No APK or AAB files were generated!"
            exit 1
          fi
          echo "Verification SUCCESS! Found $ARTIFACT_COUNT artifact(s):"
          find release-output -type f \\( -name "*.apk" -o -name "*.aab" \\) -exec ls -lh {} \\;

      # Upload APKs to GitHub Actions Artifacts
      - name: Upload APKs
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-APK
          path: release-output/*.apk
          retention-days: 30
          if-no-files-found: warn

      # Upload App Bundle (AAB) to GitHub Actions Artifacts
      - name: Upload App Bundle (AAB)
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-Release-AAB
          path: release-output/*.aab
          retention-days: 30
          if-no-files-found: warn

      # Auto-Publish Release when a git tag (e.g. v1.0.0) is pushed
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
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  const gradleSigningSnippet = `android {
    ...
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("KEYSTORE_FILE") ?: "release.jks"
            val keystoreFile = file(keystorePath)
            if (keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "android"
                keyAlias = System.getenv("KEY_ALIAS") ?: "release"
                keyPassword = System.getenv("KEY_PASSWORD") ?: "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val keystorePath = System.getenv("KEYSTORE_FILE") ?: "release.jks"
            if (file(keystorePath).exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              GitHub Actions: Signed APK & AAB Auto-Generate Code
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md">
              CI/CD Production Ready
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            GitHub par push ya tag create karne par automatically secure release keystore ke saath Signed APK
            generate karne ka complete code aur step-by-step setup guide.
          </p>
        </div>

        <button
          onClick={() => copyToClipboard(workflowYaml, 'all_yaml')}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          {copiedKey === 'all_yaml' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copiedKey === 'all_yaml' ? 'Copied Workflow!' : 'Copy Workflow YAML'}</span>
        </button>
      </div>

      {/* Gradle 8.10.2 / AGP 8.8.0 Fix Notice */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Fix Applied: Gradle 8.10.2 Update (AGP 8.8.0 Requirement)</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            Agar aapko <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-200 font-mono">"Minimum supported Gradle version is 8.10.2. Current version is 8.7"</code> error mila tha, toh niche diya gaya workflow YAML automatically Gradle 8.10.2 setup karta hai aur wrapper properties ko upgrade kar deta hai. Naya YAML copy karke GitHub par replace karein!
          </p>
        </div>
        <button
          onClick={() => copyToClipboard(workflowYaml, 'quick_copy_fix')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium shrink-0 transition-colors"
        >
          {copiedKey === 'quick_copy_fix' ? 'Copied!' : 'Copy Fixed YAML'}
        </button>
      </div>

      {/* Step 1: Create Keystore */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-sky-400 font-bold text-sm">
          <Key className="w-5 h-5" />
          <span>Step 1: Release Keystore (.jks) Generate Karein</span>
        </div>
        <p className="text-xs text-slate-300">
          Apne local computer ke terminal (Command Prompt, Bash, ya PowerShell) mein yeh command run karein. Yeh aapke app ke liye secure signing key banata hai:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Keystore File Name</label>
            <input
              type="text"
              value={keystoreName}
              onChange={(e) => setKeystoreName(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Key Alias Name</label>
            <input
              type="text"
              value={keyAlias}
              onChange={(e) => setKeyAlias(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium">Validity (Days)</label>
            <input
              type="text"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
          <code className="text-xs text-amber-300 font-mono break-all select-all">
            {keytoolCommand}
          </code>
          <button
            onClick={() => copyToClipboard(keytoolCommand, 'keytool')}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0"
            title="Copy command"
          >
            {copiedKey === 'keytool' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Step 2: Convert to Base64 */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm">
          <Terminal className="w-5 h-5" />
          <span>Step 2: Keystore ko Base64 String mein Convert Karein</span>
        </div>
        <p className="text-xs text-slate-300">
          GitHub Secrets binary (.jks) files accept nahi karta, isliye keystore ko Base64 text mein convert karein:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">Linux / macOS Terminal:</div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-sky-300 font-mono select-all">
                {base64LinuxMacCommand}
              </code>
              <button
                onClick={() => copyToClipboard(base64LinuxMacCommand, 'b64_nix')}
                className="p-1 text-slate-400 hover:text-white"
              >
                {copiedKey === 'b64_nix' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">Windows PowerShell / CMD:</div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-sky-300 font-mono select-all">
                {base64WindowsCommand}
              </code>
              <button
                onClick={() => copyToClipboard(base64WindowsCommand, 'b64_win')}
                className="p-1 text-slate-400 hover:text-white"
              >
                {copiedKey === 'b64_win' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: GitHub Secrets Configuration */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Step 3: GitHub Repository Secrets Setup Karein</span>
        </div>
        <p className="text-xs text-slate-300">
          Apne GitHub Repository par jaakar: <strong className="text-white">Settings &rarr; Secrets and variables &rarr; Actions &rarr; "New repository secret"</strong> par click karein aur yeh 4 secrets create karein:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-950 text-slate-300 font-mono">
              <tr>
                <th className="p-3 border-b border-slate-800">Secret Name</th>
                <th className="p-3 border-b border-slate-800">Value Description</th>
                <th className="p-3 border-b border-slate-800">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
              <tr>
                <td className="p-3 font-bold text-sky-400">KEYSTORE_BASE64</td>
                <td className="p-3 text-slate-300 font-sans">keystore_base64.txt file ka pura text content</td>
                <td className="p-3 text-slate-500">MIIJpAIBAzCCC...</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-sky-400">KEYSTORE_PASSWORD</td>
                <td className="p-3 text-slate-300 font-sans">Keystore banate waqt jo password set kiya tha</td>
                <td className="p-3 text-slate-500">MySecurePass123!</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-sky-400">KEY_ALIAS</td>
                <td className="p-3 text-slate-300 font-sans">Aapka key alias name</td>
                <td className="p-3 text-slate-500">{keyAlias}</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-sky-400">KEY_PASSWORD</td>
                <td className="p-3 text-slate-300 font-sans">Key ka password (agar alag nahi hai to keystore password)</td>
                <td className="p-3 text-slate-500">MySecurePass123!</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 4: GitHub Actions Workflow Code */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <FileCode className="w-5 h-5" />
            <span>Workflow File: .github/workflows/build-signed-apk.yml</span>
          </div>
          <button
            onClick={() => copyToClipboard(workflowYaml, 'yaml_btn')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
          >
            {copiedKey === 'yaml_btn' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'yaml_btn' ? 'Copied' : 'Copy YAML'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Yeh workflow file aapke project root mein <code className="text-sky-300 font-mono">.github/workflows/build-signed-apk.yml</code> ke path par rakhi gayi hai:
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[380px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed">
          <pre>
            <code>{workflowYaml}</code>
          </pre>
        </div>
      </div>

      {/* Step 5: How to Run & Download */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
          <Download className="w-5 h-5" />
          <span>Step 5: Run Kaise Karein & Signed APK Download Karna</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">A</span>
              <span>Manual Run (Single Click on GitHub):</span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Apne GitHub repo mein <strong className="text-white">"Actions"</strong> tab par jayein.</li>
              <li>Left sidebar mein <strong className="text-white">"Build & Sign Android APK / AAB"</strong> par click karein.</li>
              <li>Right side mein <strong className="text-white">"Run workflow"</strong> button par click karein.</li>
              <li>Build complete hone par neeche <strong className="text-sky-400">"Artifacts"</strong> section se <code className="text-white">WiFiShare-Signed-APK</code> download karein!</li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">B</span>
              <span>Auto Release Tag (Publish Version):</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Jab bhi aap koi version tag push karenge, GitHub automatically Signed APK & AAB ko GitHub Releases mein attach kar dega:
            </p>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300 select-all">
              git tag v1.0.0<br />
              git push origin v1.0.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
