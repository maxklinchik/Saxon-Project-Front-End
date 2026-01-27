import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3000;

// Check required environment variables
let supabase = null;
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn('WARNING: SUPABASE_SERVICE_KEY environment variable is not set!');
  console.warn('API endpoints requiring database will not work.');
} else {
  supabase = createClient(
    process.env.SUPABASE_URL || 'https://fxqddamrgadttkfxvjth.supabase.co',
    process.env.SUPABASE_SERVICE_KEY
  );
}

// CORS - allow GitHub Pages and local development
app.use(cors({
  origin: [
    'https://arkokush.github.io',
    'https://maxklinchik.github.io',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  credentials: true
}));

app.use(express.json());

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: supabase ? 'connected' : 'not configured'
  });
});

// ==================== AUTH ENDPOINTS ====================

// Coach Sign Up - Creates user with team code
app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { email, password, firstName, lastName, teamName } = req.body;
    
    if (!email || !password || !firstName || !lastName || !teamName) {
      return res.status(400).json({ error: 'All fields required: email, password, firstName, lastName, teamName' });
    }

    // Generate unique 6-character team code
    const teamCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    // Create user profile in users table
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        team_name: teamName,
        team_code: teamCode
      }])
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      // Try to clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Sign in to get session
    const { data: sessionData } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    res.json({
      success: true,
      user: userData,
      token: sessionData?.session?.access_token
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Coach Login
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.warn('Could not fetch profile:', profileError.message);
    }

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...userProfile
      },
      token: data.session?.access_token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Student Sign Up with Email, Password, and Team Code
