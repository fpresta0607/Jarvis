import { Router } from 'express';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

router.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    const completion = await openai.createCompletion({
      model: 'gpt-4o',
      prompt: `Generate a complete HTML, CSS and JS code snippet. ${prompt}`,
      temperature: 0.7,
      max_tokens: 1000,
    });
    const code = completion.data.choices[0].text || '';
    res.json({ code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

export default router;
