// Keeps items that just left a list (ticked off, deleted) for a moment, marked "leaving", in their
// old place, so they can animate out instead of vanishing. When the view itself changes (another
// filter), nothing lingers: that's a new list, not items leaving.
import { useEffect, useState } from 'react';

export function useLeavingList<T extends { id: string }>(
  list: T[],
  viewKey: string,
  ms = 340,
): (T & { leaving?: boolean })[] {
  const [previous, setPrevious] = useState({ list, viewKey });
  const [leaving, setLeaving] = useState<{ item: T; index: number }[]>([]);

  if (previous.list !== list || previous.viewKey !== viewKey) {
    const gone =
      previous.viewKey === viewKey
        ? previous.list
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !list.some((i) => i.id === item.id))
        : [];
    // Replace rather than append: React may run this twice in development.
    setLeaving((current) => [
      ...current.filter(
        (c) => !gone.some((g) => g.item.id === c.item.id) && !list.some((i) => i.id === c.item.id),
      ),
      ...gone,
    ]);
    setPrevious({ list, viewKey });
  }

  useEffect(() => {
    if (!leaving.length) return;
    const timer = window.setTimeout(() => setLeaving([]), ms);
    return () => window.clearTimeout(timer);
  }, [leaving, ms]);

  const merged: (T & { leaving?: boolean })[] = [...list];
  for (const { item, index } of leaving) {
    if (!list.some((i) => i.id === item.id))
      merged.splice(Math.min(index, merged.length), 0, { ...item, leaving: true });
  }
  return merged;
}
