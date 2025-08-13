import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import roomsRouter from './routes/rooms.js';
import moviesRouter from './routes/movies.js';
import { supabase } from './supabase.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => res.json({ ok: true }));
app.use('/api/rooms', roomsRouter);
app.use('/api/media', moviesRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN, methods: ['GET','POST'] }
});

// Room presence tracking (in-memory for MVP)
const roomMembers = new Map(); // roomId -> Set(socket.id)

io.on('connection', (socket) => {
  // Join a room
  socket.on('room:join', async ({ roomId, displayName }) => {
    socket.join(roomId);
    if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
    roomMembers.get(roomId).add(socket.id);

    // Send current playback state to the new client
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    socket.emit('room:state', {
      isPlaying: room?.is_playing ?? false,
      currentTime: Number(room?.current_time_seconds ?? 0),
      playbackRate: Number(room?.playback_rate ?? 1),
    });

    io.to(roomId).emit('room:presence', { count: roomMembers.get(roomId).size });
  });

  // Playback control events
  socket.on('play', async ({ roomId, currentTime }) => {
    io.to(roomId).emit('play', { currentTime });
    await supabase.from('rooms').update({
      is_playing: true,
      current_time_seconds: currentTime,
      last_action_at: new Date().toISOString(),
    }).eq('id', roomId);
  });

  socket.on('pause', async ({ roomId, currentTime }) => {
    io.to(roomId).emit('pause', { currentTime });
    await supabase.from('rooms').update({
      is_playing: false,
      current_time_seconds: currentTime,
      last_action_at: new Date().toISOString(),
    }).eq('id', roomId);
  });

  socket.on('seek', async ({ roomId, currentTime }) => {
    io.to(roomId).emit('seek', { currentTime });
    await supabase.from('rooms').update({
      current_time_seconds: currentTime,
      last_action_at: new Date().toISOString(),
    }).eq('id', roomId);
  });

  socket.on('rate', async ({ roomId, playbackRate }) => {
    io.to(roomId).emit('rate', { playbackRate });
    await supabase.from('rooms').update({ playback_rate: playbackRate }).eq('id', roomId);
  });

  // Chat events
  socket.on('chat:new', async ({ roomId, userId, content, atTime }) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, user_id: userId, content, at_time_seconds: atTime })
      .select('*')
      .single();
    if (!error) io.to(roomId).emit('chat:new', data);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomMembers.has(roomId)) {
        const set = roomMembers.get(roomId);
        set.delete(socket.id);
        io.to(roomId).emit('room:presence', { count: set.size });
      }
    }
  });
});

const PORT = process.env.PORT || 5174;
server.listen(PORT, () => console.log(`Server listening on :${PORT}`));