'use client';
import React from 'react';
import { Activity } from 'lucide-react';
import { percentColor } from '@/lib/hooks/useMetrics';

interface GaugeProps {
  label: string;
  value: number | null;
  unit?: string;
  subLabel?: string;
  color?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function GaugeCard({ label, value, unit = '%', subLabel, color, icon, size = 'md' }: GaugeProps) {
  const pct = value !== null ? Math.min(100, Math.max(0, value)) : 0;
  // Fix: If value is 0 (e.g. 0% load), show green, not 'unknown'
  const c = color || (value !== null ? percentColor(value) : (value === 0 ? 'var(--color-online)' : 'var(--color-unknown)'));
  const radius = size === 'sm' ? 32 : 44;
  const strokeW = size === 'sm' ? 5 : 7;
  const circumference = 2 * Math.PI * radius;
  // Fix: If value is null (loading/offline), show full grey circle or 0 dash?
  // Let's show empty dash if null.
  const dash = value !== null ? (pct / 100) * circumference : 0;
  const svgSize = (radius + strokeW) * 2 + 4;
  const center = radius + strokeW + 2;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ position: 'relative' }}>
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={center} cy={center} r={radius}
            fill="none" stroke="var(--bg-elevated)" strokeWidth={strokeW} />
          <circle cx={center} cy={center} r={radius}
            fill="none" stroke={c} strokeWidth={strokeW}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: size === 'sm' ? 16 : 22,
            fontWeight: 700, color, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {value !== null ? Math.round(value) : '—'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>
      {subLabel && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{subLabel}</div>
      )}
    </div>
  );
}

interface BarMetricProps {
  label: string;
  value: number | null;
  max?: number;
  unit?: string;
  subText?: string;
}

export function BarMetric({ label, value, max = 100, unit = '%', subText }: BarMetricProps) {
  const pct = value !== null ? Math.min(100, (value / max) * 100) : 0;
  const c = percentColor(pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>
          {value !== null ? (unit === '%' ? `${Math.round(value)}%` : `${value} ${unit}`) : '—'}
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{
          width: `${pct}%`,
          background: c,
        }} />
      </div>
      {subText && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subText}</div>}
    </div>
  );
}

interface TempBadgeProps {
  label: string;
  value: number | null;
}
export function TempBadge({ label, value }: TempBadgeProps) {
  const color = value === null ? 'var(--text-muted)'
    : value < 60 ? 'var(--color-online)'
    : value < 80 ? 'var(--color-warning)'
    : 'var(--color-offline)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {value !== null ? `${value.toFixed(0)}°C` : '—'}
      </span>
    </div>
  );
}
