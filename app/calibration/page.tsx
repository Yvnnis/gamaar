"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type StepType = 'LOADING' | 'GRID' | 'SAVING';

// ─────────────────────────────────────────────────────────────
// ANTI COLD-START : on propose les œuvres les PLUS CONNUES
// dans les 4 univers. Deux sources mélangées par section :
//  - vote_count.desc  → les incontournables que presque tout le monde a vus
//  - popularity.desc  → les gros succès récents (avec un seuil de votes)
// ─────────────────────────────────────────────────────────────
type MediaType = 'movie' | 'tv';
type SectionKey = 'movie' | 'series' | 'animation' | 'anime';
type Source = { type: MediaType; params: string };

const TMDB = "https://api.themoviedb.org/3";
const PAGE_SIZE = 12; // posters affichés par section (et par clic sur "Voir plus")

const SECTIONS: { key: SectionKey; title: string; sources: Source[]; keep?: (item: any) => boolean }[] = [
  {
    key: 'movie', title: "🎬 Films",
    sources: [
      { type: 'movie', params: "&sort_by=vote_count.desc&without_genres=16" },
      { type: 'movie', params: "&sort_by=popularity.desc&vote_count.gte=3000&without_genres=16" },
    ],
  },
  {
    key: 'series', title: "📺 Séries",
    // 10763 news, 10764 télé-réalité, 10767 talk-shows : exclus
    sources: [
      { type: 'tv', params: "&sort_by=vote_count.desc&without_genres=16,10763,10764,10767" },
      { type: 'tv', params: "&sort_by=popularity.desc&vote_count.gte=1000&without_genres=16,10763,10764,10767" },
    ],
  },
  {
    key: 'animation', title: "🎨 Films d'animation",
    // Filet de sécurité côté client : on écarte les films japonais (ils vont dans "Animés")
    keep: (it) => it.original_language !== 'ja',
    sources: [
      { type: 'movie', params: "&sort_by=vote_count.desc&with_genres=16&without_original_language=ja" },
      { type: 'movie', params: "&sort_by=popularity.desc&vote_count.gte=1000&with_genres=16&without_original_language=ja" },
    ],
  },
  {
    key: 'anime', title: "🗾 Animés",
    // Séries ET films japonais (Chihiro, Your Name…) : très connus, parfaits pour calibrer
    sources: [
      { type: 'tv', params: "&sort_by=vote_count.desc&with_genres=16&with_original_language=ja" },
      { type: 'movie', params: "&sort_by=vote_count.desc&with_genres=16&with_original_language=ja" },
    ],
  },
];

type SectionState = { shown: any[]; buffer: any[]; page: number; loading: boolean };
const emptySection = (): SectionState => ({ shown: [], buffer: [], page: 0, loading: false });
const keyOf = (item: any) => `${item.media_type}_${item.id}`;

// Récupère la page N de toutes les sources d'une section, en alternant les résultats
const fetchSectionPage = async (sources: Source[], page: number, keep: (item: any) => boolean = () => true): Promise<any[]> => {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const lists = await Promise.all(
    sources.map((src) =>
      fetch(`${TMDB}/discover/${src.type}?api_key=${apiKey}&language=fr-FR&include_adult=false${src.params}&page=${page}`)
        .then((r) => r.json())
        .then((d) => (d.results || []).map((it: any) => ({ ...it, media_type: src.type })))
        .catch(() => [])
    )
  );
  const merged: any[] = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) lists.forEach((l) => l[i] && merged.push(l[i]));
  return merged.filter((it) => it.poster_path && keep(it));
};

