import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function ForcePasswordChange() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Critérios de força da senha
  const criteria = [
    { label: 'Mínimo 6 caracteres', ok: password.length >= 6 },
    { label: 'Letras e números', ok: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
    { label: 'Senhas coincidem', ok: password.length >= 6 && password === confirmPassword },
  ];
  const allOk = criteria.every(c => c.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allOk) return;

    setLoading(true);
    setError('');

    try {
      // 1. Remove a flag must_change_password no DB PRIMEIRO
      //    Isso garante que quando USER_UPDATED disparar no AuthContext,
      //    o refreshProfile já encontra must_change_password = false
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Atualiza a senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        // Reverte a flag caso o update falhe
        await supabase.from('profiles').update({ must_change_password: true }).eq('id', user.id);
        throw updateError;
      }

      // 3. Sucesso — desconecta o usuário para forçar novo login com a nova senha
      setSuccess(true);

      setTimeout(async () => {
        try { await signOut(); } catch {}
        // signOut redireciona via AuthContext → ProtectedRoute → /login
      }, 2500);

    } catch (err) {
      console.error('ForcePasswordChange error:', err);
      setError(err?.message || 'Erro ao alterar a senha. Tente novamente.');
      setLoading(false);
    }
  };

  // Tela de sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-[#f2f1fb] dark:bg-[#090914] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white dark:bg-[#0b0b1e] rounded-2xl p-8 shadow-xl border border-zinc-100 dark:border-white/[0.05] flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
            <CheckCircle size={34} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Senha Criada!</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Sua senha foi salva com sucesso. Você será desconectado — use a{' '}
              <strong className="text-zinc-900 dark:text-white">nova senha</strong> para entrar.
            </p>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ animation: 'progressShrink 2.5s linear forwards' }}
            />
          </div>
          <style>{`
            @keyframes progressShrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f1fb] dark:bg-[#090914] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#0b0b1e] rounded-2xl shadow-xl border border-zinc-100 dark:border-white/[0.05] overflow-hidden">

        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20 p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4">
            <Lock size={22} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Crie sua Senha de Acesso</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            Um administrador redefiniu sua senha. Crie uma senha pessoal para acessar o sistema.
            Após salvar, você será desconectado para entrar com a nova senha.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Erro */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium border border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nova senha */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Crie uma senha segura"
                  className="w-full p-3 pr-11 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium disabled:opacity-50 text-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Repita a nova senha"
                  className="w-full p-3 pr-11 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium disabled:opacity-50 text-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Critérios de validação */}
            {password.length > 0 && (
              <div className="space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-700">
                {criteria.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      c.ok ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}>
                      {c.ok && <CheckCircle size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                      c.ok ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Botão salvar */}
            <button
              type="submit"
              disabled={loading || !allOk}
              className="w-full p-3.5 bg-[#2842B5] text-white rounded-xl font-bold text-sm tracking-tight hover:bg-[#1d3187] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Salvar Nova Senha
                </>
              )}
            </button>
          </form>

          {/* Sair */}
          <button
            onClick={signOut}
            disabled={loading}
            className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
