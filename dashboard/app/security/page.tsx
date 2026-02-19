'use client';
import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import {
  ShieldCheck, Key, Smartphone, LogOut, Monitor,
  Globe, Lock, Eye, EyeOff, Save, Trash2,
} from 'lucide-react';

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  last_used_at: string;
  current: boolean;
}

export default function SecurityPage() {
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'sessions' | '2fa' | 'password'>('sessions');
  const [me, setMe]                 = useState<any>(null);

  // Password change
  const [curPass, setCurPass]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // 2FA
  const [tfaStep, setTfaStep] = useState<'idle' | 'setup' | 'confirm'>('idle');
  const [tfaData, setTfaData] = useState<{ qr: string; secret: string } | null>(null);
  const [tfaCode, setTfaCode] = useState('');
  const [tfaSaving, setTfaSaving] = useState(false);
  const [disablePass, setDisablePass] = useState('');

  useEffect(() => {
    api.auth.me().then((u: any) => setMe(u)).catch(() => {});
    api.auth.sessions().then((r: any) => setSessions(r?.sessions || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function changePassword() {
    setSavingPw(true);
    try {
      await api.auth.changePassword({ current_password: curPass, new_password: newPass });
      setCurPass(''); setNewPass('');
      alert('Пароль успешно изменён');
    } catch (err: any) { alert(err.message); }
    finally { setSavingPw(false); }
  }

  async function setup2fa() {
    setTfaSaving(true);
    try {
      const r: any = await api.auth.setup2fa();
      setTfaData({ qr: r.qr_code, secret: r.secret });
      setTfaStep('setup');
    } catch (err: any) { alert(err.message); }
    finally { setTfaSaving(false); }
  }

  async function confirm2fa() {
    if (!tfaData) return;
    setTfaSaving(true);
    try {
      await api.auth.verify2fa({ secret: tfaData.secret, code: tfaCode });
      setTfaStep('idle');
      setTfaData(null);
      setTfaCode('');
      const u: any = await api.auth.me();
      setMe(u);
      alert('2FA успешно включена');
    } catch (err: any) { alert(err.message); }
    finally { setTfaSaving(false); }
  }

  async function disable2fa() {
    if (!confirm('Отключить 2FA?')) return;
    try {
      await api.auth.disable2fa({ password: disablePass });
      setDisablePass('');
      const u: any = await api.auth.me();
      setMe(u);
    } catch (err: any) { alert(err.message); }
  }

  async function endSession(id: string) {
    await api.auth.deleteSession(id).catch((e: any) => alert(e.message));
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  function deviceIcon(ua: string) {
    if (/Mobile|Android|iPhone/i.test(ua)) return <Smartphone size={16} />;
    if (/curl|axios|node/i.test(ua)) return <Globe size={16} />;
    return <Monitor size={16} />;
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Безопасность</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([['sessions', 'Сессии'], ['2fa', '2FA'], ['password', 'Пароль']] as const).map(([t, label]) => (
            <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Sessions */}
        {tab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" style={{ width: 24, height: 24, display: 'inline-block' }} /></div>
              : sessions.length === 0 ? (
                <div className="empty-state"><ShieldCheck /><p>Нет активных сессий</p></div>
              ) : sessions.map(s => (
                <div key={s.id} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  border: s.current ? '1px solid rgba(99,102,241,0.3)' : undefined,
                }}>
                  <div style={{ color: 'var(--text-secondary)' }}>{deviceIcon(s.user_agent)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.ip_address}
                      {s.current && <span style={{ fontSize: 10, padding: '1px 7px', background: 'var(--accent-muted)', color: 'var(--accent)', borderRadius: 10 }}>Текущая</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.user_agent}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Последняя активность: {new Date(s.last_used_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  {!s.current && (
                    <button className="btn btn-danger btn-sm" onClick={() => endSession(s.id)}>
                      <LogOut size={13} /> Завершить
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* ── 2FA */}
        {tab === '2fa' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: me?.totp_enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShieldCheck size={22} color={me?.totp_enabled ? 'var(--color-online)' : 'var(--color-offline)'} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {me?.totp_enabled ? '2FA включена' : '2FA отключена'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {me?.totp_enabled ? 'Двухфакторная аутентификация защищает ваш аккаунт'
                    : 'Рекомендуется включить для дополнительной защиты'}
                </div>
              </div>
            </div>

            {!me?.totp_enabled && tfaStep === 'idle' && (
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={setup2fa} disabled={tfaSaving}>
                <ShieldCheck size={14} /> Включить 2FA
              </button>
            )}

            {tfaStep === 'setup' && tfaData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Отсканируйте QR код в Google Authenticator или Authy:
                </div>
                {/* eslint-disable-next-line */}
                <img src={tfaData.qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8, imageRendering: 'pixelated' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Или введите вручную: <strong>{tfaData.secret}</strong>
                </div>
                <div>
                  <label className="field-label">Код подтверждения</label>
                  <input className="input" type="text" inputMode="numeric" maxLength={6}
                    placeholder="000000" value={tfaCode} onChange={e => setTfaCode(e.target.value)}
                    style={{ width: 140, textAlign: 'center', fontSize: 20, letterSpacing: 8 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setTfaStep('idle')}>Отмена</button>
                  <button className="btn btn-primary" onClick={confirm2fa} disabled={tfaSaving || tfaCode.length < 6}>
                    Подтвердить
                  </button>
                </div>
              </div>
            )}

            {me?.totp_enabled && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Отключить 2FA (введите пароль):</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" type="password" placeholder="Пароль" style={{ width: 200 }}
                    value={disablePass} onChange={e => setDisablePass(e.target.value)} />
                  <button className="btn btn-danger btn-sm" disabled={!disablePass} onClick={disable2fa}>
                    Отключить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Password */}
        {tab === 'password' && (
          <div className="card" style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card-title"><Lock size={14} /> Смена пароля</div>
            <div>
              <label className="field-label">Текущий пароль</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'}
                  value={curPass} onChange={e => setCurPass(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">Новый пароль</label>
              <input className="input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={changePassword}
              disabled={savingPw || !curPass || newPass.length < 8}>
              {savingPw ? 'Сохранение...' : <><Save size={14} /> Изменить пароль</>}
            </button>
            {newPass && newPass.length < 8 && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>Минимум 8 символов</div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
