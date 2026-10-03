import { useEffect, useRef, useState } from 'react';
import { getDailyBriefAudio } from '@/services/dashboard.service';
import { errorMessage } from '@/lib/queryClient';

/**
 * Lazily fetches the brief MP3 on first play and keeps one object URL for the
 * component's lifetime (each fetch is a TTS call on the backend). Revokes on unmount.
 */
export function useBriefAudio(shopId: string, briefDate?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  // New shop or date: the old audio no longer applies
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setError(null);
    };
  }, [shopId, briefDate]);

  const load = async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    setLoading(true);
    setError(null);
    try {
      const blob = await getDailyBriefAudio(shopId, briefDate);
      urlRef.current = URL.createObjectURL(blob);
      return urlRef.current;
    } catch (err) {
      setError(errorMessage(err, 'Could not load audio'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, load };
}
