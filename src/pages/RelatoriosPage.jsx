import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ShieldAlert, FileDown, DollarSign, Users } from 'lucide-react';
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
  const [jantasData, setJantasData] = useState([]);
  const [totalJantas, setTotalJantas] = useState(0);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(Math.max(2026, now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(now.getFullYear() === 2026 && now.getMonth() < 3 ? 3 : now.getMonth());
  const printRef = useRef(null);

  useEffect(() => {
    if (!isAdmin || !profile?.id) { setLoading(false); return; }
    const fetchReports = async () => {
      setLoading(true);
      try {
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

        const [eventsRes, profilesRes, monthAttsRes, allAttsRes] = await Promise.all([
          supabase.from('events').select('id, date, name, responsibles, payment_value, guests').gte('date', startDate).lte('date', endDate),
          supabase.from('profiles').select('id, name, email, avatar_url, inadimplente, role, telefone, pix').order('name'),
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
            role: p.role,
            telefone: p.telefone,
            pix: p.pix,
            inadimplente: p.inadimplente,
            presentes, justificadas, ausentes, perc,
            naoVouCount: ausentes,
            allTimeJust,
            status,
            justificativasList,
          };
        }).sort((a, b) => b.perc - a.perc);

        setMembersData(data);

        // Process jantas data
        const events = eventsRes.data || [];
        const allUserIds = [...new Set(events.flatMap(e => e.responsibles || []))];
        let profilesMap = {};
        if (allUserIds.length > 0) {
          const { data: respProfiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', allUserIds);
          profilesMap = Object.fromEntries((respProfiles || []).map(p => [p.id, p.name]));
        }

        const jantas = events.map(e => {
          const presentesCount = monthAtts.filter(a => a.event_id === e.id && a.status === 'Presente').length;
          const guestsCount = Array.isArray(e.guests) ? e.guests.length : 0;
          const totalPessoas = presentesCount + guestsCount;
          const valor = parseFloat(e.payment_value) || 0;
          const rateio = totalPessoas > 0 ? Math.ceil(valor / totalPessoas) : 0;
          const responsaveisNomes = (e.responsibles || []).map(id => profilesMap[id] || 'Responsável').join(', ');

          return {
            id: e.id,
            date: e.date,
            name: e.name,
            responsaveis: responsaveisNomes,
            valor,
            presentesCount,
            guestsCount,
            totalPessoas,
            rateio,
          };
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        setJantasData(jantas);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.id) fetchReports();
  }, [profile?.id, isAdmin, selectedMonth, selectedYear]);

  const handlePdfConfirm = async ({ type, year, month, startDate, endDate, reportType = 'presencas', shareMethod = 'pdf' }) => {
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

    if (reportType === 'valores') {
      // Fetch events with payment data
      const { data: events } = await supabase
        .from('events')
        .select('id, date, name, responsibles, payment_value, guests')
        .gte('date', start)
        .lte('date', end)
        .order('date');

      // Get all responsible user IDs
      const allRespIds = [...new Set(events?.flatMap(e => e.responsibles || []) || [])];
      let respNames = {};
      if (allRespIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', allRespIds);
        respNames = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }

      // Get attendances for presence count
      const { data: atts } = await supabase
        .from('attendances')
        .select('event_id, user_id, status')
        .in('event_id', events?.map(e => e.id) || []);

      const rows = (events || []).map(e => {
        const presentes = atts?.filter(a => a.event_id === e.id && a.status === 'Presente').length || 0;
        const guests = Array.isArray(e.guests) ? e.guests.length : 0;
        const totalPessoas = presentes + guests;
        const valor = parseFloat(e.payment_value) || 0;
        const rateio = totalPessoas > 0 ? Math.ceil(valor / totalPessoas) : 0;
        const responsaveis = (e.responsibles || []).map(id => respNames[id] || 'Responsável').join(', ');
        
        return `
          <tr>
            <td>${new Date(e.date).toLocaleDateString('pt-BR')}</td>
            <td class="cap">${e.name || 'Janta'}</td>
            <td style="font-size:10px;color:#666">${responsaveis}</td>
            <td style="text-align:center;font-weight:700">${totalPessoas}</td>
            <td style="text-align:right;font-weight:700">${valor > 0 ? 'R$ ' + valor.toFixed(2).replace('.', ',') : '-'}</td>
            <td style="text-align:right;color:#16a34a;font-weight:700">${rateio > 0 ? 'R$ ' + rateio.toFixed(2).replace('.', ',') : '-'}</td>
          </tr>`;
      }).join('');

      const totalValor = events?.reduce((acc, e) => acc + (parseFloat(e.payment_value) || 0), 0) || 0;
      const eventosComValor = events?.filter(e => e.payment_value).length || 0;
      const mediaRateio = eventosComValor > 0 
        ? Math.round(events?.filter(e => e.payment_value).reduce((acc, e) => {
            const presentes = atts?.filter(a => a.event_id === e.id && a.status === 'Presente').length || 0;
            const guests = Array.isArray(e.guests) ? e.guests.length : 0;
            const rateio = (presentes + guests) > 0 ? Math.ceil(parseFloat(e.payment_value) / (presentes + guests)) : 0;
            return acc + rateio;
          }, 0) / eventosComValor)
: 0;

      if (shareMethod === 'whatsapp') {
        // Create WhatsApp text message
        let text = `🍽️ *${title} - VALORES*\n\n`;
        (events || []).forEach(e => {
          const presentes = atts?.filter(a => a.event_id === e.id && a.status === 'Presente').length || 0;
          const guests = Array.isArray(e.guests) ? e.guests.length : 0;
          const totalPessoas = presentes + guests;
          const valor = parseFloat(e.payment_value) || 0;
          const rateio = totalPessoas > 0 ? Math.ceil(valor / totalPessoas) : 0;
          const data = new Date(e.date).toLocaleDateString('pt-BR');
          text += `📅 ${data} - ${e.name || 'Janta'}\n`;
          text += `   👤 ${(e.responsibles || []).map(id => respNames[id] || 'Responsável').join(', ')}\n`;
          text += `   👥 ${totalPessoas} pessoas\n`;
          text += `   💰 R$ ${valor.toFixed(2).replace('.', ',')}\n`;
          text += `   📊 Rateio: R$ ${rateio.toFixed(2).replace('.', ',')}\n\n`;
        });
        text += `📈 Média Rateio: R$ ${mediaRateio.toFixed(2).replace('.', ',')}\n`;
        
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        return;
      }

      const win = window.open('', '_blank');
      if (!win) {
        alert('Por favor, permita pop-ups para exportar o PDF.');
        return;
      }
      win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title} - Valores</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 24px; }
          h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
          p.sub { font-size: 11px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
          td { padding: 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
          .cap { text-transform: capitalize; }
          .total { border-top: 2px solid #e5e7eb; font-weight: 700; }
          .media { color: #16a34a; }
        </style>
      </head><body>
        <h1>${title} - Valores</h1>
        <p class="sub">${events?.length || 0} jantas &middot; ${eventosComValor} com valor cadastrado</p>
        <table>
          <thead><tr>
            <th>Data</th><th>Janta</th><th>Responsável</th><th style="text-align:center">Pessoas</th><th style="text-align:right">Total</th><th style="text-align:right">Rateio</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="total">
              <td colspan="4">Média Rateio</td>
              <td style="text-align:right" class="media">${mediaRateio > 0 ? 'R$ ' + mediaRateio.toFixed(2).replace('.', ',') : '-'}</td>
            </tr>
          </tfoot>
        </table>
      </body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 400);
      return;
    }

    // Fetch data for presenças report (existing code)
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

    if (shareMethod === 'whatsapp') {
      // Create WhatsApp text message for presenças
      let text = `🍽️ *${title} - PRESENÇAS*\n\n`;
      profiles.forEach(p => {
        const userAtts = atts.filter(a => a.user_id === p.id);
        const presentes = userAtts.filter(a => a.status === 'Presente').length;
        const justificadas = userAtts.filter(a => a.status === 'Falta Justificada').length;
        const ausentes = userAtts.filter(a => a.status === 'Ausente').length;
        const total = userAtts.length;
        const perc = total > 0 ? Math.round((presentes / total) * 100) : 0;
        const name = p.name || p.email?.split('@')[0] || 'Usuário';
        text += `👤 ${name}: ✅${presentes} | 🟡${justificadas} | ❌${ausentes} (${perc}%)\n`;
      });
      text += `\n📊 ${totalJantasPdf} jantas | ${profiles.length} membros`;
      
      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('Por favor, permita pop-ups para exportar o PDF.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title} - Presenças</title>
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
      <h1>${title} - Presenças</h1>
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
        <div className="flex gap-2">
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shrink-0"
          >
            <FileDown size={16} /> Exportar PDF
          </button>
        </div>
      </header>

      {/* Month/Year selector */}
      <Card className="flex flex-wrap gap-3 items-center">
        <span className="text-xs font-bold uppercase text-zinc-400">Período:</span>
        <div className="flex gap-2 flex-wrap">
          {MONTHS.map((m, i) => {
            const isDisabled = (selectedYear === 2026 && i < 3) || (selectedYear === now.getFullYear() && i > now.getMonth());
            return (
              <button key={m} onClick={() => setSelectedMonth(i)}
                disabled={isDisabled}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  isDisabled ? 'opacity-30 cursor-not-allowed border-zinc-100 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600' :
                  selectedMonth === i
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                }`}>
                {m.substring(0, 3)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {years.filter(y => y >= 2026).map(y => (
            <button key={y} onClick={() => {
              setSelectedYear(y);
              if (y === 2026 && selectedMonth < 3) setSelectedMonth(3);
              if (y === now.getFullYear() && selectedMonth > now.getMonth()) setSelectedMonth(now.getMonth());
            }}
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
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Membro</th>
                <th className="pb-3 text-center pr-3 hidden md:table-cell">✅ Pres.</th>
                <th className="pb-3 text-center pr-3 hidden md:table-cell">🟡 Justif.</th>
                <th className="pb-3 text-center pr-3 hidden md:table-cell">❌ Não Vou</th>
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
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 overflow-hidden shrink-0">
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                            : (m.name || m.email || 'U').charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white capitalize group-hover:underline text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{m.name}</p>
                          <p className="text-[10px] text-zinc-400 hidden md:block">{m.email}</p>
                          {m.allTimeJust >= 5 && (
                            <p className="text-[9px] font-bold text-orange-500 hidden md:block">{m.allTimeJust} faltas justif. total</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-green-600 hidden md:table-cell">{m.presentes}</td>
                    <td className="py-3 text-center font-bold text-amber-600 hidden md:table-cell">{m.justificadas}</td>
                    <td className="py-3 text-center font-bold text-red-500 hidden md:table-cell">
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

      {/* Valores das Jantas */}
      {jantasData.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-green-600" />
            <h3 className="font-bold">Valores das Jantas</h3>
          </div>
          
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="pb-3 pr-4">Data</th>
                  <th className="pb-3 pr-4 hidden md:table-cell">Responsável</th>
                  <th className="pb-3 text-center pr-3">Pessoas</th>
                  <th className="pb-3 text-right pr-3">Total</th>
                  <th className="pb-3 text-right">Rateio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {jantasData.map((j) => (
                  <tr key={j.id}>
                    <td className="py-3 pr-4">
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {new Date(j.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-zinc-600 dark:text-zinc-400 text-xs">
                      {j.responsaveis || '-'}
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users size={12} className="text-blue-500" />
                        <span className="font-bold text-zinc-900 dark:text-white">{j.totalPessoas}</span>
                        {j.guestsCount > 0 && (
                          <span className="text-[10px] text-zinc-400">({j.presentesCount} + {j.guestsCount})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right font-bold text-zinc-900 dark:text-white">
                      {j.valor > 0 ? `R$ ${j.valor.toFixed(2).replace('.', ',')}` : '-'}
                    </td>
                    <td className="py-3 text-right font-bold text-green-600">
                      {j.rateio > 0 ? `R$ ${j.rateio.toFixed(2).replace('.', ',')}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700">
                <tr>
                  <td colSpan={2} className="pt-3 pr-4 font-bold text-zinc-900 dark:text-white">Média Geral</td>
                  <td className="pt-3 text-center font-bold text-zinc-900 dark:text-white">
                    {jantasData.length > 0 ? Math.round(jantasData.reduce((acc, j) => acc + j.totalPessoas, 0) / jantasData.length) : 0}
                  </td>
                  <td className="pt-3 text-right font-bold text-zinc-900 dark:text-white">
                    {jantasData.length > 0 && jantasData.some(j => j.valor > 0) 
                      ? `R$ ${(jantasData.reduce((acc, j) => acc + j.valor, 0) / jantasData.filter(j => j.valor > 0).length).toFixed(2).replace('.', ',')}`
                      : '-'}
                  </td>
                  <td className="pt-3 text-right font-bold text-green-600">
                    {jantasData.length > 0 && jantasData.some(j => j.rateio > 0)
                      ? `R$ ${(jantasData.reduce((acc, j) => acc + j.rateio, 0) / jantasData.filter(j => j.rateio > 0).length).toFixed(2).replace('.', ',')}`
                      : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

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
