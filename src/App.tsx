import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
// Un SEUL fournisseur de thème, monté au-dessus de tout : il ne produit aucun
// élément d'interface et ne pose aucun attribut global — il publie seulement
// la préférence enregistrée. La salle de réunion, qui ne consomme pas ce
// contexte et n'utilise que la palette `meet-*`, n'en est pas affectée. C'est
// ce qui évite que l'administration et l'espace mathématique aient chacun
// leur réglage et finissent par diverger.
import { ThemeProvider } from "./context/ThemeContext";
import { RequireAuth } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/Room";
import { EmbedRoomPage } from "./pages/EmbedRoom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import { NotFound } from "./pages/NotFound";
import { MathSpace } from "./pages/MathSpace";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { RequireRole } from "./pages/admin/RequireRole";
import { OverviewView } from "./pages/admin/views/Overview";
import { MeetingsView } from "./pages/admin/views/Meetings";
import { HistoryView } from "./pages/admin/views/History";
import { UsersView } from "./pages/admin/views/Users";
import { ApplicationsView } from "./pages/admin/views/Applications";
import { SettingsView } from "./pages/admin/views/Settings";
import { MathSpaceView } from "./pages/admin/views/MathSpace";

// Landing page component - we'll create this
import { LandingPage } from "./pages/LandingPage";

export function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/embed/room/:roomId" element={<EmbedRoomPage />} />

        <Route
          path="/*"
          element={
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Navigate to="/dashboard" replace />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/room/:roomId"
                  element={
                    <RequireAuth>
                      <RoomPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/room/:roomId/math"
                  element={
                    <RequireAuth>
                      <MathSpace />
                    </RequireAuth>
                  }
                />

                {/* Espace d'administration */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Home />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/admin"
                  element={
                    <RequireAuth>
                      <AdminLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<OverviewView />} />
                  <Route path="meetings" element={<MeetingsView />} />
                  <Route path="history" element={<HistoryView />} />
                  <Route path="users" element={<UsersView />} />
                  <Route
                    path="applications"
                    element={
                      <RequireRole role="ADMIN">
                        <ApplicationsView />
                      </RequireRole>
                    }
                  />
                  <Route path="mathspace" element={<MathSpaceView />} />
                  <Route path="settings" element={<SettingsView />} />
                </Route>

                {/* Redirect old /settings to new location */}
                <Route
                  path="/settings"
                  element={<Navigate to="/dashboard/settings" replace />}
                />

                {/* Fourre-tout — DOIT RESTER EN DERNIER. React Router classe
                    `*` en tout dernier recours : aucune route déclarée
                    ci-dessus ne peut donc être interceptée, y compris les
                    routes protégées et `/room/:roomId` (une salle inexistante
                    reste traitée par `RoomPage`, pas ici).

                    Volontairement HORS de `RequireAuth` : une personne
                    déconnectée qui suit un lien mort doit voir la 404, pas
                    être renvoyée à l'écran de connexion. C'est aussi ce qui
                    lui donne accès à `useAuth` pour choisir la destination de
                    son second bouton.

                    Effet de bord assumé et validé : `/settings` redirige vers
                    `/dashboard/settings`, qui n'existe pas. Ce chemin rendait
                    une page blanche ; il rend désormais la 404. */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}