'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  LayoutDashboard, Server, Network, Bot, Globe, MessageSquare,
  Archive, Activity, ShieldCheck, Users, Settings,
  ChevronRight, Wifi, Power,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  group?: string;
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const nav: NavItem[] = [
    { href: '/dashboard',           icon: <LayoutDashboard size={16}/>, label: t.nav.home },
    { href: '/services',            icon: <Server size={16}/>,          label: t.nav.services, group: 'infra' },
    { href: '/network',             icon: <Network size={16}/>,         label: t.nav.network,  group: 'infra' },
    { href: '/ai-hub',              icon: <Bot size={16}/>,             label: t.nav.ai_hub,   group: 'ai' },
    { href: '/openclaw',            icon: <Globe size={16}/>,           label: t.nav.openclaw, group: 'ai' },
    { href: '/telegram',            icon: <MessageSquare size={16}/>,   label: t.nav.telegram, group: 'ai' },
    { href: '/backups',             icon: <Archive size={16}/>,         label: t.nav.backups,  group: 'system' },
    { href: '/activity',            icon: <Activity size={16}/>,        label: t.nav.activity, group: 'system' },
    { href: '/security',            icon: <ShieldCheck size={16}/>,     label: t.nav.security, group: 'system' },
    { href: '/admins',              icon: <Users size={16}/>,           label: t.nav.admins,   group: 'system' },
    { href: '/settings',            icon: <Settings size={16}/>,        label: t.nav.settings, group: 'system' },
  ];

  const groups: Record<string, string> = {
    infra:  'Инфраструктура',
    ai:     'AI & Агенты',
    system: 'Система',
  };

  let lastGroup = '';

  return (
    <aside className="sidebar" style={{ userSelect: 'none' }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🛡️</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            CreationHub
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>V2 · innoguru.ru</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {nav.map(item => {
          const group = item.group || '';
          const showGroup = group && group !== lastGroup;
          if (showGroup) lastGroup = group;
          return (
            <React.Fragment key={item.href}>
              {showGroup && (
                <div className="nav-group-label">{groups[group]}</div>
              )}
              <Link
                href={item.href}
                className={`nav-link ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
                onClick={onClose}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {(pathname === item.href || pathname.startsWith(item.href + '/')) && (
                  <ChevronRight size={12} style={{ opacity: 0.5 }} />
                )}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Bottom: V1 link */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <a
          href={typeof window !== 'undefined' ? `http://${window.location.hostname}:7777` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
          style={{ fontSize: 11, color: 'var(--text-muted)' }}
        >
          <Power size={14} />
          <span>CreationHub V1</span>
          <span style={{ fontSize: 10, padding: '1px 5px', background: 'var(--bg-elevated)', borderRadius: 4 }}>:7777</span>
        </a>
      </div>
    </aside>
  );
}
