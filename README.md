<div align="center">

# 🛸 CreationHub V2

**Личный управляющий центр для домашнего AI-сервера**

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

---

*Полностью автономная платформа для управления сервисами, AI-агентами, VPN, бэкапами и мониторингом — всё в одном интерфейсе.*

</div>

---

## 📸 Что это такое?

**CreationHub V2** — это самодостаточная система управления домашним сервером, разработанная с нуля. Представляет собой красивый веб-дашборд и мощный backend API, которые разворачиваются в несколько Docker-контейнеров и дают полный контроль над собственной инфраструктурой.

---

## ⚡ Возможности

| Модуль | Описание |
|---|---|
| 📊 **Мониторинг системы** | CPU, RAM, GPU (nvidia-smi), диски, сеть — данные напрямую из `/proc` |
| 🤖 **AI-центр** | Управление Ollama-моделями, локальный чат, транскрипция, TTS |
| 🦾 **OpenClaw Агенты** | Личные AI-агенты (Jarvis и другие) с Telegram-интеграцией |
| 🌐 **Управление сервисами** | Запуск, остановка, перезапуск Docker-контейнеров через UI |
| 🔒 **VPN-центр** | Управление WireGuard и Amnezia конфигами |
| 📡 **Telegram Боты** | Деплой и управление ботами прямо из дашборда |
| 💾 **Бэкапы** | Планировщик резервных копий с ротацией |
| 📋 **Логи активности** | Полный аудит всех действий в системе |
| 📺 **Сетевая карта** | GeoIP визуализация, мониторинг трафика |
| 🔑 **Безопасность** | JWT + refresh токены, 2FA (TOTP), AES-256-GCM шифрование |
| 🌍 **Мультиязычность** | Русский и английский интерфейс |

---

## 🏗 Архитектура

```
CreationHub V2
├── 🖥  Dashboard         → Next.js 14 (TypeScript)  — порт 7778
├── ⚙️  System API        → Node.js / Express         — порт 9292
├── 🐘  PostgreSQL 16     → База данных               — внутренний
├── 🌐  Browserless       → Headless Chrome CDP        — порт 3001
└── 🦊  Camoufox          → Anti-detect Firefox CDP    — порт 9223
```

---

## 🚀 Быстрый старт

### 1. Клонируй репозиторий

```bash
git clone https://github.com/Burashka44/CreationHubV2.git
cd CreationHubV2
```

### 2. Настрой переменные окружения

```bash
cp .env.example .env
```

Открой `.env` и заполни все значения:

```env
POSTGRES_DB=creationhub_v2
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password_here

# Генерируй командой: openssl rand -hex 32
JWT_ACCESS_SECRET=generate_me_with_openssl_rand_hex_32
JWT_REFRESH_SECRET=generate_me_with_openssl_rand_hex_32

# Ровно 32 символа
ENCRYPTION_KEY=exactly_32_characters_key_here!!

# IP-адрес твоего сервера
SERVER_IP=192.168.1.XXX
```

### 3. Создай хеш пароля для первого входа

```bash
node hash_pass.js  # Введи желаемый пароль
```

Вставь полученный хеш в `init/init_db.sql` в строку `PASTE_YOUR_BCRYPT_HASH_HERE`.

### 4. Запускай!

```bash
docker compose up -d
```

**Дашборд будет доступен:** `http://YOUR_SERVER_IP:7778`  
**System API:** `http://YOUR_SERVER_IP:9292`

---

## 🔐 Безопасность

- **JWT-аутентификация** с access + refresh токенами (7 дней)
- **bcrypt** (cost 12) для хеширования паролей
- **TOTP 2FA** (Google Authenticator / любой TOTP-клиент)
- **AES-256-GCM** для шифрования чувствительных данных в БД (токены ботов, VPN-конфиги)
- **Rate limiting** на auth-эндпоинтах (10 запросов / 15 минут)
- Защита от **path traversal** и **RCE** в API

---

## 🤝 Стек технологий

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Mantine UI + кастомный дизайн
- WebSocket для real-time метрик

**Backend:**
- Node.js 20 + Express
- Dockerode (управление контейнерами)
- bcrypt, otplib, jsonwebtoken
- axios, node-cron

**Инфраструктура:**
- Docker Compose
- PostgreSQL 16 (pgcrypto, uuid-ossp)
- Camoufox (anti-detect browser)
- Browserless Chrome

---

## 📁 Структура проекта

```
CreationHubV2/
├── dashboard/          # Next.js фронтенд
│   ├── app/            # Страницы (App Router)
│   ├── components/     # UI компоненты
│   └── lib/            # API клиент, хуки, i18n
├── system-api/         # Node.js бэкенд
│   ├── routes/         # API маршруты
│   ├── lib/            # Утилиты (DB, crypto, WebSocket)
│   └── middleware/     # Auth middleware
├── init/               # SQL миграции при старте
├── camoufox/           # Dockerfile для Camoufox
├── docker-compose.yml  # Оркестрация контейнеров
└── .env.example        # Пример конфигурации
```

---

<div align="center">

Сделано с ❤️ для личного использования

</div>