'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  Activity, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  Shield, Server, Wifi, Archive, Settings, Bot, Globe, MessageSquare, Lock,
} from 'lucide-react';

type Severity = 'info' | 'warning' | 'error' | 'critical';
type EventType = 'auth' | 'service' | 'vpn' | 'backup' | 'settings' | 'ai' | 'system' | 'security' | 'telegram' | 'openclaw';

interface LogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  event_type: EventType;
  event_action: string;
  target_name: string | null;
  description: string;
  ip_address: string | null;
  severity: Severity;
  metadata: any;
  created_at: string;
}

const TYPE_ICONS: Record<EventType, React.ReactNode> = {
  auth:      <Shield size={13} />,
  service:   <Server size={13} />,
  vpn:       <Wifi size={13} />,
  backup:    <Archive size={13} />,
  settings:  <Settings size={13} />,
  ai:        <Bot size={13} />,
  system:    <Globe size={13} />,
  security:  <Lock size={13} />,
  telegram:  <MessageSquare size={13} />,
  openclaw:  <Globe size={13} />,
};

const SEV_COLORS: Record<Severity, string> = {
  info:     'var(--text-muted)',
  warning:  'var(--color-warning)',
  error:    'var(--color-offline)',
  critical: '#f43f5e',
};

const SEV_BG: Record<Severity, string> = {
  info:     'transparent',
  warning:  'rgba(245,158,11,0.04)',
  error:    'rgba(239,68,68,0.05)',
  critical: 'rgba(244,63,94,0.08)',
};

export default function ActivityPage() {
  const { t } = useI18n();
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [severityFilter, setSev]= useState('');
  const [typeFilter, setType]   = useState('');
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(limit),
        offset: String((page - 1) * limit),
      };
      if (severityFilter) params.severity = severityFilter;
      if (typeFilter)     params.event_type = typeFilter;
      const res = await api.logs.list(params) as any;
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, severityFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / limit);

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.activity.title}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Всего: {total} записей</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
          <a
            href={api.logs.export('csv')}
            className="btn btn-secondary btn-sm"
            target="_blank" rel="noopener noreferrer"
          >
            <Download size={13} /> CSV
          </a>
          <a
            href={api.logs.export('json')}
            className="btn btn-secondary btn-sm"
            target="_blank" rel="noopener noreferrer"
          >
            <Download size={13} /> JSON
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="input" style={{ height: 32, fontSize: 13, paddingLeft: 10, width: 160 }}
          value={typeFilter} onChange={e => { setType(e.target.value); setPage(1); }}
        >
          <option value="">Все типы</option>
          {Object.keys(TYPE_ICONS).map(k => (
            <option key={k} value={k}>{t.activity.types[k as EventType] || k}</option>
          ))}
        </select>
        <select
          className="input" style={{ height: 32, fontSize: 13, paddingLeft: 10, width: 160 }}
          value={severityFilter} onChange={e => { setSev(e.target.value); setPage(1); }}
        >
          <option value="">Все уровни</option>
          <option value="info">Инфо</option>
          <option value="warning">Предупреждение</option>
          <option value="error">Ошибка</option>
          <option value="critical">Критично</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Тип</th>
                <th>Пользователь</th>
                <th>Описание</th>
                <th>Объект</th>
                <th>IP</th>
                <th>Уровень</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <span className="spinner" style={{ width: 24, height: 24, display: 'inline-block' }} />
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Нет записей
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ background: SEV_BG[log.severity] }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {TYPE_ICONS[log.event_type]}
                      {log.event_action}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{log.user_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ fontSize: 12, maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</div>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {log.target_name || '—'}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {log.ip_address || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                      color: SEV_COLORS[log.severity],
                      background: SEV_COLORS[log.severity] + '22',
                    }}>
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Страница {page} из {pages}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={13} />
              </button>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
