import React, { useState } from 'react';
import { Download, Smartphone, Check, X, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'button' | 'badge';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // Se já estiver rodando em modo standalone (PWA instalado no celular/desktop), não exibe
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      } else if (outcome === 'manual_guide') {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleClick}
          title="Instalar Drift Park no seu celular ou computador"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 text-[11px] font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] hover:shadow-[0_0_18px_rgba(0,240,255,0.35)] cursor-pointer ${className}`}
        >
          {justInstalled ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="hidden xs:inline text-[10px]">Instalado!</span>
            </>
          ) : (
            <>
              <Download size={12} className="text-cyan-400 shrink-0 animate-bounce" />
              <span className="hidden xs:inline text-[10px]">Instalar App</span>
            </>
          )}
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all cursor-pointer ${className}`}
        >
          <Smartphone size={16} />
          <span>Instalar Aplicativo (PWA)</span>
        </button>
      )}

      {variant === 'badge' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-medium hover:bg-cyan-900/60 transition cursor-pointer ${className}`}
        >
          <Download size={10} className="text-cyan-400" />
          <span>Baixar App</span>
        </button>
      )}

      {/* Modal Guia de Instalação (iOS Safari / Android Chrome / Desktop) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Instalar DRIFT PARK</h3>
                <p className="text-[11px] text-cyan-400 font-medium">Acesso rápido e direto sem barras</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="text-slate-200">
                  Para instalar no <strong>iPhone / iPad (Safari)</strong>:
                </p>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1 rounded bg-slate-800 text-cyan-400 shrink-0">
                    <Share2 size={16} />
                  </div>
                  <div>
                    1. Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1 rounded bg-slate-800 text-cyan-400 shrink-0">
                    <PlusSquare size={16} />
                  </div>
                  <div>
                    2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1 rounded bg-slate-800 text-emerald-400 shrink-0">
                    <Check size={16} />
                  </div>
                  <div>
                    3. Toque em <strong>Adicionar</strong> no canto superior direito. Pronto!
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="text-slate-200">
                  Para instalar no <strong>Android (Chrome)</strong>:
                </p>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1.5 rounded bg-slate-800 text-cyan-400 font-bold shrink-0">
                    ⋮
                  </div>
                  <div>
                    1. Toque no menu de <strong>três pontos</strong> no canto superior direito.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1 rounded bg-slate-800 text-cyan-400 shrink-0">
                    <Download size={16} />
                  </div>
                  <div>
                    2. Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="text-slate-200">
                  No <strong>Computador (Chrome / Edge)</strong>:
                </p>
                <div className="flex items-start gap-2.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="p-1 rounded bg-slate-800 text-cyan-400 shrink-0">
                    <Download size={16} />
                  </div>
                  <div>
                    Clique no ícone de <strong>instalar app</strong> na barra de endereços do navegador (ao lado da estrela de favoritos).
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition border border-slate-700 cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
