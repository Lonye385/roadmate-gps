import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, MapPin, Car } from "lucide-react";
import type { User } from "@shared/schema";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useQuery<User[]>({
    queryKey: ["/api/leaderboard"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading leaderboard...</div>
      </div>
    );
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-12 h-12 text-yellow-500" />;
    if (index === 1) return <Medal className="w-10 h-10 text-gray-400" />;
    if (index === 2) return <Award className="w-10 h-10 text-amber-700" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Leaderboard</h1>
          <p className="text-xl text-muted-foreground">
            Top drivers conquering Europe's roads
          </p>
        </div>

        <div className="space-y-4">
          {leaderboard?.map((user, index) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;

            return (
              <Card 
                key={user.id} 
                className={`${isTopThree ? 'ring-2 ring-primary' : ''}`}
                data-testid={`card-rank-${rank}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center justify-center w-16">
                      {getRankIcon(index) || (
                        <span className="text-3xl font-bold text-muted-foreground">
                          #{rank}
                        </span>
                      )}
                    </div>

                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="text-xl">
                        {user.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold" data-testid={`text-username-${rank}`}>
                          {user.username}
                        </h3>
                        <Badge data-testid={`badge-level-${rank}`}>
                          Level {user.level}
                        </Badge>
                      </div>
                      {user.tagline && (
                        <p className="text-sm text-muted-foreground italic mb-2">
                          {user.tagline}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {Math.round(user.totalKm)} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Car className="w-4 h-4" />
                          {user.totalTrips} trips
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          {user.countriesVisited.length} countries
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary" data-testid={`text-xp-${rank}`}>
                        {user.xp}
                      </div>
                      <div className="text-sm text-muted-foreground">XP</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!leaderboard || leaderboard.length === 0) && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-xl text-muted-foreground">
                  No rankings yet. Be the first to hit the road!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
