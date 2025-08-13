import { Router } from 'express';
import { supabase } from '../supabase.js';
const router = Router();

// Create a room
router.post('/', async (req, res) => {
  const { name, mediaId, hostUserId } = req.body;
  const { data, error } = await supabase
    .from('rooms')
    .insert({ name, media_id: mediaId, host_user_id: hostUserId })
    .select('*')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get a room
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('rooms')
    .select('*, media:media_id(*)')
    .eq('id', id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// List messages (pagination)
router.get('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const limit = Number(req.query.limit || 50);
  const { data, error } = await supabase
    .from('messages')
    .select('*, users:user_id(display_name, avatar_url)')
    .eq('room_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data.reverse());
});

export default router;