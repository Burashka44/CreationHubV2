'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  Users, Plus, Trash2, Edit2, Key, RefreshCw, Copy, Eye, EyeOff, ExternalLink,
  ShieldCheck, ShieldX,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  permissions: Record<string, boolean>;
}

interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  user_id: string;
}

export default function AdminsPage() {
  const { t } = useI18n();
  const [users, setUsers]   = useState<User[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<Partial<User> | null>(null);
  const [newToken, setNewToken] = useState<{ name: string } | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'tokens'>('users');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, tk] = await Promise.all([
        api.admins.list() as Promise<User[]>,
        api.admins.tokens.list() as Promise<ApiToken[]>,
      ]);
      setUsers(u || []);
      setTokens(tk || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveUser() {
    if (!editUser) return;
    setSaving(true);
    try {
      if (editUser.id) {
        await api.admins.update(editUser.id, editUser);
      } else {
        await api.admins.create(editUser);
      }
      setEditUser(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally { setSaving(false); }
  }

  async function deleteUser(id: string) {
    if (!confirm('Удалить пользователя?')) return;
    await api.admins.delete(id).catch((e: any) => alert(e.message));
    await load();
  }

  async function createToken() {
    if (!newToken?.name?.trim()) return;
    setSaving(true);
    try {
      const res: any = await api.admins.tokens.create({ name: newToken.name });
      setCreatedToken(res.token);
      setNewToken(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally { setSaving(false); }
  }

  const ROLES: Array<{ value: string; label: string; color: string }> = [
    { value: 'admin',  label: 'Admin',   color: '#a855f7' },
    { value: 'user',   label: 'User',    color: '#6366f1' },
    { value: 'viewer', label: 'Viewer',  color: '#64748b' },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t.admins.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditUser({ role: 'viewer', is_active: true, permissions: {} })}>
            <Plus size={13} /> {t.admins.add_user}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['users', 'tokens'] as const).map(tab => (
          <button key={tab} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'users' ? <><Users size={13} /> Пользователи</> : <><Key size={13} /> API Токены</>}
          </button>
        ))}
      </div>

      {/* Users table */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>2FA</th>
                <th>Статус</th>
                <th>Последний вход</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <span className="spinner" style={{ width: 24, height: 24, display: 'inline-block' }} />
                </td></tr>
              ) : users.map(u => {
                const role = ROLES.find(r => r.value === u.role);
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                        background: (role?.color || '#64748b') + '22', color: role?.color || '#64748b',
                      }}>{role?.label}</span>
                    </td>
                    <td>
                      {u.totp_enabled
                        ? <ShieldCheck size={16} color="var(--color-online)" />
                        : <ShieldX   size={16} color="var(--text-muted)" />}
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'online' : 'offline'}`}>
                        {u.is_active ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ru-RU') : t.admins.never_logged}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon-sm" onClick={() => setEditUser({ ...u })}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-ghost btn-icon-sm danger" onClick={() => deleteUser(u.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* API Tokens table */}
      {activeTab === 'tokens' && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setNewToken({ name: '' })}>
              <Plus size={13} /> Создать токен
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Устройство</th>
                  <th>Префикс токена</th>
                  <th>Создан</th>
                  <th>Последнее использование</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Нет токенов
                  </td></tr>
                ) : tokens.map(tk => (
                  <tr key={tk.id}>
                    <td style={{ fontWeight: 500 }}>{tk.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tk.token_prefix}...</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(tk.created_at).toLocaleDateString('ru-RU')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {tk.last_used_at ? new Date(tk.last_used_at).toLocaleString('ru-RU') : 'Никогда'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-icon-sm danger"
                        onClick={async () => {
                          if (!confirm('Отозвать токен?')) return;
                          await api.admins.tokens.revoke(tk.id).catch((e: any) => alert(e.message));
                          load();
                        }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit user modal */}
      {editUser !== null && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editUser.id ? 'Редактировать пользователя' : 'Новый пользователь'}
              <button className="btn btn-ghost btn-icon-sm" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="field-label">Имя</label>
                <input className="input" value={editUser.name || ''} onChange={e => setEditUser(p => ({ ...p!, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input className="input" type="email" value={editUser.email || ''} onChange={e => setEditUser(p => ({ ...p!, email: e.target.value }))} />
              </div>
              {!editUser.id && (
                <div>
                  <label className="field-label">Пароль</label>
                  <input className="input" type="password" onChange={e => setEditUser(p => ({ ...p!, password: e.target.value } as any))} />
                </div>
              )}
              <div>
                <label className="field-label">Роль</label>
                <select className="input" value={editUser.role || 'viewer'} onChange={e => setEditUser(p => ({ ...p!, role: e.target.value as any }))}>
                  <option value="admin">Администратор</option>
                  <option value="user">Пользователь</option>
                  <option value="viewer">Наблюдатель</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={editUser.is_active ?? true} onChange={e => setEditUser(p => ({ ...p!, is_active: e.target.checked }))} />
                Активен
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditUser(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New token modal */}
      {newToken !== null && (
        <div className="modal-overlay" onClick={() => setNewToken(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Создать API токен<button className="btn btn-ghost btn-icon-sm" onClick={() => setNewToken(null)}>✕</button></div>
            <div>
              <label className="field-label">Имя устройства / описание</label>
              <input className="input" placeholder="Например: MacBook Pro"
                value={newToken.name}
                onChange={e => setNewToken({ name: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setNewToken(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={createToken} disabled={saving || !newToken.name.trim()}>
                {saving ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show created token */}
      {createdToken && (
        <div className="modal-overlay" onClick={() => setCreatedToken(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔑 Ваш токен</div>
            <div style={{ padding: '4px 0 12px', color: 'var(--color-warning)', fontSize: 13 }}>
              ⚠ Сохраните токен — он показывается только один раз!
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: '#0a0c14', padding: 12, borderRadius: 8,
              wordBreak: 'break-all', border: '1px solid var(--border)',
            }}>
              {createdToken}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary"
                onClick={() => navigator.clipboard.writeText(createdToken)}>
                <Copy size={13} /> Копировать
              </button>
              <button className="btn btn-primary" onClick={() => setCreatedToken(null)}>Понял, закрыть</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
