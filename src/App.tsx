import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Login from "./pages/Login";
import Multitracks from "./pages/Multitracks";
import MultitrackForm from "./pages/MultitrackForm";
import Escalas from "./pages/Escalas";
import Equipes from "./pages/Equipes";
import EquipeForm from "./pages/EquipeForm";
import Usuarios from "./pages/Usuarios";
import UsuarioForm from "./pages/UsuarioForm";
import Logs from "./pages/Logs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/multitracks" replace />} />
              <Route path="/multitracks" element={<Multitracks />} />
              <Route
                path="/multitracks/novo"
                element={
                  <ProtectedRoute allowedRoles={['dm', 'admin']}>
                    <MultitrackForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/multitracks/:id/editar"
                element={
                  <ProtectedRoute allowedRoles={['dm', 'admin']}>
                    <MultitrackForm />
                  </ProtectedRoute>
                }
              />
              <Route path="/escalas" element={<Escalas />} />
              <Route path="/equipes" element={<Equipes />} />
              <Route
                path="/equipes/nova"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <EquipeForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/equipes/:id/editar"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <EquipeForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Usuarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios/novo"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsuarioForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios/:id/editar"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsuarioForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Logs />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
