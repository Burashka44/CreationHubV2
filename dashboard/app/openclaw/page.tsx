'use client';
import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { Bot, Activity, Play, Square, Terminal, ExternalLink } from 'lucide-react';

export default function OpenClawPage() {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    // Stub data
    setAgents([
      { id: 'semen', name: 'Semen', port: 3011, status: 'online', role: 'DevOps' },
      { id: 'helen', name: 'Helen', port: 3012, status: 'offline', role: 'HR' },
      { id: 'mama',  name: 'Mama',  port: 3013, status: 'online', role: 'Manager' },
      { id: 'vera',  name: 'Vera',  port: 3014, status: 'online', role: 'Support' },
      { id: 'burashka', name: 'Burashka', port: 3015, status: 'online', role: 'System' },
    ]);
  }, []);

  return (
    <AppShell>
      <h1 style={{ marginBottom: 20 }}>OpenClaw Agents</h1>
      
      <div className="grid-auto">
        {agents.map(agent => (
          <div key={agent.id} className={`badge status-${agent.status}`}>
            <div className="badge-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>👾</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>:{agent.port} • {agent.role}</div>
                </div>
              </div>
              <div className={`status-dot ${agent.status}`} />
            </div>

            <div className="badge-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm"><Play size={12} /> Start</button>
              {typeof window !== 'undefined' && <a href={`http://${window.location.hostname}:${agent.port}`} target="_blank" className="btn btn-secondary btn-sm">
                <ExternalLink size={12} /> Web UI
              </a>}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
