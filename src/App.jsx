import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useTeamsStore } from './store/teamsStore';

import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LeagueLayout from './components/LeagueLayout';

import Login from './pages/Login';
import Signup from './pages/Signup';
import HelmetShowcase from './pages/HelmetShowcase';
import Dashboard from './pages/Dashboard';
import CreateLeague from './pages/CreateLeague';
import JoinLeague from './pages/JoinLeague';
import PicksView from './pages/PicksView';
import StandingsView from './pages/StandingsView';
import PlayoffBracket from './pages/PlayoffBracket';
import Leaderboard from './pages/Leaderboard';
import CompareView from './pages/CompareView';
import LeagueSettings from './pages/LeagueSettings';
import Predictions from './pages/Predictions';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);
  const loading = useAuthStore((s) => s.loading);
  const loadTeams = useTeamsStore((s) => s.loadTeams);

  useEffect(() => {
    initAuth();
    loadTeams();
  }, [initAuth, loadTeams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white/50">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dev/helmets" element={<HelmetShowcase />} />

        {/* Authenticated */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/create-league" element={<CreateLeague />} />
            <Route path="/join/:inviteCode" element={<JoinLeague />} />

            {/* League sub-pages */}
            <Route path="/league/:leagueId" element={<LeagueLayout />}>
              <Route index element={<Navigate to="picks" replace />} />
              <Route path="picks" element={<PicksView />} />
              <Route path="standings" element={<StandingsView />} />
              <Route path="playoffs" element={<PlayoffBracket />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="compare/:compareUserId" element={<CompareView />} />
              <Route path="predictions" element={<Predictions />} />
              <Route path="chat" element={<Chat />} />
              <Route path="settings" element={<LeagueSettings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
