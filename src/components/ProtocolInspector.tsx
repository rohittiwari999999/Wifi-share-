import React, { useState } from 'react';
import { Network, Terminal, CheckCircle2, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import { ProtocolLogEntry } from '../types';

interface ProtocolInspectorProps {
  logs: ProtocolLogEntry[];
  onClearLogs: () => void;
}

export const ProtocolInspector: React.FC<ProtocolInspectorProps> = ({ logs, onClearLogs }) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = logs.filter(
    (l) => filterType === 'all' || l.type.toLowerCase().includes(filterType.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Local Network Protocol & Packet Inspector</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inspection of mDNS/DNS-SD discovery messages and Ktor HTTP streaming socket frames.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded ${filterType === 'all' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              All Packets
            </button>
            <button
              onClick={() => setFilterType('nsd')}
              className={`px-2.5 py-1 rounded ${filterType === 'nsd' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              mDNS / NSD
            </button>
            <button
              onClick={() => setFilterType('http')}
              className={`px-2.5 py-1 rounded ${filterType === 'http' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              HTTP REST
            </button>
          </div>

          <button
            onClick={onClearLogs}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg border border-slate-700"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Packet Stream Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold font-mono">packet_capture.pcapng (Live Stream)</span>
          <span className="text-slate-500 font-mono text-[11px]">{filteredLogs.length} events logged</span>
        </div>

        <div className="p-4 space-y-2 max-h-[460px] overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No protocol events recorded yet. Start scanning or initiate a transfer in the Device Simulator.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = new Date(log.timestamp).toISOString().substring(11, 23);
              const isNsd = log.type.startsWith('NSD');
              const isHttp = log.type.startsWith('HTTP');
              const isStream = log.type === 'STREAM_CHUNK';

              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] select-none">{dateStr}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isNsd
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                          : isStream
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          : 'bg-sky-950/80 text-sky-300 border border-sky-800/80'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {log.source} &rarr; {log.destination}
                    </span>
                  </div>

                  <div className="text-slate-200 text-xs font-sans md:text-right truncate max-w-xl">
                    {log.payloadSummary}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* REST API & NSD Spec Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NSD DNS-SD Spec */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Network className="w-4 h-4 text-purple-400" />
            <span>mDNS / NSD Discovery Protocol</span>
          </div>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px]">
              <span className="text-purple-400">Service Type:</span> _wifishare._tcp.<br />
              <span className="text-purple-400">Multicast Group:</span> 224.0.0.251:5353 (IPv4)<br />
              <span className="text-purple-400">Attributes:</span> v=1.0.0, dev=phone, port=8945
            </div>
            <p className="text-slate-400 text-[11px]">
              Each receiver advertises its device name as a DNS-SD instance. Senders issue standard PTR queries
              to discover active endpoints without broadcast storms.
            </p>
          </div>
        </div>

        {/* REST API Spec */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>HTTP REST & Streaming Endpoints</span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-emerald-400 font-bold">POST</span> /api/v1/session
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-emerald-400 font-bold">POST</span> /api/v1/transfer/request
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-emerald-400 font-bold">POST</span> /api/v1/transfer/upload
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-sky-400 font-bold">GET</span> /api/v1/browser/download/:token/:fileId
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
