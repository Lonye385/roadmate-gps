import { Camera, Fuel, ParkingCircle, AlertTriangle, Video } from 'lucide-react';

interface POIEvent {
  id: string;
  type: 'speed_camera' | 'mobile_camera' | 'mobile_radar_prediction' | 'traffic_camera' | 'parking' | 'gas_station' | 'service_area' | 'accident' | 'truck_park';
  distance: number;
  speedLimit?: number;
  verified?: boolean;
  confidence?: number;
}

interface TimelineSidebarProps {
  pois: POIEvent[];
  currentSpeed: number;
  routeInfo?: {
    distance: number; // km
    duration: number; // minutes
  } | null;
  placement?: 'left' | 'right'; // NEW: Sidebar placement
  width?: number; // NEW: Custom width in pixels
  useFlexLayout?: boolean; // NEW: Use flex layout instead of fixed positioning
}

const POI_CONFIG = {
  speed_camera: { icon: Camera, color: '#FF0000', label: 'Speed Camera' },
  mobile_camera: { icon: Camera, color: '#FF0000', label: 'Mobile Camera' },
  mobile_radar_prediction: { icon: AlertTriangle, color: '#FF9900', label: 'Possible Radar' },
  traffic_camera: { icon: Video, color: '#FFFF00', label: 'Traffic Camera' },
  parking: { icon: ParkingCircle, color: '#0099FF', label: 'Parking' },
  gas_station: { icon: Fuel, color: '#FF9900', label: 'Gas Station' },
  service_area: { icon: Fuel, color: '#00FF00', label: 'Service Area' },
  accident: { icon: AlertTriangle, color: '#FF0000', label: 'Accident' },
  truck_park: { icon: ParkingCircle, color: '#00FF00', label: 'Truck Parking' }
};

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    // Show meters for distances < 1km
    const meters = Math.round(distanceKm * 1000);
    return new Intl.NumberFormat('pt-PT', { 
      style: 'unit', 
      unit: 'meter', 
      maximumFractionDigits: 0 
    }).format(meters);
  } else {
    // Show km with 1 decimal (European format: 3,7 km)
    return new Intl.NumberFormat('pt-PT', { 
      style: 'unit', 
      unit: 'kilometer', 
      maximumFractionDigits: 1 
    }).format(distanceKm);
  }
}

