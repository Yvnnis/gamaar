import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rail (liste horizontale / grille) qui se RECHARGE tout seul.
 *
 * - `fetchPage(page)` renvoie les items bruts d'une page TMDB (+ total_pages).
 * - Les items déjà connus (historique Supabase, déjà affichés ailleurs, déjà retirés)
 *   sont ignorés grâce à `excludeRef` (Set partagé entre plusieurs rails si besoin).
 * - `remove(item)` retire un item (après ajout / vu / like) et déclenche
 *   automatiquement le chargement des pages suivantes pour garder `targetSize` items.
 */
export type RailItem = { id: number; media_type?: string; [key: string]: any };

type FetchPage = (page: number) => Promise<{ results: RailItem[]; total_pages?: number }>;

type Options = {
  fetchPage: FetchPage;
  keyOf: (item: RailItem) => string;
  excludeRef: React.MutableRefObject<Set<string>>;
  targetSize?: number;
  /** Nombre max de pages TMDB lues par recharge (évite les boucles infinies) */
  maxPagesPerRefill?: number;
  /** Mettre à false tant que l'historique utilisateur n'est pas chargé */
  enabled?: boolean;
};

export function useRefillingRail({
  fetchPage,
  keyOf,
  excludeRef,
  targetSize = 20,
  maxPagesPerRefill = 5,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<RailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);

  const itemsRef = useRef<RailItem[]>([]);
  const nextPageRef = useRef(1);
  const totalPagesRef = useRef<number>(Infinity);
  const fetchingRef = useRef(false);
  const pendingRefillRef = useRef(false);

  const commit = (next: RailItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const refill = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      let pagesRead = 0;

      while (
        itemsRef.current.length < targetSize &&
        pagesRead < maxPagesPerRefill &&
        nextPageRef.current <= totalPagesRef.current &&
        nextPageRef.current <= 500 // limite TMDB
      ) {
        const page = nextPageRef.current++;
        pagesRead++;

        let data: { results: RailItem[]; total_pages?: number };
        try {
          data = await fetchPage(page);
        } catch {
          break;
        }
        if (data.total_pages) totalPagesRef.current = data.total_pages;

        const fresh: RailItem[] = [];
        for (const item of data.results || []) {
          if (!item?.id || !item.poster_path) continue;
          const key = keyOf(item);
          if (excludeRef.current.has(key)) continue;
          excludeRef.current.add(key); // réserve l'item (pas de doublon entre rails)
          fresh.push(item);
        }
        // On repart de itemsRef.current (un item a pu être retiré pendant le fetch)
        commit([...itemsRef.current, ...fresh]);
      }

      if (nextPageRef.current > totalPagesRef.current) setExhausted(true);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      // Un retrait est arrivé pendant le chargement : on relance une passe
      if (pendingRefillRef.current) {
        pendingRefillRef.current = false;
        if (itemsRef.current.length < targetSize) refillRef.current?.();
      }
    }
  }, [fetchPage, keyOf, excludeRef, targetSize, maxPagesPerRefill]);

  const refillRef = useRef<() => Promise<void>>(undefined);
  refillRef.current = refill;

  // Chargement initial
  useEffect(() => {
    if (!enabled) return;
    refill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const remove = useCallback(
    (item: RailItem) => {
      const key = keyOf(item);
      excludeRef.current.add(key);
      commit(itemsRef.current.filter((i) => keyOf(i) !== key));
      // On recharge dès qu'on passe sous 75 % de la cible
      if (itemsRef.current.length < Math.ceil(targetSize * 0.75)) {
        if (fetchingRef.current) pendingRefillRef.current = true;
        else refill();
      }
    },
    [keyOf, excludeRef, targetSize, refill]
  );

  return { items, loading, exhausted, remove, refill };
}
