import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that writes complete HTML, CSS, and JS code snippets.' },
        { role: 'user', content: `Generate a complete HTML, CSS, and JS code snippet. ${prompt}` }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const code = completion.choices?.[0]?.message?.content?.trim() || '';
    res.json({ code });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

export default router;
