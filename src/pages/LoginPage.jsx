import React, { useState, useEffect } from 'react';
import { Utensils, Ban, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { PendingRatingsModal } from '../components/PendingRatingsModal';
import { supabase } from '../lib/supabase';

const translateError = (errorMsg) => {
  if (errorMsg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (errorMsg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (errorMsg.includes('Password should be at least 6 characters')) return 'A senha deve ter no mínimo 6 caracteres.';
  if (errorMsg.includes('Email not confirmed')) return 'Por favor, confirme seu e-mail antes de entrar.';
  if (errorMsg.includes('Email not whitelisted')) return 'Cadastro bloqueado: e-mail não liberado pelo Administrador.';
  if (errorMsg.includes('rate_limit')) return 'Muitas tentativas. Tente novamente em breve.';
  return errorMsg;
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#5a5a80]">
      {label}
    </label>
    {children}
  </div>
);

const inputCls = `
  w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all
  bg-zinc-50 dark:bg-white/[0.05]
  text-zinc-900 dark:text-white
  border border-zinc-200 dark:border-white/[0.09]
  placeholder:text-zinc-300 dark:placeholder:text-white/20
  focus:border-[#2842B5]/60 focus:ring-2 focus:ring-[#2842B5]/20
`;

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pix, setPix] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [isPendingRatingsOpen, setIsPendingRatingsOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [appLogoUrl, setAppLogoUrl] = useState('https://raw.githubusercontent.com/jeanturatto/jantatrembolona/main/logo_trembo.png');
  const [appName, setAppName] = useState('Janta Trembolona');

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('show_blocked_modal') === 'true') {
      setIsBlockedModalOpen(true);
      localStorage.removeItem('show_blocked_modal');
    }
  }, []);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (isLogin) {
      const { error } = await signIn(email, password, rememberMe);
      if (error) {
        if (error.message?.includes('Acesso bloqueado')) setIsBlockedModalOpen(true);
        else setError(translateError(error.message));
        setIsLoading(false);
      } else {
        const { data: { user: loggedUser } } = await supabase.auth.getUser();
        const today = new Date().toISOString().split('T')[0];

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', loggedUser.id)
          .single();

        const userCreatedAt = userProfile?.created_at;

        const { data: ratings } = await supabase
          .from('ratings')
          .select('event_id')
          .eq('user_id', loggedUser.id);

        const ratedIds = new Set((ratings || []).map(r => r.event_id));

        const { data: events } = await supabase
          .from('events')
          .select('*, attendances(user_id, status)')
          .eq('status', 'Finalizado')
          .lte('date', today)
          .order('date', { ascending: false });

        const pending = (events || [])
          .filter(j => !userCreatedAt || new Date(j.date) >= new Date(userCreatedAt))
          .map(j => {
            const userAtt = j.attendances?.find(a => a.user_id === loggedUser.id);
            return { ...j, userStatus: userAtt?.status };
          })
          .filter(j => j.userStatus === 'Presente' || j.userStatus === 'Confirmado')
          .filter(j => !ratedIds.has(j.id));

        if (pending.length > 0) {
          setPendingUser(loggedUser);
          setIsPendingRatingsOpen(true);
        } else {
          navigate('/');
        }
      }
    } else {
      const { error } = await signUp(email, password, { name, phone, pix, data_nascimento: dataNascimento || null });
      setIsLoading(false);
      if (error) {
        setError(translateError(error.message));
      } else {
        setSuccess('Conta criada com sucesso! Faça login para entrar.');
        setIsLogin(true);
        setPassword('');
        setEmail('');
      }
    }
  };

  return (
    <div className="stakent-login-bg min-h-screen flex items-center justify-center p-4">

      {/* Logo de fundo */}
      {appLogoUrl && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <img 
            src={appLogoUrl} 
            alt="Logo" 
            className="w-full h-full object-contain opacity-20 blur-[1px]" 
          />
        </div>
      )}

      {/* Decorative orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#2842B5]/10 dark:bg-[#2842B5]/15 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-[#B8ABCF]/08 dark:bg-[#B8ABCF]/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-in fade-in">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-[#2842B5] rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-[#2842B5]/30 overflow-hidden">
            {appLogoUrl
              ? <img src={appLogoUrl} alt="Logo" className="w-full h-full object-cover" />
              : <Utensils className="text-white" size={24} />
            }
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {appName}
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-400 dark:text-[#5a5a80] mt-1.5">
            {isLogin ? 'Acesso Restrito' : 'Cadastro de Membro'}
          </p>
        </div>

        {/* Card */}
        <div className="
          bg-white/90 dark:bg-white/[0.04]
          backdrop-blur-2xl
          border border-[#2842B5]/10 dark:border-white/[0.08]
          rounded-2xl p-6
          shadow-xl shadow-zinc-200/60 dark:shadow-black/50
        ">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-500/[0.08] border border-green-100 dark:border-green-500/20 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <Field label="Nome">
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    required placeholder="Seu nome completo" autoComplete="off" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      required placeholder="(00) 00000-0000" autoComplete="off" className={inputCls} />
                  </Field>
                  <Field label="PIX">
                    <input type="text" value={pix} onChange={e => setPix(e.target.value)}
                      required placeholder="Chave PIX" autoComplete="off" className={inputCls} />
                  </Field>
                </div>
                <Field label="Data de Nascimento">
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={e => setDataNascimento(e.target.value)}
                    required
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            <Field label="E-mail">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="seu@email.com" autoComplete="email" className={inputCls} />
            </Field>

            <Field label="Senha">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} className={inputCls} />
            </Field>

            {isLogin && (
              <label className="flex items-center gap-3 cursor-pointer group select-none pt-1">
                <div className="relative shrink-0">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="peer sr-only" />
                  <div className="w-4 h-4 border-2 border-zinc-300 dark:border-white/20 rounded peer-checked:bg-[#2842B5] peer-checked:border-[#2842B5] transition-all flex items-center justify-center">
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-zinc-400 dark:text-[#5a5a80] group-hover:text-zinc-600 dark:group-hover:text-[#B8ABCF] transition-colors">
                  Lembrar neste dispositivo
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#2842B5] hover:bg-[#3452c5] active:scale-[0.98] disabled:opacity-60 text-white py-3 px-4 rounded-xl font-semibold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2842B5]/25"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-400 dark:text-[#5a5a80] mt-5">
          {isLogin ? 'Não possui conta? ' : 'Já possui conta? '}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
            className="text-[#2842B5] dark:text-[#B8ABCF] font-semibold hover:underline underline-offset-2 transition-colors"
          >
            {isLogin ? 'Criar conta' : 'Fazer login'}
          </button>
        </p>
      </div>

      <Modal isOpen={isBlockedModalOpen} title="Acesso Revogado">
        <div className="flex flex-col items-center text-center py-2">
          <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4">
            <Ban size={28} />
          </div>
          <p className="text-zinc-700 dark:text-[#B8ABCF] font-medium text-sm mb-2">
            Usuário Bloqueado
          </p>
          <p className="text-xs text-zinc-400 dark:text-[#5a5a80]">
            Entre em contato com o Presidente do Clube. Seu acesso foi revogado pelo administrador.
          </p>
          <button
            onClick={() => setIsBlockedModalOpen(false)}
            className="w-full mt-6 py-3 border border-zinc-200 dark:border-white/[0.09] text-zinc-900 dark:text-[#B8ABCF] rounded-xl font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Voltar para Login
          </button>
        </div>
      </Modal>

      <PendingRatingsModal
        isOpen={isPendingRatingsOpen}
        user={pendingUser}
        onClose={() => setIsPendingRatingsOpen(false)}
        onAllRated={() => {
          setIsPendingRatingsOpen(false);
          navigate('/');
        }}
      />
    </div>
  );
}
