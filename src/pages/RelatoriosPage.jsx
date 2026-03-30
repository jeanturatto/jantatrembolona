import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ShieldAlert, FileDown } from 'lucide-react';
import { PdfPeriodoModal } from '../components/PdfPeriodoModal';
import { AdminUserModal } from '../components/AdminUserModal';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// Status: inadimplente wins, then corda_bamba (>=5 justified all-time), else regular
const getUserStatus = (inadimplente, totalJustificadasAllTime) => {
  if (inadimplente) return { label: 'INADIMPLENTE', color: 'bg-red-50 text-red-600 dark:bg-red-900/20' };
  if (totalJustificadasAllTime >= 5) return { label: 'NA CORDA BAMBA', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 border border-orange-200' };
  return { label: 'REGULAR', color: 'bg-green-50 text-green-600 dark:bg-green-900/20' };
};

export default function RelatoriosPage() {
  const { profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [membersData, setMembersData] = useState([]);
  const [totalJantas, setTotalJantas] = useState(0);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const printRef = useRef(null);

  useEffect(() => {
    if (!isAdmin || !profile?.id) { setLoading(false); return; }
    const fetchReports = async () => {
      setLoading(true);
      try {
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

        const [eventsRes, profilesRes, monthAttsRes, allAttsRes] = await Promise.all([
          supabase.from('events').select('id').gte('date', startDate).lte('date', endDate),
          supabase.from('profiles').select('id, name, email, avatar_url, inadimplente').order('name'),
          supabase.from('attendances').select('*').gte('created_at', startDate).lte('created_at', endDate),
          // All-time justified to determine "corda bamba"
          supabase.from('attendances').select('user_id, status').eq('status', 'Falta Justificada')
        ]);

        setTotalJantas(eventsRes.data?.length || 0);
        const profiles = profilesRes.data || [];
        const monthAtts = monthAttsRes.data || [];
        const allJustificadas = allAttsRes.data || [];

        // Build all-time justified count per user
        const allTimeJustMap = {};
        allJustificadas.forEach(a => {
          allTimeJustMap[a.user_id] = (allTimeJustMap[a.user_id] || 0) + 1;
        });

        const data = profiles.map(p => {
          const userAtts = monthAtts.filter(a => a.user_id === p.id);
          const presentes = userAtts.filter(a => a.status === 'Presente').length;
          const justificadas = userAtts.filter(a => a.status === 'Falta Justificada').length;
          const ausentes = userAtts.filter(a => a.status === 'Ausente').length;
          const total = userAtts.length;
          const perc = total > 0 ? Math.round((presentes / total) * 100) : 0;
          const justificativasList = userAtts
            .filter(a => a.status === 'Falta Justificada' && a.justificativa)
            .map(a => a.justificativa);
          const allTimeJust = allTimeJustMap[p.id] || 0;
          const status = getUserStatus(p.inadimplente, allTimeJust);

          return {
            id: p.id,
            name: p.name || p.email?.split('@')[0] || 'Usuário',
            email: p.email,
            avatar_url: p.avatar_url,
            presentes, justificadas, ausentes, perc,
            naoVouCount: ausentes,
            allTimeJust,
            status,
            justificativasList,
          };
        }).sort((a, b) => b.perc - a.perc);

        setMembersData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.id) fetchReports();
  }, [profile?.id, isAdmin, selectedMonth, selectedYear]);

  const handlePdfConfirm = async ({ type, year, month, startDate, endDate }) => {
    // Determine date range from selected type
    let start, end, title;
    if (type === 'month') {
      start = new Date(year, month, 1).toISOString();
      end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      title = `Relatório − ${MONTHS[month]} ${year}`;
    } else if (type === 'year') {
      start = new Date(year, 0, 1).toISOString();
      end = new Date(year, 11, 31, 23, 59, 59).toISOString();
      title = `Relatório Anual ${year}`;
    } else {
      start = new Date(startDate + 'T00:00:00').toISOString();
      end = new Date(endDate + 'T23:59:59').toISOString();
      title = `Relatório ${startDate} a ${endDate}`;
    }

    // Fetch data for the selected period
    const [eventsRes, profilesRes, attsRes, allJustRes] = await Promise.all([
      supabase.from('events').select('id').gte('date', start).lte('date', end),
      supabase.from('profiles').select('id, name, email, inadimplente').order('name'),
      supabase.from('attendances').select('*').gte('created_at', start).lte('created_at', end),
      supabase.from('attendances').select('user_id, status').eq('status', 'Falta Justificada'),
    ]);

    const profiles = profilesRes.data || [];
    const atts = attsRes.data || [];
    const allJust = allJustRes.data || [];
    const allTimeJustMap = {};
    allJust.forEach(a => { allTimeJustMap[a.user_id] = (allTimeJustMap[a.user_id] || 0) + 1; });
    const totalJantasPdf = eventsRes.data?.length || 0;

    const rows = profiles.map(p => {
      const userAtts = atts.filter(a => a.user_id === p.id);
      const presentes = userAtts.filter(a => a.status === 'Presente').length;
      const justificadas = userAtts.filter(a => a.status === 'Falta Justificada').length;
      const ausentes = userAtts.filter(a => a.status === 'Ausente').length;
      const total = userAtts.length;
      const perc = total > 0 ? Math.round((presentes / total) * 100) : 0;
      const allTimeJust = allTimeJustMap[p.id] || 0;
      const statusLabel = p.inadimplente ? 'INADIMPLENTE' : allTimeJust >= 5 ? 'NA CORDA BAMBA' : 'REGULAR';
      const statusColor = p.inadimplente ? 'badge-red' : allTimeJust >= 5 ? 'badge-orange' : 'badge-green';
      const name = p.name || p.email?.split('@')[0] || 'Usuário';
      return `
        <tr>
          <td><strong class="cap">${name}</strong><br/><small>${p.email}</small></td>
          <td style="text-align:center;color:#16a34a;font-weight:700">${presentes}</td>
          <td style="text-align:center;color:#d97706;font-weight:700">${justificadas}</td>
          <td style="text-align:center;color:#dc2626;font-weight:700">${ausentes}</td>
          <td style="text-align:center;font-weight:700">${perc}%</td>
          <td style="text-align:right"><span class="badge ${statusColor}">${statusLabel}</span></td>
        </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/><title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        p.sub { font-size: 11px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
        td { padding: 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .cap { text-transform: capitalize; }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:9px; font-weight:700; text-transform:uppercase; }
        .badge-red { background:#fee2e2; color:#dc2626; }
        .badge-orange { background:#fed7aa; color:#ea580c; }
        .badge-green { background:#dcfce7; color:#16a34a; }
      </style>
    </head><body>
      <h1>${title}</h1>
      <p class="sub">${totalJantasPdf} jantas no período &middot; ${profiles.length} membros</p>
      <table>
        <thead><tr>
          <th>Membro</th><th>Presenças</th><th>Justificadas</th><th>Não Vou</th><th>%</th><th style="text-align:right">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (!profile) return <div className="p-8 text-center text-zinc-500 font-bold animate-pulse">Carregando...</div>;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center animate-in fade-in">
        <ShieldAlert size={40} className="text-zinc-300 dark:text-zinc-600" />
        <div>
          <p className="font-bold text-zinc-700 dark:text-zinc-300">Acesso Restrito</p>
          <p className="text-sm text-zinc-500">Esta área é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-zinc-500 font-bold animate-pulse">Carregando relatórios...</div>;

  const years = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="space-y-6 animate-in fade-in min-w-0 overflow-x-hidden">
      <header className="flex flex-wrap items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-zinc-500">{totalJantas} jantas · {membersData.length} membros</p>
        </div>
        <button
          onClick={() => setIsPdfModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shrink-0"
        >
          <FileDown size={16} /> Exportar PDF
        </button>
      </header>

      {/* Month/Year selector */}
      <Card className="flex flex-wrap gap-3 items-center">
        <span className="text-xs font-bold uppercase text-zinc-400">Período:</span>
        <div className="flex gap-2 flex-wrap">
          {MONTHS.map((m, i) => (
            <button key={m} onClick={() => setSelectedMonth(i)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                selectedMonth === i
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
              }`}>
              {m.substring(0, 3)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                selectedYear === y
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
              }`}>
              {y}
            </button>
          ))}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] font-bold">
        <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20">REGULAR</span>
        <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 border border-orange-200">NA CORDA BAMBA — 5+ faltas justificadas</span>
        <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20">INADIMPLENTE</span>
      </div>

      <Card>
        <h3 className="font-bold mb-4 capitalize">{MONTHS[selectedMonth]} {selectedYear}</h3>

        {/* Printable area */}
        <div ref={printRef} className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left text-sm" style={{minWidth: '520px'}}>
            <thead className="text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Membro</th>
                <th className="pb-3 text-center pr-3">✅ Pres.</th>
                <th className="pb-3 text-center pr-3">🟡 Justif.</th>
                <th className="pb-3 text-center pr-3">❌ Não Vou</th>
                <th className="pb-3 text-center pr-3">%</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {membersData.map((m, idx) => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td className="py-3 pr-4 font-bold text-zinc-400">{idx === 0 ? '🏆' : idx + 1}</td>
                    <td className="py-3 pr-4 cursor-pointer group"
                      onClick={() => setSelectedUserForModal({
                        id: m.id, name: m.name, email: m.email,
                        avatar_url: m.avatar_url, role: m.role,
                        inadimplente: m.inadimplente, phone: m.phone, pix: m.pix
                      })}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 overflow-hidden shrink-0">
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                            : (m.name || m.email || 'U').charAt(0).toUpperCase()
                          }
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white capitalize group-hover:underline">{m.name}</p>
                          <p className="text-[10px] text-zinc-400">{m.email}</p>
                          {m.allTimeJust >= 5 && (
                            <p className="text-[9px] font-bold text-orange-500">{m.allTimeJust} faltas justif. total</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-green-600">{m.presentes}</td>
                    <td className="py-3 text-center font-bold text-amber-600">{m.justificadas}</td>
                    <td className="py-3 text-center font-bold text-red-500">
                      {m.naoVouCount}
                      {m.naoVouCount >= 3 && <span className="text-[9px] ml-1 bg-red-100 text-red-600 px-1 rounded">LIMITE</span>}
                    </td>
                    <td className="py-3 text-center font-bold">{m.perc}%</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${m.status.color}`}>
                        {m.status.label}
                      </span>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {membersData.length === 0 && (
                <tr><td colSpan="7" className="py-8 text-center text-zinc-500">Nenhum dado para este período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PdfPeriodoModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onConfirm={handlePdfConfirm}
      />

      <AdminUserModal
        isOpen={!!selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
        targetUser={selectedUserForModal}
        initialTab="justificativas"
        onSuccess={() => {}}
      />
    </div>
  );
}
