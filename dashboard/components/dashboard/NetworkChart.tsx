'use client';
import React, { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LiveMetrics } from '@/lib/hooks/useMetrics';

interface NetworkChartProps {
  metrics: LiveMetrics | null;
}

interface DataPoint {
  time:   string;
  rx:     number;
  tx:     number;
}

const MAX_POINTS = 60; // keep 60 data points (~5 min at 5s interval)

export default function NetworkChart({ metrics }: NetworkChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    if (!metrics?.net) return;
    const mainIface = Object.keys(metrics.net.interfaces)[0];
    if (!mainIface) return;
    const speed = metrics.net.speeds?.[mainIface];
    if (!speed) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    setData(prev => {
      const next = [...prev, {
        time: timeStr,
        rx:   parseFloat(speed.rx_mbps.toFixed(2)),
        tx:   parseFloat(speed.tx_mbps.toFixed(2)),
      }];
      return next.slice(-MAX_POINTS);
    });
  }, [metrics]);

  if (data.length < 2) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Накапливаются данные...
      </div>
    );
  }

  return (
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 5)}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
            }}
            formatter={(value: number, name: string) => [
              `${value} Мбит/с`,
              name === 'rx' ? '↓ Входящий' : '↑ Исходящий',
            ]}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
          />
          <Area
            type="monotone" dataKey="rx" stroke="#22c55e" strokeWidth={1.5}
            fill="url(#rxGrad)" dot={false} isAnimationActive={false}
          />
          <Area
            type="monotone" dataKey="tx" stroke="#6366f1" strokeWidth={1.5}
            fill="url(#txGrad)" dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
