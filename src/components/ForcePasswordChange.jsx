import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function ForcePasswordChange() {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      setError('A senha provisória fornecida pelo admin é obrigatória.');
      return;
    }
    if (password.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password === oldPassword) {
      setError('A nova senha não pode ser igual à senha provisória.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Reautentica para validar a senha provisória passada pelo admin
      await supabase.auth.refreshSession();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword
      });

      if (signInError) {
        throw new Error('A senha provisória informada está incorreta. Use exatamente a senha que o administrador definiu.');
      }

      // 2. Atualizar a senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // 3. Remover a flag must_change_password do profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setSuccess('Senha alterada com sucesso! Entrando no sistema...');

      // 4. Atualiza o profile em memória (remove must_change_password do state)
      // Isso faz o ProtectedRoute deixar de mostrar esta tela
      await refreshProfile(user.id);

      // 5. Navega para o dashboard (o ProtectedRoute já não vai mais redirecionar aqui)
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 600);

    } catch (err) {
      console.error('Password reset error:', err);
      setError('Erro ao alterar senha: ' + (err?.message || JSON.stringify(err)));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f1fb] dark:bg-[#090914] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#0b0b1e] rounded-2xl p-6 shadow-xl border border-zinc-100 dark:border-white/[0.05]">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Atualização Obrigatória</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Um administrador redefiniu sua senha. Para sua segurança, você deve criar uma nova senha agora.
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium border border-red-100 dark:border-red-500/20">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-xl font-medium border border-green-100 dark:border-green-500/20">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Senha Provisória (fornecida pelo Admin)</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={loading || !!success}
              placeholder="Digite a senha que o admin enviou"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Nova Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !!success}
              placeholder="Mínimo de 6 caracteres"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || !!success}
              placeholder="Repita a nova senha"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium disabled:opacity-50"
            />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 font-medium mt-1">As senhas não coincidem.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full p-3.5 bg-[#2842B5] text-white rounded-xl font-bold text-sm tracking-tight hover:bg-[#1d3187] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Salvando...
              </>
            ) : success ? 'Redirecionando...' : 'Atualizar Senha e Entrar'}
          </button>
        </form>

        <button
          onClick={signOut}
          disabled={loading}
          className="w-full mt-4 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
