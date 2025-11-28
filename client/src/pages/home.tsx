import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Bike, Truck, Home as HomeIcon, Shield, AlertTriangle, MapPin, Zap, Trophy, Users, Star, Check, Navigation, Bell, Map, Route, Award, Globe, Play } from "lucide-react";
import heroImage from "@assets/generated_images/Highway_road_aerial_view_949085bd.png";
import phoneImage from "@assets/stock_images/modern_smartphone_wi_1d32eaa6.jpg";
import routeConfirmationCard from "@assets/ui/cards/route-confirmation.jpg";
import turnByTurnCard from "@assets/ui/cards/turn-by-turn.jpg";
import laneGuidanceWidget from "@assets/ui/widgets/lane-guidance.jpg";
import completeUIKit from "@assets/ui/screenshots/complete-ui-kit.jpg";

const vehicleProfiles = [
  { id: "car", name: "Car", icon: Car, desc: "Optimized routes" },
  { id: "motorcycle", name: "Bike", icon: Bike, desc: "Scenic roads" },
  { id: "truck", name: "Truck", icon: Truck, desc: "Heavy vehicle" },
  { id: "motorhome", name: "RV", icon: HomeIcon, desc: "Camper routes" },
  { id: "adr", name: "ADR", icon: Shield, desc: "Hazmat safe" },
  { id: "special", name: "Special", icon: AlertTriangle, desc: "Oversized" }
];

const features = [
  {
    icon: Navigation,
    title: "Smart Navigation",
    description: "Real-time traffic updates, intelligent route optimization, and turn-by-turn voice guidance.",
    benefit: "Save 30% on travel time"
  },
  {
    icon: Zap,
    title: "Earn While You Drive",
    description: "Get 10 XP per kilometer. Level up, unlock exclusive badges, and show off your achievements.",
    benefit: "+50K active drivers"
  },
  {
    icon: Bell,
    title: "Live Community Alerts",
    description: "Real-time warnings from drivers about traffic, accidents, hazards, and speed cameras.",
    benefit: "2M+ alerts shared daily"
  },
  {
    icon: Trophy,
    title: "Global Leaderboards",
    description: "Compete with drivers worldwide. Track your rank by distance, countries visited, and achievements.",
    benefit: "Top 1% get rewards"
  },
  {
    icon: Map,
    title: "Offline Maps",
    description: "Download maps for any country in Europe. Navigate confidently without internet connection.",
    benefit: "Works anywhere"
  },
  {
    icon: Award,
    title: "100+ Badges",
    description: "Unlock achievements for trips, distance milestones, countries visited, and special challenges.",
    benefit: "Collect them all"
  }
];

const testimonials = [
  {
    name: "Marco Silva",
    role: "Truck Driver",
    country: "Portugal",
    text: "Finally an app that rewards me for my daily routes. Already at level 28!",
    rating: 5
  },
  {
    name: "Anna Schmidt",
    role: "Road Trip Enthusiast",
    country: "Germany",
    text: "Visited 15 countries and unlocked so many badges. Love the gamification!",
    rating: 5
  },
  {
    name: "Jean Dupont",
    role: "Delivery Driver",
    country: "France",
    text: "Best navigation app for professionals. Real-time alerts saved me hours.",
    rating: 5
  }
];

