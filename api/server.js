import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3000;

// Check required environment variables (warn but don't crash)
let supabase = null;
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn('WARNING: SUPABASE_SERVICE_KEY environment variable is not set!');
  console.warn('API endpoints requiring database will not work.');
} else {
  // Supabase client (server-side with service key)
  supabase = createClient(
    process.env.SUPABASE_URL || 'https://fxqddamrgadttkfxvjth.supabase.co',
    process.env.SUPABASE_SERVICE_KEY
  );
}

// CORS - allow GitHub Pages to call this API
app.use(cors({
  origin: [
    'https://arkokush.github.io',
    'https://maxklinchik.github.io',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5500',  // VS Code Live Server
    'http://localhost:5500'
  ],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== AUTH ENDPOINTS ====================

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: role || 'student'
      }]);

    if (profileError) throw profileError;

    res.json({ success: true, user: authData.user });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.json({ 
      success: true, 
      session: data.session,
      user: data.user 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Coach/Director Sign Up (generates unique coach code)
app.post('/api/auth/signup-coach', async (req, res) => {
  try {
    const { firstName, lastName, email, password, school } = req.body;
    
    if (!firstName || !lastName || !email || !password || !school) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Generate unique coach code (6 alphanumeric characters)
    const coachCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // Look up school_id (or use default for now)
    let schoolId = null;
    const { data: schoolData } = await supabase
      .from('schools')
      .select('id')
      .eq('name', school)
      .single();
    
    if (schoolData) {
      schoolId = schoolData.id;
    }

    // Create user profile with coach code
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'coach',
        coach_code: coachCode,
        school_id: schoolId
      }])
      .select()
      .single();

    if (profileError) throw profileError;

    // Auto-create teams for this coach (boys and girls)
    const teamInserts = [
      { name: `${school} Boys Bowling`, gender: 'boys', school_name: school, director_id: authData.user.id },
      { name: `${school} Girls Bowling`, gender: 'girls', school_name: school, director_id: authData.user.id }
    ];
    
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .insert(teamInserts)
      .select();
    
    if (teamsError) {
      console.warn('Could not auto-create teams:', teamsError.message);
    }

    // Generate session token
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    res.json({ 
      success: true,
      token: sessionData?.session?.access_token,
      user: {
        ...userData,
        coach_code: coachCode
      },
      teams: teamsData || []
    });
  } catch (error) {
    console.error('Coach signup error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Student Sign In with Coach Code
app.post('/api/auth/signin-code', async (req, res) => {
  try {
    const { coachCode } = req.body;
    
    if (!coachCode) {
      return res.status(400).json({ message: 'Coach code is required' });
    }

    // Find coach by code
    const { data: coach, error: coachError } = await supabase
      .from('users')
      .select('*')
      .eq('coach_code', coachCode.toUpperCase())
      .single();

    if (coachError || !coach) {
      return res.status(404).json({ message: 'Invalid coach code' });
    }

    // Generate a simple token for student access (view-only)
    const studentToken = `student_${coachCode}_${Date.now()}`;

    res.json({ 
      success: true,
      token: studentToken,
      coach: {
        id: coach.id,
        name: `${coach.first_name} ${coach.last_name}`.trim(),
        email: coach.email
      },
      accessLevel: 'student'
    });
  } catch (error) {
    console.error('Student signin error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user profile
app.get('/api/auth/profile/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(404).json({ error: error.message });
  }
});

// ==================== TEAMS ENDPOINTS ====================

// Get all teams
app.get('/api/teams', async (req, res) => {
  try {
    const { gender } = req.query;
    let query = supabase.from('teams').select('*').order('name');
    
    if (gender) {
      query = query.eq('gender', gender);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team by ID
app.get('/api/teams/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*, players(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Create team
app.post('/api/teams', async (req, res) => {
  try {
    const { name, gender, schoolName, division, county, directorId } = req.body;
    
    const { data, error } = await supabase
      .from('teams')
      .insert([{
        name,
        gender,
        school_name: schoolName,
        division,
        county,
        director_id: directorId
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update team
app.put('/api/teams/:id', async (req, res) => {
  try {
    const { name, gender, schoolName, division, county } = req.body;
    
    const { data, error } = await supabase
      .from('teams')
      .update({
        name,
        gender,
        school_name: schoolName,
        division,
        county
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== PLAYERS ENDPOINTS ====================

// Get team players
app.get('/api/teams/:teamId/players', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', req.params.teamId)
      .eq('is_active', true)
      .order('last_name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player by ID
app.get('/api/players/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*, teams(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get player error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Create player
app.post('/api/players', async (req, res) => {
  try {
    const { teamId, firstName, lastName, gradYear, gender, email } = req.body;
    
    if (!teamId || !firstName || !lastName || !gradYear || !gender) {
      return res.status(400).json({ error: 'Required fields: teamId, firstName, lastName, gradYear, gender' });
    }
    
    const { data, error } = await supabase
      .from('players')
      .insert([{
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        grad_year: parseInt(gradYear),
        gender: gender,
        email: email || null,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get coach's teams
app.get('/api/coach/:coachId/teams', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('director_id', req.params.coachId);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get coach teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update player
app.put('/api/players/:id', async (req, res) => {
  try {
    const { firstName, lastName, grade, jerseyNumber, isActive } = req.body;
    
    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (grade !== undefined) updateData.grade = grade;
    if (jerseyNumber !== undefined) updateData.jersey_number = jerseyNumber;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update player error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete player (soft delete - sets is_active to false)
app.delete('/api/players/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Player removed' });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== MATCHES ENDPOINTS ====================

// Get all matches
app.get('/api/matches', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, gender),
        away_team:teams!matches_away_team_id_fkey(id, name, gender)
      `)
      .order('match_date', { ascending: false });

    if (teamId) {
      query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get match by ID
app.get('/api/matches/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, gender),
        away_team:teams!matches_away_team_id_fkey(id, name, gender)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get match error:', error);
    res.status(404).json({ error: error.message });
  }
});

// Create match
app.post('/api/matches', async (req, res) => {
  try {
    const { homeTeamId, awayTeamId, matchDate, location } = req.body;
    
    const { data, error } = await supabase
      .from('matches')
      .insert([{
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        match_date: matchDate,
        location,
        status: 'scheduled'
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Create match error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update match status
app.put('/api/matches/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update match status error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== SCORES ENDPOINTS ====================

// Submit player score for a game
app.post('/api/scores', async (req, res) => {
  try {
    const { matchId, playerId, gameNumber, score, woodCount, strikes, spares } = req.body;
    
    const { data, error } = await supabase
      .from('player_scores')
      .upsert([{
        match_id: matchId,
        player_id: playerId,
        game_number: gameNumber,
        score,
        wood_count: woodCount,
        strikes: strikes || 0,
        spares: spares || 0
      }], { onConflict: 'match_id,player_id,game_number' })
      .select()
      .single();

    if (error) throw error;

    // Auto-update summary if all 3 games are submitted
    await updatePlayerSummary(matchId, playerId);

    res.json(data);
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get match scores
app.get('/api/matches/:matchId/scores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('player_scores')
      .select(`
        *,
        player:players(id, first_name, last_name, team_id, teams(name))
      `)
      .eq('match_id', req.params.matchId)
      .order('player_id')
      .order('game_number');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Get match scores error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player season stats
app.get('/api/players/:playerId/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('player_match_summary')
      .select('*')
      .eq('player_id', req.params.playerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Calculate totals
    const stats = {
      matches_played: data.length,
      total_score: data.reduce((sum, m) => sum + m.total_score, 0),
      total_wood: data.reduce((sum, m) => sum + m.total_wood, 0),
      average_score: data.length > 0 
        ? (data.reduce((sum, m) => sum + m.average_score, 0) / data.length).toFixed(2)
        : 0,
      high_game: Math.max(...data.map(m => m.high_game), 0),
      matches: data
    };

    res.json(stats);
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rankings
app.get('/api/rankings', async (req, res) => {
  try {
    const { gender, county, division } = req.query;
    
    // Get all player summaries with aggregated stats
    const { data: summaries, error } = await supabase
      .from('player_match_summary')
      .select(`
        player_id,
        players(first_name, last_name, teams(name, gender, county, division))
      `);

    if (error) throw error;

    // Group by player and calculate totals
    const playerStats = {};
    summaries.forEach(summary => {
      const playerId = summary.player_id;
      if (!playerStats[playerId]) {
        playerStats[playerId] = {
          player: summary.players,
          total_wood: 0,
          matches: 0
        };
      }
      playerStats[playerId].total_wood += summary.total_wood || 0;
      playerStats[playerId].matches += 1;
    });

    // Convert to array and filter
    let rankings = Object.entries(playerStats).map(([id, stats]) => ({
      player_id: id,
      first_name: stats.player.first_name,
      last_name: stats.player.last_name,
      team: stats.player.teams.name,
      gender: stats.player.teams.gender,
      county: stats.player.teams.county,
      division: stats.player.teams.division,
      total_wood: stats.total_wood,
      matches_played: stats.matches
    }));

    // Apply filters
    if (gender) rankings = rankings.filter(r => r.gender === gender);
    if (county) rankings = rankings.filter(r => r.county === county);
    if (division) rankings = rankings.filter(r => r.division === division);

    // Sort by total wood
    rankings.sort((a, b) => b.total_wood - a.total_wood);

    res.json(rankings);
  } catch (error) {
    console.error('Get rankings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

async function updatePlayerSummary(matchId, playerId) {
  try {
    // Get all scores for this player in this match
    const { data: scores, error: scoresError } = await supabase
      .from('player_scores')
      .select('*')
      .eq('match_id', matchId)
      .eq('player_id', playerId);

    if (scoresError || scores.length === 0) return;

    // Calculate summary
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const totalWood = scores.reduce((sum, s) => sum + s.wood_count, 0);
    const highGame = Math.max(...scores.map(s => s.score));
    const averageScore = totalScore / scores.length;
    const strikes = scores.reduce((sum, s) => sum + (s.strikes || 0), 0);
    const spares = scores.reduce((sum, s) => sum + (s.spares || 0), 0);

    // Upsert summary
    await supabase
      .from('player_match_summary')
      .upsert([{
        match_id: matchId,
        player_id: playerId,
        total_score: totalScore,
        total_wood: totalWood,
        average_score: averageScore,
        high_game: highGame,
        strikes,
        spares
      }], { onConflict: 'match_id,player_id' });
  } catch (error) {
    console.error('Update summary error:', error);
  }
}

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎳 Strike Master API running on port ${PORT}`);
});
