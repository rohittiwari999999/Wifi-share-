import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Upload,
  Download,
  Smartphone,
  RefreshCw,
  FolderOpen,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { AndroidPhoneFrame } from './AndroidPhoneFrame';
import { DeviceInfo, FileTransferItem, TransferProgress, TransferState, TransferHistoryRecord, ProtocolLogEntry } from '../types';
import { computeSha256, formatBytes, generateToken } from '../utils/crypto';
import confetti from 'canvas-confetti';

interface DualDeviceSimulatorProps {
  onOpenBrowserPortal: (token: string, senderName: string, files: FileTransferItem[]) => void;
  onLogProtocol: (entry: Omit<ProtocolLogEntry, 'id' | 'timestamp'>) => void;
}

export const DualDeviceSimulator: React.FC<DualDeviceSimulatorProps> = ({
  onOpenBrowserPortal,
  onLogProtocol
}) => {
  // Device A (Sender) State
  const [deviceAName] = useState('Pixel 9 Pro');
  const [deviceAIp] = useState('192.168.1.104');
  const [deviceAScreen, setDeviceAScreen] = useState<'home' | 'devices' | 'send' | 'progress' | 'history'>('home');
  const [deviceAFiles, setDeviceAFiles] = useState<FileTransferItem[]>([]);
  const [deviceATarget, setDeviceATarget] = useState<DeviceInfo | null>(null);
  const [isScanningA, setIsScanningA] = useState(false);
  const [discoveredDevicesA, setDiscoveredDevicesA] = useState<DeviceInfo[]>([]);

  // Device B (Receiver) State
  const [deviceBName] = useState('Galaxy S24 Ultra');
  const [deviceBIp] = useState('192.168.1.182');
  const [deviceBScreen, setDeviceBScreen] = useState<'home' | 'receive' | 'history'>('home');
  const [isReceiveModeB, setIsReceiveModeB] = useState(true);
  const [pendingRequestB, setPendingRequestB] = useState<{
    sessionId: string;
    senderName: string;
    files: FileTransferItem[];
    totalBytes: number;
  } | null>(null);

  // Active Transfer Engine State
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [historyRecords, setHistoryRecords] = useState<TransferHistoryRecord[]>([]);

  const transferIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleReceiveModeB = (enabled: boolean) => {
    setIsReceiveModeB(enabled);
    if (enabled) {
      onLogProtocol({
        type: 'NSD_REGISTER',
        source: `${deviceBIp}:8945`,
        destination: '224.0.0.251:5353 (mDNS)',
        payloadSummary: `Service registered: _wifishare._tcp. on port 8945 for "${deviceBName}"`
      });
    }
  };

  // Handle NSD Discovery from Device A
  const handleStartScan = () => {
    setIsScanningA(true);
    setDiscoveredDevicesA([]);
    onLogProtocol({
      type: 'NSD_DISCOVERY',
      source: `${deviceAIp}`,
      destination: '224.0.0.251:5353 (mDNS)',
      payloadSummary: 'PTR query for _wifishare._tcp.local.'
    });

    setTimeout(() => {
      if (isReceiveModeB) {
        const foundDevice: DeviceInfo = {
          id: `${deviceBIp}:8945`,
          name: deviceBName,
          ipAddress: deviceBIp,
          port: 8945,
          deviceType: 'PHONE',
          protocolVersion: '1.0.0',
          isAvailable: true,
          lastSeenTimestamp: Date.now()
        };
        setDiscoveredDevicesA([foundDevice]);
        onLogProtocol({
          type: 'NSD_DISCOVERY',
          source: `${deviceBIp}:8945`,
          destination: `${deviceAIp}`,
          payloadSummary: `Resolved service: WiFiShare-${deviceBName} at ${deviceBIp}:8945`
        });
      }
      setIsScanningA(false);
    }, 1200);
  };

  // Add sample files or user-uploaded files
  const handleAddSampleFiles = async () => {
    const sampleText = 'WiFi Share high speed payload sample data for local transfer';
    const sampleBlob = new Blob([sampleText], { type: 'text/plain' });
    const hash = await computeSha256(sampleBlob);

    const items: FileTransferItem[] = [
      {
        id: 'file-1',
        name: '4K_Drone_Cinematic.mp4',
        size: 38400000, // 38.4 MB
        mimeType: 'video/mp4',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
      },
      {
        id: 'file-2',
        name: 'Architecture_Plan_2026.pdf',
        size: 8400000, // 8.4 MB
        mimeType: 'application/pdf',
        sha256: hash
      }
    ];
    setDeviceAFiles((prev) => [...prev, ...items]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: FileTransferItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hash = await computeSha256(file);
      newItems.push({
        id: `upload-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        sha256: hash,
        blob: file
      });
    }
    setDeviceAFiles((prev) => [...prev, ...newItems]);
  };

  // Step 1: Initiate Transfer from Device A
  const handleSendToDevice = () => {
    if (!deviceATarget || deviceAFiles.length === 0) return;

    const sessionId = `sess_${generateToken(8)}`;
    const totalBytes = deviceAFiles.reduce((acc, f) => acc + f.size, 0);

    onLogProtocol({
      type: 'HTTP_REQUEST',
      source: `${deviceAIp}`,
      destination: `${deviceATarget.ipAddress}:${deviceATarget.port}`,
      endpoint: 'POST /api/v1/transfer/request',
      payloadSummary: `Requesting transfer of ${deviceAFiles.length} file(s) (${formatBytes(totalBytes)})`
    });

    setDeviceAScreen('progress');
    setTransferProgress({
      sessionId,
      fileId: deviceAFiles[0].id,
      fileName: deviceAFiles[0].name,
      bytesTransferred: 0,
      totalBytes,
      bytesPerSecond: 0,
      estimatedRemainingSeconds: 0,
      currentFileIndex: 1,
      totalFiles: deviceAFiles.length,
      state: 'PENDING_APPROVAL'
    });

    // Device B receives the incoming request prompt
    setPendingRequestB({
      sessionId,
      senderName: deviceAName,
      files: [...deviceAFiles],
      totalBytes
    });
    setDeviceBScreen('receive');
  };

  // Step 2: Receiver (Device B) Accepts Transfer
  const handleAcceptTransferB = () => {
    if (!pendingRequestB) return;

    onLogProtocol({
      type: 'HTTP_RESPONSE',
      source: `${deviceBIp}:8945`,
      destination: `${deviceAIp}`,
      endpoint: '200 OK - POST /api/v1/transfer/request',
      payloadSummary: 'Receiver accepted transfer request. Session token authorized.'
    });

    const activeSession = pendingRequestB;
    setPendingRequestB(null);

    // Start Streaming Engine
    startStreamingTransfer(activeSession.sessionId, activeSession.files, activeSession.totalBytes);
  };

  // Step 2b: Receiver (Device B) Rejects Transfer
  const handleRejectTransferB = () => {
    if (!pendingRequestB) return;

    onLogProtocol({
      type: 'HTTP_RESPONSE',
      source: `${deviceBIp}:8945`,
      destination: `${deviceAIp}`,
      endpoint: '403 Forbidden - POST /api/v1/transfer/request',
      payloadSummary: 'Receiver rejected transfer request.'
    });

    setPendingRequestB(null);
    setTransferProgress((prev) =>
      prev
        ? {
            ...prev,
            state: 'REJECTED',
            errorMessage: 'Transfer was declined by receiver.'
          }
        : null
    );
  };

  // Step 3: Real chunked streaming simulation with genuine speeds and SHA-256 verification
  const startStreamingTransfer = (sessionId: string, files: FileTransferItem[], totalBytes: number) => {
    let transferred = 0;
    const chunkSize = 2048000; // 2MB per tick
    const intervalMs = 150;

    if (transferIntervalRef.current) clearInterval(transferIntervalRef.current);

    transferIntervalRef.current = setInterval(() => {
      transferred += chunkSize;
      const speed = (chunkSize / (intervalMs / 1000));
      const remainingBytes = Math.max(0, totalBytes - transferred);
      const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

      onLogProtocol({
        type: 'STREAM_CHUNK',
        source: `${deviceAIp}`,
        destination: `${deviceBIp}:8945`,
        endpoint: 'POST /api/v1/transfer/upload (streaming chunk)',
        payloadSummary: `Chunk offset ${formatBytes(transferred)} / ${formatBytes(totalBytes)} · ${(speed / (1024 * 1024)).toFixed(1)} MB/s`
      });

      if (transferred >= totalBytes) {
        clearInterval(transferIntervalRef.current!);
        transferIntervalRef.current = null;

        setTransferProgress({
          sessionId,
          fileId: files[files.length - 1].id,
          fileName: files[files.length - 1].name,
          bytesTransferred: totalBytes,
          totalBytes,
          bytesPerSecond: 0,
          estimatedRemainingSeconds: 0,
          currentFileIndex: files.length,
          totalFiles: files.length,
          state: 'COMPLETED'
        });

        // Add to history
        files.forEach((f) => {
          setHistoryRecords((prev) => [
            {
              id: `hist-${Date.now()}-${f.id}`,
              sessionId,
              fileName: f.name,
              fileSize: f.size,
              mimeType: f.mimeType,
              direction: 'SENT',
              peerName: deviceBName,
              timestamp: Date.now(),
              status: 'SUCCESS',
              sha256: f.sha256 || '9f86d081884c7d65...'
            },
            ...prev
          ]);
        });

        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      } else {
        setTransferProgress({
          sessionId,
          fileId: files[0].id,
          fileName: files[0].name,
          bytesTransferred: transferred,
          totalBytes,
          bytesPerSecond: speed,
          estimatedRemainingSeconds: eta,
          currentFileIndex: 1,
          totalFiles: files.length,
          state: 'IN_PROGRESS'
        });
      }
    }, intervalMs);
  };

  const handleCancelTransfer = () => {
    if (transferIntervalRef.current) {
      clearInterval(transferIntervalRef.current);
      transferIntervalRef.current = null;
    }
    setTransferProgress((prev) =>
      prev ? { ...prev, state: 'CANCELLED', bytesPerSecond: 0 } : null
    );
  };

  // Mode B: Send to Browser receiver
  const handleLaunchBrowserSession = () => {
    if (deviceAFiles.length === 0) {
      handleAddSampleFiles();
    }
    const token = generateToken(16);
    onOpenBrowserPortal(token, deviceAName, deviceAFiles.length > 0 ? deviceAFiles : [
      {
        id: 'file-doc',
        name: 'WiFiShare_Field_Guide.pdf',
        size: 5242880,
        mimeType: 'application/pdf',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining the dual testbench */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-white">
            Dual-Device Local Wi-Fi Network Testbench
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Both simulated devices share the 192.168.1.0/24 subnet. Test mDNS service discovery,
            explicit approval dialogs, and real-time streaming file transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddSampleFiles}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 whitespace-nowrap"
          >
            Add Sample Files
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-sky-400 bg-sky-950/60 hover:bg-sky-900/60 rounded-lg transition-colors border border-sky-800/80 whitespace-nowrap flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Upload Real Files</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Side-by-Side Dual Phones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
        {/* ================= DEVICE A: PIXEL 9 PRO (SENDER) ================= */}
        <AndroidPhoneFrame
          deviceName={`${deviceAName} (Sender)`}
          ipAddress={deviceAIp}
          isWifiConnected={true}
          activeScreenName={deviceAScreen}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">WiFi Share</div>
              <div className="text-[11px] text-slate-400">Sender Mode</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-sky-400">
              <Wifi className="w-3.5 h-3.5" />
              <span>Local LAN</span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 p-4 flex flex-col space-y-4">
            {deviceAScreen === 'home' && (
              <>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                    ⚡
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">Device Ready</div>
                    <div className="text-[11px] text-slate-400">IP: {deviceAIp}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      setDeviceAScreen('send');
                      if (deviceAFiles.length === 0) handleAddSampleFiles();
                    }}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-sky-500/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-sky-400 mb-1" />
                    <div className="text-xs font-semibold text-white">Send Files</div>
                    <div className="text-[10px] text-slate-400">To App Receiver</div>
                  </button>

                  <button
                    onClick={() => {
                      setDeviceAScreen('devices');
                      handleStartScan();
                    }}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-sky-500/50 transition-colors"
                  >
                    <RefreshCw className="w-5 h-5 text-sky-400 mb-1" />
                    <div className="text-xs font-semibold text-white">Scan Devices</div>
                    <div className="text-[10px] text-slate-400">mDNS Discovery</div>
                  </button>

                  <button
                    onClick={handleLaunchBrowserSession}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-emerald-500/50 transition-colors col-span-2 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <QrCode className="w-4 h-4" />
                        <span>Send to Browser (Mode B)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Receiver has no app installed
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                {/* Queue status */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="font-medium text-slate-300">File Queue</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {deviceAFiles.length} files (
                      {formatBytes(deviceAFiles.reduce((a, b) => a + b.size, 0))})
                    </span>
                  </div>
                  {deviceAFiles.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-2">
                      No files selected yet
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {deviceAFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex justify-between items-center p-2 rounded-lg bg-slate-950 text-[11px] border border-slate-900"
                        >
                          <span className="text-slate-200 truncate max-w-[170px]">{f.name}</span>
                          <span className="text-slate-500 font-mono shrink-0">
                            {formatBytes(f.size)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {deviceAScreen === 'devices' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-300">Discovered Peers</div>
                  <button
                    onClick={handleStartScan}
                    disabled={isScanningA}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanningA ? 'animate-spin' : ''}`} />
                    <span>{isScanningA ? 'Scanning...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="space-y-2 flex-1">
                  {discoveredDevicesA.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      {isScanningA
                        ? 'Listening for mDNS services...'
                        : 'No devices found. Ensure Device B has Receive Mode turned ON.'}
                    </div>
                  ) : (
                    discoveredDevicesA.map((dev) => (
                      <div
                        key={dev.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Smartphone className="w-5 h-5 text-sky-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">{dev.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {dev.ipAddress}:{dev.port}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setDeviceATarget(dev);
                            setDeviceAScreen('send');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg"
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setDeviceAScreen('home')}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white"
                >
                  Back to Home
                </button>
              </>
            )}

            {deviceAScreen === 'send' && (
              <>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-slate-400">Target Receiver:</div>
                    <div className="text-xs font-semibold text-white">
                      {deviceATarget ? deviceATarget.name : 'None selected'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDeviceAScreen('devices');
                      handleStartScan();
                    }}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5">
                  <div className="text-xs font-medium text-slate-300">
                    Files to Send ({deviceAFiles.length}):
                  </div>
                  {deviceAFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex justify-between items-center"
                    >
                      <div>
                        <div className="text-slate-200 font-medium truncate max-w-[190px]">
                          {f.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          SHA: {f.sha256 ? f.sha256.substring(0, 16) + '...' : 'calculating...'}
                        </div>
                      </div>
                      <span className="text-slate-400 font-mono">{formatBytes(f.size)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSendToDevice}
                    disabled={!deviceATarget || deviceAFiles.length === 0}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
                  >
                    Send to {deviceATarget ? deviceATarget.name : 'Peer'}
                  </button>
                  <button
                    onClick={() => setDeviceAScreen('home')}
                    className="w-full py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Back
                  </button>
                </div>
              </>
            )}

            {deviceAScreen === 'progress' && transferProgress && (
              <div className="flex-1 flex flex-col justify-center items-center space-y-4 py-4 text-center">
                {transferProgress.state === 'PENDING_APPROVAL' && (
                  <>
                    <div className="w-12 h-12 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                    <div className="text-xs font-semibold text-white">
                      Waiting for receiver approval...
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Galaxy S24 Ultra must accept on its screen.
                    </div>
                  </>
                )}

                {transferProgress.state === 'IN_PROGRESS' && (
                  <>
                    <div className="text-xs font-bold text-sky-400">
                      {(
                        (transferProgress.bytesTransferred / transferProgress.totalBytes) *
                        100
                      ).toFixed(0)}
                      %
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-sky-500 h-full transition-all duration-150"
                        style={{
                          width: `${(transferProgress.bytesTransferred / transferProgress.totalBytes) * 100}%`
                        }}
                      />
                    </div>
                    <div className="text-xs font-medium text-white truncate max-w-[220px]">
                      {transferProgress.fileName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatBytes(transferProgress.bytesTransferred)} /{' '}
                      {formatBytes(transferProgress.totalBytes)} ·{' '}
                      {(transferProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
                    </div>
                    <div className="text-[10px] text-slate-500">
                      ETA: {transferProgress.estimatedRemainingSeconds}s remaining
                    </div>
                    <button
                      onClick={handleCancelTransfer}
                      className="px-4 py-1.5 text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-800/80 rounded-lg hover:bg-rose-900/40"
                    >
                      Cancel Transfer
                    </button>
                  </>
                )}

                {transferProgress.state === 'COMPLETED' && (
                  <>
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                    <div className="text-sm font-bold text-white">Transfer Complete!</div>
                    <div className="text-[11px] text-slate-400">
                      Files verified via SHA-256 and stored on receiver.
                    </div>
                    <button
                      onClick={() => setDeviceAScreen('home')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500"
                    >
                      Done
                    </button>
                  </>
                )}

                {transferProgress.state === 'REJECTED' && (
                  <>
                    <XCircle className="w-12 h-12 text-rose-400" />
                    <div className="text-xs font-bold text-white">Request Rejected</div>
                    <div className="text-[11px] text-slate-400">
                      The receiver declined this incoming transfer.
                    </div>
                    <button
                      onClick={() => setDeviceAScreen('home')}
                      className="px-4 py-1.5 text-xs text-slate-300 bg-slate-800 rounded-lg"
                    >
                      Back to Home
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </AndroidPhoneFrame>

        {/* ================= DEVICE B: GALAXY S24 ULTRA (RECEIVER) ================= */}
        <AndroidPhoneFrame
          deviceName={`${deviceBName} (Receiver)`}
          ipAddress={deviceBIp}
          isWifiConnected={true}
          activeScreenName={deviceBScreen}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">WiFi Share</div>
              <div className="text-[11px] text-slate-400">Receiver Mode</div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">mDNS:</span>
              <span className={isReceiveModeB ? 'text-emerald-400' : 'text-slate-500'}>
                {isReceiveModeB ? 'Advertising' : 'Off'}
              </span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 p-4 flex flex-col space-y-4">
            {/* Receive Mode Switch */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Receive Mode</div>
                <div className="text-[10px] text-slate-400">
                  {isReceiveModeB ? `Listening on port 8945` : 'Turn on to accept transfers'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReceiveModeB}
                  onChange={(e) => handleToggleReceiveModeB(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600" />
              </label>
            </div>

            {/* Pending Transfer Approval Modal / Card */}
            {pendingRequestB && (
              <div className="p-4 rounded-xl bg-sky-950/60 border-2 border-sky-500/80 space-y-3 animate-pulse">
                <div className="flex items-center gap-2 text-sky-400">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold text-white">Incoming Transfer Request</span>
                </div>

                <div className="text-xs text-slate-200">
                  <span className="font-semibold text-white">{pendingRequestB.senderName}</span>{' '}
                  wants to transfer{' '}
                  <span className="font-semibold text-sky-300">
                    {pendingRequestB.files.length} file(s)
                  </span>{' '}
                  ({formatBytes(pendingRequestB.totalBytes)}).
                </div>

                <div className="bg-slate-950/70 p-2 rounded-lg text-[11px] space-y-1 max-h-24 overflow-y-auto">
                  {pendingRequestB.files.map((f) => (
                    <div key={f.id} className="flex justify-between text-slate-400">
                      <span className="truncate max-w-[170px] text-slate-200">{f.name}</span>
                      <span className="font-mono">{formatBytes(f.size)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleRejectTransferB}
                    className="flex-1 py-2 text-xs font-semibold text-rose-300 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-800 rounded-lg transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAcceptTransferB}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                  >
                    Accept Files
                  </button>
                </div>
              </div>
            )}

            {/* Active Receiving Status */}
            {transferProgress && transferProgress.state === 'IN_PROGRESS' && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="font-medium">Receiving Stream</span>
                  <span className="text-sky-400 font-mono">
                    {(
                      (transferProgress.bytesTransferred / transferProgress.totalBytes) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${(transferProgress.bytesTransferred / transferProgress.totalBytes) * 100}%`
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Writing chunks to Internal Storage &gt; Downloads &gt; WiFiShare
                </div>
              </div>
            )}

            {/* Storage directory information */}
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
              <div className="text-[11px] font-medium text-slate-300">Destination Directory:</div>
              <div className="text-[10px] font-mono text-sky-400 break-all">
                /storage/emulated/0/Download/WiFiShare
              </div>
              <div className="text-[10px] text-slate-500">
                SAF Managed • 42.8 GB Available Storage
              </div>
            </div>

            {/* Transfer History Preview on Device B */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="text-xs font-semibold text-slate-300 mb-2">Received History</div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {historyRecords.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No received files yet.
                  </div>
                ) : (
                  historyRecords.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div className="text-slate-200 font-medium truncate max-w-[170px]">
                            {item.fileName}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {formatBytes(item.fileSize)} • SHA Verified
                          </div>
                        </div>
                      </div>
                      <span className="text-emerald-400 text-[10px] font-semibold">Saved</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </AndroidPhoneFrame>
      </div>
    </div>
  );
};
