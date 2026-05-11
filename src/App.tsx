import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index.tsx";
import RadarCliente from "./pages/RadarCliente.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Clientes from "./pages/Clientes.tsx";
import Orientacoes from "./pages/Orientacoes.tsx";
import Followups from "./pages/Followups.tsx";
import Agenda from "./pages/Agenda.tsx";
import RedefinirSenha from "./pages/RedefinirSenha.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/" element={<ProtectedLayout><Index /></ProtectedLayout>} />
            <Route path="/radar/:clienteId" element={<ProtectedLayout><RadarCliente /></ProtectedLayout>} />
            <Route path="/clientes" element={<ProtectedLayout><Clientes /></ProtectedLayout>} />
            <Route path="/orientacoes" element={<ProtectedLayout><Orientacoes /></ProtectedLayout>} />
            <Route path="/followups" element={<ProtectedLayout><Followups /></ProtectedLayout>} />
            <Route path="/agenda" element={<ProtectedLayout><Agenda /></ProtectedLayout>} />
            <Route path="/admin" element={<ProtectedLayout><Admin /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
