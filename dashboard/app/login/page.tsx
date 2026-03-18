'use client';
import React, { useState } from 'react';
import { api, saveTokens } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await api.auth.login({
        email, password, ...(needs2fa ? { totp_code: totp } : {}),
      });
      if (res.requires_2fa) { setNeeds2fa(true); setLoading(false); return; }
      saveTokens(res.access_token, res.refresh_token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 0 40px rgba(99,102,241,0.4)',
          }}>🛡️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            CreationHub V2
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Управление серверной инфраструктурой
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28, boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!needs2fa ? <>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email" required className="input"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@creationhub.local"
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Пароль
                </label>
                <input
                  type="password" required className="input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </> : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
                  🔐 Введите код из приложения-аутентификатора
                </p>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  required className="input" value={totp} onChange={e => setTotp(e.target.value)}
                  placeholder="000000" autoFocus
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                />
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#ef4444', fontSize: 13,
              }}>{error}</div>
            )}

            <button type="submit" className="btn btn-primary" style={{ height: 42, marginTop: 4, fontSize: 15 }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Вход...</> : 'Войти'}
            </button>

            {needs2fa && (
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => { setNeeds2fa(false); setTotp(''); }}>
                ← Назад
              </button>
            )}
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          innoguru.ru · CreationHub V2
        </p>
      </div>
    </div>
  );
}
