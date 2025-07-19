import { useState } from 'react';
import PromptForm from './components/PromptForm';
import CodeEditor from './components/CodeEditor';
import LivePreview from './components/LivePreview';

function App() {
  const [code, setCode] = useState(`<!DOCTYPE html>
<html>
<head>
  <style>body {font-family: Arial;}</style>
</head>
<body>
  <h1>Hello CodePilot</h1>
</body>
</html>`);

  return (
    <div className="flex h-full">
      <div className="w-1/2 p-4 space-y-4 overflow-y-auto">
        <PromptForm onCode={setCode} />
        <CodeEditor code={code} setCode={setCode} />
      </div>
      <div className="w-1/2 p-4 bg-gray-800 overflow-y-auto">
        <LivePreview code={code} />
      </div>
    </div>
  );
}

export default App;
