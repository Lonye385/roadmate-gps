// ROADMATE GPS - Vanilla JavaScript
// Professional GPS Navigation with Speed Cameras

const GEOAPIFY_API_KEY = 'GEOAPIFY_KEY_PLACEHOLDER';
const API_BASE = window.location.origin;

// POI Icons (Neon style)
const POI_ICONS = {
    'fixed_radar': '/gps/icons/fixed-radar.jpg',
    'mobile_radar': '/gps/icons/mobile-radar.jpg',
    'danger': '/gps/icons/danger.jpg',
    'fuel_station': '/gps/icons/fuel-station.jpg',
    'truck_parking': '/gps/icons/truck-parking.jpg',
    'speed_camera': '/gps/icons/fixed-radar.jpg',
    'default': '/gps/icons/fixed-radar.jpg'
};

// i18n Translations
const translations = {
    'pt': {
        'pois_header': 'Pontos de Interesse',
        'alerts_header': 'Alertas em Tempo Real',
        'report_btn': 'Reportar Incidente',
        'search_placeholder': 'Para onde?',
        'TURN_LEFT': 'Vire a esquerda',
        'TURN_RIGHT': 'Vire a direita',
        'CONTINUE_STRAIGHT': 'Siga em frente',
        'DESTINATION_REACHED': 'Chegou ao seu destino',
        'fixed_camera': 'Radar Fixo',
        'mobile_camera': 'Radar Movel',
        'fuel_station': 'Posto de Combustivel',
        'truck_parking': 'Parque de Camioes',
        'danger': 'Perigo',
        'accident': 'Acidente'
    },
    'en': {
        'pois_header': 'Nearby POIs',
        'alerts_header': 'Real-Time Alerts',
        'report_btn': 'Report Incident',
        'search_placeholder': 'Where to?',
        'TURN_LEFT': 'Turn left',
        'TURN_RIGHT': 'Turn right',
        'CONTINUE_STRAIGHT': 'Continue straight',
        'DESTINATION_REACHED': 'Destination reached',
        'fixed_camera': 'Fixed Camera',
        'mobile_camera': 'Mobile Camera',
        'fuel_station': 'Fuel Station',
        'truck_parking': 'Truck Parking',
        'danger': 'Danger',
        'accident': 'Accident'
    }
};

let currentLang = 'pt';

function t(key) {
    return translations[currentLang]?.[key] || translations['pt']?.[key] || key;
}

// Camera markers storage
let cameraMarkers = [];

// State
let map = null;
let userMarker = null;
let userLocation = null;
let destination = null;
let routeCoordinates = [];
let navigationSteps = [];
let currentStepIndex = 0;
let speedCameras = [];
let voiceEnabled = true;
let watchId = null;
let isNavigating = false;

// DOM Elements - TomTom Style Layout
const loadingEl = document.getElementById('loading');
const streetNameEl = document.getElementById('street-name');
const etaTimeEl = document.getElementById('eta-time');
const nextInstructionEl = document.getElementById('next-instruction');
const distanceToNextEl = document.getElementById('distance-to-next');
const currentStreetNameEl = document.getElementById('current-street-name');
const nextAlertWidgetEl = document.getElementById('next-alert-widget');
const nextAlertTypeEl = document.getElementById('next-alert-type');
const nextAlertDistanceEl = document.getElementById('next-alert-distance');
const timeLeftEl = document.getElementById('time-left');
const routeDistanceEl = document.getElementById('route-distance');
const poiListEl = document.getElementById('poi-list');
const alertListEl = document.getElementById('alert-list');
const userScoreEl = document.getElementById('user-score');
const speedValueEl = document.getElementById('current-speed');
const searchInputEl = document.getElementById('search-input');
const searchPanelEl = document.getElementById('search-panel');
const searchInputPanelEl = document.getElementById('search-input-panel');
const searchResultsEl = document.getElementById('search-results');
const radarAlertEl = document.getElementById('radar-alert');
const radarTypeEl = document.getElementById('radar-type');
const radarDistanceEl = document.getElementById('radar-distance-alert');
const radarLimitEl = document.getElementById('radar-limit');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('[ROADMATE] Initializing GPS...');
    
    try {
        // Get API key from backend
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
            const config = await configRes.json();
            if (config.geoapifyKey) {
                window.GEOAPIFY_KEY = config.geoapifyKey;
            }
        }
    } catch (e) {
        console.log('[ROADMATE] Using default config');
    }
    
    initMap();
    initControls();
    startGPS();
    loadSpeedCameras();
}

