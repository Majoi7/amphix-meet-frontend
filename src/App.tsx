import { Route, BrowserRouter, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/Room";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}
