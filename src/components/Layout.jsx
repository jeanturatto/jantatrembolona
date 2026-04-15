import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  User,
  Settings,
  LogOut,
  Utensils,
  ChevronRight,
  Menu,
  X,
  Bell,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileModal } from './ProfileModal';
import { CreateEventModal } from './CreateEventModal';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false); // New state for New Entry button
  const [appConfig, setAppConfig] = useState({ name: 'Janta', subtitle: 'TREMBOLONA ELITE', iconUrl: '' });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      if (data) {
        const settings = { name: 'Janta Trembolona', subtitle: 'Grupo de Jantas', iconUrl: '' };
        data.forEach(({ key, value }) => {
          if (key === 'app_name') settings.name = value || 'Janta Trembolona';
          if (key === 'app_subtitle') settings.subtitle = value || 'Grupo de Jantas';
          if (key === 'app_icon_url') settings.iconUrl = value || '';
        });
        setAppConfig(settings);
      }
    };
    fetchSettings();
    window.addEventListener('app_settings_updated', fetchSettings);
    return () => window.removeEventListener('app_settings_updated', fetchSettings);
  }, []);

  const handleLogout = async () => {
    try { await signOut(); } catch (e) { console.error('Logout error:', e); }
    finally { window.location.href = '/login'; }
  };

  const navItems = [
    { to: '/', label: 'Início',     icon: LayoutDashboard, end: true },
    { to: '/jantas', label: 'Jantas', icon: Calendar },
    ...(isAdmin ? [{ to: '/relatorios', label: 'Relatórios', icon: BarChart3 }] : []),
  ];

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleProfileSave = () => {
    // A lógica de salvar (incluindo senha) foi movida para dentro do ProfileModal.
    // Este callback é chamado apenas ao concluir com sucesso para exibir o toast.
    showToast('Perfil atualizado com sucesso!');
  };

  const userInitial = profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U';

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] bg-background text-on-background font-sans overflow-x-hidden">

      {/* ── MOBILE HEADER ── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 z-40 flex items-center justify-between px-4
        bg-white/80 dark:bg-[#0b0b1e]/90 backdrop-blur-xl
        border-b border-[#2842B5]/08 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {appConfig.iconUrl ? (
            <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
              <img src={appConfig.iconUrl} alt="icon" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-[#2842B5] rounded-xl flex items-center justify-center shrink-0">
              <Utensils className="text-white" size={15} />
            </div>
          )}
          <span className="font-semibold text-sm text-zinc-900 dark:text-white tracking-tight truncate">{appConfig.name}</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-zinc-400 dark:text-[#5a5a80] hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* ── MOBILE OVERLAY ── */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-md z-40 animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed h-full w-72 md:w-60 z-50 flex flex-col
        bg-white dark:bg-[#121226]
        border-r border-zinc-100 dark:border-white/[0.05]
        transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>

        {/* Logo */}
        <div className="px-6 h-24 flex items-center border-b border-zinc-100 dark:border-white/[0.05] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex flex-col">
              <p className="font-extrabold text-lg text-zinc-900 dark:text-white tracking-tight leading-tight">{appConfig.name}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-[#5a5a80] uppercase tracking-widest">{appConfig.subtitle}</p>
            </div>
          </div>
          <button
            className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg ml-auto"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto w-full">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                  ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-400 dark:text-[#5a5a80] hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-zinc-600 dark:hover:text-white'
                }`
              }
            >
              <item.icon size={18} strokeWidth={isActive => isActive ? 2.5 : 2} className={({isActive})=> isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400"} />
              {item.label}
            </NavLink>
          ))}

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-white/[0.05]">
            <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300 dark:text-[#3a3a60]">Ações</p>
            <button
              onClick={() => { setIsMobileMenuOpen(false); setIsProfileOpen(true); }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-400 dark:text-[#5a5a80] hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-zinc-600 transition-all text-left"
            >
              <User size={18} strokeWidth={2} />
              Perfil
            </button>
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                    ? 'bg-zinc-100/50 dark:bg-white/[0.08] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-400 dark:text-[#5a5a80] hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-zinc-600 dark:hover:text-white'
                  }`
                }
              >
                <Settings size={18} strokeWidth={2} />
                Painel Admin
              </NavLink>
            )}
          </div>
        </nav>

        {/* User footer + New Entry */}
        <div className="px-6 py-6 mt-auto">
          {isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black py-3 rounded-[0.85rem] font-semibold text-sm mb-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] hover:opacity-90"
            >
              + New Entry
            </button>
          )}
          
          <div className="bg-white dark:bg-[#121226] border border-zinc-100 dark:border-white/[0.06] shadow-sm rounded-xl p-3 flex flex-col gap-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.02]" onClick={() => setIsProfileOpen(true)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold shrink-0 overflow-hidden">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : userInitial
                }
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-xs font-bold truncate text-zinc-900 dark:text-white capitalize leading-tight">
                  {profile?.name || user?.email?.split('@')[0] || 'Usuário'}
                </p>
                <p className="text-[9px] uppercase font-bold text-zinc-400 dark:text-[#5a5a80] tracking-wider mt-0.5">{isAdmin ? 'ADMIN MEMBER' : 'MEMBER'}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                className="p-1.5 text-zinc-300 dark:text-[#3a3a60] hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg shrink-0 outline-none"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 md:ml-60 pt-16 md:pt-0 w-full max-w-full overflow-x-hidden">
        <div className="dark:dot-grid min-h-[100dvh]">
          <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 h-full flex flex-col">
            <Outlet />
          </div>
        </div>
      </main>

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl animate-in fade-in tracking-tight border ${
          toast.type === 'error'
            ? 'bg-red-600 text-white border-red-500/30'
            : 'bg-[#2842B5] text-white border-[#2842B5]/50 shadow-[#2842B5]/25'
        }`}>
          {toast.msg}
        </div>
      )}

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        profile={profile}
        onSave={handleProfileSave}
      />
      
      <CreateEventModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => { window.dispatchEvent(new Event('dashboard_refresh')); }}
      />
    </div>
  );
}
