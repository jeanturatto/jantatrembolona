import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { MapPin } from 'lucide-react';

export const EditEventModal = ({ isOpen, onClose, onSuccess, event }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedResponsibles, setSelectedResponsibles] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load script on mount
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKey && !document.getElementById('google-maps-script')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Autocomplete fetch for location
  useEffect(() => {
    if (!location || location.length < 3 || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey && window.google?.maps?.places) {
          const service = new window.google.maps.places.AutocompleteService();
          service.getPlacePredictions({ input: location, componentRestrictions: { country: 'br' } }, (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              setSuggestions(predictions.map(p => ({ display_name: p.description })));
            } else {
              setSuggestions([]);
            }
          });
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=5&countrycodes=br`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data);
          }
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [location, showSuggestions]);

  useEffect(() => {
    if (isOpen && event) {
      setName(event.rawName || 'Janta das Quintas');
      // date is stored as ISO, convert to YYYY-MM-DD for input[type=date]
      setDate(event.rawDate ? event.rawDate.substring(0, 10) : '');
      setLocation(event.rawLocation || '');
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedResponsibles(event.responsibles || []);

      const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('name');
        if (data) setUsers(data);
      };
      fetchUsers();
    }
  }, [isOpen, event]);

  const toggleResponsible = (userId) => {
    setSelectedResponsibles(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name,
          date,
          location: location || null,
          responsibles: selectedResponsibles,
        })
        .eq('id', event.id);

      if (error) throw error;
      onSuccess?.();
      onClose();
    } catch (error) {
      alert('Erro ao editar janta: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Janta">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-400">Nome da Janta</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-400">Data</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white"
            />
          </div>
          <div className="space-y-2 relative">
            <label className="text-xs font-bold uppercase text-zinc-400">Local (Opcional)</label>
            <div className="relative">
              <input
                type="text"
                value={location}
                placeholder="Ex: Salão de Festas ou endereço"
                onChange={e => {
                  setLocation(e.target.value);
                  setShowSuggestions(true);
                }}
                className="w-full p-3 pr-12 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-medium text-zinc-900 dark:text-white"
              />
              <button
                type="button"
                title="Buscar no Waze/Maps"
                onClick={() => window.open(`https://waze.com/ul?q=${encodeURIComponent(location || 'Localização')}`, '_blank')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg"
              >
                <MapPin size={16} />
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg">
                {suggestions.map((s, idx) => (
                  <li 
                    key={idx}
                    onClick={() => {
                      setLocation(s.display_name);
                      setShowSuggestions(false);
                    }}
                    className="px-4 py-2 text-xs md:text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer border-b border-zinc-100 dark:border-zinc-700 last:border-0 truncate"
                    title={s.display_name}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-400">Cozinheiros (Responsáveis)</label>
          <div className="max-h-48 overflow-y-auto space-y-2 p-1 border border-zinc-100 dark:border-zinc-800 rounded-xl">
            {users.map(u => {
              const uName = u.name || u.email.split('@')[0];
              const isSelected = selectedResponsibles.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleResponsible(u.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center font-bold text-zinc-500 overflow-hidden shrink-0 text-xs">
                    {uAvatar ? (
                      <img src={uAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (uName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <p className="flex-1 text-sm font-bold truncate text-zinc-900 dark:text-white capitalize">{uName}</p>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black' : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {isSelected && <span className="text-xs">✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="flex-1 p-3 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-70 transition-transform active:scale-[0.98]">
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