app.post('/api/auth/student-signup', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { email, password, teamCode } = req.body;

    if (!email || !password || !teamCode) {
      return res.status(400).json({ error: 'Email, password, and team code required' });
    }

    // First, find coach by team code to get coach_id
    const { data: coach, error: coachError } = await supabase
      .from('users')
      .select('id, team_name, first_name, last_name, team_code')
      .eq('team_code', teamCode.toUpperCase())
      .single();

    if (coachError || !coach) {
      return res.status(404).json({ error: 'Invalid team code' });
    }

    // Check if student email already exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingStudent) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert([{
        email: email.toLowerCase(),
        password_hash: password, // In production, hash this!
        coach_id: coach.id,
        team_code: teamCode.toUpperCase()
      }])
      .select()
      .single();

    if (studentError) {
      console.error('Student signup error:', studentError);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    res.json({
      success: true,
      user: {
        id: coach.id,
        email: student.email,
        coach_id: coach.id,
        team_name: coach.team_name,
        team_code: coach.team_code,
        role: 'student'
      }
    });

  } catch (error) {
    console.error('Student signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Student Sign In with Email and Password
app.post('/api/auth/student-login', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find student by email
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Invalid email or password' });
    }

    // Check password (in production, use proper password hashing)
    if (student.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get coach info
    const { data: coach } = await supabase
      .from('users')
      .select('id, team_name, first_name, last_name, team_code')
      .eq('id', student.coach_id)
      .single();

    res.json({
      success: true,
      user: {
        id: coach?.id || student.coach_id,
        email: student.email,
        coach_id: student.coach_id,
        team_name: coach?.team_name,
        team_code: coach?.team_code,
        role: 'student'
      }
    });

  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/auth/profile/:userId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

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

// ==================== LOCATIONS ENDPOINTS ====================

// Get saved locations for a coach
app.get('/api/locations', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId } = req.query;
    if (!coachId) {
      return res.status(400).json({ error: 'coachId is required' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('saved_locations')
      .eq('id', coachId)
      .single();

    if (error) throw error;
    
    // Return default locations if none saved
    const defaultLocations = ['Montvale Lanes', 'Bowler City', 'Lodi Lanes', 'Parkway Lanes', 'Holiday Bowl'];
    res.json(data?.saved_locations || defaultLocations);

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save locations for a coach
app.put('/api/locations', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, locations } = req.body;
    if (!coachId || !locations) {
      return res.status(400).json({ error: 'coachId and locations are required' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ saved_locations: locations })
      .eq('id', coachId)
      .select()
      .single();

    if (error) throw error;
    res.json(data.saved_locations || locations);

  } catch (error) {
    console.error('Save locations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a single location
app.post('/api/locations', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, location } = req.body;
    if (!coachId || !location) {
      return res.status(400).json({ error: 'coachId and location are required' });
    }

    // Get current locations
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('saved_locations')
      .eq('id', coachId)
      .single();

    if (fetchError) throw fetchError;

    const defaultLocations = ['Montvale Lanes', 'Bowler City', 'Lodi Lanes', 'Parkway Lanes', 'Holiday Bowl'];
    const currentLocations = userData?.saved_locations || defaultLocations;
    
    // Add new location if not already present
    if (!currentLocations.includes(location)) {
      currentLocations.push(location);
    }

    const { data, error } = await supabase
      .from('users')
      .update({ saved_locations: currentLocations })
      .eq('id', coachId)
      .select()
      .single();

    if (error) throw error;
    res.json(data.saved_locations || currentLocations);

  } catch (error) {
    console.error('Add location error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PLAYERS ENDPOINTS ====================

// Get all players for a coach (filtered by gender)
app.get('/api/players', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, gender } = req.query;

    if (!coachId) {
      return res.status(400).json({ error: 'coachId is required' });
    }

    let query = supabase
      .from('players')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('last_name');

    if (gender) {
      query = query.eq('gender', gender);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single player
app.get('/api/players/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
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
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, firstName, lastName, gender, gradYear } = req.body;

    if (!coachId || !firstName || !lastName || !gender) {
      return res.status(400).json({ error: 'Required: coachId, firstName, lastName, gender' });
    }

    const { data, error } = await supabase
      .from('players')
      .insert([{
        coach_id: coachId,
        first_name: firstName,
        last_name: lastName,
        gender,
        grad_year: gradYear ? parseInt(gradYear) : null,
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

// Update player
app.put('/api/players/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { firstName, lastName, gender, gradYear, isActive } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (gender !== undefined) updateData.gender = gender;
    if (gradYear !== undefined) updateData.grad_year = parseInt(gradYear);
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

// Delete player (soft delete)
app.delete('/api/players/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

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

// Get all matches for a coach
app.get('/api/matches', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, gender } = req.query;

    if (!coachId) {
      return res.status(400).json({ error: 'coachId is required' });
    }

    let query = supabase
      .from('matches')
      .select('*')
      .eq('coach_id', coachId)
      .order('match_date', { ascending: false });

    if (gender) {
      query = query.eq('gender', gender);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single match
app.get('/api/matches/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('matches')
      .select('*')
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
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, gender, opponent, matchDate, location, result, ourScore, opponentScore, comments } = req.body;

    if (!coachId || !gender || !opponent || !matchDate) {
      return res.status(400).json({ error: 'Required: coachId, gender, opponent, matchDate' });
    }

    const { data, error } = await supabase
      .from('matches')
      .insert([{
        coach_id: coachId,
        gender,
        opponent,
        match_date: matchDate,
        location: location || null,
        result: result || null,
        our_score: ourScore ? parseInt(ourScore) : 0,
        opponent_score: opponentScore ? parseInt(opponentScore) : 0,
        comments: comments || null,
        is_complete: false
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

// Update match (scores, result)
app.put('/api/matches/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { opponent, matchDate, location, ourScore, opponentScore, result, isComplete, comments } = req.body;

    const updateData = {};
    if (opponent !== undefined) updateData.opponent = opponent;
    if (matchDate !== undefined) updateData.match_date = matchDate;
    if (location !== undefined) updateData.location = location;
    if (ourScore !== undefined) updateData.our_score = parseInt(ourScore);
    if (opponentScore !== undefined) updateData.opponent_score = parseInt(opponentScore);
    if (result !== undefined) updateData.result = result;
    if (isComplete !== undefined) updateData.is_complete = isComplete;
    if (comments !== undefined) updateData.comments = comments;

    const { data, error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);

  } catch (error) {
    console.error('Update match error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete match
app.delete('/api/matches/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Match deleted' });

  } catch (error) {
    console.error('Delete match error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== RECORDS ENDPOINTS ====================

// Get all records for a match
app.get('/api/matches/:matchId/records', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('records')
      .select(`
        *,
        player:players(id, first_name, last_name, gender)
      `)
      .eq('match_id', req.params.matchId)
      .order('created_at');

    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all records for a player (their history)
app.get('/api/players/:playerId/records', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('records')
      .select(`
        *,
        match:matches(id, opponent, match_date, gender, location)
      `)
      .eq('player_id', req.params.playerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    console.error('Get player records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get records by matchId (query parameter)
app.get('/api/records', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { matchId } = req.query;

    if (!matchId) {
      return res.status(400).json({ error: 'matchId is required' });
    }

    const { data, error } = await supabase
      .from('records')
      .select(`
        *,
        player:players(id, first_name, last_name, gender)
      `)
      .eq('match_id', matchId)
      .order('created_at');

    if (error) throw error;

    // Format the response to include player_name
    const formattedData = (data || []).map(record => ({
      ...record,
      player_name: record.player ? `${record.player.first_name} ${record.player.last_name}` : 'Unknown Player'
    }));

    res.json(formattedData);

  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or update record (upsert)
app.post('/api/records', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { matchId, playerId, game1, game2, game3, isVarsity } = req.body;

    if (!matchId || !playerId) {
      return res.status(400).json({ error: 'Required: matchId, playerId' });
    }

    const { data, error } = await supabase
      .from('records')
      .upsert([{
        match_id: matchId,
        player_id: playerId,
        game1: game1 !== undefined && game1 !== null ? parseInt(game1) : null,
        game2: game2 !== undefined && game2 !== null ? parseInt(game2) : null,
        game3: game3 !== undefined && game3 !== null ? parseInt(game3) : null,
        is_varsity: isVarsity !== undefined ? isVarsity : true
      }], { onConflict: 'match_id,player_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);

  } catch (error) {
    console.error('Create record error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update record
app.put('/api/records/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { game1, game2, game3 } = req.body;

    const updateData = {};
    if (game1 !== undefined) updateData.game1 = parseInt(game1);
    if (game2 !== undefined) updateData.game2 = parseInt(game2);
    if (game3 !== undefined) updateData.game3 = parseInt(game3);

    const { data, error } = await supabase
      .from('records')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);

  } catch (error) {
    console.error('Update record error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete record
app.delete('/api/records/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Record deleted' });

  } catch (error) {
    console.error('Delete record error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete all records for a match
app.delete('/api/records/match/:matchId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('match_id', req.params.matchId);

    if (error) throw error;
    res.json({ success: true, message: 'All records for match deleted' });

  } catch (error) {
    console.error('Delete records by match error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== STATS ENDPOINTS ====================

// Get player stats (aggregated from records)
app.get('/api/players/:playerId/stats', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Get all records for this player
    const { data: records, error } = await supabase
      .from('records')
      .select(`
        *,
        match:matches(opponent, match_date)
      `)
      .eq('player_id', req.params.playerId);

    if (error) throw error;

    if (!records || records.length === 0) {
      return res.json({
        matches_played: 0,
        total_pins: 0,
        average: 0,
        high_game: 0,
        high_series: 0,
        records: []
      });
    }

    // Calculate stats
    let totalPins = 0;
    let totalGames = 0;
    let highGame = 0;
    let highSeries = 0;

    records.forEach(r => {
      const series = (r.game1 || 0) + (r.game2 || 0) + (r.game3 || 0);
      totalPins += series;
      
      if (r.game1) { totalGames++; highGame = Math.max(highGame, r.game1); }
      if (r.game2) { totalGames++; highGame = Math.max(highGame, r.game2); }
      if (r.game3) { totalGames++; highGame = Math.max(highGame, r.game3); }
      
      highSeries = Math.max(highSeries, series);
    });

    res.json({
      matches_played: records.length,
      total_pins: totalPins,
      average: totalGames > 0 ? (totalPins / totalGames).toFixed(1) : 0,
      high_game: highGame,
      high_series: highSeries,
      records
    });

  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team stats (all players for a coach)
app.get('/api/stats/team', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { coachId, gender } = req.query;

    if (!coachId) {
      return res.status(400).json({ error: 'coachId is required' });
    }

    // Get all players for this coach
    let playersQuery = supabase
      .from('players')
      .select('id, first_name, last_name, gender')
      .eq('coach_id', coachId)
      .eq('is_active', true);

    if (gender) {
      playersQuery = playersQuery.eq('gender', gender);
    }

    const { data: players, error: playersError } = await playersQuery;
    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return res.json([]);
    }

    // Get records for all these players
    const playerIds = players.map(p => p.id);
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .in('player_id', playerIds);

    if (recordsError) throw recordsError;

    // Calculate stats per player
    const stats = players.map(player => {
      const playerRecords = (records || []).filter(r => r.player_id === player.id);
      
      let totalPins = 0;
      let totalGames = 0;
      let highGame = 0;

      playerRecords.forEach(r => {
        if (r.game1) { totalPins += r.game1; totalGames++; highGame = Math.max(highGame, r.game1); }
        if (r.game2) { totalPins += r.game2; totalGames++; highGame = Math.max(highGame, r.game2); }
        if (r.game3) { totalPins += r.game3; totalGames++; highGame = Math.max(highGame, r.game3); }
      });

      return {
        player_id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        gender: player.gender,
        matches_played: playerRecords.length,
        total_pins: totalPins,
        average: totalGames > 0 ? (totalPins / totalGames).toFixed(1) : 0,
        high_game: highGame
      };
    });

    // Sort by average descending
    stats.sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

    res.json(stats);

  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎳 Strike Master API running on port ${PORT}`);
  console.log(`Database: ${supabase ? 'Connected' : 'Not configured'}`);
});
