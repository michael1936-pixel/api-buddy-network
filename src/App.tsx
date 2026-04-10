import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import { MarketDataProvider } from "@/contexts/MarketDataContext";
import Index from "./pages/Index";
import Agents from "./pages/Agents";
import Pipeline from "./pages/Pipeline";
import Decisions from "./pages/Decisions";
import News from "./pages/News";
import Backtest from "./pages/Backtest";
import Learning from "./pages/Learning";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MarketDataProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/news" element={<News />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
        </MarketDataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
