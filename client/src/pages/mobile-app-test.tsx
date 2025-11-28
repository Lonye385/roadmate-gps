console.log('[ROADMATE MOBILE] 📦 MOBILE GPS MODULE LOADING...');

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Car, Bike, Truck, Navigation, Volume2, VolumeX, 
  Camera, AlertTriangle, Fuel, MapPin, Clock, Navigation2,
  Plus, X, Search, Settings, ArrowUpRight, Compass
} from 'lucide-react';
import { audioSystem } from '@/lib/audioSystem';
import { ttsSystem } from '@/lib/ttsSystem';
import { LaneGuidanceWidget } from '@/components/LaneGuidanceWidget';
import { RadarSettingsModal, useRadarSettings } from '@/components/RadarSettingsModal';
import { TimelineSidebar } from '@/components/TimelineSidebar';

type VehicleType = 'car' | 'motorcycle' | 'truck';
type EventType = 'speed_camera' | 'mobile_camera' | 'mobile_radar_prediction' | 'accident' | 'gas_station' | 'traffic_camera' | 'truck_park' | 'service_area' | 'parking';

interface RouteEvent {
  id: string;
  type: EventType;
  latitude: number;
  longitude: number;
  distance: number;
  speedLimit?: number;
  verified: boolean;
  confidence: number;
  location?: string;
  name?: string;
}

interface SearchResult {
  properties: {
    formatted: string;
    lat: number;
    lon: number;
    city?: string;
    country?: string;
  };
}

interface Lane {
  valid: boolean;
  active: boolean;
  directions: string[]; // "left", "through", "right", etc.
}

interface NavigationStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  type: string; // turn_left, turn_right, continue, etc.
  coordinates: [number, number][]; // polyline segment
  lanes?: { count: number; lanes: Lane[] }; // Lane guidance data from Geoapify
}

