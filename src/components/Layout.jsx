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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileModal } from './ProfileModal';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [appConfig, setAppConfig] = useState({ name: 'Janta Trembolona', subtitle: 'Grupo de Jantas', iconUrl: '' });
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

  const handleProfileSave = async ({ phone, name, avatarUrl, pix }) => {
    setIsProfileOpen(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telefone: phone, name, pix, avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { name, phone, pix } });
      await refreshProfile(user.id);
      showToast('Perfil atualizado com sucesso!');
    } catch (err) {
      showToast('Erro ao atualizar: ' + err.message, 'error');
    }
  };

  const userInitial = profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U';

  return (
    <div className="flex min-h-screen bg-[#f2f1fb] dark:bg-[#090914] text-zinc-900 dark:text-white font-sans overflow-x-hidden">

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
        bg-white dark:bg-[#0b0b1e]
        border-r border-[#2842B5]/08 dark:border-white/[0.06]
        transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>

        {/* Logo */}
        <div className="px-5 h-16 flex items-center justify-between border-b border-[#2842B5]/08 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {appConfig.iconUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                <img src={appConfig.iconUrl} alt="logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 bg-[#2842B5] rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-[#2842B5]/30">
                <Utensils className="text-white" size={17} />
              </div>
            )}
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight truncate leading-tight">{appConfig.name}</p>
              <p className="text-[10px] text-[#2842B5] dark:text-[#B8ABCF]/60 uppercase tracking-widest truncate">{appConfig.subtitle}</p>
            </div>
          </div>
          <button
            className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 dark:text-[#3a3a60]">Menu</p>

          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                  ? 'bg-[#2842B5] text-white nav-active-glow'
                  : 'text-zinc-500 dark:text-[#5a5a80] hover:bg-[#2842B5]/[0.08] dark:hover:bg-white/[0.04] hover:text-[#2842B5] dark:hover:text-[#B8ABCF]'
                }`
              }
            >
              <item.icon size={17} strokeWidth={isActive => isActive ? 2.2 : 1.8} />
              {item.label}
            </NavLink>
          ))}

          <button
            onClick={() => { setIsMobileMenuOpen(false); setIsProfileOpen(true); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 dark:text-[#5a5a80] hover:bg-[#2842B5]/[0.08] dark:hover:bg-white/[0.04] hover:text-[#2842B5] dark:hover:text-[#B8ABCF] transition-all text-left"
          >
            <User size={17} />
            Perfil
          </button>

          {isAdmin && (
            <>
              <p className="px-3 pt-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 dark:text-[#3a3a60]">Admin</p>
              <NavLink
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                    ? 'bg-[#2842B5] text-white nav-active-glow'
                    : 'text-zinc-500 dark:text-[#5a5a80] hover:bg-[#2842B5]/[0.08] dark:hover:bg-white/[0.04] hover:text-[#2842B5] dark:hover:text-[#B8ABCF]'
                  }`
                }
              >
                <Settings size={17} />
                Painel Admin
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-[#2842B5]/08 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#2842B5]/[0.05] dark:hover:bg-white/[0.03] transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#2842B5]/15 dark:bg-[#2842B5]/20 flex items-center justify-center text-xs font-bold shrink-0 text-[#2842B5] dark:text-[#B8ABCF] uppercase overflow-hidden ring-2 ring-[#2842B5]/20">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : userInitial
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-zinc-900 dark:text-white capitalize">
                {profile?.name || user?.email?.split('@')[0] || 'Usuário'}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-[#5a5a80] truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-zinc-300 dark:text-[#3a3a60] hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg shrink-0"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 md:ml-60 pt-16 md:pt-0 min-w-0 overflow-x-hidden">
        <div className="dark:dot-grid min-h-screen">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 h-full flex flex-col">
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
    </div>
  );
}
