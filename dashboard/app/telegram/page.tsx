'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/api';
import {
  Bot, Play, Square, Terminal, Plus, Github, Trash2,
  RefreshCw, ExternalLink, X, AlertCircle, CheckCircle2,
  XCircle, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';

interface TelegramBot {
  id: string;
  name: string;
  bot_username: string | null;
  description: string | null;
  deploy_type: 'local' | 'git';
  github_repo: string | null;
  github_branch: string | null;
  container_name: string | null;
  status: string;
  real_status: string;
  docker_status: string | null;
  last_deploy_at: string | null;
  last_deploy_log: string | null;
}

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ch_access') || '';
}

async function apiReq(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const r = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

export default function TelegramPage() {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [inFlight, setInFlight] = useState<Record<string, string>>({});
  const [logsModal, setLogsModal] = useState<{ name: string; logs: string } | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiReq('/api/telegram');
      setBots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function doAction(id: string, action: 'start' | 'stop') {
    setInFlight(p => ({ ...p, [id]: action }));
    try {
      await apiReq(`/api/telegram/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInFlight(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function doDeploy(id: string) {
    setInFlight(p => ({ ...p, [id]: 'deploy' }));
    try {
      const res = await apiReq(`/api/telegram/${id}/deploy`, { method: 'POST' });
      alert(`Деплой запущен/успешен.\nЛог:\n${res.logs.substring(0, 500)}...`);
      await load();
    } catch (err: any) {
      alert(`Ошибка деплоя:\n${err.message}`);
    } finally {
      setInFlight(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function openLogs(bot: TelegramBot) {
    try {
      const { logs } = await apiReq(`/api/telegram/${bot.id}/logs`);
      setLogsModal({ name: bot.name, logs });
    } catch (err: any) {
      setLogsModal({ name: bot.name, logs: `Ошибка: ${err.message}` });
    }
  }

  async function deleteBot(id: string, name: string) {
    if (!confirm(`Удалить бота "${name}"?`)) return;
    try {
      await apiReq(`/api/telegram/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const running = bots.filter(b => b.real_status === 'running').length;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Telegram Боты</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--color-online)' }}>● {running} запущено</span>
            <span style={{ color: 'var(--text-muted)' }}>Всего: {bots.length}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} /> Обновить
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
            <Plus size={14} /> Добавить бота
          </button>
        </div>
      </div>

      {/* Bot list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : bots.length === 0 ? (
        <div className="empty-state">
          <Bot size={40} />
          <h3>Нет ботов</h3>
          <p>Добавьте Telegram бота для управления им через дашборд</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>
            <Plus size={14} /> Добавить бота
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bots.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              inFlight={inFlight[bot.id]}
              expanded={expandedId === bot.id}
              onToggleExpand={() => setExpandedId(prev => prev === bot.id ? null : bot.id)}
              onStart={() => doAction(bot.id, 'start')}
              onStop={() => doAction(bot.id, 'stop')}
              onDeploy={() => doDeploy(bot.id)}
              onLogs={() => openLogs(bot)}
              onDelete={() => deleteBot(bot.id, bot.name)}
            />
          ))}
        </div>
      )}

      {/* Logs modal */}
      {logsModal && (
        <div className="modal-overlay" onClick={() => setLogsModal(null)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={16} /> Логи: {logsModal.name}
              </span>
              <button className="btn btn-ghost btn-icon-sm" onClick={() => setLogsModal(null)}><X size={16} /></button>
            </div>
            <pre style={{
              background: '#0a0c14', color: '#e2e8f0', borderRadius: 8, padding: 14,
              fontSize: 11, fontFamily: 'var(--font-mono)', overflowY: 'auto',
              maxHeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {logsModal.logs || 'Нет логов'}
            </pre>
          </div>
        </div>
      )}

      {/* Add bot modal */}
      {addModal && <AddBotModal onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); load(); }} />}
    </AppShell>
  );
}

// ── Bot card
function BotCard({ bot, inFlight, expanded, onToggleExpand, onStart, onStop, onDeploy, onLogs, onDelete }: {
  bot: TelegramBot;
  inFlight?: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onStart: () => void;
  onStop: () => void;
  onDeploy: () => void;
  onLogs: () => void;
  onDelete: () => void;
}) {
  const isRunning = bot.real_status === 'running';
  const statusColor = isRunning ? 'var(--color-online)' : 'var(--color-offline)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Main row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
        cursor: 'pointer',
      }} onClick={onToggleExpand}>
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, #229ED9, #0088cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={22} color="#fff" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{bot.name}</span>
            {bot.bot_username && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bot.bot_username}</span>
            )}
            <span className="tag" style={{fontSize:10}}>
              {bot.deploy_type === 'git' ? <><Github size={10} style={{marginRight:3}}/>git</> : 'local'}
            </span>
          </div>
          {bot.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{bot.description}</div>
          )}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 500,
            background: isRunning ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: statusColor,
          }}>
            ● {isRunning ? 'Запущен' : 'Остановлен'}
          </span>
          {bot.docker_status && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{bot.docker_status}</span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          {/* Meta */}
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, flexWrap: 'wrap' }}>
            {bot.container_name && <span>🐳 {bot.container_name}</span>}
            {bot.github_repo && <span><Github size={11} style={{marginRight:3}}/>{bot.github_repo}@{bot.github_branch}</span>}
            {bot.last_deploy_at && <span>Деплой: {new Date(bot.last_deploy_at).toLocaleString('ru')}</span>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!isRunning ? (
              <button className="btn btn-success btn-sm" disabled={!!inFlight} onClick={onStart}>
                {inFlight === 'start' ? <span className="spinner" /> : <Play size={12} />} Запустить
              </button>
            ) : (
              <button className="btn btn-danger btn-sm" disabled={!!inFlight} onClick={onStop}>
                {inFlight === 'stop' ? <span className="spinner" /> : <Square size={12} />} Остановить
              </button>
            )}
            
            {bot.deploy_type === 'git' && (
              <button className="btn btn-primary btn-sm" disabled={!!inFlight} onClick={onDeploy}>
                {inFlight === 'deploy' ? <span className="spinner" /> : <RefreshCw size={12} />} Деплой
              </button>
            )}

            <button className="btn btn-secondary btn-sm" onClick={onLogs}>
              <Terminal size={12} /> Логи
            </button>
            {bot.bot_username && (
              <a
                href={`https://t.me/${bot.bot_username.replace('@','')}`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={12} /> Открыть в Telegram
              </a>
            )}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={onDelete}>
              <Trash2 size={12} /> Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add bot modal
function AddBotModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', bot_username: '', bot_token: '', description: '',
    deploy_type: 'local', github_repo: '', github_branch: 'main',
    container_name: '', dockerfile_path: 'Dockerfile',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiReq('/api/telegram', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} /> Добавить Telegram бота
          </span>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--color-offline)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Имя бота *</label>
              <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="My Bot" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username (@handle)</label>
              <input className="input" value={form.bot_username} onChange={e => setForm(p => ({ ...p, bot_username: e.target.value }))} placeholder="@mybot" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bot Token * (от @BotFather)</label>
            <input className="input" type="password" value={form.bot_token} onChange={e => setForm(p => ({ ...p, bot_token: e.target.value }))} required placeholder="1234567890:AABBcc..." />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Описание</label>
            <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Что делает бот?" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Docker контейнер</label>
            <input className="input" value={form.container_name} onChange={e => setForm(p => ({ ...p, container_name: e.target.value }))} placeholder="my_telegram_bot" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Тип деплоя</label>
            <select className="input" value={form.deploy_type} onChange={e => setForm(p => ({ ...p, deploy_type: e.target.value as any }))}>
              <option value="local">Локальный</option>
              <option value="git">GitHub</option>
            </select>
          </div>

          {form.deploy_type === 'git' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GitHub Repo (HTTPS) *</label>
                <input className="input" value={form.github_repo} onChange={e => setForm(p => ({ ...p, github_repo: e.target.value }))} placeholder="https://github.com/user/bot" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch</label>
                  <input className="input" value={form.github_branch} onChange={e => setForm(p => ({ ...p, github_branch: e.target.value }))} placeholder="main" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Dockerfile Path</label>
                  <input className="input" value={form.dockerfile_path} onChange={e => setForm(p => ({ ...p, dockerfile_path: e.target.value }))} placeholder="Dockerfile" />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Plus size={14} />} Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
