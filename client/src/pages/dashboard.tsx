import { useRoute, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Home, User, Trophy, AlertTriangle, Navigation as NavigationIcon, LogOut } from "lucide-react";
import Navigate from "./navigate";
import Profile from "./profile";
import Leaderboard from "./leaderboard";
import Reports from "./reports";

export default function Dashboard() {
  const [, params] = useRoute("/dashboard/:userId/:section?");
  const [location, setLocation] = useLocation();
  const userId = params?.userId;
  const section = params?.section || "navigate";

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Invalid user ID</div>
      </div>
    );
  }

  const isNavigate = section === "navigate" || !section;
  const isProfile = section === "profile";
  const isLeaderboard = section === "leaderboard";
  const isReports = section === "reports";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const menuItems = [
    {
      title: "Navigate",
      icon: NavigationIcon,
      path: `/dashboard/${userId}/navigate`,
      active: isNavigate
    },
    {
      title: "Profile",
      icon: User,
      path: `/dashboard/${userId}/profile`,
      active: isProfile
    },
    {
      title: "Leaderboard",
      icon: Trophy,
      path: `/dashboard/${userId}/leaderboard`,
      active: isLeaderboard
    },
    {
      title: "Reports",
      icon: AlertTriangle,
      path: `/dashboard/${userId}/reports`,
      active: isReports
    }
  ];

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <div className="p-4">
                <h2 className="text-2xl font-bold text-primary">ROADMATE</h2>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        onClick={() => setLocation(item.path)}
                        isActive={item.active}
                        data-testid={`nav-${item.title.toLowerCase()}`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => setLocation("/")}
                      data-testid="nav-logout"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-2 p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-y-auto">
            {(isNavigate) && <Navigate userId={userId} />}
            {isProfile && <Profile userId={userId} />}
            {isLeaderboard && <Leaderboard />}
            {isReports && <Reports userId={userId} />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
