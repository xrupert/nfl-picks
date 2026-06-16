import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const location = useLocation();

  if (!session) {
    // Preserve the page they were trying to reach so login/signup can redirect back
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
