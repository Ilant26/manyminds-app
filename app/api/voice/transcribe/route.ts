import OpenAI from 'openai';

export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio');
  if (!audio || !(audio instanceof Blob)) {
    return Response.json({ error: 'Missing audio' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });
  const file = new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });
    const verbose = transcription as unknown as { text: string; language?: string };
    return Response.json({
      text: verbose.text ?? (transcription as { text: string }).text,
      language: verbose.language ?? 'en',
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
