import React, { useMemo, useState } from "react";
import { Series, TeamKey, Player } from "../types";

/**
 * Local uid helper
 */
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

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
 * Games page:
 * - Create series rows (team/date/level/location) and assign each of three games a player + score.
 * - Saves series into localStorage as Series[] under key 'phhs_series_v1'
 *
 * Model A (frame/subs) is optional for future: current UI stores player per game and score per game.
 */

export default function Games() {
  const [playersMap] = useLocalStorage<Record<TeamKey, Player[]>>("phhs_rosters_v1", { boys: [], girls: [] });
  const [seriesList, setSeriesList] = useLocalStorage<Series[]>("phhs_series_v1", []);
  const [locations, setLocations] = useLocalStorage<string[]>("phhs_locations_v1", [
    "Montvale Lanes",
    "Holiday Bowl Oakland",
    "Bowling City Hackensack",
  ]);
  const [levels, setLevels] = useLocalStorage<string[]>("phhs_levels_v1", ["Varsity", "JV", "Regular"]);

  const [team, setTeam] = useState<TeamKey>("boys");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState(levels[0] || "Varsity");
  const [location, setLocation] = useState(locations[0] || "");
  const roster = playersMap[team] || [];

  // rows before saving as series
  type DraftRow = { id: string; players: [string | null, string | null, string | null]; scores: [number | null, number | null, number | null]; notes?: string };
  const [rows, setRows] = useState<DraftRow[]>([]);

  function addRow() {
    setRows((r) => [...r, { id: uid("r"), players: [null, null, null], scores: [null, null, null] }]);
  }

  function updateRow(rowId: string, gameIndex: number, payload: { playerId?: string | null; score?: number | null }) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const players = [...r.players] as [string | null, string | null, string | null];
        const scores = [...r.scores] as [number | null, number | null, number | null];
        if (payload.playerId !== undefined) players[gameIndex] = payload.playerId;
        if (payload.score !== undefined) scores[gameIndex] = payload.score;
        return { ...r, players, scores };
      })
    );
  }

  function removeRow(rowId: string) {
    setRows((rs) => rs.filter((r) => r.id !== rowId));
  }

  function saveRows() {
    const seriesToAdd: Series[] = rows.map((r) => {
      const games = r.players.map((pid, i) => ({ playerId: pid ?? null, score: r.scores[i] ?? null })) as Series["games"];
      return {
        id: uid("s"),
        date,
        level,
        location,
        team,
        games,
        notes: r.notes,
      };
    });
    setSeriesList((prev) => [...prev, ...seriesToAdd]);
    setRows([]);
  }

  const filteredSeries = useMemo(() => seriesList.filter((s) => s.team === team).sort((a, b) => b.date.localeCompare(a.date)), [seriesList, team]);

  function deleteSeries(id: string) {
    if (!confirm("Delete this series?")) return;
    setSeriesList((s) => s.filter((x) => x.id !== id));
  }

  // Quick edit modal (simple inline editor shown beneath list) - for readability we implement an inline editor rather than complicated modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCopy, setEditingCopy] = useState<Series | null>(null);

  function startEdit(s: Series) {
    setEditingId(s.id);
    setEditingCopy(JSON.parse(JSON.stringify(s)));
  }
  function applyEdit() {
    if (!editingCopy) return;
    setSeriesList((prev) => prev.map((x) => (x.id === editingCopy.id ? editingCopy : x)));
    setEditingId(null);
    setEditingCopy(null);
  }

  return (
    <section>
      <h2 className="page-title">Games</h2>

      <div className="panel">
        <div className="grid-2">
          <div>
            <h3 className="section-title">New series rows</h3>

            <div className="form-row">
              <label style={{ minWidth: 46 }}>Team:</label>
              <div>
                <button className={team === "boys" ? "tab active" : "tab"} onClick={() => setTeam("boys")}>
                  Boys
                </button>
                <button className={team === "girls" ? "tab active" : "tab"} onClick={() => setTeam("girls")}>
                  Girls
                </button>
              </div>
            </div>

            <div className="form-row">
              <label style={{ minWidth: 46 }}>Date:</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="form-row">
              <label style={{ minWidth: 46 }}>Level:</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {levels.map((L) => (
                  <option key={L} value={L}>
                    {L}
                  </option>
                ))}
              </select>

              <label style={{ marginLeft: 12, minWidth: 70 }}>Location:</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <button className="btn-primary" onClick={addRow}>
                Add series row
              </button>
              <button className="btn-primary" style={{ marginLeft: 8 }} onClick={saveRows}>
                Save rows
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              {rows.length === 0 && <div className="muted">No draft rows. Click "Add series row" to start.</div>}
              {rows.map((r) => (
                <div key={r.id} className="series-row">
                  <div className="muted">Draft: {r.id.slice(0, 6)}</div>
                  <div className="series-games">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="series-game">
                        <select value={r.players[i] ?? ""} onChange={(e) => updateRow(r.id, i, { playerId: e.target.value || null })}>
                          <option value="">--player--</option>
                          {roster.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.firstName} {p.lastName}
                            </option>
                          ))}
                        </select>
                        <input
                          className="tiny"
                          type="number"
                          value={r.scores[i] ?? ""}
                          onChange={(e) => updateRow(r.id, i, { score: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="score"
                        />
                      </div>
                    ))}
                    <button className="danger" onClick={() => removeRow(r.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="section-title">Saved series ({team})</h3>

            <div className="table-scroll">
              <table className="striped">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Level</th>
                    <th>G1</th>
                    <th>G2</th>
                    <th>G3</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSeries.map((s) => (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td>{s.location}</td>
                      <td>{s.level}</td>
                      {s.games.map((g, i) => {
                        const p = (playersMap[s.team] || []).find((pl) => pl.id === g.playerId) as Player | undefined;
                        return <td key={i}>{p ? `${p.firstName} ${p.lastName} (${g.score ?? "-"})` : `- (${g.score ?? "-"})`}</td>;
                      })}
                      <td>
                        <button onClick={() => startEdit(s)}>Edit</button>
                        <button className="danger" onClick={() => deleteSeries(s.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingId && editingCopy && (
              <div className="panel" style={{ marginTop: 12 }}>
                <h4>Edit series</h4>
                <div className="form-row">
                  <label>Date</label>
                  <input value={editingCopy.date} onChange={(e) => setEditingCopy({ ...editingCopy, date: e.target.value })} type="date" />
                  <label style={{ marginLeft: 8 }}>Location</label>
                  <select value={editingCopy.location} onChange={(e) => setEditingCopy({ ...editingCopy, location: e.target.value })}>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <label style={{ marginLeft: 8 }}>Level</label>
                  <select value={editingCopy.level} onChange={(e) => setEditingCopy({ ...editingCopy, level: e.target.value })}>
                    {levels.map((L) => (
                      <option key={L} value={L}>
                        {L}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 8 }}>
                  {editingCopy.games.map((g, idx) => (
                    <div key={idx} className="form-row">
                      <label style={{ minWidth: 46 }}>G{idx + 1}</label>
                      <select
                        value={g.playerId ?? ""}
                        onChange={(e) => {
                          const copy = { ...editingCopy } as Series;
                          copy.games[idx].playerId = e.target.value || null;
                          setEditingCopy(copy);
                        }}
                      >
                        <option value="">--player--</option>
                        {(playersMap[editingCopy.team] || []).map((p: Player) => (
                          <option key={p.id} value={p.id}>
                            {p.firstName} {p.lastName}
                          </option>
                        ))}
                      </select>

                      <input
                        className="tiny"
                        type="number"
                        value={editingCopy.games[idx].score ?? ""}
                        onChange={(e) => {
                          const copy = { ...editingCopy } as Series;
                          copy.games[idx].score = e.target.value === "" ? null : Number(e.target.value);
                          setEditingCopy(copy);
                        }}
                        placeholder="score"
                      />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <button className="btn-primary" onClick={applyEdit}>
                    Save edits
                  </button>
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setEditingId(null);
                      setEditingCopy(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
