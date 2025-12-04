import React, { useMemo, useState } from "react";
import { TeamKey } from "../types";

/**
 * A small local useLocalStorage hook (duplicate to keep file set small)
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
 * Stats util: Because Model A is optional/future, the app currently attributes single-game scores
 * to the player assigned for that particular game. This compute function calculates:
 * - avg (per single game bowled)
 * - total wood
 * - g1, g2, g3 averages
 */
function computePlayerAggregates(players: any[], seriesList: any[]) {
  const map: Record<string, any> = {};
  players.forEach((p) => {
    map[p.id] = { player: p, total: 0, g1sum: 0, g2sum: 0, g3sum: 0, g1count: 0, g2count: 0, g3count: 0, games: 0 };
  });

  seriesList.forEach((s) => {
    s.games.forEach((g: any, idx: number) => {
      if (!g.playerId || g.score == null) return;
      const ent = map[g.playerId];
      if (!ent) return;
      ent.total += g.score;
      ent.games += 1;
      if (idx === 0) {
        ent.g1sum += g.score;
        ent.g1count++;
      }
      if (idx === 1) {
        ent.g2sum += g.score;
        ent.g2count++;
      }
      if (idx === 2) {
        ent.g3sum += g.score;
        ent.g3count++;
      }
    });
  });

  return Object.values(map).map((m: any) => {
    const g1avg = m.g1count ? Math.round(m.g1sum / m.g1count) : 0;
    const g2avg = m.g2count ? Math.round(m.g2sum / m.g2count) : 0;
    const g3avg = m.g3count ? Math.round(m.g3sum / m.g3count) : 0;
    const avg = m.games ? Math.round(m.total / m.games) : 0;
    return { player: m.player, totalWood: m.total, g1avg, g2avg, g3avg, avg, games: m.games };
  });
}

export default function Stats() {
  const [playersMap] = useLocalStorage<Record<TeamKey, any[]>>("phhs_rosters_v1", { boys: [], girls: [] });
  const [seriesList] = useLocalStorage<any[]>("phhs_series_v1", []);
  const [team, setTeam] = useState<TeamKey>("boys");
  const [sortBy, setSortBy] = useState<"avg" | "totalWood" | "g1avg" | "g2avg" | "g3avg">("avg");

  const players = playersMap[team] || [];

  const rows = useMemo(() => {
    const computed = computePlayerAggregates(players, seriesList);
    computed.sort((a: any, b: any) => {
      if (sortBy === "avg") return b.avg - a.avg;
      if (sortBy === "totalWood") return b.totalWood - a.totalWood;
      if (sortBy === "g1avg") return b.g1avg - a.g1avg;
      if (sortBy === "g2avg") return b.g2avg - a.g2avg;
      if (sortBy === "g3avg") return b.g3avg - a.g3avg;
      return 0;
    });
    return computed;
  }, [players, seriesList, sortBy, team]);

  return (
    <section>
      <h2 className="page-title">Stats</h2>
      <div className="panel">
        <div className="tabs">
          <button className={team === "boys" ? "tab active" : "tab"} onClick={() => setTeam("boys")}>
            Boys
          </button>
          <button className={team === "girls" ? "tab active" : "tab"} onClick={() => setTeam("girls")}>
            Girls
          </button>
        </div>

        <div className="form-row">
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="avg">Average</option>
            <option value="totalWood">Total wood</option>
            <option value="g1avg">Game 1</option>
            <option value="g2avg">Game 2</option>
            <option value="g3avg">Game 3</option>
          </select>
        </div>

        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="striped">
            <thead>
              <tr>
                <th>Player</th>
                <th>Avg</th>
                <th>Total Wood</th>
                <th>G1 Avg</th>
                <th>G2 Avg</th>
                <th>G3 Avg</th>
                <th>Games</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.player.id}>
                  <td>
                    {r.player.firstName} {r.player.lastName}
                  </td>
                  <td>{r.avg}</td>
                  <td>{r.totalWood}</td>
                  <td>{r.g1avg}</td>
                  <td>{r.g2avg}</td>
                  <td>{r.g3avg}</td>
                  <td>{r.games}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
