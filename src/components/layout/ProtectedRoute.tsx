import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ministro_guia' | 'dm' | 'admin')[];
  redirectTo?: string;
}

/**
 * ProtectedRoute — Controla acesso por role.
 * Se o usuário não tem permissão, redireciona para a rota especificada.
 */
export function ProtectedRoute({ children, allowedRoles, redirectTo = '/multitracks' }: ProtectedRouteProps) {
  const { profile } = useAuth();

  if (!profile) return null;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