function initMap() {
    console.log('[ROADMATE] Initializing MapLibre...');
    
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
            sources: {
                dark_matter: {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
                        'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
                        'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; CARTO Dark Matter'
                }
            },
            layers: [{
                id: 'dark_matter',
                type: 'raster',
                source: 'dark_matter',
                paint: {
                    'raster-brightness-max': 0.8,
                    'raster-contrast': 0.2,
                    'raster-saturation': -0.2
                }
            }]
        },
        center: [-9.1393, 38.7223], // Lisboa default
        zoom: 15,
        pitch: 50,
        bearing: -20
    });
    
    map.on('load', () => {
        console.log('[ROADMATE] Map loaded!');
        hideLoading();
        
        // Add route source
        map.addSource('route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        
        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
                'line-color': '#00ff7f',
                'line-width': 8,
                'line-blur': 1,
                'line-opacity': 0.95
            }
        });
        
        // Add cameras source
        map.addSource('cameras', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        
        map.addLayer({
            id: 'cameras-layer',
            type: 'circle',
            source: 'cameras',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ff4444',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });
    });
}

function initControls() {
    // Search button (bottom bar)
    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            const query = searchInputEl?.value?.trim();
            if (query) {
                searchDestination(query);
            } else {
                searchPanelEl?.classList.remove('hidden');
                searchInputPanelEl?.focus();
            }
        });
    }
    
    // Search input (bottom bar) - Enter key
    if (searchInputEl) {
        searchInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) searchDestination(query);
            }
        });
    }
    
    // Close search panel
    const btnCloseSearch = document.getElementById('btn-close-search');
    if (btnCloseSearch) {
        btnCloseSearch.addEventListener('click', () => {
            searchPanelEl?.classList.add('hidden');
            if (searchResultsEl) searchResultsEl.innerHTML = '';
            if (searchInputPanelEl) searchInputPanelEl.value = '';
        });
    }
    
    // Search input panel
    if (searchInputPanelEl) {
        let searchTimeout;
        searchInputPanelEl.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchDestination(e.target.value), 500);
        });
    }
    
    // Sound toggle
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            voiceEnabled = !voiceEnabled;
            soundBtn.textContent = voiceEnabled ? '🔊' : '🔇';
            speak(voiceEnabled ? 'Voz ativada' : 'Voz desativada');
        });
    }
    
    // Report button
    const reportBtn = document.getElementById('report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', showReportMenu);
    }
    
    // Update POI sidebar
    updatePOISidebar();
}

function startGPS() {
    if (!navigator.geolocation) {
        console.error('[ROADMATE] Geolocation not supported');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            updateUserPosition(pos);
            centerOnUser();
        },
        (err) => console.error('[ROADMATE] GPS error:', err),
        options
    );
    
    // Watch position
    watchId = navigator.geolocation.watchPosition(
        updateUserPosition,
        (err) => console.error('[ROADMATE] GPS watch error:', err),
        options
    );
}

