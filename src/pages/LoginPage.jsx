import React, { useState } from 'react';
import { Utensils } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';

const translateError = (errorMsg) => {
  if (errorMsg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (errorMsg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (errorMsg.includes('Password should be at least 6 characters')) return 'A senha deve ter no mínimo 6 caracteres.';
  if (errorMsg.includes('Email not confirmed')) return 'Por favor, confirme seu e-mail antes de entrar.';
  if (errorMsg.includes('Email not whitelisted')) return 'Cadastro bloqueado: Seu e-mail não foi liberado pelo Administrador.';
  if (errorMsg.includes('rate_limit')) return 'Muitas tentativas. Tente novamente mais tarde.';
  return errorMsg;
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pix, setPix] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
         setError(translateError(error.message));
         setIsLoading(false);
      } else {
         navigate('/');
      }
    } else {
      const { data, error } = await signUp(email, password, { name, phone, pix });
      setIsLoading(false);
      if (error) {
         setError(translateError(error.message));
      } else {
         setSuccess("Conta criada com sucesso! Você já pode fazer login.");
         setIsLogin(true);
         setPassword('');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-sm">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Utensils className="text-white dark:text-black" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Janta Trembolona</h1>
          <p className="text-sm text-zinc-500 font-medium tracking-tighter mt-1">{isLogin ? 'Acesso Restrito' : 'Cadastro de Membro'}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-600 border border-green-100 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}
          
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">Nome</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    placeholder="Seu nome completo"
                    className="w-full p-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-400">Telefone</label>
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={!isLogin}
                      placeholder="(00) 00000-0000"
                      className="w-full p-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-zinc-400">PIX</label>
                    <input 
                      type="text" 
                      value={pix}
                      onChange={(e) => setPix(e.target.value)}
                      required={!isLogin}
                      placeholder="Chave PIX"
                      className="w-full p-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-400">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full p-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-400">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full p-3 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-6 bg-zinc-900 text-white dark:bg-white dark:text-black p-3 rounded-xl font-bold transition-transform active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              isLogin ? 'Entrar' : 'Criar Conta'
            )}
          </button>
        </form>
        
        <p className="text-center text-xs text-zinc-500 mt-6 font-medium">
          {isLogin ? "Não possui conta? " : "Já possui conta? "}
          <button 
            type="button" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }} 
            className="text-zinc-900 dark:text-white font-bold underline"
          >
            {isLogin ? "Cadastrar Usuário" : "Fazer Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
