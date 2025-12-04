import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Players from "./components/Players";
import Games from "./components/Games";
import Stats from "./components/Stats";
import Locations from "./components/Locations";
import "./styling.css";

/**
  PHHS theme colors are in styling.css (black / orange / brown / gray / white)
  This App file wires the routes and the top navigation.
*/

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <h1 className="brand">PHHS Bowling</h1>
            <div className="subtitle">Roster · Games · Stats</div>
          </div>

          <nav className="main-nav">
            <Link to="/players">Players</Link>
            <Link to="/games">Games</Link>
            <Link to="/stats">Stats</Link>
            <Link to="/locations">Locations</Link>
          </nav>
        </header>

        <main className="main-container">
          <Routes>
            <Route path="/" element={<Players />} />
            <Route path="/players" element={<Players />} />
            <Route path="/games" element={<Games />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/locations" element={<Locations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
