import { readFileSync } from 'fs';
import { storage } from './storage';
import type { InsertSpeedCamera } from '@shared/schema';

export async function importTomTomCameras(): Promise<void> {
  try {
    console.log('📡 Loading Unified Speed Camera Database...');
    
    // Try unified database first (TomTom + SCDB merged without duplicates)
    let jsonPath = 'attached_assets/unified_cameras.json';
    let fallbackToTomTom = false;
    
    try {
      readFileSync(jsonPath, 'utf-8');
    } catch {
      console.warn('⚠️  Unified database not found, falling back to TomTom only');
      jsonPath = 'attached_assets/tomtom_cameras.json';
      fallbackToTomTom = true;
    }
    
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    
    // Handle both unified format {cameras: [], metadata: {}} and legacy array format
    const data = jsonData.cameras || jsonData;
    const metadata = jsonData.metadata;
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️  No cameras found in database');
      return;
    }
    
    if (metadata) {
      console.log(`📚 Database version: ${metadata.version || 'unknown'}`);
      console.log(`📊 Sources: ${Object.keys(metadata.sources || {}).join(', ')}`);
      console.log(`🔄 Duplicates removed: ${(metadata.duplicatesRemoved || 0).toLocaleString()}`);
    }
    
    // Optional: Filter by country for phased rollout
    const allowedCountries = process.env.SPEED_CAMERA_COUNTRIES?.split(',') || null;
    
    let camerasToImport: InsertSpeedCamera[] = data;
    
    if (allowedCountries) {
      camerasToImport = data.filter((cam: any) => 
        allowedCountries.includes(cam.country)
      );
      console.log(`🌍 Filtering cameras for countries: ${allowedCountries.join(', ')}`);
    }
    
    console.log(`📊 Total cameras to import: ${camerasToImport.length.toLocaleString()}`);
    
    const startTime = Date.now();
    const imported = await storage.batchImportSpeedCameras(camerasToImport);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const dbType = fallbackToTomTom ? 'TomTom' : 'Unified';
    console.log(`✅ ${dbType} import complete: ${imported.toLocaleString()} cameras in ${duration}s`);
    console.log(`📈 Average: ${(imported / parseFloat(duration)).toFixed(0)} cameras/sec`);
    
  } catch (error) {
    console.error('❌ Failed to import speed cameras:', error);
    // Don't crash server on import failure
  }
}
