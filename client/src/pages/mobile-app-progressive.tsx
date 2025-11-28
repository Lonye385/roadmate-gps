console.log('[ROADMATE] 📦 PROGRESSIVE MODULE LOADING...');

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MobileAppProgressive() {
  console.log('[ROADMATE] 🚀 PROGRESSIVE COMPONENT RENDERING!');
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [speed, setSpeed] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [invisibleMode, setInvisibleMode] = useState(false);
  const [nearbyCamera, setNearbyCamera] = useState<any | null>(null);
  const [speedCameras, setSpeedCameras] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<any>(null);
  
  const lastAlertedCameraRef = useRef<string | null>(null);
  const routeLayerRef = useRef<boolean>(false);

  // Initialize map (PROVEN approach from test)
  useEffect(() => {
    console.log('[ROADMATE] 🗺️ Map init useEffect');
    
    if (map.current || !mapContainer.current) {
      console.log('[ROADMATE] ⏭️ Map already exists or container null');
      return;
    }

    console.log('[ROADMATE] Creating map...');

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256
            }
          },
          layers: [{
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }]
        },
        center: currentLocation || [-9.1393, 38.7223], // Lisboa default
        zoom: currentLocation ? 15 : 12,
        attributionControl: false
      });

      map.current.on('load', () => {
        console.log('[ROADMATE] ✅ Map loaded!');
        setMapLoaded(true);
        
        // Add user marker if GPS ready
        if (currentLocation && map.current) {
          userMarker.current = new maplibregl.Marker({ color: '#2D5BFF', scale: 1.5 })
            .setLngLat(currentLocation)
            .addTo(map.current);
        }
      });

      map.current.on('error', (e) => {
        console.error('[ROADMATE] ❌ Map error:', e);
      });
      
      // Add attribution
      map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
      
    } catch (error) {
      console.error('[ROADMATE] ❌ Map crash:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Fetch nearby speed cameras (Feature #2)
  useEffect(() => {
    if (!currentLocation) return;

    const fetchCameras = async () => {
      try {
        const [lng, lat] = currentLocation;
        const response = await fetch(`/api/speed-cameras/nearby?lat=${lat}&lng=${lng}&radius=10000`);
        if (response.ok) {
          const cameras = await response.json();
          setSpeedCameras(cameras);
          console.log('[ROADMATE] 📷 Loaded', cameras.length, 'nearby cameras');
        }
      } catch (error) {
        console.error('[ROADMATE] Failed to load cameras:', error);
      }
    };

    fetchCameras();
    const interval = setInterval(fetchCameras, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [currentLocation]);

  // Draw route on map (Feature #3)
  useEffect(() => {
    if (!map.current || !route || !mapLoaded) return;

    try {
      // Remove old route if exists
      if (routeLayerRef.current) {
        if (map.current.getLayer('route')) map.current.removeLayer('route');
        if (map.current.getSource('route')) map.current.removeSource('route');
      }

      // Add new route
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1E40AF',
          'line-width': 10,
          'line-opacity': 0.9
        }
      });

      routeLayerRef.current = true;
      console.log('[ROADMATE] 🛣️ Route drawn on map');
    } catch (error) {
      console.error('[ROADMATE] Failed to draw route:', error);
    }
  }, [route, mapLoaded]);

  // Search for destination
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(searchQuery)}&limit=1&apiKey=${apiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const coords = data.features[0].geometry.coordinates;
          setDestination(coords as [number, number]);
          setSearchOpen(false);
          console.log('[ROADMATE] 📍 Destination set:', coords);
          
          // Fetch route
          if (currentLocation) {
            const routeResponse = await fetch(
              `https://api.geoapify.com/v1/routing?waypoints=${currentLocation[1]},${currentLocation[0]}|${coords[1]},${coords[0]}&mode=drive&apiKey=${apiKey}`
            );
            if (routeResponse.ok) {
              const routeData = await routeResponse.json();
              setRoute(routeData.features[0]);
              
              // Set first navigation step
              if (routeData.features[0].properties.legs && routeData.features[0].properties.legs[0].steps) {
                setCurrentStep(routeData.features[0].properties.legs[0].steps[0]);
              }
              
              console.log('[ROADMATE] 🛣️ Route calculated');
            }
          }
        }
      }
    } catch (error) {
      console.error('[ROADMATE] Search failed:', error);
    }
  };

  // GPS tracking (Feature #1)
  useEffect(() => {
    if (!gpsEnabled || !mapLoaded) return;

    console.log('[ROADMATE] 📍 Starting GPS tracking...');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        setCurrentLocation(coords);
        setSpeed(position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0);
        
        // Check for nearby cameras (500m alert distance)
        const closestCamera = speedCameras.find(camera => {
          const distance = Math.sqrt(
            Math.pow((camera.longitude - coords[0]) * 111320 * Math.cos(coords[1] * Math.PI / 180), 2) +
            Math.pow((camera.latitude - coords[1]) * 111320, 2)
          );
          return distance <= 500; // 500m alert radius
        });
        
        if (closestCamera && closestCamera.id !== lastAlertedCameraRef.current) {
          console.log('[ROADMATE] 🚨 CAMERA ALERT!', closestCamera.type);
          setNearbyCamera(closestCamera);
          lastAlertedCameraRef.current = closestCamera.id;
          
          // Play beep sound if enabled (with try/catch to prevent crash)
          if (soundEnabled) {
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.frequency.value = 800;
              oscillator.type = 'sine';
              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.5);
            } catch (error) {
              console.log('[ROADMATE] Audio not available:', error);
            }
          }
          
          // Clear alert after 8 seconds
          setTimeout(() => {
            setNearbyCamera(null);
          }, 8000);
        } else if (!closestCamera) {
          setNearbyCamera(null);
        }

        // Update marker
        if (map.current) {
          if (userMarker.current) {
            userMarker.current.setLngLat(coords);
          } else {
            userMarker.current = new maplibregl.Marker({ color: '#2D5BFF', scale: 1.5 })
              .setLngLat(coords)
              .addTo(map.current);
          }
          
          // Center map on user
          map.current.flyTo({ center: coords, zoom: 15, duration: 1000 });
        }
      },
      (error) => {
        console.error('[ROADMATE] GPS error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsEnabled, mapLoaded]);

  const handleEnableGPS = () => {
    console.log('[ROADMATE] User clicked Enable GPS');
    setGpsEnabled(true);
  };

  console.log('[ROADMATE] 🎨 RENDER - mapLoaded:', mapLoaded, 'gpsEnabled:', gpsEnabled);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      {/* Map container */}
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* Status indicator */}
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(45, 91, 255, 0.9)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          ✅ ROADMATE GPS
        </div>
      )}

      {/* Speedometer (only if GPS enabled) */}
      {gpsEnabled && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: 20,
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            border: '6px solid white'
          }}
        >
          <span>{speed}</span>
          <span style={{ fontSize: '14px', marginTop: '-8px' }}>km/h</span>
        </div>
      )}

      {/* Speed Camera Alert (Radarbot-style pulsing red card) */}
      {nearbyCamera && gpsEnabled && (
        <div
          style={{
            position: 'absolute',
            bottom: 240,
            left: 20,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.6)',
            zIndex: 1000,
            minWidth: '200px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
          data-testid="alert-radar"
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            🚨 {nearbyCamera.type === 'fixed' ? 'RADAR FIXO' : 
                nearbyCamera.type === 'mobile' ? 'RADAR MÓVEL' : 
                nearbyCamera.type === 'red_light' ? 'SEMÁFORO' : 'RADAR'}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            📍 {Math.round(nearbyCamera.distance || 500)}m à frente
          </div>
          {nearbyCamera.speed_limit && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '32px', 
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {nearbyCamera.speed_limit} km/h
            </div>
          )}
        </div>
      )}

      {/* Floating Control Buttons (right side stack) */}
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 1000
          }}
        >
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px'
            }}
            data-testid="button-sound-toggle"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {/* Menu button */}
          <button
            onClick={() => console.log('Menu clicked')}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#2D5BFF'
            }}
            data-testid="button-menu"
          >
            ⋮
          </button>

          {/* Search button (blue) */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#2D5BFF',
              border: 'none',
              boxShadow: '0 4px 12px rgba(45, 91, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px'
            }}
            data-testid="button-search"
          >
            🔍
          </button>

          {/* Invisible mode toggle */}
          <button
            onClick={() => setInvisibleMode(!invisibleMode)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: invisibleMode ? '#999' : 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px'
            }}
            data-testid="button-invisible"
          >
            {invisibleMode ? '👻' : '👤'}
          </button>
        </div>
      )}

      {/* Turn-by-Turn Navigation Card (top) */}
      {currentStep && route && gpsEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
          data-testid="card-navigation"
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              background: '#2D5BFF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '28px'
            }}
          >
            ↗️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '4px' }}>
              {currentStep.instruction?.text || 'Siga em frente'}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {Math.round(currentStep.distance)} m
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {searchOpen && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 1001,
            display: 'flex',
            gap: '8px'
          }}
        >
          <input
            type="text"
            placeholder="Para onde vais?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              padding: '8px'
            }}
            data-testid="input-search"
          />
          <button
            onClick={handleSearch}
            style={{
              background: '#2D5BFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            data-testid="button-search-submit"
          >
            IR
          </button>
        </div>
      )}

      {/* Navigation Info Bar (bottom) - only when destination set */}
      {destination && route && gpsEnabled && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          data-testid="info-navigation"
        >
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {Math.round(route.properties.distance / 1000)} km
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              {Math.round(route.properties.time / 60)} min
            </div>
          </div>
          <button
            onClick={() => {
              setDestination(null);
              setRoute(null);
              if (map.current && routeLayerRef.current) {
                if (map.current.getLayer('route')) map.current.removeLayer('route');
                if (map.current.getSource('route')) map.current.removeSource('route');
                routeLayerRef.current = false;
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            data-testid="button-close-navigation"
          >
            ✕ Fechar
          </button>
        </div>
      )}

      {/* GPS Enable button (only if GPS not enabled yet) */}
      {!gpsEnabled && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}
        >
          <button
            onClick={handleEnableGPS}
            style={{
              background: '#2D5BFF',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              padding: '16px 32px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(45, 91, 255, 0.4)',
              border: 'none',
              cursor: 'pointer'
            }}
            data-testid="button-enable-gps"
          >
            📍 Permitir GPS
          </button>
        </div>
      )}
    </div>
  );
}
