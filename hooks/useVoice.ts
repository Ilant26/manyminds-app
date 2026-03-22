'use client';

import { useCallback, useRef, useState } from 'react';
import type { VoiceState } from '@/types';

const MAX_DURATION_MS = 120_000;

export function useVoice(onTranscript: (text: string, language: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported');
      setState('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          setState('idle');
          return;
        }
        setState('transcribing');
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const form = new FormData();
          form.append('audio', blob);
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: form,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError((data.error as string) ?? 'Transcription failed');
            setState('error');
            return;
          }
          const data = (await res.json()) as { text: string; language: string };
          setState('done');
          onTranscript(data.text, data.language ?? 'en');
        } catch {
          setError('Transcription failed');
          setState('error');
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    } catch {
      setError('Microphone access denied');
      setState('error');
    }
  }, [onTranscript]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    error,
    start,
    stop,
    reset,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
  };
}
