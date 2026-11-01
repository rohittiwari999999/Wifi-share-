import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Shield,
  Clock,
  Smartphone,
  Globe
} from 'lucide-react';
import { FileTransferItem } from '../types';
import { formatBytes } from '../utils/crypto';

interface BrowserReceiverModalProps {
  token: string;
  senderName: string;
  files: FileTransferItem[];
  onClose?: () => void;
}

export const BrowserReceiverModal: React.FC<BrowserReceiverModalProps> = ({
  token,
  senderName,
  files
}) => {
  const [localIp] = useState('192.168.1.104');
  const [port] = useState(8945);
  const portalUrl = `http://${localIp}:${port}/receive/${token}`;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [browserState, setBrowserState] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [downloadedFiles, setDownloadedFiles] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  // Generate QR Code
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(portalUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [portalUrl]);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate downloading a file in Chrome
  const handleDownloadFile = (file: FileTransferItem) => {
    const blob = file.blob || new Blob(['WiFi Share File Content for ' + file.name], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedFiles((prev) => ({ ...prev, [file.id]: true }));
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">
              Mode B: Browser Receiver (No App Installed)
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md">
              Ktor Local Server Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            The sender phone runs a temporary embedded HTTP server. Any other phone (Android, iPhone, PC)
            connected to the same Wi-Fi can scan this QR code or navigate to the local address in Chrome
            to accept and download the files without installing an APK.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Session expires in: {formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Main Split Grid: Sender App QR View + Simulated Mobile Chrome Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* SENDER SCREEN: Shows QR and instructions */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sender Device: {senderName}</h3>
              <p className="text-xs text-slate-400">Scan QR Code with Receiver's Camera or Chrome</p>
            </div>
          </div>

          {/* QR Code Frame */}
          <div className="flex justify-center p-4 bg-white rounded-xl max-w-[280px] mx-auto shadow-md">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Receiver QR Code"
                className="w-full h-auto aspect-square"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}
          </div>

          {/* Direct Address & Copy */}
          <div className="space-y-1.5">
            <div className="text-xs text-slate-400 font-medium">Or open this local Wi-Fi URL:</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={portalUrl}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-sky-400 focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Transfer Files Included */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Queued for Browser:</span>
              <span className="font-mono text-white font-semibold">
                {files.length} file(s) ({formatBytes(totalBytes)})
              </span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {files.map((f) => (
                <div key={f.id} className="flex justify-between text-[11px] text-slate-300">
                  <span className="truncate max-w-[220px]">{f.name}</span>
                  <span className="text-slate-500 font-mono">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Cryptographic 128-bit session token ({token.substring(0, 8)}...). Files are only
              accessible after receiver clicks Accept.
            </span>
          </div>
        </div>

        {/* RECEIVER SIMULATION: Mobile Chrome Browser View */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[380px] bg-slate-900 border-4 border-slate-700 rounded-[36px] shadow-2xl overflow-hidden ring-1 ring-slate-800">
            {/* Mobile Chrome Browser Address Bar */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 bg-slate-900 rounded-full px-3 py-1 text-[11px] font-mono text-slate-300 truncate border border-slate-800 flex items-center justify-between">
                <span className="truncate">{localIp}:{port}/receive/{token.substring(0, 6)}...</span>
                <span className="text-[9px] text-emerald-400">LAN</span>
              </div>
            </div>

            {/* Browser Content (Exact HTML that Ktor serves via BrowserPortal.kt) */}
            <div className="p-5 bg-slate-950 text-slate-100 min-h-[500px] flex flex-col justify-between">
              <div className="space-y-4">
                {/* Brand & Transfer Overview */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white text-lg">
                    ⚡
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">WiFi Share Portal</h4>
                    <p className="text-[11px] text-slate-400">Direct Local Wi-Fi Transfer</p>
                  </div>
                </div>

                {/* Sender metadata box */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sender Device:</span>
                    <span className="font-semibold text-white">{senderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Files:</span>
                    <span className="font-semibold text-white">{files.length} items</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Size:</span>
                    <span className="font-semibold text-sky-400 font-mono">
                      {formatBytes(totalBytes)}
                    </span>
                  </div>
                </div>

                {/* File list preview */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Offered Files:</div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="truncate max-w-[190px]">
                          <div className="font-medium text-slate-200 truncate">{file.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatBytes(file.size)}
                          </div>
                        </div>
                        {downloadedFiles[file.id] && (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Downloaded
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* State: Pending Approval */}
                {browserState === 'pending' && (
                  <div className="space-y-2 pt-2">
                    <div className="text-center text-[11px] text-slate-400">
                      Do you want to accept files from <span className="text-white font-medium">{senderName}</span>?
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBrowserState('rejected')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => setBrowserState('accepted')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm"
                      >
                        Accept Files
                      </button>
                    </div>
                  </div>
                )}

                {/* State: Accepted -> Download Links */}
                {browserState === 'accepted' && (
                  <div className="space-y-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 flex items-center gap-2 text-emerald-300 text-xs">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Transfer approved! Tap below to download each file:</span>
                    </div>

                    <div className="space-y-2">
                      {files.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => handleDownloadFile(file)}
                          className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-between transition-colors shadow-sm"
                        >
                          <span className="truncate max-w-[200px]">Download {file.name}</span>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* State: Rejected */}
                {browserState === 'rejected' && (
                  <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-center space-y-2">
                    <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
                    <div className="text-xs font-bold text-white">Transfer Declined</div>
                    <div className="text-[11px] text-slate-400">
                      You rejected the incoming files. No data was downloaded.
                    </div>
                    <button
                      onClick={() => setBrowserState('pending')}
                      className="text-xs text-sky-400 hover:underline pt-1"
                    >
                      Reset Decision
                    </button>
                  </div>
                )}
              </div>

              {/* Browser footer */}
              <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-slate-900">
                Direct Wi-Fi stream · Zero cloud storage · High security
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