function updateUserPosition(position) {
    const { latitude, longitude, speed, heading } = position.coords;
    userLocation = [longitude, latitude];
    
    // Update speed display
    const speedKmh = speed ? Math.round(speed * 3.6) : 0;
    speedValueEl.textContent = speedKmh;
    
    // Update/create user marker
    if (!userMarker) {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="#00c8ff" stroke="white" stroke-width="3"/>
                <path d="M20 8 L26 28 L20 24 L14 28 Z" fill="white"/>
            </svg>
        `;
        el.style.cssText = 'width:40px;height:40px;';
        
        userMarker = new maplibregl.Marker({ element: el })
            .setLngLat(userLocation)
            .addTo(map);
    } else {
        userMarker.setLngLat(userLocation);
    }
    
    // Rotate marker with heading
    if (heading && userMarker) {
        userMarker.getElement().style.transform = `rotate(${heading}deg)`;
    }
    
    // Check navigation
    if (isNavigating) {
        updateNavigation();
    }
    
    // Check speed cameras
    checkSpeedCameras();
}

function centerOnUser() {
    if (userLocation && map) {
        map.flyTo({
            center: userLocation,
            zoom: 16,
            pitch: 45
        });
    }
}

async function searchDestination(query) {
    if (!query || query.length < 3) {
        searchResultsEl.innerHTML = '';
        return;
    }
    
    const apiKey = window.GEOAPIFY_KEY || GEOAPIFY_API_KEY;
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&format=json&apiKey=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            searchResultsEl.innerHTML = data.results.map(result => `
                <div class="search-result" onclick="selectDestination(${result.lon}, ${result.lat}, '${escapeHtml(result.formatted)}')">
                    <div class="search-result-name">${result.name || result.formatted.split(',')[0]}</div>
                    <div class="search-result-address">${result.formatted}</div>
                </div>
            `).join('');
        } else {
            searchResultsEl.innerHTML = '<div class="search-result"><div class="search-result-name">Sem resultados</div></div>';
        }
    } catch (err) {
        console.error('[ROADMATE] Search error:', err);
    }
}

function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

async function selectDestination(lon, lat, name) {
    destination = [lon, lat];
    searchPanelEl.classList.add('hidden');
    searchInputEl.value = '';
    searchResultsEl.innerHTML = '';
    
    console.log('[ROADMATE] Destination selected:', name);
    speak(`A calcular rota para ${name.split(',')[0]}`);
    
    await calculateRoute();
}

async function calculateRoute() {
    if (!userLocation || !destination) return;
    
    const apiKey = window.GEOAPIFY_KEY || GEOAPIFY_API_KEY;
    const [startLon, startLat] = userLocation;
    const [endLon, endLat] = destination;
    
    const url = `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLon}|${endLat},${endLon}&mode=drive&details=instruction_details&apiKey=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features[0]) {
            const route = data.features[0];
            const distance = route.properties.distance / 1000;
            const duration = route.properties.time / 60;
            
            // Draw route on map
            routeCoordinates = route.geometry.coordinates;
            map.getSource('route').setData({
                type: 'Feature',
                geometry: route.geometry
            });
            
            // Fit map to route
            const bounds = new maplibregl.LngLatBounds();
            routeCoordinates.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 100 });
            
            // Parse navigation steps
            navigationSteps = [];
            if (route.properties.legs) {
                route.properties.legs.forEach(leg => {
                    if (leg.steps) {
                        leg.steps.forEach(step => {
                            navigationSteps.push({
                                instruction: step.instruction?.text || 'Continue em frente',
                                distance: step.distance || 0,
                                type: step.instruction?.type || 'continue',
                                coordinates: leg.geometry ? 
                                    leg.geometry.coordinates.slice(step.from_index, step.to_index + 1) : []
                            });
                        });
                    }
                });
            }
            
            // Start navigation
            isNavigating = true;
            currentStepIndex = 0;
            
            // Update UI
            turnCardEl.classList.remove('hidden');
            routeInfoEl.classList.remove('hidden');
            
            updateETADisplay(distance, duration);
            updateNavigationUI();
            
            speak(`Rota calculada. ${Math.round(distance)} quilómetros, ${Math.round(duration)} minutos.`);
            
            console.log('[ROADMATE] Route calculated:', navigationSteps.length, 'steps');
        }
    } catch (err) {
        console.error('[ROADMATE] Route calculation error:', err);
        speak('Erro ao calcular rota');
    }
}

function updateNavigation() {
    if (!isNavigating || navigationSteps.length === 0 || !userLocation) return;
    
    const currentStep = navigationSteps[currentStepIndex];
    if (!currentStep) return;
    
    // Calculate distance to next maneuver
    let minDistance = Infinity;
    if (currentStep.coordinates && currentStep.coordinates.length > 0) {
        const targetCoord = currentStep.coordinates[currentStep.coordinates.length - 1];
        if (targetCoord) {
            minDistance = haversineDistance(userLocation, targetCoord);
        }
    }
    
    // Update UI
    if (minDistance < Infinity) {
        turnDistanceEl.textContent = formatDistance(minDistance);
    }
    
    // Voice prompt at thresholds
    if (minDistance < 500 && minDistance > 450) {
        speak(`Em ${formatDistance(minDistance)}, ${currentStep.instruction}`);
    } else if (minDistance < 100 && minDistance > 80) {
        speak(currentStep.instruction);
    }
    
    // Advance to next step
    if (minDistance < 30 && currentStepIndex < navigationSteps.length - 1) {
        currentStepIndex++;
        updateNavigationUI();
        
        if (currentStepIndex === navigationSteps.length - 1) {
            speak('Chegou ao seu destino');
            endNavigation();
        }
    }
}

