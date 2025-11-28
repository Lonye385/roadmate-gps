import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import MobileApp from "@/pages/mobile-app";
import MobileAppMinimal from "@/pages/mobile-app-minimal";
import MobileAppUltra from "@/pages/mobile-app-ultra";
import MobileAppTest from "@/pages/mobile-app-test";
import MobileAppProgressive from "@/pages/mobile-app-progressive";
import LandscapeApp from "@/pages/landscape-app";
import SimpleMobile from "@/pages/simple-mobile";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/app" component={MobileAppTest} />
      <Route path="/app-simple" component={SimpleMobile} />
      <Route path="/app-minimal" component={MobileAppMinimal} />
      <Route path="/app-progressive" component={MobileAppProgressive} />
      <Route path="/app-test" component={MobileAppTest} />
      <Route path="/app-full" component={MobileApp} />
      <Route path="/app-landscape" component={LandscapeApp} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard/:userId/:section?" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
