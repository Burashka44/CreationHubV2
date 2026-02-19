'use client';
import React from 'react';
import AppShell from '@/components/layout/AppShell';
import { Globe, ExternalLink } from 'lucide-react';

export default function OpenclawPage() {
  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>OpenClaw</h1>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🦞</div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>OpenClaw Control Panel</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.6 }}>
            OpenClaw управляется через отдельный интерфейс. Вы можете открыть его напрямую или дождаться интеграции в V2.
          </p>
          <a
            href="http://192.168.1.220:3011/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ gap: 8 }}
          >
            <ExternalLink size={14} /> Открыть OpenClaw UI
          </a>
        </div>
      </div>
    </AppShell>
  );
}
