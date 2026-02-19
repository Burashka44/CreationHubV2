'use client';
import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useMetricsWS } from '@/lib/hooks/useMetrics';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';
import {
  Wifi, WifiOff, Globe, Upload, Shield, Activity,
  ArrowDown, ArrowUp, Network, Plug, PlugZap, RefreshCw,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function NetworkPage() {
  const { metrics } = useMetricsWS();
  const [publicIp, setPublicIp]   = useState<any>(null);
  const [vpnList, setVpnList]     = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [netHistory, setNetHistory] = useState<any[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.metrics.publicIp().then((r: any) => setPublicIp(r)).catch(() => {});
    // Load VPN configs from settings
    api.settings.get().then((s: any) => {
      // VPN configs stored via /api/network — stub returns placeholder
    }).catch(() => {});
    // Load 24h history
    api.metrics.history('24h').then((r: any) => setNetHistory(r || [])).catch(() => {});
  }, []);

  // Accumulate live speed
  const wg    = metrics?.wg;
  const ifaces = metrics?.net?.interfaces || {};
  const speeds  = metrics?.net?.speeds    || {};

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Сеть</h1>
        </div>

        {/* ── Top cards: IP + WG status + Internet */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {/* Public IP */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card-title"><Globe size={14} /> Публичный IP</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {publicIp?.ip || '...'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {publicIp ? `${publicIp.city}, ${publicIp.country} · ${publicIp.org}` : 'Определение...'}
            </div>
          </div>

          {/* WireGuard */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card-title"><Shield size={14} /> WireGuard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={`status-dot ${wg?.active ? 'online' : 'offline'}`} style={{ width: 12, height: 12 }} />
              <span style={{ fontSize: 20, fontWeight: 700 }}>{wg?.active ? 'Активен' : 'Выключен'}</span>
            </div>
            {wg?.interfaces?.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wg.interfaces.map((iface: string) => (
                  <span key={iface} className="tag" style={{ fontFamily: 'var(--font-mono)' }}>{iface}</span>
                ))}
              </div>
            ) : null}
          </div>

          {/* DNS */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card-title"><Network size={14} /> Интерфейсы</div>
            {Object.entries(ifaces).slice(0, 4).map(([name, stat]: [string, any]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{name}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {speeds[name] && <>
                    <span style={{ color: 'var(--color-online)' }}>↓ {speeds[name].rx_mbps.toFixed(1)}</span>
                    <span style={{ color: 'var(--accent)' }}>↑ {speeds[name].tx_mbps.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Мбит/с</span>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 24h traffic chart */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> Трафик за 24 часа</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ color: 'var(--color-online)' }}>↓ Входящий</span>
              <span style={{ color: 'var(--accent)' }}>↑ Исходящий</span>
            </div>
          </div>
          {netHistory.length > 1 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rxG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="txG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(netHistory.length/6)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v?.toFixed(2)} Мбит/с`, name === 'net_rx' ? '↓' : '↑']}
                  />
                  <Area type="monotone" dataKey="net_rx" stroke="#22c55e" strokeWidth={1.5} fill="url(#rxG)" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="net_tx" stroke="#6366f1" strokeWidth={1.5} fill="url(#txG)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <Activity size={32} />
              <p>Накапливаются данные для 24ч графика...</p>
            </div>
          )}
        </div>

        {/* ── VPN Manager */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> VPN Менеджер</span>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={13} />
              {uploading ? 'Загрузка...' : 'Загрузить конфиг'}
              <input
                ref={fileRef} type="file" hidden
                accept=".conf,.json,.ovpn"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  // Upload via form-data to /api/network/vpn (stub route, will be expanded)
                  const formData = new FormData();
                  formData.append('config', file);
                  try {
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/network/vpn/upload`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${localStorage.getItem('ch_access')}` },
                      body: formData,
                    });
                    alert('Конфиг загружен');
                  } catch (err: any) {
                    alert(err.message);
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          {/* VPN configs list — will be loaded from DB */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vpnList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                <Shield size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
                Нет сохранённых VPN конфигураций<br />
                <span style={{ fontSize: 12 }}>Поддерживаются: WireGuard (.conf), V2Ray (.json), OpenVPN (.ovpn)</span>
              </div>
            ) : vpnList.map((vpn: any) => (
              <VpnRow key={vpn.id} vpn={vpn} />
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}

function VpnRow({ vpn }: { vpn: any }) {
  const [loading, setLoading] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 8,
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    }}>
      <div className={`status-dot ${vpn.is_connected ? 'online' : 'offline'}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{vpn.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{vpn.protocol} · {vpn.server_ip}</div>
      </div>
      <span className="tag">{vpn.protocol}</span>
      <button
        className={`btn btn-sm ${vpn.is_connected ? 'btn-danger' : 'btn-success'}`}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const action = vpn.is_connected ? 'disconnect' : 'connect';
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/network/vpn/${vpn.id}/${action}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('ch_access')}` },
            });
          } finally { setLoading(false); }
        }}
      >
        {loading ? <span className="spinner" style={{ width: 12, height: 12 }} />
          : vpn.is_connected ? <><PlugZap size={13} /> Отключить</> : <><Plug size={13} /> Подключить</>}
      </button>
    </div>
  );
}
