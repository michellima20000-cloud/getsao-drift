import React, { useState } from 'react';
import { FLUTTER_CODE_FILES, FlutterFile } from '../flutter_code/flutterCodeFiles';
import {
  Code2,
  Copy,
  Check,
  Download,
  FileCode,
  X,
  ExternalLink,
  ShieldCheck,
  FolderGit2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const FlutterCodeViewerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<FlutterFile>(FLUTTER_CODE_FILES[0]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col rounded-2xl bg-[#0B132B] border border-cyan-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#101932] border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Code2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Código Flutter (Dart) & Firebase Firestore Rules</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  Pronto para Produção
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Arquivos completos com Provider, Multi-Tenant por <code>tenantId</code> e Dark Theme
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body (Sidebar + Code Editor) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* File Explorer Sidebar */}
          <div className="w-full md:w-64 bg-[#090F20] border-b md:border-b-0 md:border-r border-slate-800 p-2 overflow-y-auto shrink-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 py-1.5 flex items-center gap-1.5">
              <FolderGit2 size={13} className="text-cyan-400" />
              <span>Explorador de Arquivos</span>
            </div>

            <div className="space-y-1 mt-1">
              {FLUTTER_CODE_FILES.map((file) => {
                const isSelected = selectedFile.path === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <FileCode
                      size={14}
                      className={isSelected ? 'text-cyan-400 shrink-0' : 'text-slate-500 shrink-0'}
                    />
                    <div className="truncate">
                      <div className="truncate">{file.name}</div>
                      <div className="text-[9px] text-slate-500 truncate">{file.path}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Code Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0B132B]">
            {/* File info bar & Actions */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#141E38]/70 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-white">
                  {selectedFile.path}
                </span>
                <p className="text-[10px] text-slate-400 truncate max-w-md">
                  {selectedFile.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadFile}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-sm transition-colors"
                >
                  <Download size={14} />
                  <span>Baixar</span>
                </button>
              </div>
            </div>

            {/* Code Content Display */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-slate-200 bg-[#070D1E]/90 select-text">
              <pre className="whitespace-pre">
                <code>{selectedFile.content}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#101932] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Código 100% aderente ao Flutter 3.x, Firebase Auth e Firestore Multi-Tenant</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
