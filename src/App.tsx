import React, { useState } from 'react';
import { TopNav } from './components/TopNav';
import { DualDeviceSimulator } from './components/DualDeviceSimulator';
import { BrowserReceiverModal } from './components/BrowserReceiverModal';
import { CodebaseExplorer } from './components/CodebaseExplorer';
import { ProtocolInspector } from './components/ProtocolInspector';
import { NetworkTroubleshooter } from './components/NetworkTroubleshooter';
import { FileTransferItem, ProtocolLogEntry } from './types';
import { exportAndroidProjectZip } from './utils/zipExport';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'browser-portal' | 'codebase' | 'protocol' | 'troubleshoot'
  >('simulator');

  // Active Browser Session (Mode B)
  const [browserToken, setBrowserToken] = useState('browser_8f921a4');
  const [browserSender, setBrowserSender] = useState('Pixel 9 Pro');
  const [browserFiles, setBrowserFiles] = useState<FileTransferItem[]>([
    {
      id: 'doc-1',
      name: 'WiFiShare_Protocol_Architecture.pdf',
      size: 4823440,
      mimeType: 'application/pdf',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      id: 'img-1',
      name: 'Drone_Survey_Capture_4K.jpg',
      size: 14200300,
      mimeType: 'image/jpeg',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    }
  ]);

  // Protocol Packet Log
  const [protocolLogs, setProtocolLogs] = useState<ProtocolLogEntry[]>([
    {
      id: 'init-1',
      timestamp: Date.now() - 35000,
      type: 'NSD_REGISTER',
      source: '192.168.1.182:8945',
      destination: '224.0.0.251:5353 (mDNS)',
      payloadSummary: 'Registered DNS-SD service: _wifishare._tcp. on port 8945 for Galaxy S24 Ultra'
    },
    {
      id: 'init-2',
      timestamp: Date.now() - 15000,
      type: 'NSD_DISCOVERY',
      source: '192.168.1.104',
      destination: '224.0.0.251:5353 (mDNS)',
      payloadSummary: 'PTR query for _wifishare._tcp.local. (NsdManager)'
    }
  ]);

  const handleLogProtocol = (entry: Omit<ProtocolLogEntry, 'id' | 'timestamp'>) => {
    const newLog: ProtocolLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };
    setProtocolLogs((prev) => [newLog, ...prev]);
  };

  const handleOpenBrowserPortal = (
    token: string,
    senderName: string,
    files: FileTransferItem[]
  ) => {
    setBrowserToken(token);
    setBrowserSender(senderName);
    setBrowserFiles(files);
    setActiveTab('browser-portal');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (1-line Wordmark, Nav Links, Primary CTA) */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExportProject={exportAndroidProjectZip}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'simulator' && (
          <DualDeviceSimulator
            onOpenBrowserPortal={handleOpenBrowserPortal}
            onLogProtocol={handleLogProtocol}
          />
        )}

        {activeTab === 'browser-portal' && (
          <BrowserReceiverModal
            token={browserToken}
            senderName={browserSender}
            files={browserFiles}
          />
        )}

        {activeTab === 'codebase' && (
          <CodebaseExplorer onExportZip={exportAndroidProjectZip} />
        )}

        {activeTab === 'protocol' && (
          <ProtocolInspector
            logs={protocolLogs}
            onClearLogs={() => setProtocolLogs([])}
          />
        )}

        {activeTab === 'troubleshoot' && <NetworkTroubleshooter />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        WiFi Share · Local Network Peer-to-Peer File Transfer Protocol · Android Kotlin & Jetpack Compose
      </footer>
    </div>
  );
}
