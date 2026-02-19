'use client';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon in Next.js
const icon = L.divIcon({
  html: `<div style="
    width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    border: 3px solid #fff;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(99,102,241,0.5);
  "></div>`,
  className: '',
  iconSize:   [32, 32],
  iconAnchor: [16, 32],
  popupAnchor:[0, -32],
});

interface GeoMapProps {
  lat: number | null;
  lon: number | null;
  ip:   string;
  city: string;
}

export default function GeoMap({ lat, lon, ip, city }: GeoMapProps) {
  if (!lat || !lon) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Нет геоданных
    </div>
  );

  return (
    <div style={{ height: 200, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[lat, lon]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Dark-style free tiles
        />
        <Marker position={[lat, lon]} icon={icon}>
          <Popup>
            <div style={{ fontFamily: 'system-ui', fontSize: 13 }}>
              <strong>{ip}</strong><br />
              {city}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
