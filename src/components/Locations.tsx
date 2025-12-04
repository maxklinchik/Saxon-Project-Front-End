import React, { useState } from "react";

/**
 * Small local useLocalStorage helper
 */
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

/**
 * Locations page includes Locations manager and an editable Levels manager (L2).
 * Levels are stored under 'phhs_levels_v1'.
 */
export default function Locations() {
  const [locations, setLocations] = useLocalStorage<string[]>("phhs_locations_v1", [
    "Montvale Lanes",
    "Holiday Bowl Oakland",
    "Bowling City Hackensack",
  ]);
  const [levels, setLevels] = useLocalStorage<string[]>("phhs_levels_v1", ["Varsity", "JV", "Regular"]);
  const [newLoc, setNewLoc] = useState("");
  const [newLevel, setNewLevel] = useState("");

  function addLocation() {
    if (!newLoc.trim()) return;
    setLocations((s) => [...s, newLoc.trim()]);
    setNewLoc("");
  }
  function removeLocation(l: string) {
    if (!confirm(`Remove location "${l}"?`)) return;
    setLocations((s) => s.filter((x) => x !== l));
  }

  function addLevel() {
    if (!newLevel.trim()) return;
    setLevels((s) => [...s, newLevel.trim()]);
    setNewLevel("");
  }
  function removeLevel(l: string) {
    if (!confirm(`Remove level "${l}"?`)) return;
    setLevels((s) => s.filter((x) => x !== l));
  }

  return (
    <section>
      <h2 className="page-title">Locations & Levels</h2>

      <div className="panel">
        <div className="grid-2">
          <div>
            <h3 className="section-title">Locations</h3>
            <div className="form-row">
              <input placeholder="New location" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
              <button className="btn-primary" onClick={addLocation}>
                Add
              </button>
            </div>

            <ul className="muted">
              {locations.map((l) => (
                <li key={l}>
                  {l} <button className="danger" onClick={() => removeLocation(l)} style={{ marginLeft: 8 }}>Remove</button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="section-title">Levels (editable)</h3>
            <div className="form-row">
              <input placeholder="New level" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
              <button className="btn-primary" onClick={addLevel}>Add</button>
            </div>

            <ul className="muted">
              {levels.map((L) => (
                <li key={L}>
                  {L} <button className="danger" onClick={() => removeLevel(L)} style={{ marginLeft: 8 }}>Remove</button>
                </li>
              ))}
            </ul>

            <p className="muted" style={{ marginTop: 8 }}>
              Levels are editable here (L2). These values appear in the Games page level dropdown.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
