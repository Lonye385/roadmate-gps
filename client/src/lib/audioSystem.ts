/**
 * ROADMATE Audio System
 * Professional procedural audio generation using Web Audio API
 * SUPERIOR to static WAV files: dynamic, customizable, no file loading
 */

interface BeepOptions {
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscillatorType;
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

interface AlertSoundConfig {
  type: 'fixed' | 'mobile' | 'section' | 'tunnel' | 'redlight' | 'variable' | 'drone' | 'helicopter' | 'police';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Web Audio API not supported:', error);
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.initAudioContext();
    }
    return this.audioContext;
  }

  /**
   * Generate a professional beep with ADSR envelope
   */
  playBeep(options: BeepOptions) {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain || this.isMuted) return;

    const {
      frequency,
      duration,
      volume = 0.3,
      type = 'sine',
      envelope = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 }
    } = options;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // ADSR Envelope
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + envelope.attack);
    gainNode.gain.linearRampToValueAtTime(volume * envelope.sustain, now + envelope.attack + envelope.decay);
    gainNode.gain.setValueAtTime(volume * envelope.sustain, now + duration - envelope.release);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  /**
   * Proximity beep - frequency increases as distance decreases
   */
  playProximityBeep(distanceMeters: number, speedLimitExceeded: boolean) {
    if (distanceMeters > 500) return; // Too far

    // Calculate urgency based on distance
    const urgency = Math.max(0, Math.min(1, 1 - (distanceMeters / 500)));
    const baseFrequency = speedLimitExceeded ? 1000 : 800;
    const frequency = baseFrequency + (urgency * 400);

    this.playBeep({
      frequency,
      duration: speedLimitExceeded ? 0.15 : 0.1,
      volume: 0.3 + (urgency * 0.3),
      type: 'square',
      envelope: {
        attack: 0.005,
        decay: 0.05,
        sustain: 0.8,
        release: 0.05
      }
    });
  }

  /**
   * Generate alert sound based on camera type and urgency
   */
  playAlertSound(config: AlertSoundConfig) {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain || this.isMuted) return;

    const soundPatterns = {
      fixed: this.generateFixedCameraSound.bind(this),
      mobile: this.generateMobileCameraSound.bind(this),
      section: this.generateSectionSound.bind(this),
      tunnel: this.generateTunnelSound.bind(this),
      redlight: this.generateRedlightSound.bind(this),
      variable: this.generateVariableSound.bind(this),
      drone: this.generateDroneSound.bind(this),
      helicopter: this.generateHelicopterSound.bind(this),
      police: this.generatePoliceSound.bind(this),
    };

    const generator = soundPatterns[config.type];
    if (generator) {
      generator(config.urgency);
    }
  }

  private generateFixedCameraSound(urgency: string) {
    // Single pure tone - fixed camera
    this.playBeep({
      frequency: 800,
      duration: 0.3,
      volume: 0.4,
      type: 'sine'
    });
  }

  private generateMobileCameraSound(urgency: string) {
    // Warbling sound - uncertain location
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8, ctx.currentTime);
    lfoGain.gain.setValueAtTime(50, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gainNode.gain.setValueAtTime(0.4, now + 0.5);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.7);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    lfo.start(now);
    oscillator.stop(now + 0.7);
    lfo.stop(now + 0.7);
  }

  private generateSectionSound(urgency: string) {
    // Rising tone sequence - section start
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playBeep({
          frequency: 600 + (i * 200),
          duration: 0.15,
          volume: 0.35,
          type: 'sine'
        });
      }, i * 200);
    }
  }

  private generateTunnelSound(urgency: string) {
    // Deep echo sound
    this.playBeep({
      frequency: 400,
      duration: 0.6,
      volume: 0.4,
      type: 'triangle',
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 0.3
      }
    });
  }

  private generateRedlightSound(urgency: string) {
    // Double beep pattern
    this.playBeep({ frequency: 900, duration: 0.1, volume: 0.4, type: 'square' });
    setTimeout(() => {
      this.playBeep({ frequency: 900, duration: 0.1, volume: 0.4, type: 'square' });
    }, 150);
  }

  private generateVariableSound(urgency: string) {
    // Sweeping frequency
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(500, now);
    oscillator.frequency.linearRampToValueAtTime(1200, now + 0.4);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gainNode.gain.setValueAtTime(0.35, now + 0.35);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }

  private generateDroneSound(urgency: string) {
    // High-pitched buzzing - aerial surveillance
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1400, ctx.currentTime);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(15, ctx.currentTime);
    lfoGain.gain.setValueAtTime(30, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gainNode.gain.setValueAtTime(0.25, now + 0.5);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.6);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    lfo.start(now);
    oscillator.stop(now + 0.6);
    lfo.stop(now + 0.6);
  }

  private generateHelicopterSound(urgency: string) {
    // Low pulsing - helicopter rotors
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playBeep({
          frequency: 200 + (i * 50),
          duration: 0.12,
          volume: 0.3 + (i * 0.05),
          type: 'sawtooth',
          envelope: {
            attack: 0.01,
            decay: 0.05,
            sustain: 0.6,
            release: 0.05
          }
        });
      }, i * 140);
    }
  }

  private generatePoliceSound(urgency: string) {
    // European-style siren
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.masterGain) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    const now = ctx.currentTime;
    
    // Wee-woo pattern
    oscillator.frequency.setValueAtTime(700, now);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.25);
    oscillator.frequency.setValueAtTime(900, now + 0.25);
    oscillator.frequency.linearRampToValueAtTime(700, now + 0.5);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.03);
    gainNode.gain.setValueAtTime(0.4, now + 0.47);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  /**
   * Play arrival sound
   */
  playArrivalSound() {
    // Pleasant ascending chime
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playBeep({
          frequency: freq,
          duration: 0.3,
          volume: 0.3,
          type: 'sine',
          envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.6,
            release: 0.2
          }
        });
      }, i * 200);
    });
  }

  /**
   * Play UI click sound
   */
  playClickSound() {
    this.playBeep({
      frequency: 1200,
      duration: 0.05,
      volume: 0.15,
      type: 'sine'
    });
  }

  /**
   * Mute/unmute system
   */
  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  /**
   * Set master volume
   */
  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioContext!.currentTime);
    }
  }
}

// Singleton instance
export const audioSystem = new AudioSystem();