const steps = [
  { number: "1", title: "Download & Register", desc: "Get started in 30 seconds" },
  { number: "2", title: "Choose Your Vehicle", desc: "Select from 6 profiles" },
  { number: "3", title: "Start Driving", desc: "Earn XP automatically" },
  { number: "4", title: "Level Up & Win", desc: "Unlock badges & rewards" }
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("car");

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="relative min-h-screen flex items-center"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(45, 91, 255, 0.95), rgba(0, 0, 0, 0.85)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />
        
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <Badge className="mb-6 px-6 py-3 text-base bg-white/20 border-white/40 backdrop-blur-md text-white">
                <Star className="w-4 h-4 mr-2 inline fill-yellow-400 text-yellow-400" />
                4.9/5 Rating · 50,000+ Downloads
              </Badge>

              <h1 className="text-6xl md:text-7xl font-extrabold mb-6 text-white leading-tight">
                Navigate.
                <br />
                Earn Rewards.
                <br />
                <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 bg-clip-text text-transparent">
                  Dominate Europe.
                </span>
              </h1>

              <p className="text-2xl mb-8 text-gray-200 leading-relaxed max-w-xl">
                The only navigation app that turns every kilometer into experience points. 
                Level up, unlock badges, and climb global leaderboards.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Button 
                  size="lg" 
                  onClick={() => {
                    // Smart redirect: Mobile → /app, Tablet → /app-landscape
                    const isPortrait = window.innerHeight > window.innerWidth;
                    const isSmallScreen = window.innerWidth < 768;
                    const isMobile = isPortrait || isSmallScreen;
                    setLocation(isMobile ? "/app" : "/app-landscape");
                  }}
                  className="text-xl px-10 py-8 shadow-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0"
                  data-testid="button-demo-app"
                >
                  <Navigation className="w-6 h-6 mr-2" />
                  🚗 Abrir GPS Navegação
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button 
                  size="lg" 
                  onClick={() => setLocation("/register")}
                  className="text-xl px-10 py-8 bg-white text-black hover:bg-gray-100 shadow-2xl font-bold"
                  data-testid="button-get-started-hero"
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start Free Now
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="text-xl px-10 py-8 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white border-2 border-white/40"
                  data-testid="button-login-hero"
                >
                  Sign In
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6 text-white">
                <div>
                  <div className="text-4xl font-bold mb-1">50K+</div>
                  <div className="text-sm text-gray-300">Active Drivers</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-1">2M+</div>
                  <div className="text-sm text-gray-300">KM Tracked</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-1">100%</div>
                  <div className="text-sm text-gray-300">Free Forever</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-pink-500/50 blur-3xl rounded-full" />
                <img 
                  src={phoneImage} 
                  alt="ROADMATE App Interface" 
                  className="relative w-80 h-auto rounded-3xl shadow-2xl transform hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-20 bg-background border-b border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Trusted by Drivers Across Europe</h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Join thousands of professional drivers and road trip enthusiasts
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-8 text-left hover-elevate">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg mb-4 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role} · {testimonial.country}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-base bg-primary/10 text-primary border-primary/20">
              <Zap className="w-4 h-4 mr-2 inline" />
              Powerful Features
            </Badge>
            <h2 className="text-5xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional navigation meets gaming mechanics
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 hover-elevate transition-all duration-300">
                <div className="bg-gradient-to-br from-primary/20 to-pink-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">{feature.description}</p>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  <Check className="w-3 h-3 mr-1" />
                  {feature.benefit}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 text-base bg-primary/10 text-primary border-primary/20">
              <MapPin className="w-4 h-4 mr-2 inline" />
              Professional GPS Interface
            </Badge>
            <h2 className="text-5xl font-bold mb-4">TomTom-Style Navigation</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Clean, intuitive UI designed for professional drivers
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
            <Card className="overflow-hidden hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] bg-black/90 flex items-center justify-center p-4">
                <img 
                  src={routeConfirmationCard} 
                  alt="Route Confirmation Card UI" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-bold mb-1">Route Card</h3>
                <p className="text-xs text-muted-foreground">Distance & ETA confirmation</p>
              </div>
            </Card>

            <Card className="overflow-hidden hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] bg-black/90 flex items-center justify-center p-4">
                <img 
                  src={turnByTurnCard} 
                  alt="Turn-by-Turn Navigation Card" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-bold mb-1">Turn-by-Turn</h3>
                <p className="text-xs text-muted-foreground">Real-time navigation guidance</p>
              </div>
            </Card>

            <Card className="overflow-hidden hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] bg-black/90 flex items-center justify-center p-4">
                <img 
                  src={laneGuidanceWidget} 
                  alt="Lane Guidance Widget" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-bold mb-1">Lane Assistant</h3>
                <p className="text-xs text-muted-foreground">Visual lane guidance</p>
              </div>
            </Card>

            <Card className="overflow-hidden hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] bg-black/90 flex items-center justify-center p-4">
                <img 
                  src={completeUIKit} 
                  alt="Complete GPS UI Kit" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-bold mb-1">Complete UI</h3>
                <p className="text-xs text-muted-foreground">Professional dashboard</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">6 Vehicle Profiles</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose your vehicle type for optimized routes and restrictions
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {vehicleProfiles.map((profile) => {
              const Icon = profile.icon;
              const isSelected = selectedVehicle === profile.id;
              
              return (
                <Card
                  key={profile.id}
                  className={`p-6 cursor-pointer transition-all duration-300 hover-elevate active-elevate-2 ${
                    isSelected ? 'ring-4 ring-primary shadow-2xl shadow-primary/20' : ''
                  }`}
                  onClick={() => setSelectedVehicle(profile.id)}
                  data-testid={`card-vehicle-${profile.id}`}
                >
                  <div className="text-center">
                    <Icon className={`w-12 h-12 mx-auto mb-3 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <h3 className="font-bold text-sm mb-1">{profile.name}</h3>
                    <p className="text-xs text-muted-foreground">{profile.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <div className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start earning rewards in 4 simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-white shadow-xl">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div 
        className="py-32 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(45, 91, 255, 0.95), rgba(0, 0, 0, 0.9)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-pink-500/30" />
        <div className="container relative z-10 mx-auto px-4 text-center text-white">
          <Globe className="w-20 h-20 mx-auto mb-6 text-white/80" />
          <h2 className="text-6xl font-bold mb-6">Ready to Start Your Journey?</h2>
          <p className="text-2xl mb-12 max-w-3xl mx-auto text-gray-200">
            Download ROADMATE now and turn every trip into an adventure. 
            It's 100% free, forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              size="lg" 
              onClick={() => setLocation("/register")}
              className="text-xl px-12 py-8 bg-white text-black hover:bg-gray-100 shadow-2xl font-bold"
              data-testid="button-join-now"
            >
              <Play className="w-6 h-6 mr-2" />
              Join 50,000+ Drivers
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation("/leaderboard")}
              className="text-xl px-12 py-8 bg-transparent backdrop-blur-md hover:bg-white/10 text-white border-2 border-white/50"
              data-testid="button-view-leaderboard"
            >
              <Trophy className="w-6 h-6 mr-2" />
              View Leaderboard
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                FREE
              </div>
              <div className="text-lg text-gray-300">No Credit Card</div>
            </div>
            <div className="p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent">
                0€
              </div>
              <div className="text-lg text-gray-300">Forever Free</div>
            </div>
            <div className="p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent">
                ∞
              </div>
              <div className="text-lg text-gray-300">Unlimited Trips</div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-card py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
                ROADMATE
              </div>
              <p className="text-sm text-muted-foreground">Navigate smarter. Drive rewarded.</p>
            </div>
            <div className="flex gap-6">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Privacy</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">Terms</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">Support</Button>
            </div>
          </div>
          <div className="text-center mt-8 text-sm text-muted-foreground">
            © 2025 ROADMATE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
