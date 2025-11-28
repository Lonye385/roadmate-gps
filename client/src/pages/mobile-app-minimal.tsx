console.log('[ROADMATE] 📦 MINIMAL MODULE LOADING...');

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MobileAppMinimal() {
  console.log('[ROADMATE] 🚀 MINIMAL COMPONENT RENDERING!');
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256
            }
          },
          layers: [{
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }]
        },
        center: [-9.1393, 38.7223],
        zoom: 12,
        attributionControl: false
      });

      map.current.once('load', () => {
        console.log('[ROADMATE] ✅ Map loaded!');
        setMapLoaded(true);
      });
    } catch (error) {
      console.error('[ROADMATE] Map init error:', error);
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <div
        ref={mapContainer}
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          height: '100%'
        }}
      />
      
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 1000,
            fontWeight: 'bold'
          }}
        >
          ✅ MAPA OK
        </div>
      )}
    </div>
  );
}
