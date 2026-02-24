-- ============================================================
-- CreationHub V2 — Database Schema
-- PostgreSQL 15+
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE admins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,                    -- bcrypt cost 12
  role            TEXT NOT NULL DEFAULT 'viewer'    -- 'admin' | 'user' | 'viewer'
                  CHECK (role IN ('admin', 'user', 'viewer')),
  permissions     JSONB NOT NULL DEFAULT '{}',      -- for role='user' checkboxes
  avatar_url      TEXT,
  telegram_chat_id    TEXT,
  telegram_username   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  totp_secret     TEXT,                             -- AES-256-GCM encrypted
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  totp_backup_codes   TEXT[],                       -- AES-256-GCM encrypted
  telegram_notify_login BOOLEAN NOT NULL DEFAULT false,
  last_login_at   TIMESTAMPTZ,
  last_login_ip   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default admin (password: changeme123 — CHANGE ON FIRST LOGIN)
INSERT INTO admins (email, name, password_hash, role)
VALUES (
  'admin@creationhub.local',
  'Administrator',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.imu2', -- changeme123
  'admin'
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,                 -- SHA-256 hash
  user_agent  TEXT,
  ip_address  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ollama API tokens (for mobile apps)
CREATE TABLE api_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                        -- "My Phone"
  token_hash  TEXT NOT NULL UNIQUE,                 -- SHA-256 hash of token
  token_prefix TEXT NOT NULL,                       -- first 8 chars for display
  permissions JSONB NOT NULL DEFAULT '{"models": ["*"]}',
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVICES
-- ============================================================

CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'other',    -- 'ai'|'media'|'network'|'storage'|'automation'|'monitoring'|'other'
  container_name  TEXT,                             -- Docker container name
  port            TEXT,
  internal_url    TEXT,
  external_url    TEXT,
  icon            TEXT,                             -- emoji or icon name
  color           TEXT,                             -- hex color for badge
  is_active       BOOLEAN NOT NULL DEFAULT true,
  show_on_home    BOOLEAN NOT NULL DEFAULT false,
  tags            TEXT[] DEFAULT '{}',
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service status history
CREATE TABLE service_uptime (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('online', 'offline', 'unknown', 'degraded')),
  response_time_ms INTEGER,
  error_message   TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_uptime_service_id ON service_uptime(service_id);
CREATE INDEX idx_service_uptime_checked_at ON service_uptime(checked_at DESC);

-- Seed services
INSERT INTO services (name, display_name, description, category, container_name, port, icon, color, show_on_home, tags) VALUES
('dashboard',       'Dashboard V2',         'CreationHub V2 Dashboard',         'other',        'creationhub_v2',               '7778', '🏠', '#6366f1', false, '{}'),
('system_api',      'System API',           'Backend API',                      'other',        'creationhub_v2_api',           '9292', '⚙️', '#64748b', false, '{}'),
('ollama',          'Ollama',               'Local LLM Engine',                 'ai',           'creationhub_ollama',           '11434','🤖', '#8b5cf6', true,  '{"ai"}'),
('portainer',       'Portainer',            'Docker Management UI',             'monitoring',   'creationhub_portainer',        '9000', '🐳', '#0ea5e9', false, '{"docker"}'),
('adminer',         'Adminer',              'Database UI',                      'other',        'creationhub_adminer',          '8083', '🗄️', '#f59e0b', false, '{"db"}'),
('filebrowser',     'File Browser',         'File Manager',                     'storage',      'creationhub_filebrowser',      '8082', '📁', '#10b981', false, '{"files"}'),
('nextcloud',       'Nextcloud',            'Cloud Storage & Talk',             'storage',      'creationhub_nextcloud',        '8081', '☁️', '#0082c9', true,  '{"files","chat"}'),
('n8n',             'n8n',                  'Workflow Automation',              'automation',   'creationhub_n8n',              '5678', '🔄', '#ea580c', true,  '{"automation"}'),
('browserless',     'Browserless',          'Headless Browser (for n8n)',       'automation',   'creationhub_browserless',      '3002', '🌐', '#475569', false, '{"n8n"}'),
('rsshub',          'RSSHub',               'RSS Aggregator (for n8n)',         'automation',   'creationhub_rsshub',           '1200', '📡', '#f97316', false, '{"n8n"}'),
('npm',             'Nginx Proxy Manager',  'Reverse Proxy',                    'network',      'creationhub_npm',              '81',   '🔀', '#22c55e', false, '{"network"}'),
('yt_dlp',          'yt-dlp / MeTube',      'Media Downloader',                 'media',        'creationhub_yt_dlp',           '8084', '📥', '#ef4444', true,  '{"media"}'),
('ai_transcribe',   'Whisper',              'Audio Transcription',              'ai',           'creationhub_ai_transcribe',    '8000', '🎙️', '#a855f7', true,  '{"ai","media"}'),
('ai_translate',    'LibreTranslate',       'Text Translation',                 'ai',           'creationhub_ai_translate',     '5000', '🌍', '#06b6d4', false, '{"ai"}'),
('ai_tts',          'TTS',                  'Text to Speech',                   'ai',           'creationhub_ai_tts',           '5500', '🔊', '#ec4899', true,  '{"ai"}'),
('dozzle',          'Dozzle',               'Container Logs Viewer',            'monitoring',   'creationhub_dozzle',           '8888', '📋', '#64748b', false, '{"monitoring"}'),
('healthchecks',    'Healthchecks',         'Cron Job Monitor',                 'monitoring',   'creationhub_healthchecks',     '8001', '❤️', '#ef4444', false, '{"monitoring"}'),
('wireguard_ui',    'WireGuard UI',         'VPN Management',                   'network',      'creationhub_wireguard_ui',     '5003', '🔒', '#6366f1', false, '{"vpn","network"}'),
('sam2',            'SAM2',                 'Image Segmentation AI',            'ai',           'creationhub_sam2',             '8787', '🖼️', '#8b5cf6', false, '{"ai"}'),
('iopaint',         'IOPaint',              'AI Image Editing',                 'ai',           'creationhub_iopaint',          '8585', '🎨', '#ec4899', false, '{"ai","media"}'),
('openclaw_semen',  'OpenClaw: Semen',      'Personal AI Agent',               'ai',           'creationhub_openclaw_semen',   '3011', '🦾', '#f59e0b', false, '{"ai","openclaw"}'),
('openclaw_helen',  'OpenClaw: Helen',      'Personal AI Agent',               'ai',           'creationhub_openclaw_helen',   '3012', '🦾', '#f59e0b', false, '{"ai","openclaw"}'),
('openclaw_mama',   'OpenClaw: Mama',       'Personal AI Agent',               'ai',           'creationhub_openclaw_mama',    '3013', '🦾', '#f59e0b', false, '{"ai","openclaw"}'),
('openclaw_vera',   'OpenClaw: Vera',       'Personal AI Agent',               'ai',           'creationhub_openclaw_vera',    '3014', '🦾', '#f59e0b', false, '{"ai","openclaw"}'),
('burashka',        'Бурашка',              'System Agent 24/7',               'ai',           'creationhub_burashka',         '3015', '🤖', '#6366f1', true,  '{"ai","openclaw","system"}'),
('tabby',           'Tabby',                'AI Coding Assistant',              'ai',           'creationhub_tabby',            '8591', '💻', '#22c55e', false, '{"ai","coding"}'),
('video_processor', 'Video Processor',      'Video Processing Pipeline',       'media',        'creationhub_video_processor',  '8686', '🎬', '#ef4444', false, '{"media"}');

-- ============================================================
-- SYSTEM METRICS (from host)
-- ============================================================

CREATE TABLE system_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpu_percent     FLOAT,
  cpu_temp_c      FLOAT,
  ram_percent     FLOAT,
  ram_used_gb     FLOAT,
  ram_total_gb    FLOAT,
  swap_percent    FLOAT,
  net_rx_bytes    BIGINT,
  net_tx_bytes    BIGINT,
  net_rx_mbps     FLOAT,
  net_tx_mbps     FLOAT,
  uptime_seconds  BIGINT,
  load_avg_1      FLOAT,
  load_avg_5      FLOAT,
  load_avg_15     FLOAT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- Auto-cleanup: keep 30 days
CREATE OR REPLACE FUNCTION cleanup_system_metrics() RETURNS void AS $$
BEGIN
  DELETE FROM system_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Disk snapshots
CREATE TABLE disk_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  mount_point     TEXT NOT NULL,
  used_bytes      BIGINT,
  total_bytes     BIGINT,
  percent         FLOAT,
  fs_type         TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disk_snapshots_timestamp ON disk_snapshots(timestamp DESC);

-- GPU metrics (nvidia-smi)
CREATE TABLE gpu_metrics (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gpu_index             INTEGER NOT NULL,           -- 0=1080Ti, 1=V100#1, 2=V100#2
  gpu_name              TEXT,
  gpu_temp_c            FLOAT,
  vrm_temp_c            FLOAT,
  gpu_util_percent      FLOAT,
  mem_util_percent      FLOAT,
  mem_used_mb           BIGINT,
  mem_total_mb          BIGINT,
  power_draw_w          FLOAT,
  power_limit_w         FLOAT,
  fan_speed_percent     FLOAT,
  nvlink_active         BOOLEAN DEFAULT false,
  nvlink_bandwidth_gbps FLOAT,
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gpu_metrics_timestamp ON gpu_metrics(timestamp DESC);
CREATE INDEX idx_gpu_metrics_gpu_index ON gpu_metrics(gpu_index);

-- ============================================================
-- VPN
-- ============================================================

CREATE TABLE vpn_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,                    -- "Netherlands WG"
  protocol        TEXT NOT NULL                     -- 'wireguard'|'amnezia'|'v2ray'
                  CHECK (protocol IN ('wireguard', 'amnezia', 'v2ray')),
  country         TEXT,
  country_code    TEXT,                             -- ISO 3166-1 alpha-2
  city            TEXT,
  config_data     TEXT NOT NULL,                    -- AES-256-GCM encrypted
  config_filename TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  last_connected_at TIMESTAMPTZ,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vpn_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id       UUID REFERENCES vpn_configs(id) ON DELETE SET NULL,
  config_name     TEXT,
  protocol        TEXT,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  public_ip       TEXT,
  geo_country     TEXT,
  geo_city        TEXT,
  geo_lat         FLOAT,
  geo_lon         FLOAT,
  duration_seconds INTEGER
);

-- ============================================================
-- BACKUPS
-- ============================================================

CREATE TABLE backup_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  targets         JSONB NOT NULL DEFAULT '[]',      -- what to backup
  cron_expression TEXT NOT NULL,                    -- e.g. "0 3 * * *"
  retention_days  INTEGER NOT NULL DEFAULT 30,
  destination     TEXT NOT NULL,                    -- path on host
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backup_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id     UUID REFERENCES backup_schedules(id) ON DELETE SET NULL,
  schedule_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
  targets         JSONB,
  size_bytes      BIGINT,
  file_path       TEXT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_backup_history_started_at ON backup_history(started_at DESC);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
  user_name   TEXT,
  user_role   TEXT,
  event_type  TEXT NOT NULL                         -- 'auth'|'service'|'vpn'|'backup'|'settings'|'ai'|'system'|'security'
              CHECK (event_type IN ('auth','service','vpn','backup','settings','ai','system','security','telegram','openclaw')),
  event_key   TEXT NOT NULL,                        -- 'login'|'logout'|'service_start'|...
  target      TEXT,                                 -- service name / resource
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','warning','error','critical')),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX idx_activity_logs_admin_id ON activity_logs(admin_id);
CREATE INDEX idx_activity_logs_severity ON activity_logs(severity);

-- ============================================================
-- TELEGRAM BOTS
-- ============================================================

CREATE TABLE telegram_bots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  bot_username    TEXT,
  bot_token       TEXT NOT NULL,                    -- AES-256-GCM encrypted
  description     TEXT,
  deploy_type     TEXT NOT NULL DEFAULT 'local'
                  CHECK (deploy_type IN ('local', 'github')),
  github_repo     TEXT,
  github_branch   TEXT DEFAULT 'main',
  github_token    TEXT,                             -- AES-256-GCM encrypted
  container_name  TEXT,
  dockerfile_path TEXT DEFAULT 'Dockerfile',
  env_vars        JSONB DEFAULT '{}',               -- AES-256-GCM encrypted values
  status          TEXT DEFAULT 'stopped'
                  CHECK (status IN ('running', 'stopped', 'error', 'deploying')),
  last_deploy_at  TIMESTAMPTZ,
  last_deploy_log TEXT,
  webhook_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OPENCLAW AGENTS
-- ============================================================

CREATE TABLE openclaw_agents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,                    -- 'Semen', 'Helen', 'Burashka'
  slug            TEXT UNIQUE NOT NULL,             -- 'semen', 'helen', 'burashka'
  port            INTEGER NOT NULL,
  container_name  TEXT NOT NULL,
  description     TEXT,
  telegram_bot_token  TEXT,                         -- AES-256-GCM encrypted
  telegram_chat_id    TEXT,
  telegram_username   TEXT,
  is_system_agent BOOLEAN NOT NULL DEFAULT false,   -- true only for Burashka
  is_active       BOOLEAN NOT NULL DEFAULT true,
  owner_admin_id  UUID REFERENCES admins(id) ON DELETE SET NULL,
  model           TEXT DEFAULT 'llama3.2',
  system_prompt   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO openclaw_agents (name, slug, port, container_name, description, is_system_agent) VALUES
('Бурашка', 'burashka', 3015, 'creationhub_burashka', 'System Agent 24/7 — Server Administrator', true),
('Semen',   'semen',    3011, 'creationhub_openclaw_semen', 'Personal AI Agent', false),
('Helen',   'helen',    3012, 'creationhub_openclaw_helen', 'Personal AI Agent', false),
('Mama',    'mama',     3013, 'creationhub_openclaw_mama',  'Personal AI Agent', false),
('Vera',    'vera',     3014, 'creationhub_openclaw_vera',  'Personal AI Agent', false);

-- ============================================================
-- N8N WORKFLOWS CACHE
-- ============================================================

CREATE TABLE n8n_workflows (
  id              TEXT PRIMARY KEY,                 -- n8n workflow ID
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  tags            JSONB DEFAULT '[]',
  node_count      INTEGER DEFAULT 0,
  last_execution_at TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS / WEBHOOKS
-- ============================================================

CREATE TABLE notification_channels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL                         -- 'telegram'|'webhook'|'nextcloud_talk'|'discord'|'slack'
              CHECK (type IN ('telegram', 'webhook', 'nextcloud_talk', 'discord', 'slack')),
  config      JSONB NOT NULL DEFAULT '{}',          -- AES-256-GCM for tokens
  events      TEXT[] DEFAULT '{}',                  -- which events to send
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GLOBAL SETTINGS
-- ============================================================

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  description TEXT,
  is_secret   BOOLEAN DEFAULT false,               -- if true, value is AES-256 encrypted
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
('language',              'ru',                   'Interface language: ru | en'),
('theme',                 'dark',                 'UI theme: dark | light'),
('timezone',              'Europe/Moscow',         'Server timezone'),
('ntp_server',            'pool.ntp.org',          'NTP server for time sync'),
('date_format',           'DD.MM.YYYY',            'Date display format'),
('time_format',           '24h',                   'Time format: 24h | 12h'),
('log_retention_days',    '30',                    'Activity log retention in days'),
('backup_path',           '/home/inno/backups',    'Default backup destination'),
('auto_update_enabled',   'false',                 'Enable automatic updates'),
('auto_update_cron',      '0 4 * * 0',             'Auto-update schedule (cron)'),
('health_check_interval', '30',                    'Service health check interval in seconds'),
('metrics_interval',      '10',                    'System metrics collection interval in seconds'),
('ui_scale',              '100',                   'UI scale percentage: 80|90|100|110|125'),
('quiet_hours_enabled',   'false',                 'Enable quiet hours for notifications'),
('quiet_hours_start',     '00:00',                 'Quiet hours start time'),
('quiet_hours_end',       '08:00',                 'Quiet hours end time'),
('nextcloud_url',         'http://localhost:8081', 'Nextcloud internal URL'),
('nextcloud_talk_enabled','false',                 'Enable Nextcloud Talk notifications'),
('burashka_telegram_enabled', 'false',             'Enable Burashka Telegram bot'),
('pwa_enabled',           'true',                  'Enable PWA manifest'),
('global_search_enabled', 'true',                  'Enable Ctrl+K global search'),
('terminal_enabled',      'true',                  'Enable web terminal (admin only)'),
('health_score_enabled',  'true',                  'Show system health score on home');

-- ============================================================
-- UPDATE SCHEDULES
-- ============================================================

CREATE TABLE ai_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    model VARCHAR(100) NOT NULL,
    prompt_preview TEXT,
    response_preview TEXT,
    tokens_used INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE update_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name    TEXT NOT NULL,
  display_name    TEXT,
  cron_expression TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  last_run_at     TIMESTAMPTZ,
  last_status     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER backup_schedules_updated_at BEFORE UPDATE ON backup_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER telegram_bots_updated_at BEFORE UPDATE ON telegram_bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER openclaw_agents_updated_at BEFORE UPDATE ON openclaw_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

-- Latest service status
CREATE VIEW v_service_status AS
SELECT
  s.id,
  s.name,
  s.display_name,
  s.category,
  s.container_name,
  s.port,
  s.icon,
  s.color,
  s.show_on_home,
  s.tags,
  su.status,
  su.response_time_ms,
  su.checked_at AS last_checked_at
FROM services s
LEFT JOIN LATERAL (
  SELECT status, response_time_ms, checked_at
  FROM service_uptime
  WHERE service_id = s.id
  ORDER BY checked_at DESC
  LIMIT 1
) su ON true
WHERE s.is_active = true;

-- System health score (0-100)
CREATE VIEW v_health_score AS
SELECT
  (
    -- Services online score (40 points)
    COALESCE((
      SELECT ROUND(COUNT(*) FILTER (WHERE status = 'online') * 40.0 / NULLIF(COUNT(*), 0))
      FROM v_service_status
    ), 0) +
    -- Metrics score (60 points) - based on latest metrics
    COALESCE((
      SELECT
        CASE WHEN cpu_percent < 80 THEN 20 ELSE 0 END +
        CASE WHEN ram_percent < 85 THEN 20 ELSE 0 END +
        CASE WHEN uptime_seconds > 3600 THEN 20 ELSE 10 END
      FROM system_metrics
      ORDER BY timestamp DESC
      LIMIT 1
    ), 0)
  )::INTEGER AS score,
  NOW() AS calculated_at;

-- Default Admin (password: admin123)
INSERT INTO admins (email, password_hash, name, role, totp_secret)
VALUES ('admin@creationhub.local', '$2b$10$MxZ0pvQREqUkIZwk2lD2pe1Dii54IeOMj2yymCW587nmTmg8CYaDa', 'Super Admin', 'admin', NULL)
ON CONFLICT (email) DO NOTHING;
