import { useState, useRef, useCallback } from 'react';
import { downloadBlob } from '../utils/fileUtils';

interface UseVideoRecorderOptions {
  fps: number;
  filename?: string;
}

interface UseVideoRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: (canvas: HTMLCanvasElement) => void;
  stopRecording: () => void;
  error: string | null;
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

export function useVideoRecorder({
  fps,
  filename = 'animation.webm',
}: UseVideoRecorderOptions): UseVideoRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((canvas: HTMLCanvasElement) => {
    if (isRecording || !canvas) return;

    try {
      setError(null);
      chunksRef.current = [];

      const stream = canvas.captureStream(fps);
      const mimeType = getSupportedMimeType();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadBlob(blob, filename);
        chunksRef.current = [];
        setIsProcessing(false);
        setIsRecording(false);
      };

      mediaRecorder.onerror = () => {
        setError('Recording failed');
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, [fps, filename, isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    error,
  };
}
