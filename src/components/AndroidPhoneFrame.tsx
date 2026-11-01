import React from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface AndroidPhoneFrameProps {
  deviceName: string;
  ipAddress: string;
  isWifiConnected: boolean;
  activeScreenName: string;
  children: React.ReactNode;
}

export const AndroidPhoneFrame: React.FC<AndroidPhoneFrameProps> = ({
  deviceName,
  ipAddress,
  isWifiConnected,
  activeScreenName,
  children
}) => {
  return (
    <div className="flex flex-col w-full max-w-[370px] bg-slate-900 border-4 border-slate-700/80 rounded-[40px] shadow-2xl overflow-hidden ring-1 ring-slate-800">
      {/* Phone Header / Status Bar */}
      <div className="bg-slate-950 px-6 pt-3 pb-2 flex items-center justify-between text-[11px] text-slate-300 select-none border-b border-slate-800/60">
        <span className="font-semibold font-mono">10:45</span>

        {/* Camera cutout */}
        <div className="w-3.5 h-3.5 rounded-full bg-slate-800 ring-2 ring-slate-900 mx-auto" />

        <div className="flex items-center gap-1.5 text-slate-400">
          <Signal className="w-3 h-3 text-slate-300" />
          <Wifi className={`w-3 h-3 ${isWifiConnected ? 'text-sky-400' : 'text-slate-600'}`} />
          <BatteryMedium className="w-3.5 h-3.5 text-slate-300" />
        </div>
      </div>

      {/* Device Info Badge */}
      <div className="bg-slate-900/90 px-4 py-1.5 flex items-center justify-between text-[11px] border-b border-slate-800">
        <span className="font-medium text-slate-200 truncate">{deviceName}</span>
        <span className="font-mono text-slate-400 text-[10px]">{ipAddress}</span>
      </div>

      {/* Phone Screen Area */}
      <div className="flex-1 bg-slate-950 min-h-[560px] max-h-[620px] overflow-y-auto flex flex-col relative text-slate-100">
        {children}
      </div>

      {/* Android Bottom Navigation Pill Bar */}
      <div className="bg-slate-950 py-2.5 flex justify-center border-t border-slate-900">
        <div className="w-32 h-1 bg-slate-600 rounded-full" />
      </div>
    </div>
  );
};
