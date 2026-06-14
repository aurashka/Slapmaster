import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Express initialization
const app = express();
const PORT = 3000;

// Middleware to parse JSON payloads with larger limit to facilitate base64 photo snapping
app.use(express.json({ limit: '10mb' }));

// In-memory Room State Registry for Online Multiplayer Action
interface PlayerSyncState {
  health: number;
  energy: number;
  action: string;
  score: number;
  displayName: string;
  faces: {
    normal: string | null;
    attack: string | null;
    hit: string | null;
  } | null;
  lastHitType: string | null;
  lastActive: number;
}

interface Room {
  id: string;
  gameMode: 'boxing_fight' | 'slapping_duel' | null;
  status: 'lobby' | 'setup' | 'playing' | 'ended';
  players: [PlayerSyncState | null, PlayerSyncState | null];
}

const rooms = new Map<string, Room>();

// Self-cleaning routine for inactive rooms every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    const p1Active = room.players[0] ? (now - room.players[0].lastActive < 20000) : false;
    const p2Active = room.players[1] ? (now - room.players[1].lastActive < 20000) : false;
    
    // Prune rooms where both players have closed screens or timed out
    if (!p1Active && !p2Active) {
      rooms.delete(roomId);
    }
  }
}, 30000);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', roomsCount: rooms.size });
});

// Create a new match lobby code
app.post('/api/rooms', (req, res) => {
  const { displayName, faces, gameMode } = req.body;
  
  // Generate a random unique 4-digit code
  let roomId = '';
  do {
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(roomId));

  const newRoom: Room = {
    id: roomId,
    gameMode: gameMode || 'boxing_fight',
    status: 'lobby',
    players: [
      {
        displayName: displayName || 'Fighter Red',
        health: 100,
        energy: 100,
        action: 'idle',
        score: 0,
        faces: faces || null,
        lastHitType: null,
        lastActive: Date.now()
      },
      null
    ]
  };

  rooms.set(roomId, newRoom);
  res.json({ roomId, playerIndex: 0, message: 'Room created successfully' });
});

// Join an existing room via 4-digit entry
app.post('/api/rooms/join', (req, res) => {
  const { roomId, displayName, faces } = req.body;
  
  if (!roomId) {
    res.status(400).json({ error: 'Room code is required' });
    return;
  }

  const room = rooms.get(roomId.toString().trim());
  if (!room) {
    res.status(404).json({ error: 'Fighter room not found. Double-check your 4-digit code.' });
    return;
  }

  if (room.players[1]) {
    res.status(400).json({ error: 'Room is already full! Max 2 players allowed.' });
    return;
  }

  // Populate Player 2 (Green)
  room.players[1] = {
    displayName: displayName || 'Fighter Green',
    health: 100,
    energy: 100,
    action: 'idle',
    score: 0,
    faces: faces || null,
    lastHitType: null,
    lastActive: Date.now()
  };

  room.status = 'playing';

  res.json({ 
    roomId, 
    playerIndex: 1, 
    gameMode: room.gameMode,
    message: 'Matched with Red Fighter! Preparing the arena...' 
  });
});

// Bidirectional real-time status synchronization endpoint
app.post('/api/rooms/:roomId/sync', (req, res) => {
  const { roomId } = req.params;
  const { playerIndex, health, energy, action, score, faces, lastHitType, gameMode, status } = req.body;

  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room closed or expired.' });
    return;
  }

  const idx = parseInt(playerIndex);
  if (idx !== 0 && idx !== 1) {
    res.status(400).json({ error: 'Invalid player alignment slot.' });
    return;
  }

  const targetPlayer = room.players[idx];
  if (targetPlayer) {
    targetPlayer.health = typeof health === 'number' ? health : targetPlayer.health;
    targetPlayer.energy = typeof energy === 'number' ? energy : targetPlayer.energy;
    targetPlayer.action = action || targetPlayer.action;
    targetPlayer.score = typeof score === 'number' ? score : targetPlayer.score;
    targetPlayer.lastHitType = lastHitType !== undefined ? lastHitType : targetPlayer.lastHitType;
    targetPlayer.lastActive = Date.now();
    
    if (faces) {
      targetPlayer.faces = faces;
    }
  } else {
    // Re-initialize if disconnected
    room.players[idx] = {
      displayName: idx === 0 ? 'Fighter Red' : 'Fighter Green',
      health: health || 100,
      energy: energy || 100,
      action: action || 'idle',
      score: score || 0,
      faces: faces || null,
      lastHitType: lastHitType || null,
      lastActive: Date.now()
    };
  }

  // Allow either client to enforce a gameMode change or status advancement
  if (gameMode) room.gameMode = gameMode;
  if (status) room.status = status;

  res.json({
    roomId: room.id,
    gameMode: room.gameMode,
    status: room.status,
    p1: room.players[0],
    p2: room.players[1]
  });
});

// Mount Vite middleware handles serving the client in single server paradigm
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fighter Arena full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
