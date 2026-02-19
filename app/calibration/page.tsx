"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type StepType = 'LOADING' | 'GRID' | 'SAVING';

// 1. COMPOSANT INTERNE (Logique)
function CalibrationContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- STATES ---
  const [step, setStep] = useState<StepType>('LOADING');
  const [userId, setUserId] = useState("");
  
  // Grid
  const [movies, setMovies] = useState<any[]>([]);
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  // --- INIT & FETCH DES FILMS ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
      const isRecalibrating = searchParams.get('rec') === 'true';
      
      // Si l'utilisateur est déjà calibré, on le renvoie au dashboard
      if (profile?.preferences?.calibrated && !isRecalibrating) { 
          router.push("/dashboard"); 
          return; 
      }
      
      // On charge directement les films !
      fetchInitialMovies();
    };
    init();
  }, [router, supabase, searchParams]);

  const fetchInitialMovies = async () => {
    setStep('LOADING');
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    
    try {
      // On mixe les "Tendances de la semaine" et les "Populaires globaux" pour avoir des hits évidents
      const [trendingRes, popularRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=fr-FR`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=fr-FR&page=1`).then(r => r.json())
      ]);
      
      const results = [...(trendingRes.results || []), ...(popularRes.results || [])];

      // Supprimer les doublons et mélanger un peu
      const uniqueMovies = Array.from(new Map(results.map((item: any) => [item.id, item])).values());
      const shuffled = uniqueMovies.sort(() => 0.5 - Math.random());
      
      setMovies(shuffled.slice(0, 24)); 
      setStep('GRID');
    } catch (e) {
      console.error("Erreur API:", e);
      setStep('GRID');
    }
  };

  const loadMoreMovies = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=fr-FR&page=${nextPage}`);
        const data = await res.json();
        const newCandidates = data.results || [];
        
        setMovies(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNewMovies = newCandidates.filter((m: any) => !existingIds.has(m.id));
            return [...prev, ...uniqueNewMovies];
        });
    } catch(e) { console.error("Erreur loadMore:", e); }
  };

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedMovieIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMovieIds(newSet);
  };

  const finish = async () => {
    setStep('SAVING');
    try {
      // 1. Mettre à jour le profil avec un flag "calibrated" 
      await supabase.from("profiles").update({
        preferences: {
            calibrated: true
        }
      }).eq("id", userId);

      // 2. Sauvegarder les films sélectionnés (Vu ET Aimé)
      if (selectedMovieIds.size > 0) {
        const interactions = Array.from(selectedMovieIds).map(id => ({
            user_id: userId,
            tmdb_id: id,
            media_type: 'movie',
            is_liked: true,
            is_seen: true,
            in_list: false
        }));
        await supabase.from("user_interactions").upsert(interactions);
      }
      
      // 3. Direction le Dashboard !
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
             {step === 'LOADING' ? "Chargement des meilleurs films..." : "Création de ton univers..."}
          </p>
        </div>
      )}

      {step === 'GRID' && (
        <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "2.5rem" }}>Tes films favoris 🍿</h1>
            <p style={{ color: "#aaa", fontSize: "1.1rem" }}>Sélectionne au moins 3 films que tu as vus et aimés pour lancer l'algorithme.</p>
          </div>
          
          <div style={styles.movieGrid}>
            {movies.map((movie) => {
              const isSelected = selectedMovieIds.has(movie.id);
              return (
                <div 
                  key={movie.id}
                  onClick={() => toggleSelection(movie.id)}
                  style={{
                    position: "relative", aspectRatio: "2/3", borderRadius: "10px", overflow: "hidden", cursor: "pointer",
                    transform: isSelected ? "scale(0.95)" : "scale(1)",
                    border: isSelected ? "3px solid #46d369" : "none",
                    opacity: (selectedMovieIds.size > 0 && !isSelected) ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                >
                  <img src={movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : "https://via.placeholder.com/300x450"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {isSelected && <div style={styles.checkBadge}>✓</div>}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "linear-gradient(to top, black, transparent)" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "bold", textShadow: "0 1px 3px black" }}>{movie.title}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "40px 0 100px 0" }}>
             <button onClick={loadMoreMovies} style={styles.secondaryBtn}>🔄 Charger d'autres films</button>
          </div>

          <div style={styles.bottomBar}>
             <button 
               onClick={finish}
               disabled={selectedMovieIds.size < 3}
               style={{
                 ...styles.mainBtn,
                 width: "auto", padding: "15px 50px",
                 background: selectedMovieIds.size >= 3 ? "#e50914" : "#333",
                 cursor: selectedMovieIds.size >= 3 ? "pointer" : "not-allowed"
               }}
             >
               {selectedMovieIds.size < 3 ? `Encore ${3 - selectedMovieIds.size}...` : `C'EST PARTI (${selectedMovieIds.size}) ➤`}
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