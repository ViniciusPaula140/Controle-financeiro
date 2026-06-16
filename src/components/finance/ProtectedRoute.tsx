import { useAuth } from '@/lib/supabase/auth-context';

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

/** Redirecionamento de auth é centralizado no RouteGuard de __root.tsx */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  return <>{children}</>;
}

/** Redirecionamento de auth é centralizado no RouteGuard de __root.tsx */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  return <>{children}</>;
}
