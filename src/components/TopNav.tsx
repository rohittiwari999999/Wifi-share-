import React from 'react';
import { Download } from 'lucide-react';

interface TopNavProps {
  activeTab: 'simulator' | 'browser-portal' | 'codebase' | 'github-ci' | 'protocol' | 'troubleshoot';
  onTabChange: (tab: 'simulator' | 'browser-portal' | 'codebase' | 'github-ci' | 'protocol' | 'troubleshoot') => void;
  onExportProject: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  onExportProject
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
          WiFi Share
        </span>
        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          Android P2P Protocol
        </span>
      </div>

      {/* Zone 2: 4-5 single-line clean navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          onClick={() => onTabChange('simulator')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'simulator'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          Device Simulator
        </button>
        <button
          onClick={() => onTabChange('browser-portal')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'browser-portal'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          Browser Receiver (Mode B)
        </button>
        <button
          onClick={() => onTabChange('codebase')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'codebase'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          Android Codebase
        </button>
        <button
          onClick={() => onTabChange('github-ci')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'github-ci'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          GitHub Signed APK
        </button>
        <button
          onClick={() => onTabChange('protocol')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'protocol'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          Protocol & Packets
        </button>
        <button
          onClick={() => onTabChange('troubleshoot')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'troubleshoot'
              ? 'text-sky-400 font-semibold border-b-2 border-sky-400'
              : 'text-slate-400'
          }`}
        >
          Diagnostics & Wi-Fi
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onExportProject}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Android Project</span>
        </button>
      </div>
    </header>
  );
};
