import Editor from '@monaco-editor/react';

interface Props {
  code: string;
  setCode: (code: string) => void;
}

export default function CodeEditor({ code, setCode }: Props) {
  return (
    <div className="h-96 border border-gray-700">
      <Editor
        height="100%"
        defaultLanguage="html"
        value={code}
        onChange={(value) => setCode(value || '')}
        theme="vs-dark"
      />
    </div>
  );
}
