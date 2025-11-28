# ROADMATE - Navigation & Gamification Platform

## Overview
ROADMATE is a professional GPS navigation application for Europe, combining TomTom-quality navigation with engaging gamification elements such as XP, badges, leveling up, and leaderboards. It supports multi-vehicle profiles, real-time trip tracking, community reports, and aims to enhance user loyalty and adoption across the European market. The project's vision is to offer a free, feature-rich navigation experience with a strong community focus.

## User Preferences
- **No Payment System**: User explicitly requested removal of Stripe. ROADMATE is a free navigation app with no payment features.
- **Development Workflow - Landscape-First Approach**: 
  - ✅ **Step 1**: Implement new features/fixes in `/app-landscape` (landscape-app.tsx) first
  - ✅ **Step 2**: Test thoroughly until everything works without errors
  - ✅ **Step 3**: Port the tested code to `/app` (mobile-app-test.tsx) 
  - **Rationale**: Landscape has more screen space and easier debugging. Once working there, mobile implementation becomes a tested copy-paste operation.
  - **Key Files**: 
    - Primary reference: `client/src/pages/landscape-app.tsx` 
    - Mobile target: `client/src/pages/mobile-app-test.tsx`
    - Shared components: `client/src/components/` (LaneGuidanceWidget, RadarSettingsModal, TimelineSidebar)

## System Architecture

### Core Features
- **Multi-Vehicle Profiles**: Supports various vehicle types (Car, Motorcycle, Truck, Motorhome, ADR, Special Transport).
- **Gamification System**: XP earning, level progression, badge achievements, and leaderboards based on distance driven.
- **Trip Tracking**: Functionality for starting, ending, and tracking trips, including distance and duration.
- **Community Features**: Allows users to report traffic alerts, hazards, verify speed cameras, and contribute to a truck parking system.
- **Professional Navigation**: Includes destination search with autocomplete, turn-by-turn navigation, real-time traffic, voice navigation, dark mode, PWA capabilities, waypoint management, and alternative route suggestions.
- **Unified Speed Camera Database**: Integrates a comprehensive European speed camera database with indexing and an alert system.
- **Mobile Robustness**: Ensures GPS functionality independent of map loading and provides enhanced radar alerts.
- **Anonymous User Presence System**: Displays Waze-style anonymous user markers with real-time updates and privacy features.
- **POI Sidebar (TomTom-style)**: Displays nearby Points of Interest (speed cameras, gas stations, truck parks) sorted by distance, with optimized loading.
- **Professional Audio System**: Utilizes Web Audio API for procedural beeps, proximity-based alerts, and mobile vibration patterns.
- **Multi-Language Voice Navigation (TTS)**: Web Speech API support for 6 languages with turn-by-turn instructions and urgent radar alerts.
- **Community Alert System**: One-tap reporting for various alert types with intelligent expiry and anonymous reporting.
- **Radarbot-Style Interface**: Full-featured GPS navigation UI with a turn-by-turn card, speedometer, radar warning cards, floating controls, and a thick blue route line.
- **Lane Guidance Widget**: Visual lane assistant integrated with Geoapify for recommended lanes and distance countdown.
- **Radar Settings Modal**: User-configurable radar alert preferences (distance thresholds, speed margin, alert types) with localStorage persistence.
- **Mobile Radar Predictions**: Implementation of Radarbot-style mobile radar forecasting with distinct map markers, alerts, and user control.

### Technical Stack
- **Frontend**: React, TypeScript, Vite
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon-backed) with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Storage**: PostgreSQL for user data, cameras, and trips.

### UI/UX Decisions
- **Design System**: Based on `design_guidelines.md` with specific typography and a primary blue color, utilizing shadcn/ui.
- **Mobile PWA**: Mobile-first responsive design with a dedicated `/app` route for GPS navigation, featuring a TomTom/Radarbot-style dashboard.
  - **Mobile Layout Architecture** (November 2024 Refactor):
    - **Flex-Row Container**: Main layout uses `display: flex; flexDirection: 'row'` (inline styles, NOT Tailwind classes to avoid Babel parser issues)
    - **Ultra-Thin Left Sidebar**: 70px vertical POI timeline on LEFT side (TimelineSidebar with `placement="left"`, `width={70}`, `useFlexLayout={true}`)
    - **Flex-1 Map Area**: Main map/overlays in right column with `flex: 1` for remaining space
    - **Non-Overlapping Design**: Sidebar does NOT overlay the map (distinct from landscape's fixed positioning)
    - **Performance Optimization**: GPS movement guard with Haversine distance (>1m threshold) prevents infinite re-render loops
- **Landscape GPS App (Tablets Only)**: Professional horizontal tablet-style GPS interface at `/app-landscape` with:
  - **Smart Device Detection**: Auto-redirects telemóveis to `/app` (portrait mode), tablets remain in `/app-landscape` (landscape mode)
  - **Redirect Logic**: Portrait orientation OR screen <768px → `/app`, Landscape ≥768px → `/app-landscape`
  - **Responsive Design**: Auto-adapts for tablets Android (1024px, 768px+) with CSS media queries
  - **Sidebar Width Adaptation**: 200px (desktop) → 180px (tablets ≥768px) → 150px (small tablets)
  - **Font Size Scaling**: ETA time 32px → 28px → 24px, distances 18px → 16px → 14px
  - **Logo**: "ROAD◇MATE" azul neon, Azul Neon color system, TomTom-style timeline sidebar for POIs
  - **Layout**: Minimal floating controls, 3D map view (pitch 45°), distinct radar markers with pulsation
- **Visual Alerts**: Radar alerts feature pulsing red gradient cards, white icon circles, and bold typography.
- **Gamification UI**: Dynamic level system with progress bars, stats cards, badge sections, and a leaderboard.
- **UI Asset Library**: Professional GPS interface components generated with Gemini AI, including:
  - **Turn-by-Turn Cards**: Enhanced gradient backgrounds with lucide-react icons (ArrowUpRight, Compass)
  - **Route Confirmation Cards**: Professional multi-step journey visualization
  - **Lane Guidance Widget**: Visual lane assistant with recommended lanes
  - **Icon Libraries**: Speed camera, mobile radar, and POI icons (4 theme variants)
  - **Screenshot Gallery**: Featured on landing page showcasing GPS capabilities
  - **Asset Organization**: Structured in `attached_assets/ui/` (cards, widgets, icons, screenshots)
  - **Multi-Language Support**: All UI mockups text-free with transparent backgrounds

### System Design
- **API Endpoints**: Comprehensive API for authentication, user management, trips, badges, reports, speed cameras, truck parks, and user presence.
- **Data Model**: Drizzle schemas for Users, Trips, Badges, Reports, UserBadges, SpeedCameras, TrafficCameras, TruckParks, ParkUpdates, and Sessions.
- **Database Persistence**: Implemented for Users, Speed Cameras, Traffic Cameras, and Trips.
- **Performance**: Speed camera batch import with conflict handling and coordinate validation.
- **WebSocket Implementation**: Real-time communication for anonymous user presence tracking and deduplication.

## External Dependencies
- **Mapping**: OpenStreetMap (raster tiles)
- **Geocoding & Routing**: Geoapify (Geocoding and Routing API)
- **Speech Synthesis**: Web Speech API
- **GPS/Geolocation**: HTML5 Geolocation API
- **Speed Camera Data**: TomTom SCDB, SCDB TXT v2