function updateNavigationUI() {
    const step = navigationSteps[currentStepIndex];
    if (!step) return;
    
    turnInstructionEl.textContent = step.instruction;
    updateTurnIcon(step.type);
}

function updateTurnIcon(type) {
    const iconEl = document.querySelector('#turn-icon svg');
    let path = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z'; // right arrow default
    
    if (type?.includes('left')) {
        path = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';
    } else if (type?.includes('right')) {
        path = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
    } else if (type?.includes('straight') || type?.includes('continue')) {
        path = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z';
    }
    
    iconEl.innerHTML = `<path d="${path}"/>`;
}

function updateETADisplay(distanceKm, durationMin) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + durationMin);
    etaEl.textContent = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    distanceRemainingEl.textContent = `${distanceKm.toFixed(1)} km`;
}

function endNavigation() {
    isNavigating = false;
    turnCardEl.classList.add('hidden');
    routeInfoEl.classList.add('hidden');
    map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
}

async function loadSpeedCameras() {
    try {
        const response = await fetch('/api/speed-cameras/nearby?lat=38.7223&lng=-9.1393&radius=50000');
        if (response.ok) {
            const data = await response.json();
            speedCameras = data.cameras || [];
            console.log('[ROADMATE] Loaded', speedCameras.length, 'speed cameras');
            
            // Clear existing markers
            cameraMarkers.forEach(m => m.remove());
            cameraMarkers = [];
            
            // Add camera markers with custom icons (limit to 200 for performance)
            const camerasToShow = speedCameras.slice(0, 200);
            camerasToShow.forEach(cam => {
                const iconType = cam.cameraType?.includes('mobile') ? 'mobile_radar' : 'fixed_radar';
                const iconUrl = POI_ICONS[iconType] || POI_ICONS.default;
                
                // Create custom marker element
                const el = document.createElement('div');
                el.className = 'camera-marker';
                el.innerHTML = `<img src="${iconUrl}" alt="camera" style="width:40px;height:40px;border-radius:8px;box-shadow:0 0 10px rgba(255,0,0,0.5);">`;
                el.style.cssText = 'width:40px;height:40px;cursor:pointer;';
                
                // Add click handler for popup
                el.addEventListener('click', () => {
                    showCameraPopup(cam);
                });
                
                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([cam.longitude, cam.latitude])
                    .addTo(map);
                
                cameraMarkers.push(marker);
            });
            
            console.log('[ROADMATE] Added', cameraMarkers.length, 'camera markers with neon icons');
            
            // Update sidebar with POIs
            updatePOISidebar();
        }
    } catch (err) {
        console.error('[ROADMATE] Error loading cameras:', err);
    }
}

function showCameraPopup(camera) {
    const popup = document.createElement('div');
    popup.className = 'camera-popup';
    popup.innerHTML = `
        <div style="background:rgba(26,26,46,0.95);padding:12px;border-radius:12px;border:1px solid #ff4444;color:white;min-width:150px;">
            <div style="font-size:14px;color:#ff6666;font-weight:bold;">${t(camera.cameraType?.includes('mobile') ? 'mobile_camera' : 'fixed_camera')}</div>
            <div style="font-size:24px;font-weight:bold;margin:8px 0;">${camera.speedLimit || '?'} km/h</div>
            <div style="font-size:12px;color:#888;">${camera.direction || 'Ambas direccoes'}</div>
        </div>
    `;
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;';
    document.body.appendChild(popup);
    
    setTimeout(() => popup.remove(), 3000);
}

function checkSpeedCameras() {
    if (!userLocation || speedCameras.length === 0) return;
    
    let nearestCamera = null;
    let nearestDistance = Infinity;
    
    for (const cam of speedCameras) {
        const distance = haversineDistance(userLocation, [cam.longitude, cam.latitude]);
        if (distance < nearestDistance && distance < 2000) { // 2km range
            nearestDistance = distance;
            nearestCamera = cam;
        }
    }
    
    if (nearestCamera && nearestDistance < 500) {
        showRadarAlert(nearestCamera, nearestDistance);
    } else {
        radarAlertEl.classList.add('hidden');
    }
}

