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
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Home />
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

                {/* Espace d'administration. Volontairement séparé de l'espace
                    personnel : ses données ne sont chargées qu'ici. Aucune
                    route de la réunion n'est touchée.

                    ── QUELLES VUES SONT RÉSERVÉES À L'ADMINISTRATEUR ──────

                    Le classement ci-dessous vient de ce que chaque vue LIT,
                    vérifié dans son code — pas de son nom de fichier. Une
                    vue « Utilisateurs » ou « Paramètres » peut très bien ne
                    montrer que des données personnelles, et c'est le cas.

                    Données personnelles de l'utilisateur connecté — garde
                    `RequireAuth` seule :

                      • Tableau de bord  `GET /meetings/mine` + `/bookings/mine`
                      • Réunions         `GET /meetings/mine`
                      • Historique       `GET /meetings/mine` + `/bookings/mine`
                      • Utilisateurs     le compte connecté, puis les personnes
                                         déduites de SES réservations ; aucun
                                         annuaire de la plateforme n'existe
                      • Paramètres       thème local + compte connecté
                      • Espace math.     rien : moteur local, historique en
                                         `localStorage`

                    Fonctionnalité à portée plateforme — garde `RequireRole` :

                      • Applications & API. C'est la seule dont le SUJET est
                        la plateforme : elle décrit l'accès serveur-à-serveur
                        (`POST /api/v1/integrations/amphix/sessions`), nomme
                        l'en-tête `X-Amphix-Secret` et la variable
                        d'environnement qui le porte, et énonce la politique
                        d'affichage des secrets.

                        Elle n'affiche AUCUNE donnée de plateforme, parce
                        qu'aucun modèle `ApiApplication` / `ApiKey` n'existe
                        et qu'aucun point d'entrée ne les liste. C'est
                        assumé : la garde ferme l'écran, et aucune API n'a
                        été inventée pour la justifier. L'API
                        d'administration n'existe pas — `requireRole` est
                        présent côté serveur mais n'est appelé par aucune
                        route —, donc cette garde est une règle d'AFFICHAGE,
                        pas une frontière de sécurité. Le dire vaut mieux que
                        de le laisser croire.

                    Aucun compte ne peut aujourd'hui obtenir le rôle ADMIN
                    par l'application : l'inscription publique le refuse et
                    il n'existe aucun chemin de promotion. La page
                    « Applications » n'est donc atteignable que par un
                    compte promu directement en base. */}
                <Route
                  path="/dashboard"
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

                {/* `/settings` était lié depuis l'espace personnel sans qu'aucune
                    route ne lui corresponde : un lien mort. Il mène désormais
                    aux paramètres de l'administration. Aucun autre fichier
                    n'est modifié pour cela. */}
                <Route
                  path="/settings"
                  element={<Navigate to="/dashboard/settings" replace />}
                />
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}