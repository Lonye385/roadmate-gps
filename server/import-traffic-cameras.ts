import { storage } from './storage';
import { type InsertTrafficCamera } from '@shared/schema';
import fs from 'fs/promises';
import path from 'path';

interface RawTrafficCamera {
  State: string;
  Road: string;
  Name: string;
  URL: string;
  Lat: number;
  Lon: number;
}

export async function importSpainTrafficCameras() {
  const startTime = Date.now();
  console.log('📡 Loading Spain Traffic Cameras Database...');
  
  try {
    const dataPath = path.resolve(process.cwd(), 'server/data/spain_traffic_cameras.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const rawCameras: RawTrafficCamera[] = JSON.parse(rawData);
    
    console.log(`📊 Total cameras to import: ${rawCameras.length}`);
    
    // Convert to our schema format and filter invalid coordinates
    const cameras: InsertTrafficCamera[] = rawCameras
      .filter((raw) => {
        // Filter out cameras with missing or invalid coordinates
        const lat = typeof raw.Lat === 'number' ? raw.Lat : parseFloat(String(raw.Lat));
        const lon = typeof raw.Lon === 'number' ? raw.Lon : parseFloat(String(raw.Lon));
        return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
      })
      .map((raw) => ({
        country: 'ES', // Spain
        state: raw.State,
        road: raw.Road,
        name: raw.Name,
        liveImageUrl: raw.URL,
        latitude: typeof raw.Lat === 'number' ? raw.Lat : parseFloat(String(raw.Lat)),
        longitude: typeof raw.Lon === 'number' ? raw.Lon : parseFloat(String(raw.Lon)),
      }));
    
    // Batch import
    const imported = await storage.batchImportTrafficCameras(cameras);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Spain traffic cameras import complete: ${imported} cameras in ${duration}s`);
    
    return imported;
  } catch (error) {
    console.error('❌ Error importing traffic cameras:', error);
    throw error;
  }
}
