import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { SWRConfig } from "swr";
import "@fontsource/dotgothic16";
import "@fontsource/klee-one/600.css";
import "@fontsource/pacifico";
import "./index.css";
import AdminPage from "./AdminPage.tsx";
import MapPage from "./MapPage.tsx";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </SWRConfig>
  </StrictMode>,
);
