interface Props {
  code: string;
}

export default function LivePreview({ code }: Props) {
  return (
    <iframe
      title="preview"
      className="w-full h-full bg-white"
      srcDoc={code}
    />
  );
}