function showRadarAlert(camera, distance) {
    radarTypeEl.textContent = camera.cameraType || 'Radar';
    radarDistanceEl.textContent = formatDistance(distance);
    radarLimitEl.textContent = camera.speedLimit ? `${camera.speedLimit} km/h` : '';
    radarAlertEl.classList.remove('hidden');
    
    // Check if speeding
    const currentSpeed = parseInt(speedValueEl.textContent) || 0;
    if (camera.speedLimit && currentSpeed > camera.speedLimit) {
        speedDisplayEl.classList.add('over-limit');
        speedLimitEl.textContent = camera.speedLimit;
        speedLimitEl.classList.remove('hidden');
    } else {
        speedDisplayEl.classList.remove('over-limit');
        speedLimitEl.classList.add('hidden');
    }
    
    // Voice alert once
    if (distance < 500 && distance > 450) {
        speak(`Atenção! Radar a ${formatDistance(distance)}`);
    }
}

function updatePOISidebar() {
    if (!poiListEl) return;
    
    // Update with nearby POIs from cameras
    const nearbyPOIs = speedCameras.slice(0, 10).map((cam, i) => {
        const iconUrl = cam.cameraType?.includes('mobile') 
            ? POI_ICONS.mobile_radar 
            : POI_ICONS.fixed_radar;
        const typeName = cam.cameraType?.includes('mobile') 
            ? t('mobile_camera') 
            : t('fixed_camera');
        
        return `
            <li data-testid="poi-item-${i}">
                <img src="${iconUrl}" alt="${typeName}" style="width:32px;height:32px;border-radius:6px;">
                <div>
                    <strong>${typeName}</strong>
                    <small style="display:block;color:#888;">${cam.speedLimit || '?'} km/h</small>
                </div>
            </li>
        `;
    }).join('');
    
    poiListEl.innerHTML = nearbyPOIs || '<li style="color:#888;">Nenhum POI proximo</li>';
}

function updateNavigationUI(step, distance, eta, totalDistance) {
    if (nextInstructionEl) {
        nextInstructionEl.textContent = t(step?.instruction) || step?.instruction || 'Siga em frente';
    }
    if (distanceToNextEl) {
        distanceToNextEl.textContent = distance ? `${Math.round(distance)}m` : '--';
    }
    if (currentStreetNameEl) {
        currentStreetNameEl.textContent = step?.street || 'Rota ativa';
    }
    if (streetNameEl) {
        streetNameEl.textContent = step?.street || 'ROADMATE GPS';
    }
    if (etaTimeEl) {
        etaTimeEl.textContent = eta || '--:--';
    }
    if (timeLeftEl) {
        timeLeftEl.textContent = eta || 'N/A';
    }
    if (routeDistanceEl) {
        routeDistanceEl.textContent = totalDistance ? `${(totalDistance/1000).toFixed(1)} km` : 'N/A';
    }
}

function updateAlertWidget(type, distance) {
    if (!nextAlertWidgetEl) return;
    
    if (type && distance) {
        nextAlertWidgetEl.style.display = 'flex';
        if (nextAlertTypeEl) nextAlertTypeEl.textContent = type;
        if (nextAlertDistanceEl) nextAlertDistanceEl.textContent = `${Math.round(distance)}m`;
    } else {
        nextAlertWidgetEl.style.display = 'none';
    }
}

function showReportMenu() {
    const types = ['Radar Movel', 'Acidente', 'Perigo', 'Transito'];
    
    const type = prompt('Reportar:\n1. Radar Movel\n2. Acidente\n3. Perigo\n4. Transito\n\nEscolha (1-4):');
    if (type && userLocation) {
        const alertType = types[parseInt(type) - 1] || types[0];
        reportAlert(alertType);
    }
}

async function reportAlert(type) {
    if (!userLocation) return;
    
    try {
        await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 1,
                latitude: userLocation[1],
                longitude: userLocation[0],
                reportType: type
            })
        });
        speak(`${type} reportado`);
    } catch (err) {
        console.error('[ROADMATE] Report error:', err);
    }
}

// TTS
function speak(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-PT';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
}

// Utilities
function haversineDistance(coord1, coord2) {
    const R = 6371000; // meters
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function formatDistance(meters) {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
}

function hideLoading() {
    loadingEl.classList.add('hidden');
}

// Make selectDestination globally accessible
window.selectDestination = selectDestination;
