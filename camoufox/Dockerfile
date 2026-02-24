FROM python:3.11-slim

# Install system dependencies for Firefox (Debian-based)
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libx11-xcb1 \
    libasound2 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    xvfb \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Camoufox with GeoIP support
RUN pip install --no-cache-dir "camoufox[geoip,server]"

# Fetch browser binary
RUN python -m camoufox fetch

# Create profile directory
RUN mkdir -p /profiles

ENV CAMOUFOX_HEADLESS=true
ENV PYTHONUNBUFFERED=1

# Expose Cdp port
EXPOSE 9222

# Start server
CMD ["xvfb-run", "-a", "python", "-m", "camoufox", "server"]
