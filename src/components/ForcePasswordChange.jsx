import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react';

export default function ForcePasswordChange() {
  const { user, signOut } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      setError('A senha atual fornecida pelo admin é obrigatória.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Força um destravamento de sessão e reautentica para validar a senha antiga
      await supabase.auth.refreshSession();
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword
      });

      if (signInError) {
        throw new Error('A senha atual/provisória informada está incorreta.');
      }
      
      // 1. Atualizar a senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // 2. Remover a flag must_change_password do profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
      
      if (profileError) throw profileError;

      setSuccess('Senha alterada com sucesso! Redirecionando...');
      // Força o reload da página inteira para limpar todas as sessões e context cache state em memória
      setTimeout(() => {
        window.location.replace('/');
      }, 800);

    } catch (err) {
      console.error('Password reset error:', err);
      // Supabase errors sometimes don't have .message natively in all nested instances
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

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-xl font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Senha Provisória (Atual)</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Nova Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full p-3.5 bg-[#2842B5] text-white rounded-xl font-bold text-sm tracking-tight hover:bg-[#1d3187] transition-all disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Atualizar e Entrar'}
          </button>
        </form>

        <button
          onClick={signOut}
          className="w-full mt-4 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