export default function MobileAppTest() {
  console.log('[ROADMATE MOBILE] 🚀 MOBILE GPS RENDERING!');
  
  // TABLET REDIRECT: ≥768px landscape → /app-landscape
  useEffect(() => {
    const checkDeviceAndRedirect = () => {
      const isLandscape = window.innerWidth >= window.innerHeight;
      const isTabletOrLarger = window.innerWidth >= 768;
      
      if (isLandscape && isTabletOrLarger) {
        console.log('[ROADMATE MOBILE] 📱 Tablet landscape detected, redirecting to /app-landscape');
        window.location.href = '/app-landscape';
      }
    };
    
    checkDeviceAndRedirect();
    window.addEventListener('resize', checkDeviceAndRedirect);
    window.addEventListener('orientationchange', checkDeviceAndRedirect);
    
    return () => {
      window.removeEventListener('resize', checkDeviceAndRedirect);
      window.removeEventListener('orientationchange', checkDeviceAndRedirect);
    };
  }, []);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [routeEvents, setRouteEvents] = useState<RouteEvent[]>([]);
  const [activeAlert, setActiveAlert] = useState<RouteEvent | null>(null);
  const [currentSpeedLimit, setCurrentSpeedLimit] = useState<number | null>(null);
  const lastPosition = useRef<{ lat: number; lon: number; timestamp: number} | null>(null);
  const [showSearch, setShowSearch] = useState(false); // NEW: Toggle search visibility
  const [isNavigating, setIsNavigating] = useState(false); // NEW: Track if navigation is active
  
  // TURN-BY-TURN NAVIGATION states
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextStep, setDistanceToNextStep] = useState<number | null>(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const routePolyline = useRef<[number, number][]>([]);
  
  // RADAR SETTINGS state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0); // Force re-render trigger
  const radarSettings = useRadarSettings();
  
  // RADAR ALERT POP-UP states
  // MULTI-RADAR POPUP TRACKING (per-radar state instead of global)
  const [activeRadarAlerts, setActiveRadarAlerts] = useState<Map<string, { event: RouteEvent, distance: number }>>(new Map());
  
  // PROGRESSIVE BEEPING state (MULTI-RADAR SCHEDULER)
  const beepTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map()); // Per-radar timers
  const beepStateRef = useRef<Map<string, { tier: number, distance: number }>>(new Map()); // Per-radar state
  
  // RADAR POPUP HYSTERESIS (prevent re-trigger oscillations)
  const alertedRadarsRef = useRef<Set<string>>(new Set());
  const cooldownTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map()); // Track cooldown timers for cleanup

  // Map initialization
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('[ROADMATE MOBILE] 🗺️ Initializing MapLibre GL...');
    
    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [-9.1393, 38.7223], // Lisboa default
      zoom: 12,
      pitch: 45, // 3D view for landscape mode
      bearing: 0
    });

    map.current = mapInstance;

    mapInstance.on('load', () => {
      console.log('[ROADMATE MOBILE] ✅ Map loaded!');
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // GPS Tracking
  useEffect(() => {
    if (!mapLoaded) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const newLocation: [number, number] = [longitude, latitude];
        
        // MOVEMENT GUARD: Only update if position changed significantly (>1m threshold)
        let shouldUpdate = true;
        if (lastPosition.current) {
          const lastLat = lastPosition.current.lat;
          const lastLon = lastPosition.current.lon;
          
          // Haversine distance calculation (meters)
          const R = 6371000; // Earth radius in meters
          const dLat = (latitude - lastLat) * Math.PI / 180;
          const dLon = (longitude - lastLon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lastLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          // Only update if moved >1 meter
          shouldUpdate = distance > 1;
        }
        
        if (shouldUpdate) {
          setUserLocation(newLocation);
          lastPosition.current = { lat: latitude, lon: longitude, timestamp: Date.now() };
        }
        
        // Always update speed (can change even if position doesn't)
        setCurrentSpeed(speed ? Math.round(speed * 3.6) : 0); // m/s to km/h

        // Update user marker (only if position changed)
        if (shouldUpdate && map.current) {
          if (!userMarker.current) {
            const el = document.createElement('div');
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.background = 'radial-gradient(circle, #00FFFF 0%, #0099FF 100%)'; // Azul neon
            el.style.border = '3px solid #FFFFFF';
            el.style.boxShadow = '0 0 20px rgba(0,255,255,0.8)'; // Neon glow
            
            userMarker.current = new maplibregl.Marker({ element: el })
              .setLngLat(newLocation)
              .addTo(map.current);
          } else {
            userMarker.current.setLngLat(newLocation);
          }
        }
      },
      (error) => console.error('[ROADMATE MOBILE GPS]', error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapLoaded]);

  // Search destination
  const handleSearch = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${apiKey}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data.features || []);
    } catch (error) {
      console.error('[ROADMATE MOBILE SEARCH]', error);
    }
  };

  const selectDestination = (result: SearchResult) => {
    const { lat, lon } = result.properties;
    setDestination([lon, lat]);
    setSearchQuery('');
    setSearchResults([]);
    
    if (map.current) {
      map.current.flyTo({ center: [lon, lat], zoom: 14 });
    }
  };

  // Calculate route (simplified - azul turquesa line)
  useEffect(() => {
    if (!mapLoaded || !userLocation || !destination || !map.current) return;

    const calculateRoute = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
        const [startLon, startLat] = userLocation;
        const [endLon, endLat] = destination;
        
        console.log('[ROADMATE MOBILE ROUTE] Starting calculation...', { 
          userLocation, 
          destination,
          mapLoaded, 
          hasMap: !!map.current 
        });
        
        // FIX: Geoapify expects lon,lat NOT lat,lon!
        // ADD: details=instruction_details to get lane guidance data
        const url = `https://api.geoapify.com/v1/routing?waypoints=${startLon},${startLat}|${endLon},${endLat}&mode=drive&details=instruction_details&apiKey=${apiKey}`;
        console.log('[ROADMATE MOBILE ROUTE] API URL:', url.replace(apiKey, 'HIDDEN'));
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('[ROADMATE MOBILE ROUTE] API Response:', data);
        
        if (data.features && data.features[0]) {
          const route = data.features[0];
          const distance = route.properties.distance / 1000; // meters to km
          const duration = route.properties.time / 60; // seconds to minutes
          
          console.log('[ROADMATE MOBILE ROUTE] Route found!', { distance, duration, geometryType: route.geometry.type });
          setRouteInfo({ distance, duration });

          // PARSE TURN-BY-TURN NAVIGATION STEPS (CORRECT MultiLineString handling!)
          const steps: NavigationStep[] = [];
          if (route.properties.legs && route.properties.legs.length > 0) {
            // Geoapify uses MultiLineString: geometry.coordinates[legIndex][coordIndex]
            route.properties.legs.forEach((leg: any, legIndex: number) => {
              if (!leg.steps || leg.steps.length === 0) return;
              
              // Get leg-specific coordinate array
              const legGeometry = route.geometry.coordinates[legIndex];
              if (!legGeometry || !Array.isArray(legGeometry)) {
                console.warn('[ROADMATE MOBILE NAV] ⚠️ Missing geometry for leg', legIndex);
                return;
              }
              
              leg.steps.forEach((step: any) => {
                const instruction = step.instruction?.text || step.instruction || 'Continue';
                
                // BOUNDS CHECK: Validate indices within THIS leg's geometry
                const fromIdx = Math.max(0, step.from_index || 0);
                const toIdx = Math.min(legGeometry.length - 1, step.to_index || legGeometry.length - 1);
                
                // Slice coordinates from leg-specific array
                const stepCoords = legGeometry.slice(fromIdx, toIdx + 1);
                
                // Skip step if coordinates are invalid
                if (!stepCoords || stepCoords.length === 0) {
                  console.warn('[ROADMATE MOBILE NAV] ⚠️ Skipping step with empty coordinates:', instruction);
                  return;
                }
                
                steps.push({
                  instruction,
                  distance: step.distance || 0,
                  duration: step.duration || 0,
                  type: step.type || 'continue',
                  coordinates: stepCoords as [number, number][],
                  lanes: step.lanes // Capture lane guidance data if present
                });
              });
            });
            
            console.log('[ROADMATE MOBILE NAV] ✅ Parsed', steps.length, 'navigation steps from', route.properties.legs.length, 'legs');
            
            // RESET navigation state completely
            setNavigationSteps(steps);
            setCurrentStepIndex(0);
            setDistanceToNextStep(null);
            
            // Announce first instruction
            if (steps.length > 0 && soundEnabled) {
              setTimeout(() => {
                ttsSystem.speak({ 
                  type: 'turn_instruction', 
                  data: { instruction: steps[0].instruction, distance: steps[0].distance } as any
                });
              }, 1000);
            }
          } else {
            // No legs/steps available - reset state
            setNavigationSteps([]);
            setCurrentStepIndex(0);
            setDistanceToNextStep(null);
          }

          // Store route polyline for off-route detection (FLATTEN MultiLineString!)
          // Geoapify returns MultiLineString: coordinates[legIndex][coordIndex]
          // We need flat array for distance calculations
          const flattenedCoords: [number, number][] = [];
          if (Array.isArray(route.geometry.coordinates)) {
            route.geometry.coordinates.forEach((legCoords: any) => {
              if (Array.isArray(legCoords)) {
                flattenedCoords.push(...legCoords);
              }
            });
          }
          routePolyline.current = flattenedCoords;
          console.log('[ROADMATE MOBILE ROUTE] 📍 Flattened polyline:', flattenedCoords.length, 'coordinates');

          // Draw AZUL TURQUESA route line (neon bright!)
          if (map.current!.getSource('route')) {
            console.log('[ROADMATE MOBILE ROUTE] Updating existing route source');
            (map.current!.getSource('route') as maplibregl.GeoJSONSource).setData(route.geometry);
          } else {
            console.log('[ROADMATE MOBILE ROUTE] Adding new route source + layer');
            map.current!.addSource('route', {
              type: 'geojson',
              data: route.geometry
            });
            
            map.current!.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#00FFFF', // Azul turquesa intenso (ciano)
                'line-width': 8,
                'line-opacity': 0.9,
                'line-blur': 2 // Glow effect
              }
            });
            console.log('[ROADMATE MOBILE ROUTE] ✅ Route layer added successfully!');
          }

          // Fetch nearby POIs (radars, cameras, etc)
          fetchNearbyPOIs(userLocation, destination);
        } else {
          console.error('[ROADMATE MOBILE ROUTE] No features in response!', data);
        }
      } catch (error) {
        console.error('[ROADMATE MOBILE ROUTE ERROR]', error);
        console.error('[ROADMATE MOBILE ROUTE] Full error:', JSON.stringify(error, null, 2));
      }
    };

    calculateRoute();
  }, [mapLoaded, userLocation, destination]);

  const fetchNearbyPOIs = async (start: [number, number], end: [number, number]) => {
    try {
      // Fetch speed cameras along route
      const cameraResponse = await fetch('/api/speed-cameras/nearby?' + new URLSearchParams({
        lat: start[1].toString(),
        lng: start[0].toString(),
        radius: '50000' // 50km radius
      }));
      const cameras = await cameraResponse.json();

      // Fetch traffic cameras
      const trafficResponse = await fetch('/api/traffic-cameras/nearby?' + new URLSearchParams({
        lat: start[1].toString(),
        lng: start[0].toString(),
        radius: '50000'
      }));
      const trafficCameras = await trafficResponse.json();

      // Generate mobile_radar_prediction events (convert 10% of mobile cameras to predictions for demo)
      const predictions: RouteEvent[] = cameras
        .filter((cam: any) => cam.type === 'mobile' && Math.random() < 0.1) // 10% become predictions
        .map((cam: any) => {
          // Slightly offset position for visual distinction
          const offsetLat = cam.latitude + (Math.random() - 0.5) * 0.01;
          const offsetLng = cam.longitude + (Math.random() - 0.5) * 0.01;
          
          return {
            id: `pred-${cam.id}`,
            type: 'mobile_radar_prediction' as const,
            latitude: offsetLat,
            longitude: offsetLng,
            distance: calculateDistance(start[1], start[0], offsetLat, offsetLng), // Use OFFSET coords for accurate distance!
            speedLimit: cam.speed_limit,
            verified: false,
            confidence: Math.random() > 0.5 ? 0.7 : 0.5 // Medium/High confidence
          };
        });

      // Generate mock parking and gas station POIs along route
      const mockPOIs: RouteEvent[] = [];
      const routeLength = calculateDistance(start[1], start[0], end[1], end[0]);
      const numPOIs = Math.floor(routeLength / 10); // 1 POI every 10km

      for (let i = 0; i < Math.min(numPOIs, 8); i++) {
        const progress = (i + 1) / (numPOIs + 1); // Distribute along route
        const poiLat = start[1] + (end[1] - start[1]) * progress + (Math.random() - 0.5) * 0.02;
        const poiLng = start[0] + (end[0] - start[0]) * progress + (Math.random() - 0.5) * 0.02;
        const distance = calculateDistance(start[1], start[0], poiLat, poiLng);
        
        // Alternate between parking and gas stations
        const type = i % 2 === 0 ? 'parking' : 'gas_station';
        
        mockPOIs.push({
          id: `poi-${type}-${i}`,
          type: type as 'parking' | 'gas_station',
          latitude: poiLat,
          longitude: poiLng,
          distance: distance,
          verified: true,
          confidence: 1.0
        });
      }

      // Combine and sort by distance
      const allEvents: RouteEvent[] = [
        ...cameras.map((cam: any) => ({
          id: cam.id,
          type: cam.type === 'mobile' ? 'mobile_camera' : 'speed_camera',
          latitude: cam.latitude,
          longitude: cam.longitude,
          distance: calculateDistance(start[1], start[0], cam.latitude, cam.longitude),
          speedLimit: cam.speed_limit,
          verified: true,
          confidence: 0.95
        })),
        ...trafficCameras.map((cam: any) => ({
          id: cam.id,
          type: 'traffic_camera',
          latitude: cam.latitude,
          longitude: cam.longitude,
          distance: calculateDistance(start[1], start[0], cam.latitude, cam.longitude),
          verified: true,
          confidence: 1.0,
          location: cam.road
        })),
        ...predictions, // Add mobile radar predictions!
        ...mockPOIs // Add parking and gas stations!
      ].sort((a, b) => a.distance - b.distance);

      setRouteEvents(allEvents);

      // Add VERMELHO NEON markers for radars
      allEvents.forEach(event => {
        if (!map.current) return;
        
        const el = document.createElement('div');
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';

        if (event.type === 'speed_camera' || event.type === 'mobile_camera') {
          // Vermelho neon intenso com pulsação
          el.style.background = 'radial-gradient(circle, #FF0000 0%, #CC0000 100%)';
          el.style.border = '3px solid #FFFFFF';
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 0 30px rgba(255,0,0,1)'; // Intenso!
          el.style.animation = 'pulse-red 2s infinite';
          el.innerHTML = `<span style="color: white; font-size: 18px; font-weight: bold;">${event.speedLimit || '!'}</span>`;
        } else if (event.type === 'mobile_radar_prediction') {
          // ORANGE markers for predictions with glow
          el.style.background = 'radial-gradient(circle, #FF9900 0%, #CC6600 100%)';
          el.style.border = '3px solid #FFF';
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 0 25px rgba(255,153,0,0.9)'; // Orange glow
          el.style.animation = 'pulse-orange 2s infinite';
          el.innerHTML = `<span style="color: white; font-size: 14px; font-weight: bold;">?</span>`; // Question mark for predictions
        } else if (event.type === 'parking') {
          // BLUE markers for parking
          el.style.background = 'radial-gradient(circle, #0099FF 0%, #0066CC 100%)';
          el.style.border = '2px solid #FFF';
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 0 20px rgba(0,153,255,0.8)';
          el.innerHTML = `<span style="color: white; font-size: 16px; font-weight: bold;">P</span>`;
        } else if (event.type === 'gas_station') {
          // ORANGE markers for gas stations
          el.style.background = 'radial-gradient(circle, #FF9900 0%, #CC6600 100%)';
          el.style.border = '2px solid #FFF';
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 0 20px rgba(255,153,0,0.8)';
          el.innerHTML = `<span style="color: white; font-size: 16px; font-weight: bold;">⛽</span>`;
        } else {
          el.style.background = '#FFA500'; // Amarelo/laranja para outros
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 0 20px rgba(255,165,0,0.8)';
        }

        new maplibregl.Marker({ element: el })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map.current!);
      });

    } catch (error) {
      console.error('[ROADMATE MOBILE POIs]', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Quick add radar report
  const quickAddReport = (type: EventType) => {
    if (!userLocation) return;
    
    audioSystem.playBeep({ frequency: 800, duration: 0.1, volume: 0.3 }); // Confirmation beep
    
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        latitude: userLocation[1],
        longitude: userLocation[0],
        verified: false,
        description: `Quick report: ${type}`
      })
    }).catch(err => console.error('[ROADMATE MOBILE REPORT]', err));
  };

  // Get current time
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // TURN-BY-TURN TRACKING: Monitor distance to next step and advance instructions
  useEffect(() => {
    if (!userLocation || navigationSteps.length === 0 || currentStepIndex >= navigationSteps.length) {
      return;
    }

    const currentStep = navigationSteps[currentStepIndex];
    if (!currentStep || !currentStep.coordinates || currentStep.coordinates.length === 0) {
      return;
    }

    // Calculate distance to end of current step
    const stepEnd = currentStep.coordinates[currentStep.coordinates.length - 1];
    const distanceToStep = calculateDistance(
      userLocation[1], // lat
      userLocation[0], // lon
      stepEnd[1], // target lat
      stepEnd[0]  // target lon
    ) * 1000; // Convert km to meters

    setDistanceToNextStep(distanceToStep);

    // ADVANCE TO NEXT STEP when close (< 50m)
    if (distanceToStep < 50 && currentStepIndex < navigationSteps.length - 1) {
      console.log('[ROADMATE MOBILE NAV] ✅ Step completed! Advancing to next instruction...');
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      
      // Announce next instruction
      if (soundEnabled && navigationSteps[nextIndex]) {
        ttsSystem.speak({ 
          type: 'turn_instruction', 
          data: { 
            instruction: navigationSteps[nextIndex].instruction, 
            distance: navigationSteps[nextIndex].distance 
          } as any
        });
      }
    }

    // OFF-ROUTE DETECTION: Check if user is too far from ENTIRE route polyline
    const routeCoords = routePolyline.current;
    if (routeCoords.length > 0) {
      let minDistanceToRoute = Infinity;
      
      // Check distance to ALL route coordinates (not just first 50!)
      // For long routes, check every 5th point for performance
      const step = routeCoords.length > 1000 ? 5 : 1;
      for (let i = 0; i < routeCoords.length; i += step) {
        const dist = calculateDistance(
          userLocation[1],
          userLocation[0],
          routeCoords[i][1],
          routeCoords[i][0]
        ) * 1000; // Convert to meters
        
        if (dist < minDistanceToRoute) {
          minDistanceToRoute = dist;
        }
        
        // Early exit if very close (optimization)
        if (minDistanceToRoute < 20) break;
      }

      // If more than 100m off route, trigger rerouting
      if (minDistanceToRoute > 100 && !isOffRoute) {
        console.log('[ROADMATE MOBILE NAV] ⚠️ OFF ROUTE! Distance:', minDistanceToRoute, 'm');
        setIsOffRoute(true);
        
        if (soundEnabled) {
          ttsSystem.speak({ type: 'rerouting' });
        }
      } else if (minDistanceToRoute <= 100 && isOffRoute) {
        setIsOffRoute(false);
      }
    }

  }, [userLocation, navigationSteps, currentStepIndex]);

  // AUTO-REROUTING: Recalculate route when off-route detected
  useEffect(() => {
    if (!isOffRoute || !userLocation || !destination) return;

    console.log('[ROADMATE MOBILE REROUTE] 🔄 User went off-route! Recalculating in 3 seconds...');
    
    const rerouteTimer = setTimeout(async () => {
      try {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
        const [startLon, startLat] = userLocation;
        const [endLon, endLat] = destination;
        
        // ADD: details=instruction_details to get lane guidance data
        const url = `https://api.geoapify.com/v1/routing?waypoints=${startLon},${startLat}|${endLon},${endLat}&mode=drive&details=instruction_details&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features[0]) {
          const route = data.features[0];
          const distance = route.properties.distance / 1000;
          const duration = route.properties.time / 60;
          
          setRouteInfo({ distance, duration });

          // Parse new navigation steps (CORRECT MultiLineString handling - same as initial!)
          const steps: NavigationStep[] = [];
          if (route.properties.legs && route.properties.legs.length > 0) {
            // Geoapify uses MultiLineString: geometry.coordinates[legIndex][coordIndex]
            route.properties.legs.forEach((leg: any, legIndex: number) => {
              if (!leg.steps || leg.steps.length === 0) return;
              
              // Get leg-specific coordinate array
              const legGeometry = route.geometry.coordinates[legIndex];
              if (!legGeometry || !Array.isArray(legGeometry)) {
                console.warn('[ROADMATE MOBILE REROUTE] ⚠️ Missing geometry for leg', legIndex);
                return;
              }
              
              leg.steps.forEach((step: any) => {
                const instruction = step.instruction?.text || step.instruction || 'Continue';
                
                // BOUNDS CHECK: Validate indices within THIS leg's geometry
                const fromIdx = Math.max(0, step.from_index || 0);
                const toIdx = Math.min(legGeometry.length - 1, step.to_index || legGeometry.length - 1);
                
                // Slice coordinates from leg-specific array
                const stepCoords = legGeometry.slice(fromIdx, toIdx + 1);
                
                // Skip step if coordinates are invalid
                if (!stepCoords || stepCoords.length === 0) {
                  console.warn('[ROADMATE MOBILE REROUTE] ⚠️ Skipping step with empty coordinates:', instruction);
                  return;
                }
                
                steps.push({
                  instruction,
                  distance: step.distance || 0,
                  duration: step.duration || 0,
                  type: step.type || 'continue',
                  coordinates: stepCoords as [number, number][],
                  lanes: step.lanes // Capture lane guidance data if present
                });
              });
            });
            
            console.log('[ROADMATE MOBILE REROUTE] ✅ Parsed', steps.length, 'navigation steps from', route.properties.legs.length, 'legs');
            
            // RESET navigation state completely (including distanceToNextStep!)
            setNavigationSteps(steps);
            setCurrentStepIndex(0);
            setDistanceToNextStep(null);
            
            // Announce new first instruction
            if (steps.length > 0 && soundEnabled) {
              ttsSystem.speak({ 
                type: 'turn_instruction', 
                data: { instruction: steps[0].instruction, distance: steps[0].distance } as any
              });
            }
          } else {
            // No legs/steps available - reset state
            setNavigationSteps([]);
            setCurrentStepIndex(0);
            setDistanceToNextStep(null);
          }

          // Update route polyline (FLATTEN MultiLineString - same as initial!)
          const flattenedCoords: [number, number][] = [];
          if (Array.isArray(route.geometry.coordinates)) {
            route.geometry.coordinates.forEach((legCoords: any) => {
              if (Array.isArray(legCoords)) {
                flattenedCoords.push(...legCoords);
              }
            });
          }
          routePolyline.current = flattenedCoords;
          console.log('[ROADMATE MOBILE REROUTE] 📍 Flattened polyline:', flattenedCoords.length, 'coordinates');

          // Update map route
          if (map.current?.getSource('route')) {
            (map.current.getSource('route') as maplibregl.GeoJSONSource).setData(route.geometry);
          }

          // Clear off-route flag
          setIsOffRoute(false);
          console.log('[ROADMATE MOBILE REROUTE] ✅ New route calculated!');
        }
      } catch (error) {
        console.error('[ROADMATE MOBILE REROUTE ERROR]', error);
        setIsOffRoute(false); // Reset to try again later
      }
    }, 3000); // Wait 3 seconds before rerouting

    return () => clearTimeout(rerouteTimer);
  }, [isOffRoute]);

  // PROGRESSIVE BEEPING: Multi-radar scheduler (each radar beeps independently!)
  useEffect(() => {
    if (!userLocation || !soundEnabled || routeEvents.length === 0) {
      // Clear all beep timers
      beepTimersRef.current.forEach(timer => clearInterval(timer));
      beepTimersRef.current.clear();
      beepStateRef.current.clear();
      return;
    }

    // Find all radars within beeping range (<1000m)
    // Include mobile_radar_prediction if user enabled them in settings
    const radars = routeEvents.filter(e => 
      e.type === 'speed_camera' || 
      e.type === 'mobile_camera' ||
      (e.type === 'mobile_radar_prediction' && radarSettings.showMobileRadars)
    );

    if (radars.length === 0) {
      // Clear all beep timers
      beepTimersRef.current.forEach(timer => clearInterval(timer));
      beepTimersRef.current.clear();
      beepStateRef.current.clear();
      return;
    }

    // Track which radars are currently in range
    const currentRadarIds = new Set<string>();

    radars.forEach(radar => {
      const distance = calculateDistance(
        userLocation[1],
        userLocation[0],
        radar.latitude,
        radar.longitude
      ) * 1000; // Convert to meters

      const radarId = radar.id;

      // Only beep if within 1000m
      if (distance >= 1000) return;

      currentRadarIds.add(radarId);

      // Calculate beep parameters based on distance (using user settings)
      let beepInterval: number;
      let beepFrequency: number;
      let beepVolume: number;

      // Use configurable thresholds from radar settings
      const closeDistance = radarSettings.closeAlertDistance; // 150-300m
      const farDistance = radarSettings.firstAlertDistance; // 1000-2000m
      const midDistance1 = closeDistance + (farDistance - closeDistance) * 0.33; // ~33%
      const midDistance2 = closeDistance + (farDistance - closeDistance) * 0.66; // ~66%

      if (distance < closeDistance) {
        beepInterval = 200; // Very close - urgent beeps
        beepFrequency = 1200;
        beepVolume = radarSettings.enableSound ? 0.7 : 0;
      } else if (distance < midDistance1) {
        beepInterval = 500; // Close
        beepFrequency = 1000;
        beepVolume = radarSettings.enableSound ? 0.5 : 0;
      } else if (distance < midDistance2) {
        beepInterval = 1500; // Medium distance
        beepFrequency = 900;
        beepVolume = radarSettings.enableSound ? 0.4 : 0;
      } else if (distance < farDistance) {
        beepInterval = 3000; // Far - first alert
        beepFrequency = 800;
        beepVolume = radarSettings.enableSound ? 0.3 : 0;
      } else {
        // Beyond configured distance - skip beeping
        return; // Skip this radar (inside forEach, use return instead of continue)
      }

      // Check if we need to update this radar's timer
      const existingState = beepStateRef.current.get(radarId);
      const tierChanged = !existingState || existingState.tier !== beepInterval;
      const distanceChanged = !existingState || Math.abs(distance - existingState.distance) > 50;
      const distanceIncreased = existingState && distance > existingState.distance + 50; // User passing radar

      if (tierChanged || distanceChanged || distanceIncreased) {
        // ALWAYS clear existing timer for this radar before creating new one
        const existingTimer = beepTimersRef.current.get(radarId);
        if (existingTimer) {
          clearInterval(existingTimer);
          console.log('[ROADMATE MOBILE BEEP] 🔇 Cleared old timer for radar:', radarId);
        }

        // Create new timer for this radar
        const newTimer = setInterval(() => {
          if (soundEnabled) {
            audioSystem.playBeep({ 
              frequency: beepFrequency, 
              duration: 0.15, 
              volume: beepVolume 
            });
          }
        }, beepInterval);

        beepTimersRef.current.set(radarId, newTimer);
        beepStateRef.current.set(radarId, { tier: beepInterval, distance });

        if (tierChanged) {
          console.log('[ROADMATE MOBILE BEEP] 🔊 Radar', radarId, 'tier changed to:', beepInterval, 'ms (distance:', distance.toFixed(0), 'm)');
        } else if (distanceIncreased) {
          console.log('[ROADMATE MOBILE BEEP] 🔊 Radar', radarId, 'distance increased, slowing beep (distance:', distance.toFixed(0), 'm)');
        }
      }
    });

    // Remove timers for radars no longer in range
    const radarsToRemove: string[] = [];
    beepTimersRef.current.forEach((timer, radarId) => {
      if (!currentRadarIds.has(radarId)) {
        clearInterval(timer);
        radarsToRemove.push(radarId);
        console.log('[ROADMATE MOBILE BEEP] 🔇 Stopped beeping for radar:', radarId);
      }
    });

    radarsToRemove.forEach(radarId => {
      beepTimersRef.current.delete(radarId);
      beepStateRef.current.delete(radarId);
    });

    // NO cleanup here - timers persist across location updates!
    // Cleanup moved to separate effect below

  }, [userLocation, routeEvents, soundEnabled, radarSettings]); // Added radarSettings to force re-calc when settings change

  // Separate cleanup effect for beep timers (runs ONLY on unmount)
  useEffect(() => {
    return () => {
      beepTimersRef.current.forEach(timer => clearInterval(timer));
      beepTimersRef.current.clear();
      beepStateRef.current.clear();
    };
  }, []); // Empty deps = only on mount/unmount

  // RADAR ALERT POP-UP: Multi-radar tracking with FUNCTIONAL setState (no infinite loop!)
  useEffect(() => {
    if (!userLocation || routeEvents.length === 0) {
      // Clear all alerts when no location or events
      setActiveRadarAlerts(prev => prev.size > 0 ? new Map() : prev);
      return;
    }

    // Find all radars
    const radars = routeEvents.filter(e => 
      e.type === 'speed_camera' || e.type === 'mobile_camera'
    );

    if (radars.length === 0) {
      // Clear all alerts when no radars
      setActiveRadarAlerts(prev => prev.size > 0 ? new Map() : prev);
      return;
    }

    // USE FUNCTIONAL setState to avoid dependency on activeRadarAlerts!
    setActiveRadarAlerts(prevAlerts => {
      const newActiveAlerts = new Map(prevAlerts); // Clone for immutability
      let triggeredNewAlert = false;

      radars.forEach(radar => {
        const distance = calculateDistance(
          userLocation[1],
          userLocation[0],
          radar.latitude,
          radar.longitude
        ) * 1000; // Convert to meters

        const radarId = radar.id;
        const isTracked = newActiveAlerts.has(radarId);
        const wasAlerted = alertedRadarsRef.current.has(radarId);

        // HYSTERESIS: TRIGGER at <150m, CLOSE at >250m (prevent oscillation)
        if (distance < 150 && !isTracked && !wasAlerted) {
          console.log('[ROADMATE MOBILE RADAR] 🚨 Adding radar to active alerts! Distance:', distance.toFixed(0), 'm, ID:', radarId);
          newActiveAlerts.set(radarId, { event: radar, distance });
          alertedRadarsRef.current.add(radarId);

          // Vibration pattern (if mobile)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }

          // Announce with TTS (urgent!) - ONLY for FIRST new alert this tick
          if (soundEnabled && !triggeredNewAlert) {
            ttsSystem.speak({ 
              type: 'radar_ahead', 
              data: { distance } 
            }, true); // urgent = true
          }
          
          triggeredNewAlert = true; // Set flag AFTER TTS check
        } 
        // Update distance while tracked
        else if (distance < 250 && isTracked) {
          newActiveAlerts.set(radarId, { event: radar, distance });
        }
        // CLOSE ALERT when passed the radar (> 250m for hysteresis)
        else if (distance > 250 && isTracked) {
          console.log('[ROADMATE MOBILE RADAR] ✅ Radar passed (>250m), removing from alerts, ID:', radarId);
          newActiveAlerts.delete(radarId);
          
          // Clear existing cooldown timer for this radar if any
          const existingTimer = cooldownTimersRef.current.get(radarId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          // Set new cooldown timer (allow re-alerting if user loops back)
          const cooldownTimer = setTimeout(() => {
            alertedRadarsRef.current.delete(radarId);
            cooldownTimersRef.current.delete(radarId);
            console.log('[ROADMATE MOBILE RADAR] 🔄 Cooldown cleared for radar:', radarId);
          }, 30000);
          
          cooldownTimersRef.current.set(radarId, cooldownTimer);
        }
      });

      // Only update if Map actually changed (prevent unnecessary re-renders)
      if (newActiveAlerts.size !== prevAlerts.size || 
          Array.from(newActiveAlerts.keys()).some(k => !prevAlerts.has(k))) {
        return newActiveAlerts;
      }
      return prevAlerts; // Return prev to prevent re-render
    });

    // Cleanup cooldown timers ONLY on unmount (not on every render!)
    // This cleanup now runs ONLY when component unmounts
  }, [userLocation, routeEvents, soundEnabled]); // Removed activeRadarAlerts dependency!

  // Separate cleanup effect for cooldown timers (runs ONLY on unmount)
  useEffect(() => {
    return () => {
      cooldownTimersRef.current.forEach((timer) => clearTimeout(timer));
      cooldownTimersRef.current.clear();
    };
  }, []); // Empty deps = only on mount/unmount

  // Compute the CLOSEST radar from activeRadarAlerts Map for display
  const closestRadar = Array.from(activeRadarAlerts.values()).reduce<{ event: RouteEvent, distance: number } | null>(
    (closest, current) => {
      if (!closest || current.distance < closest.distance) {
        return current;
      }
      return closest;
    },
    null
  );

  return (
    <div
      data-testid="mobile-app"
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000'
      }}
    >
      {/* LEFT: MOBILE TIMELINE SIDEBAR - 70px width, flex layout */}
      <TimelineSidebar 
        pois={routeEvents}
        currentSpeed={currentSpeed}
        routeInfo={routeInfo}
        placement="left"
        width={70}
        useFlexLayout={true}
      />

      {/* RIGHT: Map + Overlay Content */}
      <div style={{ flex: 1, position: 'relative', height: '100vh' }}>
        {/* Map Container - FULL SCREEN in content area */}
        <div
          ref={mapContainer}
          data-testid="map-container"
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />

      {/* LOGO ROADMATE - Mobile Smaller */}
      <div
        data-testid="logo-roadmate"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          fontSize: 20,
          fontWeight: 'bold',
          color: '#00FFFF', // Azul neon
          textShadow: '0 0 15px rgba(0,255,255,0.9), 0 0 30px rgba(0,255,255,0.6)',
          letterSpacing: '1px',
          zIndex: 1000,
          fontFamily: 'Space Grotesk, sans-serif'
        }}
      >
        ROAD◇MATE
      </div>

      {/* TURN-BY-TURN NAVIGATION CARD - Enhanced Mobile Design */}
      {navigationSteps.length > 0 && currentStepIndex < navigationSteps.length && (
        <div
          data-testid="turn-by-turn-card"
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(25,25,35,1), rgba(15,15,20,1))',
            backdropFilter: 'blur(24px)',
            border: '2px solid #00FFFF',
            borderRadius: 20,
            padding: '18px 24px',
            boxShadow: '0 0 50px rgba(0,255,255,0.5), 0 10px 30px rgba(0,0,0,0.9)',
            zIndex: 1100,
            width: 'calc(100% - 40px)',
            maxWidth: 400,
            textAlign: 'center'
          }}
        >
          {/* TOP ROW: Horizontal layout (arrow → info → compass) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: navigationSteps[currentStepIndex].lanes ? 12 : 0
            }}
          >
            {/* LEFT: Turn arrow icon (smaller on mobile) */}
            <div
              style={{
                minWidth: 60,
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <ArrowUpRight 
                size={48} 
                color="#FFFFFF"
                style={{
                  filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.8))'
                }}
              />
            </div>

            {/* CENTER: Distance + Street name */}
            <div style={{ flex: 1, textAlign: 'left' }}>
              {distanceToNextStep !== null && (
                <div
                  data-testid="text-next-step-distance"
                  style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#FFFFFF',
                    marginBottom: 4
                  }}
                >
                  {distanceToNextStep < 1000 
                    ? `${Math.round(distanceToNextStep)}m` 
                    : `${(distanceToNextStep / 1000).toFixed(1)}km`}
                </div>
              )}
              <div
                data-testid="text-turn-instruction"
                style={{
                  fontSize: 15,
                  color: '#999',
                  fontWeight: '400',
                  lineHeight: 1.3
                }}
              >
                {navigationSteps[currentStepIndex].instruction}
              </div>
            </div>

            {/* RIGHT: Compass (smaller on mobile) */}
            <div style={{ minWidth: 48, textAlign: 'center' }}>
              <Compass 
                size={28} 
                color="#00FFFF"
                style={{ marginBottom: 2 }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: '#00FFFF',
                  fontWeight: 'bold'
                }}
              >
                N
              </div>
            </div>
          </div>

          {/* LANE GUIDANCE WIDGET - Full width row below */}
          {navigationSteps[currentStepIndex].lanes && distanceToNextStep !== null && (
            <div style={{ width: '100%' }}>
              <LaneGuidanceWidget 
                lanes={navigationSteps[currentStepIndex].lanes}
                distanceToTurn={distanceToNextStep}
              />
            </div>
          )}

          {/* Off-route indicator */}
          {isOffRoute && (
            <div
              data-testid="text-off-route-warning"
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: 'bold',
                color: '#FF0000',
                textShadow: '0 0 10px rgba(255,0,0,0.8)',
                animation: 'pulse-red 1s infinite'
              }}
            >
              ⚠️ RECALCULANDO ROTA...
            </div>
          )}
        </div>
      )}

      {/* Search Overlay - HIDDEN by default (só aparece quando botão Search clicado) */}
      {showSearch && (
        <div
          data-testid="search-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 100
          }}
          onClick={() => {
            setShowSearch(false);
            setSearchResults([]);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600,
              maxWidth: '90%'
            }}
          >
            {/* Search Bar */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Procurar destino..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                data-testid="input-search"
                autoFocus
                style={{
                  width: '100%',
                  padding: '18px 60px 18px 24px',
                  borderRadius: 16,
                  border: '3px solid #00FFFF',
                  background: 'rgba(0,0,0,0.95)',
                  backdropFilter: 'blur(20px)',
                  color: '#FFF',
                  fontSize: 18,
                  boxShadow: '0 0 40px rgba(0,255,255,0.6)'
                }}
              />
              
              {/* Close button */}
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,0,0,0.3)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  maxHeight: 400,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 16,
                  border: '2px solid #00FFFF',
                  boxShadow: '0 0 30px rgba(0,255,255,0.4)'
                }}
              >
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      selectDestination(result);
                      setShowSearch(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      borderBottom: idx < searchResults.length - 1 ? '1px solid #333' : 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0,255,255,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ color: '#FFF', fontSize: 16, fontWeight: '500' }}>
                      {result.properties.formatted}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROUTE CONFIRMATION CARD - Enhanced Mobile Design */}
      {destination && routeInfo && !isNavigating && (
        <div
          data-testid="route-confirmation-card"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, rgba(20,20,30,1), rgba(10,10,15,1))',
            backdropFilter: 'blur(40px)',
            border: '3px solid #00FFFF',
            borderRadius: 24,
            padding: '32px 24px',
            boxShadow: '0 0 80px rgba(0,255,255,0.6), 0 12px 50px rgba(0,0,0,0.95)',
            zIndex: 2000,
            width: 'calc(100% - 40px)',
            maxWidth: 500,
            textAlign: 'center'
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 'bold',
              color: '#00FFFF',
              marginBottom: 30,
              textShadow: '0 0 20px rgba(0,255,255,0.9)',
              letterSpacing: '1px'
            }}
          >
            🎯 ROTA CALCULADA
          </div>

          {/* Route Info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: 40,
              gap: 30
            }}
          >
            {/* Distance */}
            <div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  marginBottom: 8
                }}
              >
                {routeInfo.distance.toFixed(1)}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}
              >
                KM
              </div>
            </div>

            {/* Duration */}
            <div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  marginBottom: 8
                }}
              >
                {Math.round(routeInfo.duration)}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}
              >
                MIN
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 20,
              justifyContent: 'center'
            }}
          >
            {/* Cancel Button */}
            <button
              onClick={() => {
                setDestination(null);
                setRouteInfo(null);
                setNavigationSteps([]);
                // Clear route from map
                if (map.current?.getSource('route')) {
                  map.current.removeLayer('route');
                  map.current.removeSource('route');
                }
              }}
              data-testid="button-cancel-route"
              style={{
                padding: '16px 32px',
                borderRadius: 12,
                border: '2px solid #FF4444',
                background: 'transparent',
                color: '#FF4444',
                fontSize: 18,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: 140
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ❌ CANCELAR
            </button>

            {/* Start Navigation Button */}
            <button
              onClick={() => {
                setIsNavigating(true);
                console.log('[ROADMATE MOBILE] ✅ Navigation started!');
              }}
              data-testid="button-start-navigation"
              style={{
                padding: '16px 32px',
                borderRadius: 12,
                border: '3px solid #00FFFF',
                background: 'linear-gradient(135deg, #00FFFF22, #00FFFF11)',
                color: '#00FFFF',
                fontSize: 20,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: 200,
                boxShadow: '0 0 30px rgba(0,255,255,0.5)',
                textShadow: '0 0 10px rgba(0,255,255,0.8)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #00FFFF44, #00FFFF22)';
                e.currentTarget.style.boxShadow = '0 0 40px rgba(0,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #00FFFF22, #00FFFF11)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,255,0.5)';
              }}
            >
              🚗 INICIAR NAVEGAÇÃO
            </button>
          </div>
        </div>
      )}

      {/* Floating Controls - Bottom Left (Azul Neon, MINIMALISTA - agora com Search!) */}
      <div
        className="floating-controls"
        style={{
          position: 'absolute',
          bottom: 30,
          left: 30,
          display: 'flex',
          gap: 16,
          zIndex: 1000
        }}
      >
        {/* Sound Toggle - Azul Neon */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          data-testid="button-sound"
          title="Radar Alerts"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid #00FFFF',
            background: soundEnabled 
              ? 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(0,150,255,0.3) 100%)'
              : 'rgba(0,0,0,0.8)',
            color: soundEnabled ? '#00FFFF' : '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: soundEnabled 
              ? '0 0 30px rgba(0,255,255,0.6)' 
              : '0 4px 12px rgba(0,0,0,0.6)',
            transition: 'all 0.3s'
          }}
        >
          {soundEnabled ? <Volume2 size={28} /> : <VolumeX size={28} />}
        </button>

        {/* Center GPS - Azul Neon */}
        <button
          onClick={() => {
            if (userLocation && map.current) {
              map.current.flyTo({ center: userLocation, zoom: 15, pitch: 45 });
            }
          }}
          data-testid="button-center-gps"
          title="Center GPS"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid #00FFFF',
            background: userLocation
              ? 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(0,150,255,0.3) 100%)'
              : 'rgba(0,0,0,0.8)',
            color: userLocation ? '#00FFFF' : '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: userLocation
              ? '0 0 30px rgba(0,255,255,0.6)'
              : '0 4px 12px rgba(0,0,0,0.6)',
            transition: 'all 0.3s'
          }}
        >
          <Navigation size={28} />
        </button>

        {/* Search Button - Azul Neon (abre overlay) */}
        <button
          onClick={() => setShowSearch(true)}
          data-testid="button-search"
          title="Search Destination"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid #00FFFF',
            background: 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(0,150,255,0.3) 100%)',
            color: '#00FFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(0,255,255,0.6)',
            transition: 'all 0.3s'
          }}
        >
          <Search size={28} />
        </button>

        {/* Settings Button - Azul Neon */}
        <button
          onClick={() => setShowSettings(true)}
          data-testid="button-settings"
          title="Radar Settings"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid #00FFFF',
            background: 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(0,150,255,0.3) 100%)',
            color: '#00FFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(0,255,255,0.6)',
            transition: 'all 0.3s'
          }}
        >
          <Settings size={28} />
        </button>

        {/* Quick Report - VERMELHO for visibility */}
        <button
          onClick={() => quickAddReport('mobile_camera')}
          data-testid="button-quick-report"
          title="Report Radar"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2px solid #FF0000',
            background: 'linear-gradient(135deg, rgba(255,0,0,0.4) 0%, rgba(200,0,0,0.4) 100%)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(255,0,0,0.7)',
            transition: 'all 0.3s'
          }}
        >
          <Camera size={28} />
        </button>
      </div>

      {/* RADAR ALERT FULLSCREEN POP-UP - Radarbot Style (MULTI-RADAR SUPPORT!) */}
      {closestRadar && (
        <div
          data-testid="radar-alert-fullscreen"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: closestRadar.event.type === 'mobile_radar_prediction'
              ? 'radial-gradient(circle at center, #FF9900 0%, #CC6600 50%, #663300 100%)' // Orange for predictions
              : 'radial-gradient(circle at center, #FF0000 0%, #990000 50%, #330000 100%)', // Red for confirmed
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse-fullscreen-red 1s infinite',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Giant Camera Icon */}
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
              boxShadow: '0 0 80px rgba(255,255,255,0.8)',
              animation: 'pulse-icon 0.5s infinite'
            }}
          >
            <Camera size={100} color="#FFFFFF" strokeWidth={3} />
          </div>

          {/* Speed Limit - HUGE */}
          {closestRadar.event.speedLimit && (
            <div
              data-testid="text-alert-speed-limit"
              style={{
                fontSize: 120,
                fontWeight: 'bold',
                color: '#FFFFFF',
                textShadow: '0 0 40px rgba(255,255,255,1)',
                marginBottom: 20,
                letterSpacing: '10px'
              }}
            >
              {closestRadar.event.speedLimit}
            </div>
          )}

          {/* Alert Text */}
          <div
            data-testid="text-alert-message"
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: '#FFFFFF',
              textAlign: 'center',
              textShadow: '0 0 20px rgba(255,255,255,0.8)',
              marginBottom: 30
            }}
          >
            ⚠️ RADAR AHEAD ⚠️
          </div>

          {/* Distance */}
          <div
            data-testid="text-alert-distance"
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: '#FFFF00',
              textShadow: '0 0 20px rgba(255,255,0,0.8)'
            }}
          >
            {closestRadar.distance < 1000 
              ? `${Math.round(closestRadar.distance)}m` 
              : `${(closestRadar.distance / 1000).toFixed(1)}km`}
          </div>

          {/* Type indicator with POSSIBLE badge for predictions */}
          <div
            style={{
              marginTop: 30,
              fontSize: 24,
              color: '#FFFFFF',
              opacity: 0.8
            }}
          >
            {closestRadar.event.type === 'mobile_radar_prediction' 
              ? '⚠️ POSSIBLE MOBILE RADAR' 
              : closestRadar.event.type === 'mobile_camera' 
              ? '📱 MOBILE RADAR' 
              : '📷 FIXED CAMERA'}
          </div>

          {/* MULTI-RADAR INDICATOR (if >1 radar active) */}
          {activeRadarAlerts.size > 1 && (
            <div
              style={{
                marginTop: 20,
                fontSize: 18,
                color: '#FFFF00',
                opacity: 0.9
              }}
            >
              +{activeRadarAlerts.size - 1} more radar{activeRadarAlerts.size > 2 ? 's' : ''} ahead
            </div>
          )}
        </div>
      )}

      {/* RADAR SETTINGS MODAL */}
      <RadarSettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsChange={(newSettings) => {
          console.log('[ROADMATE MOBILE SETTINGS] 🔧 Settings updated:', newSettings);
          // Force parent re-render to pick up new settings
          setSettingsVersion(v => v + 1);
          // Beep scheduler will use updated values via useRadarSettings hook
        }}
      />
      </div>
    </div>
  );
}
