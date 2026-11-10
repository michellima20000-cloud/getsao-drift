import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share2, PlusSquare } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'button' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Se já estiver rodando como PWA instalado na tela inicial, oculta o botão
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 4000);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Botão no cabeçalho superior (compacto) */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Instalar aplicativo Drift Park no seu celular ou computador"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40 hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] active:scale-95 ${className}`}
        >
          <Download size={12} className="text-cyan-400 shrink-0 animate-bounce" />
          <span className="text-[10px] tracking-wide uppercase">Instalar App</span>
        </button>
      )}

      {/* Botão padrão / formulário de login */}
      {variant === 'button' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(0,240,255,0.25)] active:scale-[0.99] cursor-pointer ${className}`}
        >
          <Smartphone size={16} className="text-cyan-400" />
          <span>Instalar Aplicativo no Celular</span>
          <Download size={14} className="text-cyan-400" />
        </button>
      )}

      {/* Banner de destaque opcional */}
      {variant === 'banner' && (
        <div className={`p-3 rounded-xl bg-gradient-to-r from-cyan-950/80 to-[#141E38] border border-cyan-500/30 flex items-center justify-between gap-3 text-xs ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Smartphone size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-[12px] truncate">Instale o Drift Park</div>
              <div className="text-[10px] text-slate-400 truncate">Acesso rápido direto da tela inicial</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.3)]"
          >
            Instalar
          </button>
        </div>
      )}

      {/* Feedback de sucesso na instalação */}
      {installedSuccess && (
        <div className="fixed top-4 right-4 z-50 p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in">
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span>Aplicativo instalado com sucesso na tela inicial!</span>
        </div>
      )}

      {/* Modal interativo com guia passo a passo para iOS ou navegadores sem prompt nativo */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0B132B] border border-cyan-500/40 p-5 shadow-2xl text-slate-100 relative">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                🏎️
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                  Instalar DRIFT PARK
                </h3>
                <p className="text-[11px] text-cyan-400">
                  Aplicativo Web Progressivo (PWA)
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300 py-2">
                <p className="text-slate-200">
                  No <strong>iPhone</strong> ou <strong>iPad</strong> (Safari):
                </p>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <Share2 size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    1. Toque no botão de <strong>Compartilhar</strong> na barra do Safari (ícone com quadrado e seta para cima).
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <PlusSquare size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    3. Toque em <strong>Adicionar</strong> no canto superior direito. Pronto!
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300 py-2">
                <p className="text-slate-200">
                  Como instalar no <strong>Android</strong> ou <strong>Computador</strong>:
                </p>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <Download size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    1. Toque nos <strong>3 pontinhos (Menu)</strong> do seu navegador (Chrome / Edge).
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <Smartphone size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    2. Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141E38]/80 border border-slate-700">
                  <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    3. Confirme a instalação para abrir em tela cheia como um app nativo.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors border border-slate-700 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