export function TimelineSidebar({ pois, currentSpeed, routeInfo, placement = 'right', width, useFlexLayout = false }: TimelineSidebarProps) {
  // Limit to 5 nearest POIs within 25km
  const timelinePOIs = pois
    .filter(poi => poi.distance <= 25)
    .slice(0, 5);

  // Calculate ETA (Estimated Time of Arrival)
  const getETA = () => {
    if (!routeInfo) return null;
    const now = new Date();
    const etaMs = now.getTime() + (routeInfo.duration * 60 * 1000); // minutes to ms
    const eta = new Date(etaMs);
    return eta.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  // Always show sidebar, even if empty (with helpful message)

  // Build style object dynamically
  const sidebarStyle: React.CSSProperties = {
    position: useFlexLayout ? 'relative' : 'fixed',
    height: '100vh',
    width: width ? `${width}px` : undefined,
    background: 'rgba(0, 0, 0, 0.7)', // 70% transparency
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    zIndex: useFlexLayout ? 1 : 10,
    flexShrink: 0 // Prevent sidebar from shrinking in flex layout
  };

  // Add positioning only for fixed layout
  if (!useFlexLayout) {
    sidebarStyle.top = 0;
    if (placement === 'left') {
      sidebarStyle.left = 0;
    } else {
      sidebarStyle.right = 0;
    }
  }

  return (
    <div
      className="timeline-sidebar-responsive"
      style={sidebarStyle}
      data-testid="timeline-sidebar"
    >
      {/* ETA CARD - ESTILO TOMTOM */}
      {routeInfo && (
        <div
          data-testid="eta-card"
          style={{
            background: 'rgba(255, 0, 0, 0.3)', // Vermelho semi-transparente
            backdropFilter: 'blur(10px)',
            borderRadius: 12,
            padding: 12,
            border: '2px solid rgba(255, 0, 0, 0.6)',
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.4)'
          }}
        >
          {/* Hora de Chegada (ETA) */}
          <div
            data-testid="text-eta-time"
            className="eta-time-responsive"
            style={{
              fontWeight: 'bold',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)'
            }}
          >
            {getETA()}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.3)', margin: '8px 0' }} />

          {/* Distância e Tempo Restantes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              data-testid="text-remaining-distance"
              className="eta-distance-responsive"
              style={{
                fontWeight: '600',
                color: '#FFFFFF',
                textAlign: 'center',
                textShadow: '0 2px 6px rgba(0,0,0,0.8)'
              }}
            >
              {routeInfo.distance.toFixed(1)} km
            </div>
            <div
              data-testid="text-remaining-time"
              className="eta-duration-responsive"
              style={{
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.9)',
                textAlign: 'center',
                textShadow: '0 2px 6px rgba(0,0,0,0.8)'
              }}
            >
              {formatDuration(routeInfo.duration)}
            </div>
          </div>
        </div>
      )}

      {/* Empty State - No Route */}
      {!routeInfo && timelinePOIs.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
            <div
              style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: '500',
                lineHeight: 1.4
              }}
            >
              Define um destino para ver a rota
            </div>
          </div>
        </div>
      )}

      {/* Vertical Timeline Line */}
      {timelinePOIs.length > 0 && (
        <div
          style={{
            position: 'relative',
            flex: 1,
            paddingLeft: 32
          }}
        >
          {/* Central vertical line via ::before pseudo-element */}
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'rgba(255, 255, 255, 0.3)'
            }}
          />

          {/* POI Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
          {timelinePOIs.map((poi, index) => {
            const config = POI_CONFIG[poi.type];
            const Icon = config.icon;
            const isClosest = index === 0;

            return (
              <div
                key={poi.id}
                data-testid={`timeline-poi-${poi.id}`}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                {/* Connector Dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: -32,
                    width: isClosest ? 12 : 8,
                    height: isClosest ? 12 : 8,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: `2px solid ${config.color}`,
                    boxShadow: isClosest ? `0 0 12px ${config.color}` : 'none',
                    transition: 'all 0.3s'
                  }}
                />

                {/* Icon Badge */}
                <div
                  style={{
                    width: isClosest ? 44 : 40,
                    height: isClosest ? 44 : 40,
                    borderRadius: '50%',
                    background: config.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 16px ${config.color}`,
                    transform: isClosest ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.3s'
                  }}
                >
                  <Icon size={isClosest ? 24 : 20} color="#FFFFFF" strokeWidth={2.5} />
                </div>

                {/* Distance Label */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}
                >
                  <span
                    data-testid={`text-poi-distance-${poi.id}`}
                    style={{
                      fontSize: isClosest ? 18 : 16,
                      fontWeight: isClosest ? 'bold' : '600',
                      color: '#FFFFFF',
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                    }}
                  >
                    {formatDistance(poi.distance)}
                  </span>
                  
                  {/* Speed limit for cameras */}
                  {poi.speedLimit && (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontWeight: '500'
                      }}
                    >
                      {poi.speedLimit} km/h
                    </span>
                  )}

                  {/* Confidence for predictions */}
                  {poi.type === 'mobile_radar_prediction' && poi.confidence && (
                    <span
                      style={{
                        fontSize: 11,
                        color: '#FF9900',
                        fontWeight: '600'
                      }}
                    >
                      {Math.round(poi.confidence * 100)}% conf
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Bottom Helper Text */}
      {timelinePOIs.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center',
            paddingTop: 8,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          Next {timelinePOIs.length} POIs
        </div>
      )}
    </div>
  );
}
