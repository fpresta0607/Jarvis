import { useState } from 'react';
import axios from 'axios';

interface Props {
  onCode: (code: string) => void;
}

export default function PromptForm({ onCode }: Props) {
  const [prompt, setPrompt] = useState('Create a landing page for a coffee shop with a hero banner, menu section, and contact form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/generate', { prompt });
      onCode(res.data.code);
    } catch (err) {
      setError('Failed to generate code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        className="w-full p-2 rounded bg-gray-800 text-gray-100"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      ></textarea>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
