// Keeps the last non-null value for a moment after it becomes null, so a dialog that closes can
// still show its content while it animates out.
import { useEffect, useState } from 'react';

export function useLingering<T>(value: T | null, ms = 240): T | null {
  const [kept, setKept] = useState(value);
  if (value !== null && value !== kept) setKept(value);
  useEffect(() => {
    if (value !== null) return;
    const timer = window.setTimeout(() => setKept(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return value ?? kept;
}
