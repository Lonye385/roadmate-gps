import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, MapPin, Award, Car, Calendar, Zap } from "lucide-react";
import type { User, Badge as BadgeType, UserBadge, Trip } from "@shared/schema";

interface ProfileProps {
  userId: string;
}

export default function Profile({ userId }: ProfileProps) {

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId
  });

  const { data: badges, isLoading: badgesLoading } = useQuery<BadgeType[]>({
    queryKey: ["/api/badges"]
  });

  const { data: userBadges, isLoading: userBadgesLoading } = useQuery<UserBadge[]>({
    queryKey: ["/api/user-badges", userId],
    enabled: !!userId
  });

  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips/user", userId],
    enabled: !!userId
  });

  if (userLoading || badgesLoading || userBadgesLoading || tripsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">User not found</div>
      </div>
    );
  }

  const xpToNextLevel = user.level * 1000;
  const xpProgress = (user.xp % 1000) / 1000 * 100;
  const unlockedBadgeIds = new Set(userBadges?.map(ub => ub.badgeId) || []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                <Avatar className="w-32 h-32 border-4 border-primary">
                  <AvatarFallback className="text-4xl" data-testid="avatar-fallback">
                    {user.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Badge 
                  className="absolute -top-2 -right-2 text-xl px-3 py-1"
                  data-testid="badge-level"
                >
                  {user.level}
                </Badge>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold mb-2" data-testid="text-username">
                  {user.username}
                </h1>
                {user.tagline && (
                  <p className="text-lg text-muted-foreground italic mb-4" data-testid="text-tagline">
                    {user.tagline}
                  </p>
                )}
                
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Level {user.level}</span>
                    <span>{user.xp} / {xpToNextLevel} XP</span>
                  </div>
                  <Progress value={xpProgress} className="h-6" data-testid="progress-xp" />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <Card className="p-4">
                    <div className="text-center">
                      <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold" data-testid="text-total-km">
                        {Math.round(user.totalKm)}
                      </div>
                      <div className="text-sm text-muted-foreground">KM Driven</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <Car className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold" data-testid="text-total-trips">
                        {user.totalTrips}
                      </div>
                      <div className="text-sm text-muted-foreground">Trips</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold" data-testid="text-countries-count">
                        {user.countriesVisited.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Countries</div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="badges" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="badges" data-testid="tab-badges">Badges</TabsTrigger>
            <TabsTrigger value="trips" data-testid="tab-trips">Trip History</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {badges?.map((badge) => {
                const isUnlocked = unlockedBadgeIds.has(badge.id);
                return (
                  <Card 
                    key={badge.id} 
                    className={`p-4 ${!isUnlocked ? 'opacity-40' : ''}`}
                    data-testid={`card-badge-${badge.id}`}
                  >
                    <div className="text-center">
                      <Award className="w-16 h-16 mx-auto mb-3 text-primary" />
                      <h3 className="font-bold text-sm mb-1">{badge.name}</h3>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      {isUnlocked && (
                        <Badge className="mt-2" variant="secondary">
                          +{badge.xpReward} XP
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="trips" className="mt-6">
            <div className="space-y-4">
              {trips && trips.length > 0 ? (
                trips.map((trip) => (
                  <Card key={trip.id} data-testid={`card-trip-${trip.id}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg mb-1">{trip.startLocation}</h3>
                          {trip.endLocation && (
                            <p className="text-muted-foreground">to {trip.endLocation}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {Math.round(trip.distance)} km
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(trip.startedAt).toLocaleDateString()}
                            </span>
                            {trip.xpEarned > 0 && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-4 h-4 text-primary" />
                                +{trip.xpEarned} XP
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={trip.isActive ? "default" : "secondary"}>
                          {trip.isActive ? "Active" : "Completed"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No trips yet. Start your first journey!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Countries Visited</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.countriesVisited.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {user.countriesVisited.map((country) => (
                        <Badge key={country} variant="secondary">
                          {country}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No countries visited yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Car className="w-12 h-12 text-primary" />
                    <div>
                      <p className="font-bold text-xl capitalize">{user.vehicleProfile}</p>
                      <p className="text-sm text-muted-foreground">Current vehicle type</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
