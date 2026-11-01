import React from 'react';
import {
  WifiOff,
  Radio,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Share2
} from 'lucide-react';

export const NetworkTroubleshooter: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <span>Local Network Discovery & Wi-Fi Diagnostics Guide</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Comprehensive field guide for network edge cases, client isolation, multicast filtering, and hotspot operation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issue 1: AP / Client Isolation */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Problem 1: Access Point / Client Isolation</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Public Wi-Fi networks (hotels, cafes, airports, university dorms) frequently enable <strong>Client Isolation</strong> (also called AP Isolation). The router allows internet access but blocks all internal IP-to-IP unicast and multicast packets between connected phones.
          </p>
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
            <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              <span>Recommended Solution: Portable Hotspot</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Turn on <strong>Personal Hotspot</strong> on Phone A. Connect Phone B to Phone A's hotspot. Android's local hotspot router never isolates clients, enabling maximum transfer speeds (~40-80 MB/s on Wi-Fi 6) with zero cellular data usage!
            </p>
          </div>
        </div>

        {/* Issue 2: Multicast Filtering & mDNS */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-sky-400 font-bold text-sm">
            <Radio className="w-5 h-5" />
            <span>Problem 2: Multicast UDP Drops</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Some commercial mesh routers throttle or discard 224.0.0.251:5353 multicast frames to conserve airtime. As a result, automatic discovery via NsdManager may intermittently fail to resolve the peer service name.
          </p>
          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 space-y-1">
            <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Built-in Fallbacks: QR & Direct IP</span>
            </div>
            <p className="text-[11px] text-slate-300">
              WiFi Share includes a built-in <strong>Connect by IP</strong> option and Mode B QR Code scanner that bypasses mDNS entirely by establishing direct unicast TCP sockets to the receiver's IP.
            </p>
          </div>
        </div>

        {/* Issue 3: VPN Interference */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>Problem 3: VPN Tunnel Overriding Local Subnet</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            When a third-party VPN or ad-blocker tunnel is running, all outbound device traffic (including 192.168.x.x packets) may be captured into the TUN interface and routed through the remote VPN server, causing local socket connection timeouts.
          </p>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-xs font-semibold text-slate-200">Remedy:</div>
            <p className="text-[11px] text-slate-400">
              Ensure "Bypass VPN for local networks" is enabled in your VPN settings, or temporarily pause the VPN connection during large file transfers.
            </p>
          </div>
        </div>

        {/* Issue 4: Android Permission Model */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm">
            <Smartphone className="w-5 h-5" />
            <span>Modern Android Permissions (Android 12 – 15+)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Starting in Android 13, Google introduced <code>NEARBY_WIFI_DEVICES</code> with <code>android:usesPermissionFlags="neverForLocation"</code> so apps do not need GPS location permission to talk to local Wi-Fi peers.
          </p>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-xs font-semibold text-slate-200">No All-Files Permission Required:</div>
            <p className="text-[11px] text-slate-400">
              WiFi Share uses the standard Storage Access Framework (SAF) and Android Photo Picker to stream files. It never asks for dangerous <code>MANAGE_EXTERNAL_STORAGE</code> permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
