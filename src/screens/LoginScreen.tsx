import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { SpeedometerLogo } from '../components/SpeedometerLogo';
import { Mail, Lock, Eye, EyeOff, User, Check, AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, loginWithGoogle, register } = useDriftPark();

  const [email, setEmail] = useState(() => {
    return localStorage.getItem('driftpark_saved_email') || 'michel.lima20000@gmail.com';
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('driftpark_saved_password') || '123456';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('driftpark_remember_me') !== 'false';
  });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setIsSubmitting(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success) {
        setErrorMessage(res.message || 'Erro ao autenticar com o Google.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

    if (rememberMe) {
      localStorage.setItem('driftpark_saved_email', email.trim());
      localStorage.setItem('driftpark_saved_password', password.trim());
      localStorage.setItem('driftpark_remember_me', 'true');
    } else {
      localStorage.removeItem('driftpark_saved_email');
      localStorage.removeItem('driftpark_saved_password');
      localStorage.setItem('driftpark_remember_me', 'false');
    }

    setIsSubmitting(true);
    try {
      if (isRegisterMode) {
        const res = await register(registerName, email, password);
        if (!res.success) {
          setErrorMessage(res.message || 'Erro ao realizar cadastro.');
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setErrorMessage(res.message || 'Erro ao realizar login.');
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMessage(e?.message || 'Erro inesperado.');
    } finally {
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

          {/* Google Firebase Login Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-xl bg-[#141E38] hover:bg-[#1C284C] border border-cyan-500/40 text-slate-100 font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Entrar com Google (Firebase Cloud)</span>
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
        </form>
      </div>
    </div>
  );
};
