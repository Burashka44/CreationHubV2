'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://${hostname}:9292/ws`;

export interface LiveMetrics {
  cpu:      number | null;
  cpuTemp:  number | null;
  mem:      { percent: number; used_gb: number; total_gb: number; swap_percent: number } | null;
  disks:    Array<{ name: string; mount_point: string; percent: number; used_bytes: number; total_bytes: number }>;
  net:      { interfaces: Record<string, { rx_bytes: number; tx_bytes: number }>; speeds: Record<string, { rx_mbps: number; tx_mbps: number }> } | null;
  uptime:   number | null;
  load:     { avg1: number; avg5: number; avg15: number } | null;
  gpus:     Array<{
    gpu_index: number; gpu_name: string; gpu_temp_c: number | null; vrm_temp_c: number | null;
    gpu_util_percent: number; mem_util_percent: number; mem_used_mb: number; mem_total_mb: number;
    power_draw_w: number | null; power_limit_w: number | null; fan_speed_percent: number | null; nvlink_active: boolean;
  }>;
  wg:       { active: boolean; interfaces: string[] } | null;
  timestamp: string;
}

export function useMetricsWS() {
  const [metrics, setMetrics]       = useState<LiveMetrics | null>(null);
  const [connected, setConnected]   = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ch_access') : null;
    if (!token) return;

    ws.current = new WebSocket(`${WS_URL}?token=${token}`);

    ws.current.onopen = () => setConnected(true);

    ws.current.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        if (type === 'metrics') setMetrics(data);
      } catch {}
    };

    ws.current.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.current.onerror = () => ws.current?.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { metrics, connected };
}

// Format uptime in days/hours/min
export function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

// Color for percentage value
export function percentColor(v: number): string {
  if (v < 60) return 'var(--color-online)';
  if (v < 85) return 'var(--color-warning)';
  return 'var(--color-offline)';
}

// Format bytes to human
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
