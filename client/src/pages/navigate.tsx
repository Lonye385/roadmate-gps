import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Navigation, AlertTriangle, Zap, Flag } from "lucide-react";
import type { Trip } from "@shared/schema";

interface NavigateProps {
  userId: string;
}

export default function Navigate({ userId }: NavigateProps) {
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: activeTrip, isLoading } = useQuery<Trip | null>({
    queryKey: ["/api/trips/active", userId],
    enabled: !!userId
  });

  const { data: nearbyReports } = useQuery({
    queryKey: ["/api/reports/nearby"],
    queryFn: async () => {
      const response = await fetch("/api/reports/nearby?latitude=51.5074&longitude=-0.1278&radiusKm=50");
      return response.json();
    }
  });

  const startTripMutation = useMutation({
    mutationFn: async (data: { userId: string; startLocation: string; vehicleProfile: string }) => {
      const result = await apiRequest("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return result as any;
    },
    onSuccess: () => {
      toast({
        title: "Trip started!",
        description: "Safe travels! Earn XP as you drive.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/active", userId] });
      setStartLocation("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start trip",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const endTripMutation = useMutation({
    mutationFn: async (data: { id: string; endLocation: string; distance: number; duration: number }) => {
      const result = await apiRequest(`/api/trips/${data.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endLocation: data.endLocation,
          distance: data.distance,
          duration: data.duration
        })
      });
      return result as any;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Trip completed!",
        description: `You earned ${data.xpEarned} XP! Great job!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/active", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setEndLocation("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to end trip",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleStartTrip = () => {
    if (!startLocation.trim()) {
      toast({
        title: "Location required",
        description: "Please enter a starting location",
        variant: "destructive"
      });
      return;
    }

    startTripMutation.mutate({
      userId,
      startLocation: startLocation.trim(),
      vehicleProfile: "car"
    });
  };

  const handleEndTrip = () => {
    if (!activeTrip || !endLocation.trim()) {
      toast({
        title: "Location required",
        description: "Please enter an end location",
        variant: "destructive"
      });
      return;
    }

    const mockDistance = Math.floor(Math.random() * 500) + 50;
    const mockDuration = Math.floor(Math.random() * 300) + 30;

    endTripMutation.mutate({
      id: activeTrip.id,
      endLocation: endLocation.trim(),
      distance: mockDistance,
      duration: mockDuration
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading navigation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Navigation</h1>
          <p className="text-muted-foreground">Start your journey and earn rewards</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardContent className="p-6">
                <div 
                  className="aspect-video bg-muted rounded-md flex items-center justify-center mb-4"
                  data-testid="map-container"
                >
                  <div className="text-center">
                    <Navigation className="w-16 h-16 mx-auto mb-2 text-primary" />
                    <p className="text-muted-foreground">Map view (demo mode)</p>
                  </div>
                </div>

                {!activeTrip ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Starting Location</label>
                      <Input
                        value={startLocation}
                        onChange={(e) => setStartLocation(e.target.value)}
                        placeholder="e.g., London, UK"
                        data-testid="input-start-location"
                      />
                    </div>
                    <Button 
                      onClick={handleStartTrip} 
                      className="w-full"
                      disabled={startTripMutation.isPending}
                      data-testid="button-start-trip"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {startTripMutation.isPending ? "Starting..." : "Start Trip"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card className="bg-primary/10 border-primary">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="default">Active Trip</Badge>
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-bold text-lg">From: {activeTrip.startLocation}</p>
                        <p className="text-sm text-muted-foreground">
                          Started: {new Date(activeTrip.startedAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>

                    <div>
                      <label className="block text-sm font-medium mb-2">End Location</label>
                      <Input
                        value={endLocation}
                        onChange={(e) => setEndLocation(e.target.value)}
                        placeholder="e.g., Paris, France"
                        data-testid="input-end-location"
                      />
                    </div>
                    <Button 
                      onClick={handleEndTrip} 
                      className="w-full"
                      disabled={endTripMutation.isPending}
                      data-testid="button-end-trip"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      {endTripMutation.isPending ? "Finishing..." : "Finish Trip"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Nearby Alerts
                </h3>
                <div className="space-y-3">
                  {nearbyReports && nearbyReports.length > 0 ? (
                    nearbyReports.slice(0, 5).map((report: any) => (
                      <Card key={report.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-1 text-orange-500" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{report.type}</p>
                            <p className="text-xs text-muted-foreground">{report.location}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {report.upvotes}
                          </Badge>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No nearby alerts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
