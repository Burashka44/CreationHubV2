'use client';
import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useMetricsWS, formatUptime, formatBytes, percentColor } from '@/lib/hooks/useMetrics';
import { GaugeCard, BarMetric, TempBadge } from '@/components/dashboard/MetricWidgets';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  Cpu, MemoryStick, HardDrive, Activity, Wifi, Server,
  Globe, Clock, Zap, BarChart2, ThermometerSun,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Leaflet map: load only on client (no SSR)
const GeoMap = dynamic(() => import('@/components/dashboard/GeoMap'), { ssr: false });
const NetworkChart = dynamic(() => import('@/components/dashboard/NetworkChart'), { ssr: false });

export default function DashboardPage() {
  const { metrics, connected } = useMetricsWS();
  const { t } = useI18n();
  const [services, setServices] = useState<any[]>([]);
  const [publicIp, setPublicIp] = useState<any>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);

  useEffect(() => {
    api.services.list().then((r: any) => setServices(r)).catch(() => {});
    api.metrics.publicIp().then((r: any) => setPublicIp(r)).catch(() => {});
    api.metrics.healthScore().then((r: any) => setHealthScore(r?.score)).catch(() => {});
  }, []);

  const m = metrics;
  const gpu0 = m?.gpus?.[0];
  const gpu1 = m?.gpus?.[1];

  const onlineServicesCount = services.filter((s: any) => s.real_status === 'online').length;
  const allServicesCount = services.length;

  // Network speed on primary interface
  const mainIface = m?.net ? Object.keys(m.net.interfaces)[0] : null;
  const netSpeed = mainIface && m?.net?.speeds?.[mainIface];

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Top row: Health score + status + uptime */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          {/* Health Score */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `conic-gradient(${healthScore !== null ? percentColor(100 - (healthScore || 0)) : '#475569'} ${(healthScore || 0) * 3.6}deg, var(--bg-elevated) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: 'inset 0 0 0 8px var(--bg-card)',
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {healthScore !== null ? healthScore : '—'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t.home.health_score}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: healthScore !== null && healthScore > 80 ? 'var(--color-online)' : 'var(--color-warning)' }}>
                {healthScore !== null && healthScore > 90 ? '✓ Отлично'
                  : healthScore !== null && healthScore > 70 ? '⚠ Хорошо'
                  : '✕ Проблемы'}
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.home.uptime}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUptime(m?.uptime ?? null)}</div>
              {m?.load && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Load: {m.load.avg1.toFixed(2)} / {m.load.avg5.toFixed(2)} / {m.load.avg15.toFixed(2)}</div>}
            </div>
          </div>

          {/* Services */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Server size={22} style={{ color: onlineServicesCount === allServicesCount ? 'var(--color-online)' : 'var(--color-warning)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.home.services}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                <span style={{ color: 'var(--color-online)' }}>{onlineServicesCount}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}> / {allServicesCount}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>онлайн сервисов</div>
            </div>
          </div>

          {/* Public IP */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Globe size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.home.public_ip}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{publicIp?.ip || '...'}</div>
              {publicIp && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{publicIp.city}, {publicIp.country}</div>}
            </div>
            {m?.wg?.active && (
              <span style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(34,197,94,0.12)', color: 'var(--color-online)', borderRadius: 10, fontWeight: 500 }}>
                VPN
              </span>
            )}
          </div>
        </div>

        {/* ── CPU + RAM */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* CPU */}
          <div className="card">
            <div className="card-title"><Cpu size={14} /> {t.home.cpu}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center' }}>
              <GaugeCard label="" value={m?.cpu ?? null} size="md" color={m?.cpu !== null ? percentColor(m!.cpu) : undefined} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <TempBadge label={t.home.temp} value={m?.cpuTemp ?? null} />
                {m?.load && <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>1м / 5м / 15м</span>
                    <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                      {m.load.avg1.toFixed(2)} / {m.load.avg5.toFixed(2)} / {m.load.avg15.toFixed(2)}
                    </span>
                  </div>
                </>}
              </div>
            </div>
          </div>

          {/* RAM */}
          <div className="card">
            <div className="card-title"><MemoryStick size={14} /> {t.home.ram}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
              <BarMetric
                label={`${m?.mem?.used_gb?.toFixed(1) || 0} / ${m?.mem?.total_gb?.toFixed(1) || 0} ГБ`}
                value={m?.mem?.percent ?? null}
              />
              {m?.mem && m.mem.swap_total_gb > 0 && (
                <BarMetric
                  label={`Swap: ${(m.mem as any).swap_used_gb?.toFixed(1) || 0} ГБ`}
                  value={m.mem.swap_percent}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── GPU(s) */}
        {(gpu0 || gpu1) && (
          <div style={{ display: 'grid', gridTemplateColumns: gpu1 ? '1fr 1fr' : '1fr', gap: 14 }}>
            {[gpu0, gpu1].filter(Boolean).map((gpu: any) => (
              <div key={gpu.gpu_index} className="card">
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} /> {gpu.gpu_name || t.home.gpu} #{gpu.gpu_index}
                  </span>
                  {gpu.nvlink_active && (
                    <span style={{ fontSize: 10, padding: '1px 7px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', borderRadius: 10 }}>
                      NVLink
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16, alignItems: 'start' }}>
                  <GaugeCard label="" value={gpu.gpu_util_percent} size="sm" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <TempBadge label={t.home.temp} value={gpu.gpu_temp_c} />
                    {gpu.vrm_temp_c && <TempBadge label={t.home.vrm_temp} value={gpu.vrm_temp_c} />}
                    <BarMetric
                      label={`VRAM: ${(gpu.mem_used_mb / 1024).toFixed(1)} / ${(gpu.mem_total_mb / 1024).toFixed(1)} ГБ`}
                      value={gpu.mem_util_percent}
                    />
                    {gpu.power_draw_w !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t.home.power}</span>
                        <span style={{ fontWeight: 500 }}>{gpu.power_draw_w?.toFixed(0)}W / {gpu.power_limit_w?.toFixed(0)}W</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Disks */}
        {m?.disks && m.disks.length > 0 && (
          <div className="card">
            <div className="card-title"><HardDrive size={14} /> {t.home.disk}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {m.disks.map((disk: any) => (
                <BarMetric
                  key={disk.mount_point}
                  label={`${disk.mount_point} (${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)})`}
                  value={disk.percent}
                  subText={disk.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Network Chart + Map */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card">
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={14} /> {t.home.network}</span>
              {netSpeed && (
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: 'var(--color-online)' }}>↓ {netSpeed.rx_mbps.toFixed(2)} Мбит/с</span>
                  <span style={{ color: 'var(--accent)' }}>↑ {netSpeed.tx_mbps.toFixed(2)} Мбит/с</span>
                </div>
              )}
            </div>
            <NetworkChart metrics={m} />
          </div>

          <div className="card" style={{ minHeight: 200 }}>
            <div className="card-title"><Globe size={14} /> {t.home.map_title}</div>
            {publicIp ? (
              <GeoMap lat={publicIp.lat} lon={publicIp.lon} ip={publicIp.ip} city={publicIp.city} />
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <Globe size={32} />
                <p>Определение геолокации...</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Services grid (compact) */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Server size={14} /> {t.home.services}</span>
            <a href="/services" style={{ fontSize: 12, color: 'var(--accent)' }}>Все сервисы →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {services.slice(0, 12).map((svc: any) => (
              <div key={svc.name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}>
                <div className={`status-dot ${svc.real_status}`} />
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {svc.display_name}
                </span>
                {svc.port && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>:{svc.port}</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
