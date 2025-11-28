import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, Navigation, Volume2, Settings as SettingsIcon } from 'lucide-react';

interface SearchResult {
  properties: {
    formatted: string;
    lat: number;
    lon: number;
  };
}

interface Maneuver {
  instruction: string;
  distance: number;
  location: [number, number];
}

export default function SimpleMobile() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const lastLat = useRef(0);
  const lastLon = useRef(0);
  const hasAnnounced = useRef(false);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [maneuvers, setManeuvers] = useState<Maneuver[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);

  // Speak instruction
  const speak = (text: string) => {
    if (!soundEnabled) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-PT';
      window.speechSynthesis.speak(utterance);
      console.log('[VOICE]', text);
    } catch (e) {
      console.error('[VOICE ERROR]', e);
    }
  };

  // Calculate distance
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [-9.1393, 38.7223],
      zoom: 12
    });

    map.current = mapInstance;

    mapInstance.on('load', () => {
      console.log('[GPS] Map loaded');
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // GPS tracking
  useEffect(() => {
    if (!mapLoaded) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc: [number, number] = [longitude, latitude];
        
        // Movement guard
        const dist = calcDistance(lastLat.current, lastLon.current, latitude, longitude);
        if (dist < 1 && lastLat.current !== 0) return;
        
        lastLat.current = latitude;
        lastLon.current = longitude;
        setUserLocation(newLoc);
        
        // Update marker
        if (map.current) {
          if (!userMarker.current) {
            const el = document.createElement('div');
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.borderRadius = '50%';
            el.style.background = '#00FFFF';
            el.style.border = '3px solid #FFF';
            el.style.boxShadow = '0 0 10px rgba(0,255,255,0.8)';
            
            userMarker.current = new maplibregl.Marker({ element: el })
              .setLngLat(newLoc)
              .addTo(map.current);
          } else {
            userMarker.current.setLngLat(newLoc);
          }
          
          // Center map
          if (isNavigating) {
            map.current.easeTo({ center: newLoc, zoom: 16 });
          } else {
            map.current.easeTo({ center: newLoc });
          }
        }
        
        // Navigation logic
        if (isNavigating && maneuvers.length > 0 && currentStep < maneuvers.length) {
          const next = maneuvers[currentStep];
          const [nextLon, nextLat] = next.location;
          const distNext = calcDistance(latitude, longitude, nextLat, nextLon);
          setDistanceToNext(distNext);
          
          // Final destination
          if (currentStep === maneuvers.length - 1 && distNext < 30) {
            console.log('[NAV] Destination reached!');
            speak('Destino alcançado');
            setIsNavigating(false);
            setCurrentStep(0);
            setDistanceToNext(null);
            hasAnnounced.current = false;
            return;
          }
          
          // Reached maneuver
          if (distNext < 30 && currentStep < maneuvers.length - 1) {
            console.log('[NAV] Reached step', currentStep);
            setCurrentStep(currentStep + 1);
            speak(maneuvers[currentStep + 1].instruction);
            hasAnnounced.current = false;
          }
          
          // 200m warning
          if (distNext < 200 && distNext > 150 && !hasAnnounced.current) {
            speak(`Em 200 metros, ${next.instruction}`);
            hasAnnounced.current = true;
          }
        }
      },
      (error) => console.error('[GPS]', error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapLoaded, isNavigating, maneuvers, currentStep]);

  // Search
  const handleSearch = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${apiKey}&limit=5&filter=countrycode:pt`
      );
      const data = await response.json();
      setSearchResults(data.features || []);
    } catch (error) {
      console.error('[SEARCH]', error);
    }
  };

  const selectDestination = (result: SearchResult) => {
    const { lat, lon } = result.properties;
    const destCoords: [number, number] = [lon, lat];
    setDestination(destCoords);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
    
    // Add marker
    if (map.current) {
      if (destMarker.current) {
        destMarker.current.remove();
      }
      
      const el = document.createElement('div');
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.background = 'red';
      el.style.borderRadius = '50% 50% 50% 0';
      el.style.transform = 'rotate(-45deg)';
      el.style.border = '3px solid white';
      
      destMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat(destCoords)
        .addTo(map.current);
      
      map.current.flyTo({ center: destCoords, zoom: 14 });
    }
  };

  // Calculate route
  useEffect(() => {
    if (!mapLoaded || !userLocation || !destination || !map.current) return;

    const calculateRoute = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
        const [startLon, startLat] = userLocation;
        const [endLon, endLat] = destination;
        
        console.log('[ROUTING] Calculating route...');
        const response = await fetch(
          `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLon}|${endLat},${endLon}&mode=drive&details=instruction_details&apiKey=${apiKey}`
        );
        const data = await response.json();
        
        console.log('[ROUTING] API response:', data);
        
        if (data.features && data.features[0]) {
          const route = data.features[0];
          const distance = route.properties.distance / 1000;
          const duration = route.properties.time / 60;
          
          console.log('[ROUTING] Route found:', distance, 'km', duration, 'min');
          
          setRouteInfo({ distance, duration });
          
          // Extract maneuvers
          const extracted: Maneuver[] = [];
          if (route.properties.legs) {
            route.properties.legs.forEach((leg: any) => {
              if (leg.steps) {
                leg.steps.forEach((step: any) => {
                  if (step.instruction && step.instruction.text) {
                    extracted.push({
                      instruction: step.instruction.text,
                      distance: step.distance,
                      location: step.to_location || [startLon, startLat]
                    });
                  }
                });
              }
            });
          }
          
          setManeuvers(extracted);
          console.log('[ROUTING] Extracted', extracted.length, 'maneuvers');
          
          // Reset navigation if active
          if (isNavigating) {
            setIsNavigating(false);
            setCurrentStep(0);
            setDistanceToNext(null);
            hasAnnounced.current = false;
          }
          
          // Add route to map
          if (map.current) {
            console.log('[MAP] Adding route layer...');
            
            // Remove old
            if (map.current.getLayer('route-line')) {
              map.current.removeLayer('route-line');
            }
            if (map.current.getSource('route')) {
              map.current.removeSource('route');
            }
            
            // Add new
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: route.geometry,
                properties: {}
              }
            });
            
            map.current.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#00AAFF',
                'line-width': 8,
                'line-opacity': 1.0
              }
            });
            
            console.log('[MAP] Route layer added!');
            
            // Fit bounds
            const coords = route.geometry.coordinates;
            if (coords && coords.length > 0) {
              const bounds = coords.reduce((b: any, c: any) => b.extend(c), 
                new maplibregl.LngLatBounds(coords[0], coords[0]));
              
              map.current.fitBounds(bounds, {
                padding: { top: 100, bottom: 150, left: 50, right: 50 }
              });
              console.log('[MAP] Fitted to route bounds');
            }
          }
        } else {
          console.error('[ROUTING] No route found');
        }
      } catch (error) {
        console.error('[ROUTING ERROR]', error);
      }
    };

    calculateRoute();
  }, [mapLoaded, userLocation, destination]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ flex: 1, width: '100%' }} />
      
      {/* Navigation card */}
      {isNavigating && maneuvers.length > 0 && currentStep < maneuvers.length && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          padding: 20,
          background: 'linear-gradient(135deg, #00FF00 0%, #00DD00 100%)',
          color: '#000',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,255,0,0.5)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 5 }}>
            PRÓXIMA INSTRUÇÃO
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
            {maneuvers[currentStep].instruction}
          </div>
          {distanceToNext !== null && (
            <div style={{ fontSize: 32, fontWeight: 'bold' }}>
              {distanceToNext < 1000 
                ? `${Math.round(distanceToNext)} m` 
                : `${(distanceToNext / 1000).toFixed(1)} km`}
            </div>
          )}
          <div style={{ fontSize: 12, marginTop: 5, opacity: 0.8 }}>
            Passo {currentStep + 1} de {maneuvers.length}
          </div>
        </div>
      )}
      
      {/* Status */}
      {!destination && !isNavigating && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          padding: 20,
          background: 'rgba(0,0,0,0.8)',
          color: '#FFF',
          borderRadius: 12,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          Define um destino para ver a rota
        </div>
      )}
      
      {/* Route info */}
      {routeInfo && !isNavigating && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          padding: 20,
          background: 'rgba(0,170,255,0.95)',
          color: '#FFF',
          borderRadius: 12,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>
            {routeInfo.distance.toFixed(1)} km
          </div>
          <div style={{ fontSize: 16, marginTop: 5 }}>
            {Math.round(routeInfo.duration)} min
          </div>
        </div>
      )}
      
      {/* Search */}
      {showSearch && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Pesquisar destino..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              autoFocus
              style={{
                flex: 1,
                padding: 16,
                fontSize: 18,
                borderRadius: 12,
                border: '2px solid #00FFFF',
                background: '#1a1a1a',
                color: '#FFF'
              }}
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              style={{
                marginLeft: 10,
                padding: 16,
                background: '#FF0000',
                border: 'none',
                borderRadius: 12,
                color: '#FFF',
                fontSize: 18,
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => selectDestination(result)}
                style={{
                  padding: 16,
                  marginBottom: 10,
                  background: '#1a1a1a',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: '1px solid #333'
                }}
              >
                <div style={{ color: '#FFF', fontSize: 16 }}>
                  {result.properties.formatted}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 20,
        padding: 15,
        background: 'rgba(0,0,0,0.9)',
        borderRadius: 50,
        backdropFilter: 'blur(10px)'
      }}>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '3px solid #00FFFF',
            background: soundEnabled ? '#00FFFF' : 'transparent',
            color: soundEnabled ? '#000' : '#00FFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          data-testid="button-sound"
        >
          <Volume2 size={28} />
        </button>
        
        <button
          onClick={() => {
            if (destination && userLocation && maneuvers.length > 0) {
              if (!isNavigating) {
                setIsNavigating(true);
                setCurrentStep(0);
                speak('Navegação iniciada. ' + maneuvers[0].instruction);
                console.log('[NAV] Started with', maneuvers.length, 'steps');
              } else {
                setIsNavigating(false);
                setCurrentStep(0);
                setDistanceToNext(null);
                speak('Navegação terminada');
                console.log('[NAV] Stopped');
              }
            }
          }}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '3px solid #00FFFF',
            background: isNavigating ? '#00FF00' : (destination ? '#00FFFF' : 'transparent'),
            color: isNavigating ? '#000' : (destination ? '#000' : '#00FFFF'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: destination ? 1 : 0.5
          }}
          data-testid="button-navigate"
        >
          <Navigation size={28} />
        </button>
        
        <button
          onClick={() => setShowSearch(true)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '3px solid #00FFFF',
            background: 'transparent',
            color: '#00FFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          data-testid="button-search"
        >
          <Search size={28} />
        </button>
        
        <button
          onClick={() => console.log('[SETTINGS]')}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '3px solid #00FFFF',
            background: 'transparent',
            color: '#00FFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          data-testid="button-settings"
        >
          <SettingsIcon size={28} />
        </button>
      </div>
    </div>
  );
}