// 1. COMPOSANT INTERNE (Logique)
function CalibrationContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- STATES ---
  const [step, setStep] = useState<StepType>('LOADING');
  const [userId, setUserId] = useState("");
  
  // Sections (films / séries / animation / animés)
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    movie: emptySection(), series: emptySection(), animation: emptySection(), anime: emptySection(),
  });
  // Sélection : clé "movie_123" / "tv_456" → item (les IDs TMDB films et séries peuvent se chevaucher !)
  const [selected, setSelected] = useState<Map<string, any>>(new Map());
  const [existingPrefs, setExistingPrefs] = useState<Record<string, any>>({});

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
      const isRecalibrating = searchParams.get('rec') === 'true';

      if (profile?.preferences?.calibrated && !isRecalibrating) {
          router.push("/dashboard");
          return;
      }
      setExistingPrefs(profile?.preferences || {});
      loadInitial();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complète une section : pioche dans le buffer, fetch la page suivante si besoin
  const growSection = async (key: SectionKey, current: SectionState, seen: Set<string>): Promise<SectionState> => {
    const def = SECTIONS.find((s) => s.key === key)!;
    const { shown, buffer } = current;
    let { page } = current;
    let tries = 0;
    while (buffer.length < PAGE_SIZE && tries < 3) {
      page += 1; tries += 1;
      const fresh = await fetchSectionPage(def.sources, page, def.keep);
      fresh.forEach((it) => {
        const k = keyOf(it);
        if (!seen.has(k)) { seen.add(k); buffer.push(it); }
      });
    }
    return { shown: [...shown, ...buffer.slice(0, PAGE_SIZE)], buffer: buffer.slice(PAGE_SIZE), page, loading: false };
  };

  const loadInitial = async () => {
    setStep('LOADING');
    try {
      const seen = new Set<string>();
      const results = await Promise.all(SECTIONS.map((s) => growSection(s.key, emptySection(), seen)));
      const next = {} as Record<SectionKey, SectionState>;
      SECTIONS.forEach((s, i) => { next[s.key] = results[i]; });
      setSections(next);
    } catch (e) {
      console.error("Erreur API:", e);
    }
    setStep('GRID');
  };

  const loadMore = async (key: SectionKey) => {
    const current = sections[key];
    if (current.loading) return;
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    const seen = new Set<string>();
    Object.values(sections).forEach((sec) => [...sec.shown, ...sec.buffer].forEach((it) => seen.add(keyOf(it))));
    const updated = await growSection(key, { ...current, buffer: [...current.buffer] }, seen);
    setSections((prev) => ({ ...prev, [key]: updated }));
  };

  const toggleSelection = (item: any) => {
    const next = new Map(selected);
    const k = keyOf(item);
    if (next.has(k)) next.delete(k); else next.set(k, item);
    setSelected(next);
  };

  const countFor = (key: SectionKey) =>
    sections[key].shown.filter((it) => selected.has(keyOf(it))).length;

  const finish = async () => {
    setStep('SAVING');
    try {
      // 1. On FUSIONNE avec les préférences existantes (avant : écrasées → favoris perdus)
      await supabase.from("profiles").update({
        preferences: { ...existingPrefs, calibrated: true }
      }).eq("id", userId);

      const items = Array.from(selected.values());
      if (items.length > 0) {
        // 2. Cache média (titres / affiches pour Profil & Ma Liste)
        await supabase.from("media_cache").upsert(items.map((it) => ({
          tmdb_id: it.id,
          media_type: it.media_type,
          title: it.title || it.name,
          poster_path: it.poster_path,
          vote_average: it.vote_average,
          release_date: it.release_date || it.first_air_date,
        })), { onConflict: "tmdb_id,media_type" });

        // 3. Interactions avec le BON media_type (avant : tout était enregistré en 'movie')
        await supabase.from("user_interactions").upsert(items.map((it) => ({
          user_id: userId,
          tmdb_id: it.id,
          media_type: it.media_type,
          is_liked: true,
          is_seen: true,
          in_list: false,
        })), { onConflict: "user_id,tmdb_id,media_type" });
      }
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      router.push("/dashboard");
    }
  };

  // --- RENDU ---
  return (
    <div style={styles.container}>
      {(step === 'LOADING' || step === 'SAVING') && (
        <div style={styles.centerBox}>
          <div className="spinner"></div>
          <p style={{ marginTop: "20px", color: "#aaa", fontSize: "1.2rem" }}>
             {step === 'LOADING' ? "Chargement des incontournables..." : "Création de ton univers..."}
          </p>
        </div>
      )}

      {step === 'GRID' && (
        <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "2.5rem" }}>Tes coups de cœur 🍿</h1>
            <p style={{ color: "#aaa", fontSize: "1.1rem" }}>
              Sélectionne au moins 3 œuvres que tu as vues et aimées. Plus tu pioches dans les différentes catégories, plus tes recommandations seront justes.
            </p>
          </div>

          {SECTIONS.map((sec) => {
            const state = sections[sec.key];
            const count = countFor(sec.key);
            return (
              <section key={sec.key} style={{ marginBottom: "50px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "15px" }}>
                  <h2 style={{ fontSize: "1.5rem", margin: 0 }}>{sec.title}</h2>
                  {count > 0 && <span style={{ color: "#46d369", fontWeight: "bold" }}>{count} sélectionné{count > 1 ? "s" : ""}</span>}
                </div>
                <div style={styles.movieGrid}>
                  {state.shown.map((item) => {
                    const isSelected = selected.has(keyOf(item));
                    return (
                      <div
                        key={keyOf(item)}
                        onClick={() => toggleSelection(item)}
                        style={{
                          position: "relative", aspectRatio: "2/3", borderRadius: "10px", overflow: "hidden", cursor: "pointer",
                          transform: isSelected ? "scale(0.95)" : "scale(1)",
                          outline: isSelected ? "3px solid #46d369" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} alt={item.title || item.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        {isSelected && <div style={styles.checkBadge}>✓</div>}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "linear-gradient(to top, black, transparent)" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "bold", textShadow: "0 1px 3px black" }}>{item.title || item.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
                  <button onClick={() => loadMore(sec.key)} disabled={state.loading} style={styles.secondaryBtn}>
                    {state.loading ? "Chargement..." : `🔄 Voir plus de ${sec.title.replace(/^\S+\s/, "").toLowerCase()}`}
                  </button>
                </div>
              </section>
            );
          })}

          <div style={{ height: "80px" }} />

          <div style={styles.bottomBar}>
             <button 
               className={selected.size >= 3 ? "cta-primary" : undefined}
               onClick={finish}
               disabled={selected.size < 3}
               style={{
                 ...styles.mainBtn,
                 width: "auto", padding: "15px 50px",
                 background: selected.size >= 3 ? "#e50914" : "#333",
                 cursor: selected.size >= 3 ? "pointer" : "not-allowed"
               }}
             >
               {selected.size < 3 ? `Encore ${3 - selected.size}...` : `C'EST PARTI (${selected.size}) ➤`}
             </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spinner { width: 50px; height: 50px; border: 4px solid #333; border-top: 4px solid #e50914; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// 2. WRAPPER SUSPENSE (Pour Next.js)
export default function CalibrationUltimatePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#141414" }}>
        <div className="spinner" style={{ width: "50px", height: "50px", border: "4px solid #333", borderTop: "4px solid #e50914", borderRadius: "50%" }}></div>
      </div>
    }>
      <CalibrationContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" },
  centerBox: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" },

  movieGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "15px" },
  checkBadge: { position: "absolute", top: "10px", right: "10px", width: "30px", height: "30px", borderRadius: "50%", background: "#46d369", color: "black", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", zIndex: 10 },
  
  mainBtn: { width: "100%", padding: "18px", borderRadius: "30px", border: "none", backgroundColor: "#e50914", color: "white", fontSize: "1.1rem", fontWeight: "bold", transition: "0.2s", cursor: "pointer", boxShadow: "0 5px 15px rgba(229, 9, 20, 0.4)" },
  secondaryBtn: { padding: "15px 30px", borderRadius: "30px", border: "1px solid #555", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: "1rem", transition: "0.2s" },
  bottomBar: { position: "fixed", bottom: "0", left: "0", right: "0", padding: "30px", pointerEvents: "auto", background: "linear-gradient(to top, rgba(0,0,0,0.95), transparent)", display: "flex", justifyContent: "center", zIndex: 100 },
};