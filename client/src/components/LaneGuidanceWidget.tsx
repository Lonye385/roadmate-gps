import { ChevronLeft, ArrowUp, ArrowUpRight, ArrowUpLeft, ChevronRight } from 'lucide-react';

interface Lane {
  valid: boolean;
  active: boolean;
  directions: string[];
}

interface LaneGuidanceProps {
  lanes: { count: number; lanes: Lane[] };
  distanceToTurn: number;
}

export function LaneGuidanceWidget({ lanes, distanceToTurn }: LaneGuidanceProps) {
  if (!lanes || lanes.count === 0) return null;

  // Map direction strings to icons
  const getDirectionIcon = (directions: string[]) => {
    // Use first direction if multiple (Geoapify sometimes returns ["through", "right"])
    const primaryDir = directions[0];
    
    switch (primaryDir) {
      case 'left':
      case 'sharp_left':
        return ChevronLeft;
      case 'slight_left':
        return ArrowUpLeft;
      case 'right':
      case 'sharp_right':
        return ChevronRight;
      case 'slight_right':
        return ArrowUpRight;
      case 'through':
      case 'straight':
      default:
        return ArrowUp;
    }
  };

  return (
    <div className="mt-2 flex flex-col items-center gap-2 px-4" data-testid="lane-guidance-widget">
      {/* Distance to turn */}
      <div className="text-sm font-medium text-white/80">
        {distanceToTurn < 1000 
          ? `${Math.round(distanceToTurn)}m` 
          : `${(distanceToTurn / 1000).toFixed(1)}km`}
      </div>

      {/* Lane arrows */}
      <div className="flex items-end gap-2 pb-2">
        {lanes.lanes.map((lane, index) => {
          const Icon = getDirectionIcon(lane.directions);
          
          return (
            <div
              key={index}
              className={`flex flex-col items-center transition-all duration-300 ${
                lane.active ? 'scale-110' : 'scale-100'
              }`}
              data-testid={`lane-arrow-${index}`}
            >
              {/* Arrow Icon */}
              <div
                className={`flex items-center justify-center rounded-lg p-2 transition-all duration-300 ${
                  lane.active
                    ? 'bg-[#00FFFF]/30 shadow-[0_0_20px_#00FFFF]' // Neon cyan highlight
                    : lane.valid
                    ? 'bg-white/20'
                    : 'bg-red-500/20 opacity-50'
                }`}
                style={{
                  boxShadow: lane.active ? '0 0 20px rgba(0, 255, 255, 0.6)' : 'none',
                }}
              >
                <Icon
                  size={24}
                  className={
                    lane.active
                      ? 'text-[#00FFFF] drop-shadow-[0_0_8px_#00FFFF]' // Neon cyan glow
                      : lane.valid
                      ? 'text-white'
                      : 'text-red-300'
                  }
                  strokeWidth={2.5}
                />
              </div>

              {/* Checkmark for recommended lane */}
              {lane.active && (
                <div className="mt-1 text-[#00FFFF] text-xs font-bold" data-testid="lane-checkmark">
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint text */}
      <div className="text-xs text-white/60 text-center">
        Use highlighted lane
      </div>
    </div>
  );
}
