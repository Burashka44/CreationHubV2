'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { I18nProvider } from '@/lib/i18n';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Apply saved theme/scale
    const theme = localStorage.getItem('ch_theme') || 'dark';
    const scale = localStorage.getItem('ch_scale') || '100';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-scale', scale);
    setMounted(true);

    // Auth check
    const token = localStorage.getItem('ch_access');
    if (!token) router.push('/login');
  }, [router]);

  if (!mounted) return null;

  return (
    <I18nProvider>
      <div className="layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'var(--overlay)',
              zIndex: 90, display: 'none',
            }}
            id="sidebar-overlay"
          />
        )}

        <Sidebar onClose={() => setSidebarOpen(false)} />

        <div className="main-content">
          <Header
            onMenuToggle={() => setSidebarOpen(v => !v)}
            sidebarOpen={sidebarOpen}
          />
          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
