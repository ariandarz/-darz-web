/**
 * LoginPage — collector access-key sign-in. The catalogue API requires an
 * authenticated principal (`DEFAULT_PERMISSION_CLASSES = IsAuthenticated`),
 * so a minimal real login page — not just the Phase 3 demo panel — is
 * in-scope for Phase 4. Team/email login is an admin surface (later phase).
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { Button, Input } from '../../components';

export function LoginPage() {
  const { auth } = useApi();
  const { isAuthenticated } = useSession();
  const location = useLocation();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isAuthenticated) {
    const to = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={to} replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    auth
      .loginCollector(accessKey)
      .catch((err: Error) => setError(err.message))
      .finally(() => setPending(false));
  };

  return (
    <div
      className="dz-page"
      style={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}
    >
      <form onSubmit={onSubmit} style={{ padding: '0 22px', width: '100%' }}>
        <p className="eyebrow">Darz Market</p>
        <h1
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 600,
            fontSize: '30px',
            marginTop: 8,
          }}
        >
          Sign in
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: 13.5, margin: '8px 0 22px' }}>
          Enter the access key your gallery shared with you.
        </p>
        <Input
          label="Access key"
          name="accessKey"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          error={error ?? undefined}
          autoFocus
        />
        <div style={{ marginTop: 16 }}>
          <Button type="submit" variant="primary" block disabled={pending || !accessKey}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  );
}
