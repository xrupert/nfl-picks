import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Gate authenticated routes. Redirects to /login when there's no session.
export default function ProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
