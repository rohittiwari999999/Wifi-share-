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
  workflow_dispatch: # Allows manual trigger from GitHub Actions tab

jobs:
  build-and-sign:
    name: Build Signed Release APK & AAB
    runs-on: ubuntu-latest

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

      - name: Make Gradle Wrapper Executable
        run: |
          if [ -f "gradlew" ]; then
            chmod +x gradlew
          fi

      # 1. Decode Release Keystore from GitHub Secrets (Base64)
      - name: Decode Release Keystore
        if: \${{ secrets.KEYSTORE_BASE64 != '' }}
        env:
          KEYSTORE_BASE64: \${{ secrets.KEYSTORE_BASE64 }}
        run: |
          echo "$KEYSTORE_BASE64" | base64 --decode > app/release.jks
          echo "Keystore successfully decoded to app/release.jks"

      # 2. Build Release APK and Android App Bundle (AAB)
      - name: Build Release APK & Bundle
        env:
          KEYSTORE_FILE: "release.jks"
          KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: \${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: \${{ secrets.KEY_PASSWORD }}
        run: |
          ./gradlew assembleRelease bundleRelease --stacktrace

      # 3. Sign APK with official Android apksigner
      - name: Sign Release APK
        if: \${{ secrets.KEYSTORE_BASE64 != '' }}
        uses: r0adkll/sign-android-release@v1
        id: sign_apk
        with:
          releaseDirectory: app/build/outputs/apk/release
          signingKeyBase64: \${{ secrets.KEYSTORE_BASE64 }}
          alias: \${{ secrets.KEY_ALIAS }}
          keyStorePassword: \${{ secrets.KEYSTORE_PASSWORD }}
          keyPassword: \${{ secrets.KEY_PASSWORD }}
        env:
          BUILD_TOOLS_VERSION: "35.0.0"

      # 4. Prepare and rename final output
      - name: Prepare Artifacts
        run: |
          mkdir -p release-output
          if [ -f "\${{ steps.sign_apk.outputs.signedReleaseFile }}" ]; then
            cp "\${{ steps.sign_apk.outputs.signedReleaseFile }}" release-output/WiFiShare-signed.apk
          elif [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
            cp app/build/outputs/apk/release/app-release.apk release-output/WiFiShare-release.apk
          else
            cp app/build/outputs/apk/*/*.apk release-output/ 2>/dev/null || true
          fi

          if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
            cp app/build/outputs/bundle/release/app-release.aab release-output/WiFiShare-release.aab
          fi

      # 5. Upload Signed APK (Downloadable from GitHub Actions)
      - name: Upload Signed APK
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-Signed-APK
          path: release-output/*.apk
          retention-days: 30

      # 6. Upload AAB for Google Play Store
      - name: Upload App Bundle (AAB)
        uses: actions/upload-artifact@v4
        with:
          name: WiFiShare-Release-AAB
          path: release-output/*.aab
          retention-days: 30

      # 7. Auto-Publish Release when a git tag like 'v1.0.0' is pushed
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
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`;

  const gradleSigningSnippet = `android {
    ...
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("KEYSTORE_FILE") ?: "release.jks"
            val keystoreFile = file(keystorePath)
            if (keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("KEY_ALIAS") ?: ""
                keyPassword = System.getenv("KEY_PASSWORD") ?: ""
            } else {
                // Fallback to debug keystore for local testing
                storeFile = signingConfigs.getByName("debug").storeFile
                storePassword = signingConfigs.getByName("debug").storePassword
                keyAlias = signingConfigs.getByName("debug").keyAlias
                keyPassword = signingConfigs.getByName("debug").keyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
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
