import React, { useState } from 'react';
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
  X
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
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Início', icon: LayoutDashboard },
    { to: '/jantas', label: 'Jantas', icon: Calendar },
    ...(isAdmin ? [{ to: '/relatorios', label: 'Relatórios', icon: BarChart3 }] : []),
  ];

  const handleProfileSave = async ({ phone, name, avatarUrl, pix }) => {
    try {
      // 1. Update profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ telefone: phone, name, pix, avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;

      // 2. Sync auth metadata so Supabase panel stays in sync
      await supabase.auth.updateUser({
        data: { name, phone, pix }
      });

      // 3. Refresh context BEFORE closing modal so UI updates immediately
      await refreshProfile(user.id);
      setIsProfileOpen(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err) {
      alert('Erro ao atualizar perfil: ' + err.message);
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50/50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 w-full h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          {appConfig.iconUrl ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img src={appConfig.iconUrl} alt="App Icon" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center shrink-0">
              <Utensils className="text-white dark:text-black" size={16} />
            </div>
          )}
          <h1 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{appConfig.name}</h1>
        </div>
        <button  
          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
      </header>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed h-full w-72 md:w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-50 transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {appConfig.iconUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm">
                <img src={appConfig.iconUrl} alt="App Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shrink-0">
                <Utensils className="text-white dark:text-black" size={20} />
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm leading-tight text-zinc-900 dark:text-white truncate">{appConfig.name}</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-tighter truncate">{appConfig.subtitle}</p>
            </div>
          </div>
          
          <button 
            className="md:hidden p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 md:mt-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => 
                `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                  ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200 dark:shadow-none dark:bg-white dark:text-black" 
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
               setIsMobileMenuOpen(false);
               setIsProfileOpen(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all font-sans text-left"
          >
            <User size={18} /> Perfil
          </button>
        </nav>

        {/* ADMIN & USER SECTION */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          {isAdmin && (
            <NavLink 
              to="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => 
                `w-full p-3 mb-4 rounded-xl border border-dashed flex items-center justify-between transition-colors ${
                  isActive 
                  ? 'bg-zinc-900 text-white border-zinc-900' 
                  : 'border-zinc-300 text-zinc-400 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-white'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Settings size={16} />
                <span className="text-xs font-bold uppercase">Painel Admin</span>
              </div>
              <ChevronRight size={14} />
            </NavLink>
          )}
          
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0 text-zinc-900 dark:text-white uppercase overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : (profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U')
              }
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-zinc-900 dark:text-white capitalize">{profile?.name || user?.email?.split('@')[0] || 'Usuário'}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-2 -mr-2 text-zinc-400 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 p-4 md:p-10 max-w-6xl w-full">
        <div className="max-w-5xl mx-auto h-full flex flex-col">
          <Outlet />
        </div>
      </main>

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
