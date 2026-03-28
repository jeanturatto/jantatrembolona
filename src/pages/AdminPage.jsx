import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, User, CheckCircle, XCircle, MailPlus, Trash2, Pencil, Settings, Upload, MessageSquare, Copy } from 'lucide-react';
import { Card } from '../components/Card';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserModal } from '../components/AdminUserModal';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('membros'); // 'membros' ou 'convites'
  
  const [users, setUsers] = useState([]);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  // Mensagem tab state
  const [adminEvents, setAdminEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);

  // App settings
  const [appName, setAppName] = useState('Janta Trembolona');
  const [appSubtitle, setAppSubtitle] = useState('Grupo de Jantas');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const iconInputRef = useRef(null);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').order('name');
      if (data) setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvites = async () => {
    try {
      const { data } = await supabase.from('allowed_emails').select('*').order('created_at', { ascending: false });
      if (data) setAllowedEmails(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchInvites()]);
    setLoading(false);
  };

  const fetchAppSettings = async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      data.forEach(({ key, value }) => {
        if (key === 'app_name') setAppName(value || 'Janta Trembolona');
        if (key === 'app_subtitle') setAppSubtitle(value || 'Grupo de Jantas');
        if (key === 'app_icon_url') setAppIconUrl(value || '');
      });
    }
  };

  const loadAdminEvents = async () => {
    setLoadingMsg(true);
    try {
      const { data: events } = await supabase
        .from('events')
        .select('*, attendances(user_id, status)')
        .order('date', { ascending: false });

      if (events) {
        setAdminEvents(events);
        if (events.length > 0 && !selectedEventId) {
          setSelectedEventId(events[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const generateMessageForEvent = async (eventId) => {
    if (!eventId) return;
    setLoadingMsg(true);
    try {
      const janta = adminEvents.find(e => e.id === eventId);
      if (!janta) return;
      
      // Get responsibles names
      const responsiblesProfiles = await Promise.all(
        (janta.responsibles || []).map(async id => {
          const { data } = await supabase.from('profiles').select('name, email').eq('id', id).single();
          return data;
        })
      );
      const respNames = responsiblesProfiles.map(p => p?.name || p?.email?.split('@')[0]).join(' e ') || 'Nenhum';

      // Get confirmed attendees
      const confirmedIds = (janta.attendances || [])
        .filter(a => a.status === 'Presente')
        .map(a => a.user_id);
        
      let confirmedNames = [];
      if (confirmedIds.length > 0) {
        const { data: confirmedProfiles } = await supabase
          .from('profiles')
          .select('name, email')
          .in('id', confirmedIds)
          .order('name');
        if (confirmedProfiles) {
          // Sort by name alphabetically before joining
          confirmedProfiles.sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email));
          confirmedNames = confirmedProfiles.map(p => p.name || p.email?.split('@')[0]);
        }
      }

      const dateObj = new Date(janta.date);
      const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const msg = `*Grupo Trembolona*
Janta data: ${dateStr}
Responsáveis: ${respNames}
Local: ${janta.location || 'A definir'}

*Confirmados (${confirmedNames.length}):*
${confirmedNames.map(n => `- ${n}`).join('\n')}`;

      setGeneratedMsg(msg);
    } catch (err) {
      console.error(err);
      setGeneratedMsg('Erro ao gerar mensagem. Tente novamente.');
    } finally {
      setLoadingMsg(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mensagem') {
      loadAdminEvents();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedEventId) {
      generateMessageForEvent(selectedEventId);
    }
  }, [selectedEventId, adminEvents]);

  useEffect(() => {
    loadData();
    fetchAppSettings();
  }, []);

  const toggleStatus = async (userId, currentStatus) => {
    try {
      await supabase.from('profiles').update({ inadimplente: !currentStatus }).eq('id', userId);
      fetchUsers();
    } catch (err) {
      alert("Erro ao atualizar status");
    }
  };

  const toggleRole = async (userId, currentRole) => {
    if (userId === currentUser?.id) {
       alert("Ação negada: Você não pode remover seus próprios privilégios de Administrador.");
       return;
    }
    try {
      const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      fetchUsers();
    } catch (err) {
      alert("Erro ao atualizar permissão");
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail) return;
    try {
      const { error } = await supabase.from('allowed_emails').insert([{ email: newEmail.trim() }]);
      if (error) {
        if (error.code === '23505') alert('Este email já está autorizado.');
        else alert('Erro ao autorizar email.');
        return;
      }
      setNewEmail('');
      fetchInvites();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveEmail = async (email) => {
    try {
      if (!confirm(`Remover autorização de ${email}?`)) return;
      await supabase.from('allowed_emails').delete().eq('email', email);
      fetchInvites();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        supabase.from('app_settings').upsert({ key: 'app_name', value: appName }),
        supabase.from('app_settings').upsert({ key: 'app_subtitle', value: appSubtitle }),
        supabase.from('app_settings').upsert({ key: 'app_icon_url', value: appIconUrl }),
      ]);
      window.dispatchEvent(new Event('app_settings_updated'));
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Resize to 64x64 using canvas
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 64);
        canvas.toBlob(async (blob) => {
          const filePath = `app-icon-${Date.now()}.png`;
          const { error } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: 'image/png', upsert: true });
          if (!error) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setAppIconUrl(data.publicUrl);
          } else {
            alert('Erro ao enviar ícone.');
          }
        }, 'image/png');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4">
      <header>
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
        <p className="text-sm text-zinc-500">Gerencie os membros do grupo e autorizações de acesso.</p>
      </header>

      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <button 
          onClick={() => setActiveTab('membros')}
          className={`pb-2 text-sm font-bold px-2 whitespace-nowrap ${activeTab === 'membros' ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "text-zinc-400"}`}
        >
          <ShieldAlert size={16} className="inline mr-2" />
          Membros
        </button>
        <button 
          onClick={() => setActiveTab('convites')}
          className={`pb-2 text-sm font-bold px-2 whitespace-nowrap ${activeTab === 'convites' ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "text-zinc-400"}`}
        >
          <MailPlus size={16} className="inline mr-2" />
          Convites Pendentes
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={`pb-2 text-sm font-bold px-2 whitespace-nowrap ${activeTab === 'config' ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "text-zinc-400"}`}
        >
          <Settings size={16} className="inline mr-2" />
          Configurações da Página
        </button>
        <button 
          onClick={() => setActiveTab('mensagem')}
          className={`pb-2 text-sm font-bold px-2 whitespace-nowrap ${activeTab === 'mensagem' ? "border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "text-zinc-400"}`}
        >
          <MessageSquare size={16} className="inline mr-2" />
          Mensagem WhatsApp
        </button>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-zinc-500 text-center py-4">Carregando dados...</p>
        ) : activeTab === 'membros' ? (
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center font-bold text-zinc-500 overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (u.name || u.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-sm capitalize truncate">{u.name || u.email?.split('@')[0]}</h4>
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 transition-colors">
                    <Pencil size={12} /> Editar
                  </button>

                  {u.id !== currentUser?.id ? (
                    <button 
                      onClick={() => toggleRole(u.id, u.role)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        u.role === 'ADMIN' 
                        ? 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-500/10' 
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700'
                      }`}
                    >
                      {u.role === 'ADMIN' ? 'ADMIN' : 'TORNAR ADMIN'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-500/10 cursor-not-allowed opacity-80">VOCÊ (ADMIN)</span>
                  )}

                  <button 
                    onClick={() => toggleStatus(u.id, u.inadimplente)}
                    className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                      u.inadimplente 
                      ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-500/10' 
                      : 'border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10'
                    }`}
                  >
                    {u.inadimplente ? <XCircle size={12}/> : <CheckCircle size={12}/>}
                    {u.inadimplente ? 'INADIMPLENTE' : 'REGULAR'}
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-center text-zinc-500 text-sm py-4">Nenhum membro encontrado.</p>}
          </div>
        ) : activeTab === 'config' ? (
          <div className="space-y-6">
            <p className="text-xs text-zinc-500">Personalize o nome, subtítulo e ícone exibidos no menu lateral.</p>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                {appIconUrl
                  ? <img src={appIconUrl} alt="App Icon" className="w-full h-full object-cover" />
                  : <span className="text-white text-2xl font-bold">{appName?.charAt(0) || 'J'}</span>
                }
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-zinc-400">Ícone da Aplicação</p>
                <p className="text-[11px] text-zinc-500">Qualquer imagem será redimensionada para 64×64px.</p>
                <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                <button onClick={() => iconInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-400 transition-colors">
                  <Upload size={12} /> Selecionar Imagem
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Nome da Aplicação</label>
              <input value={appName} onChange={e => setAppName(e.target.value)}
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:border-zinc-900 dark:focus:border-white transition-all" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Subtítulo</label>
              <input value={appSubtitle} onChange={e => setAppSubtitle(e.target.value)}
                className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium outline-none focus:border-zinc-900 dark:focus:border-white transition-all" />
            </div>

            <button onClick={handleSaveSettings} disabled={savingSettings}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black p-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
              {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        ) : activeTab === 'mensagem' ? (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="sm:w-1/3 border-r border-zinc-200 dark:border-zinc-800 pr-6 space-y-4">
              <h3 className="font-bold text-sm uppercase text-zinc-500">Selecione a Janta</h3>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {adminEvents.map(ev => {
                  const dObj = new Date(ev.date);
                  const d = dObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  return (
                    <button 
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${selectedEventId === ev.id ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800/80 font-bold' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-zinc-50 dark:bg-zinc-900/50'}`}
                    >
                      <div className="truncate">{ev.name || 'Janta'}</div>
                      <div className="text-xs text-zinc-500 mt-1">{d} • {ev.status}</div>
                    </button>
                    )
                })}
                {adminEvents.length === 0 && !loadingMsg && <p className="text-xs text-zinc-500">Nenhuma janta encontrada.</p>}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm text-zinc-500">Texto formatado com as confirmações da janta selecionada.</p>
              {loadingMsg ? (
                <p className="text-sm text-zinc-500 py-4 animate-pulse">Carregando mensagem...</p>
              ) : (
                <div className="space-y-4">
                  <textarea
                    readOnly
                    value={generatedMsg}
                    className="w-full h-80 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-mono outline-none resize-none"
                  />
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedMsg);
                        alert('Mensagem copiada para a área de transferência!');
                      }}
                      disabled={!generatedMsg || generatedMsg.startsWith('Nenhuma') || generatedMsg.startsWith('Erro')}
                      className="flex-1 bg-green-500 text-white p-3 rounded-xl font-bold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy size={16} /> Copiar Texto
                    </button>
                    <button onClick={() => generateMessageForEvent(selectedEventId)} className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl font-bold text-sm hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                      Recarregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleAddEmail} className="flex gap-2">
              <input 
                type="email" 
                required 
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="email@autorizado.com" 
                className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 ring-zinc-900 outline-none transition-all placeholder:text-zinc-400 text-sm"
              />
              <button 
                type="submit" 
                className="bg-zinc-900 text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold text-sm transition-transform active:scale-[0.98] shrink-0"
              >
                Autorizar
              </button>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Emails Autorizados Pendentes</h4>
              {allowedEmails.filter(ae => !users.some(u => u.email === ae.email)).map(inv => (
                <div key={inv.email} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                   <div>
                     <p className="text-sm font-bold text-zinc-900 dark:text-white">{inv.email}</p>
                     <p className="text-[10px] text-zinc-500">Adicionado em {new Date(inv.created_at).toLocaleDateString()}</p>
                   </div>
                   <button onClick={() => handleRemoveEmail(inv.email)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                     <Trash2 size={16} />
                   </button>
                </div>
              ))}
              {allowedEmails.filter(ae => !users.some(u => u.email === ae.email)).length === 0 && (
                <p className="text-[11px] text-zinc-500 italic">Nenhum email aguardando cadastro.</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <AdminUserModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        targetUser={selectedUser}
        onSuccess={loadData}
      />
    </div>
  );
}
