import { Router } from 'express';
import { supabase } from '../supabase.js';
const router = Router();

// Add media (video/audio). For MVP, no auth.
router.post('/', async (req, res) => {
  const { title, type, url, durationSeconds, thumbnailUrl, createdBy } = req.body;
  const { data, error } = await supabase
    .from('media')
    .insert({ title, type, url, duration_seconds: durationSeconds, thumbnail_url: thumbnailUrl, created_by: createdBy })
    .select('*')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// List media
router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('media').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;