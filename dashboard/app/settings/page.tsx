'use client';
import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Save, Moon, Sun, Globe, Bell, Database, Clock, BellOff } from 'lucide-react';

const LANGUAGES = [{ value: 'ru', label: '🇷🇺 Русский' }, { value: 'en', label: '🇬🇧 English' }];
const TIMEZONES = ['UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Asia/Dubai'];
const DATE_FORMATS = ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const TIME_FORMATS = ['24h', '12h'];
const SCALES = [80, 90, 100, 110, 125];

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [theme, setTheme]       = useState('dark');
  const [scale, setScale]       = useState('100');

  useEffect(() => {
    const savedTheme = localStorage.getItem('ch_theme') || 'dark';
    const savedScale = localStorage.getItem('ch_scale') || '100';
    setTheme(savedTheme);
    setScale(savedScale);
    api.settings.get().then((s: any) => setSettings(s || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function set(key: string, value: string) {
    setSettings(p => ({ ...p, [key]: value }));
  }

  function applyTheme(t: string) {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('ch_theme', t);
  }

  function applyScale(s: string) {
    setScale(s);
    document.documentElement.setAttribute('data-scale', s);
    localStorage.setItem('ch_scale', s);
  }

  async function save() {
    setSaving(true);
    try {
      await api.settings.update({ ...settings, language: lang, theme, ui_scale: scale });
      applyTheme(theme);
      applyScale(scale);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <AppShell><div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" style={{ width: 32, height: 32, display: 'inline-block' }} /></div></AppShell>;

  return (
    <AppShell>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t.settings.title}</h1>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '...' : saved ? '✓ Сохранено' : <><Save size={14} /> Сохранить</>}
          </button>
        </div>

        {/* ── Тема и язык */}
        <div className="card">
          <div className="card-title"><Globe size={14} /> Внешний вид</div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.language}</div>
              <div className="settings-desc">Язык интерфейса дашборда</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {LANGUAGES.map(l => (
                <button key={l.value}
                  className={`btn btn-sm ${lang === l.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setLang(l.value as 'ru' | 'en')}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.theme}</div>
              <div className="settings-desc">Светлая или тёмная тема</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => applyTheme('dark')}>
                <Moon size={13} /> Тёмная
              </button>
              <button className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => applyTheme('light')}>
                <Sun size={13} /> Светлая
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.ui_scale}</div>
              <div className="settings-desc">Масштаб всего интерфейса</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCALES.map(s => (
                <button key={s}
                  className={`btn btn-sm ${scale === String(s) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => applyScale(String(s))}>
                  {s}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Дата / Время */}
        <div className="card">
          <div className="card-title"><Clock size={14} /> Дата и время</div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.timezone}</div>
            </div>
            <select className="input" style={{ width: 240 }}
              value={settings.timezone || 'Europe/Moscow'}
              onChange={e => set('timezone', e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.date_format}</div>
            </div>
            <select className="input" style={{ width: 180 }}
              value={settings.date_format || 'DD.MM.YYYY'}
              onChange={e => set('date_format', e.target.value)}>
              {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.settings.time_format}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIME_FORMATS.map(f => (
                <button key={f}
                  className={`btn btn-sm ${(settings.time_format || '24h') === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => set('time_format', f)}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Уведомления */}
        <div className="card">
          <div className="card-title"><Bell size={14} /> Уведомления</div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Тихие часы</div>
              <div className="settings-desc">Не отправлять уведомления в это время</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="time" className="input" style={{ width: 110 }}
                value={settings.quiet_hours_start || '23:00'}
                onChange={e => set('quiet_hours_start', e.target.value)} />
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="time" className="input" style={{ width: 110 }}
                value={settings.quiet_hours_end || '08:00'}
                onChange={e => set('quiet_hours_end', e.target.value)} />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Telegram уведомление при входе</div>
              <div className="settings-desc">Получать сообщение при каждом входе в систему</div>
            </div>
            <label className="toggle">
              <input type="checkbox"
                checked={settings.tg_login_notify === 'true'}
                onChange={e => set('tg_login_notify', String(e.target.checked))} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
        </div>

        {/* ── Система */}
        <div className="card">
          <div className="card-title"><Database size={14} /> Система</div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Хранение логов активности</div>
              <div className="settings-desc">Логи старше этого срока будут удалены</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" className="input" min={1} max={365} style={{ width: 80 }}
                value={settings.log_retention_days || '90'}
                onChange={e => set('log_retention_days', e.target.value)} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>дней</span>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Хранение метрик</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" className="input" min={1} max={90} style={{ width: 80 }}
                value={settings.metrics_retention_days || '30'}
                onChange={e => set('metrics_retention_days', e.target.value)} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>дней</span>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Путь для бэкапов</div>
            </div>
            <input type="text" className="input" style={{ width: 280 }}
              value={settings.backup_path || '/backups'}
              onChange={e => set('backup_path', e.target.value)} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
