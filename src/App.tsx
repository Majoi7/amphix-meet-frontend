import { Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/Room";
import { EmbedRoomPage } from "./pages/EmbedRoom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";

export function App() {
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
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}