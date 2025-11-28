/**
 * ROADMATE Multi-Language TTS System
 * Professional voice navigation using Web Speech API
 * Supports: Portuguese, Spanish, English, French, German, Italian
 */

export type SupportedLanguage = 'pt' | 'es' | 'en' | 'fr' | 'de' | 'it';

export type TTSMessageType = 
  | 'radar_ahead'
  | 'speed_limit_warning'
  | 'section_start'
  | 'section_end'
  | 'mobile_radar'
  | 'tunnel_radar'
  | 'police_ahead'
  | 'drone_detected'
  | 'helicopter_ahead'
  | 'accident_ahead'
  | 'traffic_jam'
  | 'arrived'
  | 'calculating_route'
  | 'gps_lost'
  | 'gps_recovered'
  | 'waypoint_reached'
  | 'turn_instruction'
  | 'continue_straight'
  | 'turn_left'
  | 'turn_right'
  | 'turn_sharp_left'
  | 'turn_sharp_right'
  | 'turn_slight_left'
  | 'turn_slight_right'
  | 'roundabout'
  | 'rerouting';

interface TTSMessage {
  type: TTSMessageType;
  data?: {
    distance?: number; // meters
    speedLimit?: number; // km/h
    location?: string;
  };
}

const phrases: Record<SupportedLanguage, Record<TTSMessageType, (data?: any) => string>> = {
  pt: {
    radar_ahead: (d) => d?.distance ? `Radar a ${Math.round(d.distance)} metros` : 'Radar à frente',
    speed_limit_warning: (d) => d?.speedLimit ? `Atenção! Limite ${d.speedLimit} quilómetros por hora` : 'Reduza a velocidade',
    section_start: () => 'Início de troço controlado',
    section_end: () => 'Fim de troço controlado',
    mobile_radar: () => 'Atenção! Possível radar móvel',
    tunnel_radar: () => 'Radar em túnel',
    police_ahead: () => 'Atenção! Controlo policial à frente',
    drone_detected: () => 'Atenção! Vigilância aérea por drone',
    helicopter_ahead: () => 'Atenção! Helicóptero policial na área',
    accident_ahead: (d) => d?.distance ? `Acidente a ${Math.round(d.distance)} metros` : 'Acidente à frente',
    traffic_jam: (d) => d?.distance ? `Trânsito lento a ${Math.round(d.distance)} metros` : 'Trânsito lento à frente',
    arrived: () => 'Chegou ao seu destino',
    calculating_route: () => 'Calculando rota',
    gps_lost: () => 'Sinal GPS perdido',
    gps_recovered: () => 'Sinal GPS recuperado',
    waypoint_reached: () => 'Ponto intermédio alcançado',
    turn_instruction: (d) => d?.instruction || 'Continue',
    continue_straight: (d) => d?.distance ? `Continue em frente por ${Math.round(d.distance)} metros` : 'Continue em frente',
    turn_left: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, vire à esquerda` : 'Vire à esquerda',
    turn_right: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, vire à direita` : 'Vire à direita',
    turn_sharp_left: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, vire acentuadamente à esquerda` : 'Vire acentuadamente à esquerda',
    turn_sharp_right: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, vire acentuadamente à direita` : 'Vire acentuadamente à direita',
    turn_slight_left: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, mantenha-se à esquerda` : 'Mantenha-se à esquerda',
    turn_slight_right: (d) => d?.distance ? `Em ${Math.round(d.distance)} metros, mantenha-se à direita` : 'Mantenha-se à direita',
    roundabout: (d) => d?.exit ? `Na rotunda, tome a ${d.exit}ª saída` : 'Entre na rotunda',
    rerouting: () => 'A recalcular rota',
  },
  es: {
    radar_ahead: (d) => d?.distance ? `Radar a ${Math.round(d.distance)} metros` : 'Radar adelante',
    speed_limit_warning: (d) => d?.speedLimit ? `¡Atención! Límite ${d.speedLimit} kilómetros por hora` : 'Reduzca la velocidad',
    section_start: () => 'Inicio de tramo controlado',
    section_end: () => 'Fin de tramo controlado',
    mobile_radar: () => '¡Atención! Posible radar móvil',
    tunnel_radar: () => 'Radar en túnel',
    police_ahead: () => '¡Atención! Control policial adelante',
    drone_detected: () => '¡Atención! Vigilancia aérea con dron',
    helicopter_ahead: () => '¡Atención! Helicóptero policial en la zona',
    accident_ahead: (d) => d?.distance ? `Accidente a ${Math.round(d.distance)} metros` : 'Accidente adelante',
    traffic_jam: (d) => d?.distance ? `Tráfico lento a ${Math.round(d.distance)} metros` : 'Tráfico lento adelante',
    arrived: () => 'Ha llegado a su destino',
    calculating_route: () => 'Calculando ruta',
    gps_lost: () => 'Señal GPS perdida',
    gps_recovered: () => 'Señal GPS recuperada',
    waypoint_reached: () => 'Punto intermedio alcanzado',
    turn_instruction: (d) => d?.instruction || 'Continúe',
    continue_straight: (d) => d?.distance ? `Continúe recto por ${Math.round(d.distance)} metros` : 'Continúe recto',
    turn_left: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, gire a la izquierda` : 'Gire a la izquierda',
    turn_right: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, gire a la derecha` : 'Gire a la derecha',
    turn_sharp_left: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, gire bruscamente a la izquierda` : 'Gire bruscamente a la izquierda',
    turn_sharp_right: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, gire bruscamente a la derecha` : 'Gire bruscamente a la derecha',
    turn_slight_left: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, manténgase a la izquierda` : 'Manténgase a la izquierda',
    turn_slight_right: (d) => d?.distance ? `En ${Math.round(d.distance)} metros, manténgase a la derecha` : 'Manténgase a la derecha',
    roundabout: (d) => d?.exit ? `En la rotonda, tome la ${d.exit}ª salida` : 'Entre en la rotonda',
    rerouting: () => 'Recalculando ruta',
  },
  en: {
    radar_ahead: (d) => d?.distance ? `Speed camera in ${Math.round(d.distance)} meters` : 'Speed camera ahead',
    speed_limit_warning: (d) => d?.speedLimit ? `Attention! Speed limit ${d.speedLimit} kilometers per hour` : 'Reduce speed',
    section_start: () => 'Section control start',
    section_end: () => 'Section control end',
    mobile_radar: () => 'Attention! Possible mobile speed camera',
    tunnel_radar: () => 'Speed camera in tunnel',
    police_ahead: () => 'Attention! Police control ahead',
    drone_detected: () => 'Attention! Aerial surveillance drone',
    helicopter_ahead: () => 'Attention! Police helicopter in area',
    accident_ahead: (d) => d?.distance ? `Accident in ${Math.round(d.distance)} meters` : 'Accident ahead',
    traffic_jam: (d) => d?.distance ? `Traffic jam in ${Math.round(d.distance)} meters` : 'Traffic jam ahead',
    arrived: () => 'You have arrived at your destination',
    calculating_route: () => 'Calculating route',
    gps_lost: () => 'GPS signal lost',
    gps_recovered: () => 'GPS signal recovered',
    waypoint_reached: () => 'Waypoint reached',
    turn_instruction: (d) => d?.instruction || 'Continue',
    continue_straight: (d) => d?.distance ? `Continue straight for ${Math.round(d.distance)} meters` : 'Continue straight',
    turn_left: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, turn left` : 'Turn left',
    turn_right: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, turn right` : 'Turn right',
    turn_sharp_left: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, turn sharp left` : 'Turn sharp left',
    turn_sharp_right: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, turn sharp right` : 'Turn sharp right',
    turn_slight_left: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, keep left` : 'Keep left',
    turn_slight_right: (d) => d?.distance ? `In ${Math.round(d.distance)} meters, keep right` : 'Keep right',
    roundabout: (d) => d?.exit ? `At the roundabout, take the ${d.exit} exit` : 'Enter the roundabout',
    rerouting: () => 'Recalculating route',
  },
  fr: {
    radar_ahead: (d) => d?.distance ? `Radar à ${Math.round(d.distance)} mètres` : 'Radar devant',
    speed_limit_warning: (d) => d?.speedLimit ? `Attention! Limite ${d.speedLimit} kilomètres par heure` : 'Réduisez la vitesse',
    section_start: () => 'Début de tronçon contrôlé',
    section_end: () => 'Fin de tronçon contrôlé',
    mobile_radar: () => 'Attention! Radar mobile possible',
    tunnel_radar: () => 'Radar dans tunnel',
    police_ahead: () => 'Attention! Contrôle policier devant',
    drone_detected: () => 'Attention! Surveillance aérienne par drone',
    helicopter_ahead: () => 'Attention! Hélicoptère policier dans la zone',
    accident_ahead: (d) => d?.distance ? `Accident à ${Math.round(d.distance)} mètres` : 'Accident devant',
    traffic_jam: (d) => d?.distance ? `Embouteillage à ${Math.round(d.distance)} mètres` : 'Embouteillage devant',
    arrived: () => 'Vous êtes arrivé à destination',
    calculating_route: () => 'Calcul de l\'itinéraire',
    gps_lost: () => 'Signal GPS perdu',
    gps_recovered: () => 'Signal GPS récupéré',
    waypoint_reached: () => 'Point intermédiaire atteint',
    turn_instruction: (d) => d?.instruction || 'Continuez',
    continue_straight: (d) => d?.distance ? `Continuez tout droit pendant ${Math.round(d.distance)} mètres` : 'Continuez tout droit',
    turn_left: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, tournez à gauche` : 'Tournez à gauche',
    turn_right: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, tournez à droite` : 'Tournez à droite',
    turn_sharp_left: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, tournez fortement à gauche` : 'Tournez fortement à gauche',
    turn_sharp_right: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, tournez fortement à droite` : 'Tournez fortement à droite',
    turn_slight_left: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, restez à gauche` : 'Restez à gauche',
    turn_slight_right: (d) => d?.distance ? `Dans ${Math.round(d.distance)} mètres, restez à droite` : 'Restez à droite',
    roundabout: (d) => d?.exit ? `Au rond-point, prenez la ${d.exit}ème sortie` : 'Entrez dans le rond-point',
    rerouting: () => 'Recalcul de l\'itinéraire',
  },
  de: {
    radar_ahead: (d) => d?.distance ? `Blitzer in ${Math.round(d.distance)} Metern` : 'Blitzer voraus',
    speed_limit_warning: (d) => d?.speedLimit ? `Achtung! Tempolimit ${d.speedLimit} Kilometer pro Stunde` : 'Geschwindigkeit reduzieren',
    section_start: () => 'Beginn der Streckenüberwachung',
    section_end: () => 'Ende der Streckenüberwachung',
    mobile_radar: () => 'Achtung! Möglicher mobiler Blitzer',
    tunnel_radar: () => 'Blitzer im Tunnel',
    police_ahead: () => 'Achtung! Polizeikontrolle voraus',
    drone_detected: () => 'Achtung! Luftüberwachung durch Drohne',
    helicopter_ahead: () => 'Achtung! Polizeihubschrauber in der Nähe',
    accident_ahead: (d) => d?.distance ? `Unfall in ${Math.round(d.distance)} Metern` : 'Unfall voraus',
    traffic_jam: (d) => d?.distance ? `Stau in ${Math.round(d.distance)} Metern` : 'Stau voraus',
    arrived: () => 'Sie haben Ihr Ziel erreicht',
    calculating_route: () => 'Route wird berechnet',
    gps_lost: () => 'GPS-Signal verloren',
    gps_recovered: () => 'GPS-Signal wiederhergestellt',
    waypoint_reached: () => 'Zwischenpunkt erreicht',
    turn_instruction: (d) => d?.instruction || 'Weiterfahren',
    continue_straight: (d) => d?.distance ? `Fahren Sie ${Math.round(d.distance)} Meter geradeaus` : 'Fahren Sie geradeaus',
    turn_left: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern links abbiegen` : 'Links abbiegen',
    turn_right: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern rechts abbiegen` : 'Rechts abbiegen',
    turn_sharp_left: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern scharf links abbiegen` : 'Scharf links abbiegen',
    turn_sharp_right: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern scharf rechts abbiegen` : 'Scharf rechts abbiegen',
    turn_slight_left: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern links halten` : 'Links halten',
    turn_slight_right: (d) => d?.distance ? `In ${Math.round(d.distance)} Metern rechts halten` : 'Rechts halten',
    roundabout: (d) => d?.exit ? `Im Kreisverkehr die ${d.exit}. Ausfahrt nehmen` : 'In den Kreisverkehr einfahren',
    rerouting: () => 'Route wird neu berechnet',
  },
  it: {
    radar_ahead: (d) => d?.distance ? `Autovelox a ${Math.round(d.distance)} metri` : 'Autovelox avanti',
    speed_limit_warning: (d) => d?.speedLimit ? `Attenzione! Limite ${d.speedLimit} chilometri all'ora` : 'Ridurre la velocità',
    section_start: () => 'Inizio tratto controllato',
    section_end: () => 'Fine tratto controllato',
    mobile_radar: () => 'Attenzione! Possibile autovelox mobile',
    tunnel_radar: () => 'Autovelox in galleria',
    police_ahead: () => 'Attenzione! Controllo della polizia avanti',
    drone_detected: () => 'Attenzione! Sorveglianza aerea con drone',
    helicopter_ahead: () => 'Attenzione! Elicottero della polizia nella zona',
    accident_ahead: (d) => d?.distance ? `Incidente a ${Math.round(d.distance)} metri` : 'Incidente avanti',
    traffic_jam: (d) => d?.distance ? `Traffico lento a ${Math.round(d.distance)} metri` : 'Traffico lento avanti',
    arrived: () => 'Sei arrivato a destinazione',
    calculating_route: () => 'Calcolo del percorso',
    gps_lost: () => 'Segnale GPS perso',
    gps_recovered: () => 'Segnale GPS recuperato',
    waypoint_reached: () => 'Punto intermedio raggiunto',
    turn_instruction: (d) => d?.instruction || 'Continua',
    continue_straight: (d) => d?.distance ? `Continua dritto per ${Math.round(d.distance)} metri` : 'Continua dritto',
    turn_left: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, svolta a sinistra` : 'Svolta a sinistra',
    turn_right: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, svolta a destra` : 'Svolta a destra',
    turn_sharp_left: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, svolta nettamente a sinistra` : 'Svolta nettamente a sinistra',
    turn_sharp_right: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, svolta nettamente a destra` : 'Svolta nettamente a destra',
    turn_slight_left: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, mantieni la sinistra` : 'Mantieni la sinistra',
    turn_slight_right: (d) => d?.distance ? `Tra ${Math.round(d.distance)} metri, mantieni la destra` : 'Mantieni la destra',
    roundabout: (d) => d?.exit ? `Alla rotonda, prendi la ${d.exit}ª uscita` : 'Entra nella rotonda',
    rerouting: () => 'Ricalcolo del percorso',
  },
};

class TTSSystem {
  private synthesis: SpeechSynthesis | null = null;
  private language: SupportedLanguage = 'en';
  private enabled: boolean = true;
  private rate: number = 1.0; // Normal speed
  private pitch: number = 1.0; // Normal pitch
  private volume: number = 1.0; // Full volume

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  /**
   * Set TTS language
   */
  setLanguage(lang: SupportedLanguage) {
    this.language = lang;
  }

  /**
   * Enable/disable TTS
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.synthesis) {
      this.synthesis.cancel(); // Stop current speech
    }
  }

  /**
   * Set speech rate (0.1 - 2.0)
   */
  setRate(rate: number) {
    this.rate = Math.max(0.1, Math.min(2.0, rate));
  }

  /**
   * Set speech pitch (0.0 - 2.0)
   */
  setPitch(pitch: number) {
    this.pitch = Math.max(0.0, Math.min(2.0, pitch));
  }

  /**
   * Set speech volume (0.0 - 1.0)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0.0, Math.min(1.0, volume));
  }

  /**
   * Speak a message
   */
  speak(message: TTSMessage, urgent: boolean = false) {
    if (!this.synthesis || !this.enabled) return;

    const languagePhrases = phrases[this.language];
    const phraseGenerator = languagePhrases[message.type];
    
    if (!phraseGenerator) {
      console.warn(`No phrase found for message type: ${message.type}`);
      return;
    }

    const text = phraseGenerator(message.data);
    const utterance = new SpeechSynthesisUtterance(text);

    // Select voice based on language
    const voices = this.synthesis.getVoices();
    const languageMap: Record<SupportedLanguage, string[]> = {
      pt: ['pt-PT', 'pt-BR', 'pt'],
      es: ['es-ES', 'es-MX', 'es'],
      en: ['en-GB', 'en-US', 'en'],
      fr: ['fr-FR', 'fr-CA', 'fr'],
      de: ['de-DE', 'de-AT', 'de'],
      it: ['it-IT', 'it'],
    };

    const preferredLanguages = languageMap[this.language];
    const voice = voices.find(v => 
      preferredLanguages.some(lang => v.lang.startsWith(lang))
    );

    if (voice) {
      utterance.voice = voice;
    }

    // Urgent messages: faster rate, higher pitch
    utterance.rate = urgent ? Math.min(this.rate * 1.2, 2.0) : this.rate;
    utterance.pitch = urgent ? Math.min(this.pitch * 1.1, 2.0) : this.pitch;
    utterance.volume = this.volume;
    utterance.lang = preferredLanguages[0];

    // Cancel current speech if urgent
    if (urgent) {
      this.synthesis.cancel();
    }

    this.synthesis.speak(utterance);
  }

  /**
   * Stop current speech
   */
  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking || false;
  }
}

// Singleton instance
export const ttsSystem = new TTSSystem();
