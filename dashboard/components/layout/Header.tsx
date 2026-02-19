'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Menu, X, ChevronDown, User, LogOut, Moon, Sun, Globe } from 'lucide-react';
import { api, clearTokens } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface HeaderProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}

export default function Header({ onMenuToggle, sidebarOpen }: HeaderProps) {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [scale, setScale] = useState<string>('100');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifCount] = useState(0); // will be connected to WS later
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ch_theme') as 'dark' | 'light' || 'dark';
    const savedScale = localStorage.getItem('ch_scale') || '100';
    setTheme(savedTheme);
    setScale(savedScale);
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-scale', savedScale);

    // Load user info
    api.auth.me().then((u: any) => setUser(u)).catch(() => {});
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ch_theme', next);
    api.settings.theme(next).catch(() => {});
  }

  async function handleLogout() {
    const rt = localStorage.getItem('ch_refresh') || '';
    await api.auth.logout(rt).catch(() => {});
    clearTokens();
    router.push('/login');
  }

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="header" style={{ justifyContent: 'space-between', gap: 16 }}>
      {/* Left: hamburger + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={onMenuToggle} style={{ display: 'none' }} id="sidebar-toggle">
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text" placeholder={t.actions.search}
            className="input"
            style={{ paddingLeft: 32, height: 32, fontSize: 13, width: 260 }}
            onFocus={() => {/* global search modal will open here */}}
            readOnly
          />
          <kbd style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', padding: '1px 5px',
            borderRadius: 4, border: '1px solid var(--border)',
          }}>Ctrl+K</kbd>
        </div>
      </div>

      {/* Right: lang, theme, notifications, user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Language toggle */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          style={{ gap: 4, fontWeight: 600, fontSize: 12 }}
          title="Switch language"
        >
          <Globe size={14} />
          {lang.toUpperCase()}
        </button>

        {/* Theme toggle */}
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }}>
          <Bell size={16} />
          {notifCount > 0 && (
            <span className="notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>
          )}
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setUserMenuOpen(v => !v)}
            style={{ gap: 6 }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#fff', fontWeight: 600, flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || '...'}
            </span>
            <ChevronDown size={12} />
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu" style={{ right: 0, top: 'calc(100% + 6px)', minWidth: 200 }}>
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email}</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', marginTop: 4,
                  padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                  background: 'var(--accent-muted)', color: 'var(--accent)',
                }}>{user?.role}</div>
              </div>
              <div className="dropdown-item" onClick={() => { setUserMenuOpen(false); router.push('/settings'); }}>
                <User size={14} />
                Профиль и безопасность
              </div>
              <div className="dropdown-separator" />
              <div className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={14} />
                {t.auth.logout}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
