import React, { useMemo, useState } from "react";
import { Player, Rank, TeamKey } from "../types";

/**
 * Simple local uid (no external dependency).
 */
const uid = (n = "id") => `${n}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * tiny useLocalStorage hook (self-contained)
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

const RANKS: Rank[] = ["Varsity", "JV", "Regular"];

export default function Players() {
  // stored as map: { boys: Player[], girls: Player[] }
  const [rosters, setRosters] = useLocalStorage<Record<TeamKey, Player[]>>(
    "phhs_rosters_v1",
    { boys: [], girls: [] }
  );

  const [team, setTeam] = useState<TeamKey>("boys");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [rank, setRank] = useState<Rank>("Regular");

  const roster = rosters[team] || [];

  function addPlayer() {
    if (!firstName.trim() || !lastName.trim()) return alert("Enter first + last name");
    const p: Player = {
      id: uid("p"),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      number: number.trim() || undefined,
      team,
      rank,
    };
    setRosters((prev) => ({ ...prev, [team]: [...prev[team], p] }));
    setFirstName("");
    setLastName("");
    setNumber("");
    setRank("Regular");
  }

  function removePlayer(id: string) {
    if (!confirm("Remove player?")) return;
    setRosters((prev) => ({ ...prev, [team]: prev[team].filter((p) => p.id !== id) }));
  }

  function updatePlayer(id: string, updates: Partial<Player>) {
    setRosters((prev) => ({
      ...prev,
      [team]: prev[team].map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }

  const sorted = useMemo(() => [...roster].sort((a, b) => a.lastName.localeCompare(b.lastName)), [roster]);

  return (
    <section>
      <h2 className="page-title">Players</h2>

      <div className="panel">
        <div className="tabs">
          <button className={team === "boys" ? "tab active" : "tab"} onClick={() => setTeam("boys")}>
            Boys
          </button>
          <button className={team === "girls" ? "tab active" : "tab"} onClick={() => setTeam("girls")}>
            Girls
          </button>
        </div>

        <div className="grid-2">
          <div>
            <h3 className="section-title">Add Player ({team})</h3>

            <div className="form-row">
              <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>

            <div className="form-row">
              <input placeholder="#" value={number} onChange={(e) => setNumber(e.target.value)} className="small" />
              <select value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row" style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={addPlayer}>
                Add player
              </button>
            </div>

            <p className="muted">Ranks are fixed: Varsity / JV / Regular. You can edit players on the right.</p>
          </div>

          <div>
            <h3 className="section-title">Roster</h3>
            <div className="roster-list">
              {sorted.map((p) => (
                <RosterRow key={p.id} p={p} onRemove={() => removePlayer(p.id)} onSave={(u) => updatePlayer(p.id, u)} />
              ))}
              {sorted.length === 0 && <div className="muted">No players yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RosterRow({ p, onRemove, onSave }: { p: Player; onRemove: () => void; onSave: (u: Partial<Player>) => void }) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(p.firstName);
  const [last, setLast] = useState(p.lastName);
  const [num, setNum] = useState(p.number || "");
  const [rank, setRank] = useState<Rank>(p.rank);

  function save() {
    onSave({ firstName: first.trim(), lastName: last.trim(), number: num.trim() || undefined, rank });
    setEditing(false);
  }

  return (
    <div className="roster-row">
      {editing ? (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            <input className="small" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="small" value={last} onChange={(e) => setLast(e.target.value)} />
            <input className="tiny" value={num} onChange={(e) => setNum(e.target.value)} />
            <select value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
              <option>Varsity</option>
              <option>JV</option>
              <option>Regular</option>
            </select>
          </div>
          <div className="row-actions">
            <button onClick={save} className="btn-primary small">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="danger small">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="name">
              {p.firstName} {p.lastName} <span className="muted">#{p.number ?? "-"}</span>
            </div>
            <div className="muted brown">{p.rank}</div>
          </div>

          <div className="row-actions">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={onRemove} className="danger">
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
