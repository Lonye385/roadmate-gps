import { GoogleGenAI } from "@google/genai";
import type { Request } from "express";

// Gemini AI Service for ROADMATE
// Uses Replit AI Integrations (no external API key needed)
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

export interface DrivingContext {
  currentLocation?: { lat: number; lon: number };
  speed?: number;
  vehicleType?: string;
  destination?: string;
  nearbyRadars?: number;
  userXP?: number;
  userId?: string;
  firstName?: string;
  lastName?: string;
}

export interface AIResponse {
  text: string;
  action?: {
    type: 'navigate' | 'search_poi' | 'report' | 'leaderboard' | 'info' | 'none';
    data?: any;
  };
  speak?: boolean;
}

export class GeminiAssistant {
  async processCommand(userInput: string, context: DrivingContext): Promise<AIResponse> {
    try {
      const prompt = this.buildPrompt(userInput, context);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          maxOutputTokens: 512, // Concise responses for driving
          temperature: 0.7,
        }
      });

      const aiText = response.text || "Desculpe, não entendi.";
      
      // Parse action from response
      const action = this.extractAction(aiText, userInput);
      
      return {
        text: aiText,
        action,
        speak: true
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      return {
        text: "Desculpe, ocorreu um erro. Tente novamente.",
        action: { type: 'none' },
        speak: true
      };
    }
  }

  private buildPrompt(userInput: string, context: DrivingContext): string {
    const locationStr = context.currentLocation 
      ? `${context.currentLocation.lat.toFixed(4)}, ${context.currentLocation.lon.toFixed(4)}`
      : 'desconhecida';
    
    const userName = context.firstName 
      ? `${context.firstName} ${context.lastName || ''}`
      : 'Condutor';

    return `Você é o assistente de navegação ROADMATE para condutores profissionais em Portugal/Europa.

CONTEXTO ATUAL:
- Utilizador: ${userName}
- Localização: ${locationStr}
- Velocidade: ${context.speed || 0} km/h
- Veículo: ${context.vehicleType || 'Carro'}
- Destino atual: ${context.destination || 'nenhum'}
- Radares próximos: ${context.nearbyRadars || 0}
- XP total: ${context.userXP || 0} pontos

COMANDO DO UTILIZADOR: "${userInput}"

INSTRUÇÕES:
1. Responda em PORTUGUÊS de Portugal (PT-PT)
2. Seja CONCISO (máximo 2 frases curtas) - o utilizador está a conduzir!
3. Se for navegação, inclua [NAVEGAR: destino] no início
4. Se for pesquisa POI, inclua [PESQUISAR: categoria] no início
5. Se for report, inclua [REPORTAR: tipo] no início
6. Se for info/leaderboard, inclua [INFO: tipo] no início
7. Use linguagem natural e amigável

EXEMPLOS:
"leva-me ao posto de gasolina mais próximo" → [PESQUISAR: gas_station] A procurar posto de gasolina próximo.
"há radares na rota?" → Há ${context.nearbyRadars} radares nos próximos 15 km. Atenção!
"qual a minha posição no leaderboard?" → [INFO: leaderboard] A consultar a tua classificação.
"reporta acidente aqui" → [REPORTAR: accident] Acidente reportado. Obrigado!

RESPOSTA:`;
  }

  private extractAction(aiText: string, userInput: string): AIResponse['action'] {
    const lowerText = aiText.toLowerCase();
    const lowerInput = userInput.toLowerCase();

    // Navigation
    if (lowerText.includes('[navegar:') || lowerInput.includes('navega') || lowerInput.includes('leva-me') || lowerInput.includes('rota para')) {
      const match = aiText.match(/\[NAVEGAR:\s*([^\]]+)\]/i);
      const destination = match ? match[1].trim() : userInput.replace(/(navega|leva-me|rota para|ir para)/gi, '').trim();
      return { type: 'navigate', data: { destination } };
    }

    // Search POI
    if (lowerText.includes('[pesquisar:') || lowerInput.includes('procura') || lowerInput.includes('encontra') || lowerInput.includes('onde')) {
      const match = aiText.match(/\[PESQUISAR:\s*([^\]]+)\]/i);
      const category = match ? match[1].trim() : this.extractPOICategory(userInput);
      return { type: 'search_poi', data: { category } };
    }

    // Report
    if (lowerText.includes('[reportar:') || lowerInput.includes('reporta') || lowerInput.includes('report')) {
      const match = aiText.match(/\[REPORTAR:\s*([^\]]+)\]/i);
      const reportType = match ? match[1].trim() : this.extractReportType(userInput);
      return { type: 'report', data: { reportType } };
    }

    // Info/Leaderboard
    if (lowerText.includes('[info:') || lowerInput.includes('leaderboard') || lowerInput.includes('classificação') || lowerInput.includes('posição')) {
      const match = aiText.match(/\[INFO:\s*([^\]]+)\]/i);
      const infoType = match ? match[1].trim() : 'leaderboard';
      return { type: 'info', data: { infoType } };
    }

    return { type: 'none' };
  }

  private extractPOICategory(input: string): string {
    const categories: Record<string, string> = {
      'gasolina': 'gas_station',
      'combustível': 'gas_station',
      'posto': 'gas_station',
      'café': 'cafe',
      'restaurante': 'restaurant',
      'comida': 'restaurant',
      'estacionamento': 'parking',
      'parque': 'parking',
      'truckpark': 'truck_parking',
      'camiões': 'truck_parking',
      'hospital': 'hospital',
      'farmácia': 'pharmacy',
    };

    for (const [keyword, category] of Object.entries(categories)) {
      if (input.toLowerCase().includes(keyword)) {
        return category;
      }
    }

    return 'generic';
  }

  private extractReportType(input: string): string {
    const types: Record<string, string> = {
      'acidente': 'accident',
      'polícia': 'police',
      'radar': 'mobile_camera',
      'câmara': 'mobile_camera',
      'trânsito': 'traffic_jam',
      'engarrafamento': 'traffic_jam',
      'drone': 'drone',
      'helicóptero': 'helicopter',
      'perigo': 'hazard',
    };

    for (const [keyword, type] of Object.entries(types)) {
      if (input.toLowerCase().includes(keyword)) {
        return type;
      }
    }

    return 'hazard';
  }

}

export const geminiAssistant = new GeminiAssistant();
