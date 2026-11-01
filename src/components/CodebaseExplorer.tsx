import React, { useState } from 'react';
import {
  FileCode,
  FolderTree,
  Copy,
  Check,
  Download,
  Search,
  ExternalLink,
  Code
} from 'lucide-react';
import { ANDROID_FILES, AndroidFileRecord } from '../data/androidProjectTree';

interface CodebaseExplorerProps {
  onExportZip: () => void;
}

export const CodebaseExplorer: React.FC<CodebaseExplorerProps> = ({ onExportZip }) => {
  const [selectedFile, setSelectedFile] = useState<AndroidFileRecord>(ANDROID_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'config', label: 'Gradle & Config' },
    { id: 'manifest', label: 'Manifest & Perms' },
    { id: 'discovery', label: 'NSD Discovery' },
    { id: 'transfer', label: 'Ktor Transfer Engine' },
    { id: 'browser', label: 'Browser Receiver' },
    { id: 'core', label: 'Security & SAF' },
    { id: 'cicd', label: 'GitHub Signed APK' },
    { id: 'test', label: 'Unit Tests' }
  ];

  const filteredFiles = ANDROID_FILES.filter((file) => {
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-sky-400" />
            <span>Native Android Studio Project Inspector</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            100% complete, un-stubbed Kotlin & Jetpack Compose codebase ready to compile with Gradle 8.8+ & Android SDK 35.
          </p>
        </div>

        <button
          onClick={onExportZip}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Complete Project (ZIP)</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or files..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Split Viewer: File List Tree on Left, Code on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* File List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
          <div className="p-3 bg-slate-950 font-semibold text-xs text-slate-300 flex items-center justify-between">
            <span>Project Files ({filteredFiles.length})</span>
            <span className="text-[10px] text-slate-500 font-mono">com.wifishare.local</span>
          </div>

          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-800/50">
            {filteredFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={`w-full p-3 text-left transition-colors flex items-start gap-3 ${
                  selectedFile.path === file.path
                    ? 'bg-sky-950/40 border-l-2 border-sky-400'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <FileCode
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    selectedFile.path === file.path ? 'text-sky-400' : 'text-slate-500'
                  }`}
                />
                <div className="truncate">
                  <div
                    className={`text-xs font-medium truncate ${
                      selectedFile.path === file.path ? 'text-sky-300' : 'text-slate-200'
                    }`}
                  >
                    {file.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {file.description}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 truncate mt-1">
                    {file.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Code Content View */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {/* File Header */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{selectedFile.name}</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedFile.language}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {selectedFile.path}
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="p-4 overflow-x-auto max-h-[580px] font-mono text-xs leading-relaxed text-slate-300">
            <pre>
              <code>
                {selectedFile.content.split('\n').map((line, idx) => (
                  <div key={idx} className="table-row">
                    <span className="table-cell pr-4 text-slate-600 select-none text-right tabular-nums w-8">
                      {idx + 1}
                    </span>
                    <span className="table-cell whitespace-pre">{line}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
