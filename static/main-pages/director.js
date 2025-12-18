(function(){
  const API_ROOT = '';
  let currentTeam = 'boys';
  const tokenKey = 'bowling_token';

  function authHeaders(){
    const t = localStorage.getItem(tokenKey) || document.getElementById('tokenInput').value.trim();
    return t ? { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async function fetchPlayers(){
    const res = await fetch(API_ROOT + '/api/players?team=' + currentTeam);
    const players = await res.json();
    renderPlayers(players);
    renderQuick(players);
    fetchRecentScores(players);
  }

  async function fetchRecentScores(players){
    const ids = players.map(p => Number(p.id));
    try {
      const res = await fetch(API_ROOT + '/api/scores');
      const all = await res.json();
      const recent = all.filter(s => ids.includes(Number(s.player_id))).sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0,12);
      renderRecentScores(recent, players);
    } catch (err) { console.warn('Could not load scores', err); }
  }

  function renderRecentScores(scores, players){
    const el = document.getElementById('recentScores'); el.innerHTML = '';
    if (!scores || scores.length === 0) { el.innerHTML = '<div class="small">No recent scores</div>'; return; }
    scores.forEach(s => {
      const p = players.find(x => Number(x.id) === Number(s.player_id));
      const div = document.createElement('div'); div.className = 'small';
      div.textContent = `${s.date} — ${p ? p.name : 'Player ' + s.player_id}: [${(s.scores||[]).join(', ')}] avg:${s.avg} total:${s.totalWood}`;
      el.appendChild(div);
    });
  }

  function renderPlayers(players){
    const el = document.getElementById('playersList'); el.innerHTML = '';
    players.forEach(p => {
      const row = document.createElement('div'); row.className = 'player-row';
      row.innerHTML = `<div style="flex:1">${p.name} <div class="small">ID: ${p.id}</div></div>`;
      el.appendChild(row);
    });
  }

  function renderQuick(players){
    const el = document.getElementById('quickList'); el.innerHTML = '';
    players.forEach(p => {
      const row = document.createElement('div'); row.className = 'player-row';
      row.innerHTML = `<div style="flex:1">${p.name}</div>
        <input class="score" data-player="${p.id}" placeholder="G1" inputmode="numeric" />
        <input class="score" data-player="${p.id}" placeholder="G2" inputmode="numeric" />
        <input class="score" data-player="${p.id}" placeholder="G3" inputmode="numeric" />
        <input class="small-input" data-player-spares="${p.id}" placeholder="Spares" inputmode="numeric" />
        <input class="small-input" data-player-strikes="${p.id}" placeholder="Strikes" inputmode="numeric" />
        <input class="small-input" data-player-sub="${p.id}" placeholder="Sub For (id)" inputmode="numeric" />
        <button class="saveScore btn" data-player="${p.id}">Save</button>`;
      el.appendChild(row);
    });
    // attach handlers
    el.querySelectorAll('.saveScore').forEach(btn => btn.addEventListener('click', saveScores));
  }

  async function saveScores(e){
    const id = e.currentTarget.dataset.player;
    const root = e.currentTarget.parentElement;
    const inputs = Array.from(root.querySelectorAll('input.score'));
    const scores = inputs.map(i => Number(i.value || 0));
    if (scores.some(s => isNaN(s) || s < 0 || s > 300)) { alert('Scores must be numbers between 0 and 300'); return; }
    const sparesInput = root.querySelector(`input[data-player-spares="${id}"]`);
    const strikesInput = root.querySelector(`input[data-player-strikes="${id}"]`);
    const subInput = root.querySelector(`input[data-player-sub="${id}"]`);
    const spares = sparesInput ? Number(sparesInput.value || 0) : 0;
    const strikes = strikesInput ? Number(strikesInput.value || 0) : 0;
    const substitute_for = subInput && subInput.value ? Number(subInput.value) : null;
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/3);
    const totalWood = scores.reduce((a,b)=>a+b,0);
    const payload = { player_id: Number(id), date: new Date().toISOString().slice(0,10), scores, location_id: null, spares, strikes, substitute_for, avg, totalWood };
    try {
      const res = await fetch(API_ROOT + '/api/scores', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d.message || 'Error saving'); return; }
      // show saved briefly and refresh recent scores
      const b = e.currentTarget;
      b.textContent = 'Saved'; b.disabled = true; setTimeout(()=>{ b.textContent = 'Save'; b.disabled = false; inputs.forEach(i=>i.value=''); if (sparesInput) sparesInput.value=''; if (strikesInput) strikesInput.value=''; if (subInput) subInput.value=''; fetchPlayers(); }, 900);
    } catch (err) { console.error(err); alert('Network error'); }
  }

  document.getElementById('team-boys').addEventListener('click', () => { currentTeam = 'boys'; fetchPlayers(); });
  document.getElementById('team-girls').addEventListener('click', () => { currentTeam = 'girls'; fetchPlayers(); });
  document.getElementById('saveToken').addEventListener('click', () => { const v = document.getElementById('tokenInput').value.trim(); if (v) { localStorage.setItem(tokenKey, v); alert('Token saved'); } });

  document.getElementById('addPlayerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('newPlayerName').value.trim();
    const team = document.getElementById('newPlayerTeam').value;
    if (!name) return alert('Name required');
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, team }) });
      const data = await res.json();
      if (!res.ok) return alert(data.message || 'Error creating player');
      document.getElementById('newPlayerName').value = '';
      fetchPlayers();
    } catch (err) { console.error(err); alert('Network error'); }
  });

  // initial load
  fetchPlayers();
})();
