import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { SpeedometerLogo } from '../components/SpeedometerLogo';
import { Mail, Lock, Eye, EyeOff, User, Check, AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, register } = useDriftPark();

  const [email, setEmail] = useState(() => {
    return localStorage.getItem('driftpark_remembered_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('driftpark_remembered_email') !== null;
  });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (isRegisterMode && !registerName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 dígitos.');
      return;
    }

    setIsSubmitting(true);

    // Timeout de segurança absoluto para garantir que NUNCA fique travado carregando
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMessage('Tempo limite de resposta esgotado. Verifique sua conexão e tente novamente.');
    }, 4000);

    try {
      if (isRegisterMode) {
        const res = await register(registerName, email, password);
        if (!res.success) {
          setErrorMessage(res.message || 'Erro ao realizar cadastro.');
        } else {
          if (rememberMe) {
            localStorage.setItem('driftpark_remembered_email', email.trim().toLowerCase());
          } else {
            localStorage.removeItem('driftpark_remembered_email');
          }
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setErrorMessage(res.message || 'Erro ao realizar login.');
        } else {
          if (rememberMe) {
            localStorage.setItem('driftpark_remembered_email', email.trim().toLowerCase());
          } else {
            localStorage.removeItem('driftpark_remembered_email');
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMessage(e?.message || 'Erro inesperado.');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setErrorMessage('');
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between px-6 py-8 text-slate-100 overflow-y-auto">
      {/* Background glow radial */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-96 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 25%, rgba(0, 240, 255, 0.25) 0%, rgba(11, 19, 43, 0) 70%)',
        }}
      />

      {/* Top Branding Section (Matching reference photo) */}
      <div className="flex flex-col items-center text-center pt-4 z-10">
        <SpeedometerLogo size={88} animated={true} className="mb-4" />

        <h1 className="text-3xl font-extrabold tracking-wider text-white font-display">
          DRIFT PARK
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 font-medium tracking-wide">
          Sistema de Gestão & Telemetria de Pista
        </p>
      </div>

      {/* Form Section */}
      <div className="w-full max-w-sm mx-auto my-6 z-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegisterMode && (
            <div className="relative">
              <label className="absolute -top-2.5 left-4 px-2 py-0.5 bg-[#0B132B] text-[11px] font-medium text-cyan-400 rounded">
                Nome Completo
              </label>
              <div className="flex items-center px-4 py-3.5 rounded-xl border border-slate-700 focus-within:border-cyan-400 focus-within:shadow-[0_0_12px_rgba(0,180,216,0.25)] bg-[#141E38]/60 transition-all">
                <User size={18} className="text-cyan-400 mr-3 shrink-0" />
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Seu nome"
                  required={isRegisterMode}
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Email input with floating badge title matching screenshot */}
          <div className="relative">
            <label className="absolute -top-2.5 left-4 px-2 py-0.5 bg-[#0B132B] text-[11px] font-medium text-slate-300 rounded">
              E-mail de Acesso
            </label>
            <div className="flex items-center px-4 py-3.5 rounded-xl border border-slate-700/90 focus-within:border-cyan-400 focus-within:shadow-[0_0_12px_rgba(0,180,216,0.25)] bg-[#141E38]/60 transition-all">
              <Mail size={18} className="text-[#00B4D8] mr-3 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password input with floating badge title and eye toggle matching screenshot */}
          <div className="relative">
            <label className="absolute -top-2.5 left-4 px-2 py-0.5 bg-[#0B132B] text-[11px] font-medium text-slate-300 rounded">
              Senha
            </label>
            <div className="flex items-center px-4 py-3.5 rounded-xl border border-slate-700/90 focus-within:border-cyan-400 focus-within:shadow-[0_0_12px_rgba(0,180,216,0.25)] bg-[#141E38]/60 transition-all">
              <Lock size={18} className="text-[#00B4D8] mr-3 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 dígitos"
                required
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                aria-label="Alternar visibilidade de senha"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Options: Remember login & Forgot password */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  rememberMe
                    ? 'bg-[#00B4D8] border-[#00B4D8] text-[#070D1E]'
                    : 'border-slate-600 bg-[#141E38]'
                }`}
              >
                {rememberMe && <Check size={12} strokeWidth={3} />}
              </div>
              <span className="text-slate-300 font-medium">Lembrar login</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setInfoMessage('Instruções para redefinir senha enviadas para o e-mail informado.');
                setErrorMessage('');
              }}
              className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium hover:underline"
            >
              Esqueceu a senha?
            </button>
          </div>

          {infoMessage && (
            <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-2">
              <Check size={16} className="shrink-0 text-cyan-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Big Cyan Action Button matching reference image with loading state */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 rounded-xl bg-[#48CAE4] hover:bg-[#00B4D8] text-[#0B132B] font-bold text-sm tracking-wider uppercase transition-all duration-200 glow-cyan-btn hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 ${
              isSubmitting ? 'opacity-80 cursor-wait' : ''
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#0B132B] border-t-transparent rounded-full animate-spin" />
                <span>{isRegisterMode ? 'CADASTRANDO...' : 'ENTRANDO...'}</span>
              </div>
            ) : (
              <span>{isRegisterMode ? 'CADASTRAR E ENTRAR' : 'ENTRAR'}</span>
            )}
          </button>

          {/* Register toggle link matching reference image */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {isRegisterMode ? (
                <span>Já tem conta? <strong className="text-cyan-400">Clique para entrar</strong></span>
              ) : (
                <span>Ainda não tem cadastro? <strong className="text-cyan-400">Clique para cadastrar.</strong></span>
              )}
            </button>
          </div>

          {/* Atalhos de Acesso Rápido para as Contas do Firebase */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center mb-2">
              Acesso Rápido às Contas do Firebase
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEmail('admcledson@gmail.com');
                  setPassword('123456');
                  setErrorMessage('');
                  setInfoMessage('Conta do Adm Clécio preenchida. Clique em ENTRAR.');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#141E38]/80 hover:bg-[#141E38] border border-amber-500/30 hover:border-amber-500/60 text-left text-xs flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">👑</span>
                  <div>
                    <div className="text-[11px] font-bold text-amber-300">Adm Clécio (Administrador)</div>
                    <div className="text-[10px] text-slate-400 font-mono">admcledson@gmail.com</div>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold group-hover:bg-amber-500/20">
                  Preencher
                </span>
              </button>

              {(() => {
                try {
                  const del = JSON.parse(localStorage.getItem('driftpark_deleted_accounts_v1') || '[]');
                  if (del.includes('carollimap1993@gmail.com')) return null;
                } catch {}
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('carollimap1993@gmail.com');
                      setPassword('123456');
                      setErrorMessage('');
                      setInfoMessage('Sub-conta de Carol Lima preenchida. Clique em ENTRAR.');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#141E38]/80 hover:bg-[#141E38] border border-cyan-500/30 hover:border-cyan-500/60 text-left text-xs flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🏎️</span>
                      <div>
                        <div className="text-[11px] font-bold text-cyan-300">Carol Lima (Sub-conta / Operador)</div>
                        <div className="text-[10px] text-slate-400 font-mono">carollimap1993@gmail.com</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-semibold group-hover:bg-cyan-500/20">
                      Preencher
                    </span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => {
                  setEmail('michel.lima20000@gmail.com');
                  setPassword('123456');
                  setErrorMessage('');
                  setInfoMessage('Conta do Michel Lima preenchida. Clique em ENTRAR.');
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#141E38]/40 hover:bg-[#141E38] border border-slate-700/60 hover:border-slate-500 text-left text-xs flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">👑</span>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300">Michel Lima (Admin Matriz)</div>
                    <div className="text-[10px] text-slate-500 font-mono">michel.lima20000@gmail.com</div>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-slate-200">
                  Preencher
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
