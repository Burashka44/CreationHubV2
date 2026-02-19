'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  Play, Square, RotateCcw, Terminal, ExternalLink, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Eye, Server, Tag,
  Search, Filter,
} from 'lucide-react';

type ServiceStatus = 'online' | 'offline' | 'warning' | 'unknown';

interface Service {
  id: string;
  name: string;
  display_name: string;
  description: string;
  container_name: string;
  port: number | null;
  url: string | null;
  category: string;
  icon: string | null;
  real_status: ServiceStatus;
  docker_state: string | null;
  docker_status: string | null;
  response_time_ms: number | null;
  is_active: boolean;
  tags: string[];
}

const CATEGORIES = ['all', 'ai', 'media', 'network', 'storage', 'automation', 'monitoring', 'other'];
const STATUS_ICON: Record<ServiceStatus, React.ReactNode> = {
  online:  <CheckCircle2 size={14} color="var(--color-online)" />,
  offline: <XCircle     size={14} color="var(--color-offline)" />,
  warning: <AlertCircle size={14} color="var(--color-warning)" />,
  unknown: <Eye         size={14} color="var(--color-unknown)" />,
};

export default function ServicesPage() {
  const { t } = useI18n();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionInFlight, setActionInFlight] = useState<Record<string, string>>({});
  const [logsModal, setLogsModal] = useState<{ name: string; output: string } | null>(null);
  const [filter, setFilter]     = useState<string>('all');
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.services.list() as Service[];
      setServices(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function action(name: string, act: 'start' | 'stop' | 'restart') {
    setActionInFlight(p => ({ ...p, [name]: act }));
    try {
      if (act === 'start')   await api.services.start(name);
      if (act === 'stop')    await api.services.stop(name);
      if (act === 'restart') await api.services.restart(name);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInFlight(p => { const n = { ...p }; delete n[name]; return n; });
    }
  }

  async function openLogs(name: string) {
    try {
      const out = await api.services.logs(name, 300) as string;
      setLogsModal({ name, output: out });
    } catch (err: any) {
      setLogsModal({ name, output: `Ошибка: ${err.message}` });
    }
  }

  const categories: Record<string, string> = {
    all:        'Все',
    ai:         'AI',
    media:      'Медиа',
    network:    'Сеть',
    storage:    'Хранилище',
    automation: 'Автоматизация',
    monitoring: 'Мониторинг',
    other:      'Прочее',
  };

  const filtered = services.filter(s => {
    const matchCat = filter === 'all' || s.category === filter;
    const matchSearch = !search || s.display_name.toLowerCase().includes(search.toLowerCase())
      || s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const online  = services.filter(s => s.real_status === 'online').length;
  const offline = services.filter(s => s.real_status === 'offline').length;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.services.title}</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--color-online)' }}>● {online} онлайн</span>
            <span style={{ color: 'var(--color-offline)' }}>● {offline} офлайн</span>
            <span style={{ color: 'var(--text-muted)' }}>Всего: {services.length}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text" placeholder="Поиск сервиса..." className="input"
            style={{ paddingLeft: 30, height: 32, fontSize: 13, width: 220 }}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`btn btn-sm ${filter === cat ? 'btn-primary' : 'btn-secondary'}`}
            >
              {categories[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Server />
          <h3>Сервисы не найдены</h3>
          <p>Попробуйте изменить фильтр или поиск</p>
        </div>
      ) : (
        <div className="grid-auto">
          {filtered.map(svc => (
            <ServiceBadge
              key={svc.id}
              svc={svc}
              inFlight={actionInFlight[svc.name]}
              onAction={action}
              onLogs={openLogs}
            />
          ))}
        </div>
      )}

      {/* Logs modal */}
      {logsModal && (
        <div className="modal-overlay" onClick={() => setLogsModal(null)}>
          <div className="modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={18} /> Логи: {logsModal.name}
              </span>
              <button className="btn btn-ghost btn-icon-sm" onClick={() => setLogsModal(null)}>✕</button>
            </div>
            <pre style={{
              background: '#0a0c14', color: '#e2e8f0', borderRadius: 8, padding: 14,
              fontSize: 11, fontFamily: 'var(--font-mono)', overflowY: 'auto',
              maxHeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {logsModal.output || 'Нет логов'}
            </pre>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Service badge card
function ServiceBadge({ svc, inFlight, onAction, onLogs }: {
  svc: Service;
  inFlight?: string;
  onAction: (name: string, act: 'start' | 'stop' | 'restart') => void;
  onLogs: (name: string) => void;
}) {
  const isLoading = !!inFlight;

  return (
    <div className={`badge status-${svc.real_status}`}>
      {/* Header row */}
      <div className="badge-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {svc.icon && <span style={{ fontSize: 18 }}>{svc.icon}</span>}
          <span className="badge-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {svc.display_name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {STATUS_ICON[svc.real_status]}
          {svc.url && (
            <a href={svc.url} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost btn-icon-sm" title="Открыть">
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Status + port + response */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className={`status-badge ${svc.real_status}`}>
          {svc.docker_status || (svc.real_status === 'online' ? 'running' : svc.real_status)}
        </span>
        {svc.port && (
          <span className="tag" style={{ fontFamily: 'var(--font-mono)' }}>:{svc.port}</span>
        )}
        {svc.response_time_ms !== null && (
          <span className="tag">{svc.response_time_ms}мс</span>
        )}
      </div>

      {/* Description */}
      {svc.description && (
        <div className="badge-meta" style={{
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {svc.description}
        </div>
      )}

      {/* Actions */}
      <div className="badge-actions">
        {svc.real_status !== 'online' ? (
          <button className="btn btn-success btn-sm" disabled={isLoading}
            onClick={() => onAction(svc.name, 'start')}>
            {inFlight === 'start' ? <span className="spinner" /> : <Play size={12} />}
            Старт
          </button>
        ) : (
          <>
            <button className="btn btn-warning btn-sm" disabled={isLoading}
              onClick={() => onAction(svc.name, 'restart')}>
              {inFlight === 'restart' ? <span className="spinner" /> : <RotateCcw size={12} />}
              Рестарт
            </button>
            <button className="btn btn-danger btn-sm" disabled={isLoading}
              onClick={() => onAction(svc.name, 'stop')}>
              {inFlight === 'stop' ? <span className="spinner" /> : <Square size={12} />}
              Стоп
            </button>
          </>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onLogs(svc.name)}>
          <Terminal size={12} /> Логи
        </button>
      </div>
    </div>
  );
}
