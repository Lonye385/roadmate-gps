import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings, Volume2, Vibrate, MessageCircle, AlertTriangle } from 'lucide-react';

export interface RadarSettings {
  firstAlertDistance: number; // meters: 1000, 1500, or 2000
  closeAlertDistance: number; // meters: 150, 200, or 300
  speedMargin: number; // km/h over limit: 5, 10, or 15
  enableVibration: boolean;
  enableSound: boolean;
  enableVoice: boolean;
  showMobileRadars: boolean;
}

const DEFAULT_SETTINGS: RadarSettings = {
  firstAlertDistance: 1000,
  closeAlertDistance: 150,
  speedMargin: 10,
  enableVibration: true,
  enableSound: true,
  enableVoice: true,
  showMobileRadars: true,
};

const STORAGE_KEY = 'roadmate_radar_settings';

interface RadarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: RadarSettings) => void;
}

export function RadarSettingsModal({ isOpen, onClose, onSettingsChange }: RadarSettingsModalProps) {
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('[RADAR SETTINGS] Failed to load settings:', error);
    }
  }, []);

  // Save settings to localStorage and notify parent
  const saveSettings = (newSettings: RadarSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent('radarSettingsChanged', { detail: newSettings }));
      
      onSettingsChange?.(newSettings);
      console.log('[RADAR SETTINGS] ✅ Settings saved:', newSettings);
    } catch (error) {
      console.error('[RADAR SETTINGS] Failed to save settings:', error);
    }
  };

  const updateSetting = <K extends keyof RadarSettings>(key: K, value: RadarSettings[K]) => {
    saveSettings({ ...settings, [key]: value });
  };

  const resetToDefaults = () => {
    saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="radar-settings-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Radar Alert Settings
          </DialogTitle>
          <DialogDescription>
            Customize radar alerts, distances, and warnings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Alert Toggles */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/90">Alert Types</h3>
            
            <div className="flex items-center justify-between" data-testid="setting-sound">
              <Label htmlFor="sound" className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Sound Alerts
              </Label>
              <Switch
                id="sound"
                checked={settings.enableSound}
                onCheckedChange={(checked) => updateSetting('enableSound', checked)}
                data-testid="toggle-sound"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-vibration">
              <Label htmlFor="vibration" className="flex items-center gap-2">
                <Vibrate className="w-4 h-4" />
                Vibration
              </Label>
              <Switch
                id="vibration"
                checked={settings.enableVibration}
                onCheckedChange={(checked) => updateSetting('enableVibration', checked)}
                data-testid="toggle-vibration"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-voice">
              <Label htmlFor="voice" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Voice Announcements
              </Label>
              <Switch
                id="voice"
                checked={settings.enableVoice}
                onCheckedChange={(checked) => updateSetting('enableVoice', checked)}
                data-testid="toggle-voice"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-mobile-radars">
              <Label htmlFor="mobile" className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Mobile Radar Predictions
              </Label>
              <Switch
                id="mobile"
                checked={settings.showMobileRadars}
                onCheckedChange={(checked) => updateSetting('showMobileRadars', checked)}
                data-testid="toggle-mobile-radars"
              />
            </div>
          </div>

          {/* Distance Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/90">Alert Distances</h3>
            
            <div className="space-y-2" data-testid="setting-first-alert-distance">
              <Label>
                First Alert Distance: {settings.firstAlertDistance}m
              </Label>
              <Slider
                value={[settings.firstAlertDistance]}
                onValueChange={([value]) => updateSetting('firstAlertDistance', value)}
                min={1000}
                max={2000}
                step={500}
                className="w-full"
                data-testid="slider-first-alert"
              />
              <div className="flex justify-between text-xs text-white/50">
                <span>1000m</span>
                <span>1500m</span>
                <span>2000m</span>
              </div>
            </div>

            <div className="space-y-2" data-testid="setting-close-alert-distance">
              <Label>
                Close Alert Distance: {settings.closeAlertDistance}m
              </Label>
              <Slider
                value={[settings.closeAlertDistance]}
                onValueChange={([value]) => updateSetting('closeAlertDistance', value)}
                min={150}
                max={300}
                step={50}
                className="w-full"
                data-testid="slider-close-alert"
              />
              <div className="flex justify-between text-xs text-white/50">
                <span>150m</span>
                <span>200m</span>
                <span>250m</span>
                <span>300m</span>
              </div>
            </div>
          </div>

          {/* Speed Margin */}
          <div className="space-y-2" data-testid="setting-speed-margin">
            <h3 className="text-sm font-semibold text-white/90">Speed Tolerance</h3>
            <Label>
              Alert if exceeding limit by: +{settings.speedMargin} km/h
            </Label>
            <Slider
              value={[settings.speedMargin]}
              onValueChange={([value]) => updateSetting('speedMargin', value)}
              min={5}
              max={15}
              step={5}
              className="w-full"
              data-testid="slider-speed-margin"
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>+5 km/h</span>
              <span>+10 km/h</span>
              <span>+15 km/h</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
            >
              Reset to Defaults
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={onClose}
              data-testid="button-close-settings"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to load settings from localStorage
export function useRadarSettings(): RadarSettings {
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('[RADAR SETTINGS] Failed to load settings:', error);
    }

    // Listen for storage changes (if user changes settings in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue));
        } catch (error) {
          console.error('[RADAR SETTINGS] Failed to parse storage update:', error);
        }
      }
    };

    // Listen for custom event (same-tab updates)
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<RadarSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
        console.log('[RADAR SETTINGS] 🔄 Settings updated via custom event:', customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('radarSettingsChanged', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('radarSettingsChanged', handleCustomEvent);
    };
  }, []);

  return settings;
}
