import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// All 32 teams are reference data used everywhere — load once and cache.
export const useTeamsStore = create((set, get) => ({
  teams: [],
  byId: {},
  byAbbr: {},
  loaded: false,
  loading: false,

  loadTeams: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const { data, error } = await supabase.from('teams').select('*');
    if (error || !data) {
      set({ loading: false });
      return;
    }
    const byId = Object.fromEntries(data.map((t) => [t.id, t]));
    const byAbbr = Object.fromEntries(data.map((t) => [t.abbreviation, t]));
    set({ teams: data, byId, byAbbr, loaded: true, loading: false });
  },
}));

// Division ordering used across the app (NFC first, North→South→East→West).
export const DIVISION_ORDER = [
  { conference: 'NFC', division: 'North' },
  { conference: 'NFC', division: 'South' },
  { conference: 'NFC', division: 'East' },
  { conference: 'NFC', division: 'West' },
  { conference: 'AFC', division: 'North' },
  { conference: 'AFC', division: 'South' },
  { conference: 'AFC', division: 'East' },
  { conference: 'AFC', division: 'West' },
];

export const divisionKey = (conference, division) => `${conference} ${division}`;
