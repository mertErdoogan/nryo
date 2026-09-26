import { useEffect, useState } from 'react';
import { msUntilTomorrow, toDateKey } from '../lib/date';

/** Today's local date key; re-renders just after midnight so daily content rolls over. */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => toDateKey());
  useEffect(() => {
    const timer = setTimeout(() => setKey(toDateKey()), msUntilTomorrow() + 1000);
    return () => clearTimeout(timer);
  }, [key]);
  return key;
}
