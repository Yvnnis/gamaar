"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// --- ALGO DE CORRECTION (LEVENSHTEIN) ---
const getLevenshteinDistance = (a: string, b: string) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// --- CONFIGURATION AVATARS (OPEN PEEPS STYLE) ---
const AVATAR_MAP = [
  { 
    id: "visionary", 
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Felix&clothing=geeky", 
    label: "Le Visionnaire", 
    sub: "Science-Fiction",
    archetype: "VISIONARY", 
    genres: "878,14,12" 
  },
  { 
    id: "action", 
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Aneka&face=calm", 
    label: "L'Intrépide", 
    sub: "Action & Aventure",
    archetype: "ACTION", 
    genres: "28,12,80" 
  },
  { 
    id: "analyst", 
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Christopher&face=serious", 
    label: "Le Stratège", 
    sub: "Thriller & Mystère",
    archetype: "ANALYST", 
    genres: "9648,53,80" 
  },
  { 
    id: "emotional", 
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Molly&face=cute", 
    label: "L'Idéaliste", 
    sub: "Romance & Drame",
    archetype: "EMOTIONAL", 
    genres: "10749,18,35" 
  },
  { 
    id: "thrill", 
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Boo&face=concerned", 
    label: "Le Frisson", 
    sub: "Horreur",
    archetype: "THRILL", 
    genres: "27,53" 
  },
  { 
    id: "comedy", 
    // ✅ CORRECTION ICI : 'smileBig' fonctionne mieux que 'laugh'
    src: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Buddy&face=smileBig", 
    label: "Le Rigolo", 
    sub: "Comédie",
    archetype: "COMEDY", 
    genres: "35,10751" 
  },
];

// --- QUIZ DATA ---
const DILEMMAS = [
  {
    question: "Morpheus te tend deux pilules. Laquelle choisis-tu ?",
    options: [
      { label: "🔵 La Bleue : L'ignorance et le bonheur.", archetype: "EMOTIONAL" },
      { label: "🔴 La Rouge : La vérité, aussi brutale soit-elle.", archetype: "ANALYST" },
      { label: "👊 Je refuse de choisir, je me bats !", archetype: "ACTION" },
      { label: "✨ Je vois le code, je change la réalité.", archetype: "VISIONARY" },
    ]
  },
  {
    question: "Le Joker menace Gotham. Tu dois sauver quelqu'un...",
    options: [
      { label: "❤️ L'amour de ma vie (Rachel).", archetype: "EMOTIONAL" },
      { label: "⚖️ Le symbole de la justice (Harvey Dent).", archetype: "ANALYST" },
      { label: "🔥 Je fonce dans le tas pour arrêter le Joker.", archetype: "ACTION" },
      { label: "🦇 Je me sacrifie pour la ville.", archetype: "VISIONARY" },
    ]
  },
  {
    question: "La Terre se meurt. La mission Lazarus commence...",
    options: [
      { label: "🚀 Je pars seul dans l'espace inconnu.", archetype: "VISIONARY" },
      { label: "🏡 Je reste pour mourir avec ma famille.", archetype: "EMOTIONAL" },
      { label: "🛠️ Je construis une arche pour sauver tout le monde.", archetype: "ACTION" },
      { label: "🧮 Je résous l'équation de la gravité d'abord.", archetype: "ANALYST" },
    ]
  }
];

type StepType = 'LOADING' | 'IDENTITY' | 'QUIZ' | 'FAVORITES' | 'GRID' | 'SAVING';

export default function CalibrationUltimatePage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- STATES ---
  const [step, setStep] = useState<StepType>('LOADING');
  const [userId, setUserId] = useState("");
  
  // 1. Identity
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState<number | null>(null);
  const [pseudo, setPseudo] = useState("");

  // 2. Quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({ VISIONARY: 0, ACTION: 0, EMOTIONAL: 0, ANALYST: 0, THRILL: 0 });

  // 3. Favorites
  const [favorites, setFavorites] = useState({ movie: "", director: "", actor: "" });

  // 4. Grid
  const [movies, setMovies] = useState<any[]>([]);
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [gridGenreBase, setGridGenreBase] = useState(""); 

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("username, preferences").eq("id", user.id).single();
      
      if (profile?.username && !profile.username.startsWith("User-")) setPseudo(profile.username);
      
      const isRecalibrating = searchParams.get('rec') === 'true';
      
      if (profile?.preferences?.archetype && !isRecalibrating) { 
          router.push("/mood"); 
          return; 
      }
      
      if (profile?.preferences?.archetype) {
          const preSelectedIdx = AVATAR_MAP.findIndex(a => a.archetype === profile.preferences.archetype);
          if (preSelectedIdx !== -1) setSelectedAvatarIdx(preSelectedIdx);
      }
      
      setStep('IDENTITY');
    };
    init();
  }, [router, supabase, searchParams]);


  // --- HANDLERS ---

  const submitIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAvatarIdx === null || !pseudo.trim()) return;
    setStep('QUIZ');
  };

  const handleQuizChoice = (archetype: string) => {
    setScores(prev => ({ ...prev, [archetype]: prev[archetype] + 1 }));
    if (quizIndex < DILEMMAS.length - 1) {
      setQuizIndex(prev => prev + 1);
    } else {
      setStep('FAVORITES');
    }
  };

  const smartResolve = async (query: string, type: 'person' | 'movie'): Promise<{id: number, name: string} | null> => {
      if (!query || query.trim().length < 2) return null;
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      try {
          const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=fr-FR`);
          const data = await res.json();
          const results = data.results || [];
          if (results.length === 0) return null;

          let bestMatch = null;
          let bestDist = 999;

          for (const item of results) {
              const name = type === 'movie' ? (item.title || item.name) : item.name;
              const dist = getLevenshteinDistance(query, name);
              if (dist < bestDist && dist < 5) { 
                  bestDist = dist;
                  bestMatch = { id: item.id, name: name };
              }
              else if (name.toLowerCase().includes(query.toLowerCase()) && bestMatch === null) {
                   bestMatch = { id: item.id, name: name };
              }
          }
          return bestMatch || { id: results[0].id, name: type === 'movie' ? results[0].title : results[0].name };
      } catch (e) { return null; }
  };

  const submitFavorites = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('LOADING');

    const avatarArchetype = AVATAR_MAP[selectedAvatarIdx!];
    const genres = avatarArchetype.genres; 
    setGridGenreBase(genres);
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

    const correctedFavorites = { ...favorites };
    let resolvedDirectorId = null;
    let resolvedActorId = null;

    try {
        if (favorites.director) {
            const dir = await smartResolve(favorites.director, 'person');
            if (dir) { resolvedDirectorId = dir.id; correctedFavorites.director = dir.name; }
        }
        if (favorites.actor) {
            const act = await smartResolve(favorites.actor, 'person');
            if (act) { resolvedActorId = act.id; correctedFavorites.actor = act.name; }
        }
        if (favorites.movie) {
            const mov = await smartResolve(favorites.movie, 'movie');
            if (mov) correctedFavorites.movie = mov.name;
        }

        setFavorites(correctedFavorites);

        const promises = [];
        promises.push(fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&with_genres=${genres}&vote_count.gte=300&page=1`).then(r => r.json()));
        promises.push(fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=fr-FR`).then(r => r.json()));
        promises.push(fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&language=fr-FR&page=1`).then(r => r.json()));

        if (resolvedDirectorId) {
             promises.push(fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&with_crew=${resolvedDirectorId}`).then(r => r.json()));
        }
        if (resolvedActorId) {
             promises.push(fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&with_cast=${resolvedActorId}`).then(r => r.json()));
        }

        const results = await Promise.all(promises);
        let mixedMovies = [
            ...(results[0]?.results?.slice(0, 8) || []), 
            ...(results[1]?.results?.slice(0, 4) || []), 
            ...(results[2]?.results?.slice(0, 3) || [])  
        ];
        const specificMovies = [];
        if (resolvedDirectorId) specificMovies.push(...(results[3]?.results?.slice(0, 4) || []));
        const actorResultIndex = resolvedDirectorId ? 4 : 3;
        if (resolvedActorId && results[actorResultIndex]) specificMovies.push(...(results[actorResultIndex]?.results?.slice(0, 4) || []));

        if (specificMovies.length > 0) mixedMovies = [...specificMovies, ...mixedMovies];
        const shuffled = mixedMovies.sort(() => 0.5 - Math.random());
        const uniqueMovies = Array.from(new Map(shuffled.map(item => [item.id, item])).values());
        setMovies(uniqueMovies.slice(0, 24)); 
        setStep('GRID');
    } catch (e) {
        console.error("Erreur API:", e);
        const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`);
        const data = await res.json();
        setMovies(data.results || []);
        setStep('GRID');
    }
  };

  const loadMoreMovies = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    try {
        const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&with_genres=${gridGenreBase}&page=${nextPage}`);
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
    const avatarData = AVATAR_MAP[selectedAvatarIdx!];
    try {
      await supabase.from("profiles").update({
        username: pseudo.trim(),
        avatar_url: avatarData.src,
        preferences: {
            archetype: avatarData.archetype,
            genres: avatarData.genres.split(',').map(Number),
            favorites: favorites, 
            actors: []
        }
      }).eq("id", userId);
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
      router.push("/mood");
    } catch (e) {
      console.error(e);
      router.push("/mood");
    }
  };

  // --- RENDU ---
  return (
    <div style={styles.container}>
      {(step === 'LOADING' || step === 'SAVING') && (
        <div style={styles.centerBox}>
          <div className="spinner"></div>
          <p style={{ marginTop: "20px", color: "#aaa", fontSize: "1.2rem" }}>
             {step === 'LOADING' ? "Chargement..." : "Création de ton univers..."}
          </p>
        </div>
      )}

      {step === 'IDENTITY' && (
        <div style={styles.contentBox}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
             <h1 style={styles.title}>Confirme ton style</h1>
             <p style={styles.sub}>On a sélectionné cet avatar pour toi, mais tu peux en changer.</p>
          </div>

          <div style={styles.avatarGrid}>
            {AVATAR_MAP.map((av, idx) => {
              const isSelected = selectedAvatarIdx === idx;
              return (
                <div 
                  key={av.id} 
                  onClick={() => setSelectedAvatarIdx(idx)}
                  style={{
                    ...styles.avatarCard,
                    borderColor: isSelected ? "#e50914" : "transparent",
                    transform: isSelected ? "scale(1.05)" : "scale(1)",
                    opacity: (selectedAvatarIdx !== null && !isSelected) ? 0.6 : 1,
                    boxShadow: isSelected ? "0 10px 30px rgba(0,0,0,0.5)" : "none",
                    backgroundColor: "white", 
                  }}
                >
                  <img src={av.src} style={styles.avatarImg} alt={av.label} />
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#222" }}>{av.label}</div>
                  
                  {/* ✅ MODIFICATION ICI : TEXTE ROUGE */}
                  <div style={{ fontSize: "0.8rem", color: "#e50914", fontWeight: "bold", marginTop: "5px" }}>{av.sub}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "50px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <label style={styles.label}>TON NOM DE CODE</label>
            <input 
              value={pseudo} 
              onChange={e => setPseudo(e.target.value)} 
              placeholder="Ex: Neo" 
              style={styles.input} 
              maxLength={15}
            />
            <button 
              onClick={submitIdentity}
              disabled={selectedAvatarIdx === null || !pseudo}
              style={{...styles.mainBtn, opacity: (selectedAvatarIdx !== null && pseudo) ? 1 : 0.5}}
            >
              SUIVANT ➤
            </button>
          </div>
        </div>
      )}

      {step === 'QUIZ' && (
        <div style={styles.centerBox}>
          <div style={{ maxWidth: "900px", width: "100%", animation: "fadeIn 0.5s" }}>
            <div style={{ marginBottom: "20px", color: "#e50914", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px" }}>
               Dilemme {quizIndex + 1} / {DILEMMAS.length}
            </div>
            <h2 style={{ fontSize: "2rem", marginBottom: "50px", lineHeight: "1.3" }}>
               {DILEMMAS[quizIndex].question}
            </h2>
            <div style={styles.quizGrid}>
               {DILEMMAS[quizIndex].options.map((opt, i) => (
                 <button 
                   key={i} 
                   onClick={() => handleQuizChoice(opt.archetype)}
                   style={styles.quizCard}
                   onMouseOver={e => { e.currentTarget.style.borderColor = "#e50914"; e.currentTarget.style.backgroundColor = "#2a2a2a"; }}
                   onMouseOut={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.backgroundColor = "#1f1f1f"; }}
                 >
                    {opt.label}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}

      {step === 'FAVORITES' && (
         <div style={styles.centerBox}>
            <div style={{ maxWidth: "500px", width: "100%", animation: "fadeIn 0.5s" }}>
               <h1 style={{ fontSize: "2rem", marginBottom: "10px", textAlign: "center" }}>Tes Références 🌟</h1>
               <p style={{ color: "#aaa", textAlign: "center", marginBottom: "40px" }}>Dis-nous ce qui t'inspire (Optionnel)</p>
               <form onSubmit={submitFavorites} style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                  <div>
                    <label style={styles.label}>TON FILM CULTE</label>
                    <input value={favorites.movie} onChange={e => setFavorites({...favorites, movie: e.target.value})} placeholder="Ex: Inception" style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>TON RÉALISATEUR PRÉFÉRÉ</label>
                    <input value={favorites.director} onChange={e => setFavorites({...favorites, director: e.target.value})} placeholder="Ex: Nolan" style={styles.input} />
                  </div>
                  <div>
                    <label style={styles.label}>TON ACTEUR / ACTRICE PRÉFÉRÉ(E)</label>
                    <input value={favorites.actor} onChange={e => setFavorites({...favorites, actor: e.target.value})} placeholder="Ex: DiCaprio" style={styles.input} />
                  </div>
                  <button type="submit" style={styles.mainBtn}>GÉNÉRER MA SÉLECTION ➤</button>
                  <button type="button" onClick={submitFavorites} style={styles.secondaryBtn}>Je ne sais pas, passer cette étape</button>
               </form>
            </div>
         </div>
      )}

      {step === 'GRID' && (
        <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 1s" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "2rem" }}>Films favoris ❤️</h1>
            <p style={{ color: "#aaa" }}>Sélectionne au moins 3 films que tu as aimés.</p>
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
               {selectedMovieIds.size < 3 ? `Encore ${3 - selectedMovieIds.size}...` : `VALIDER (${selectedMovieIds.size}) ➤`}
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

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" },
  centerBox: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" },
  contentBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", maxWidth: "1000px", margin: "0 auto", animation: "fadeIn 0.5s" },
  
  title: { fontSize: "2.5rem", marginBottom: "10px", textAlign: "center" },
  sub: { color: "#aaa", fontSize: "1.1rem", marginBottom: "40px", textAlign: "center" },

  avatarGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "25px", width: "100%" },
  avatarCard: { background: "white", borderRadius: "15px", padding: "20px", border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", transition: "all 0.2s", textAlign: "center" },
  avatarImg: { width: "120px", height: "120px", borderRadius: "0%", objectFit: "contain", marginBottom: "20px" },

  label: { display: "block", marginBottom: "10px", color: "#ccc", fontSize: "0.8rem", letterSpacing: "1px" },
  input: { width: "100%", padding: "15px", borderRadius: "10px", background: "#333", border: "1px solid #444", color: "white", fontSize: "1.2rem", textAlign: "center", outline: "none" },
  
  quizGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "25px" },
  quizCard: { padding: "30px", background: "#1f1f1f", border: "2px solid #333", borderRadius: "15px", color: "white", fontSize: "1.2rem", textAlign: "left", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", minHeight: "100px", lineHeight: "1.4" },

  movieGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "15px" },
  checkBadge: { position: "absolute", top: "10px", right: "10px", width: "30px", height: "30px", borderRadius: "50%", background: "#46d369", color: "black", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" },
  
  mainBtn: { width: "100%", padding: "18px", borderRadius: "30px", border: "none", backgroundColor: "#e50914", color: "white", fontSize: "1.1rem", fontWeight: "bold", transition: "0.2s", cursor: "pointer", boxShadow: "0 5px 15px rgba(229, 9, 20, 0.4)" },
  secondaryBtn: { width: "100%", padding: "15px", borderRadius: "30px", border: "1px solid #555", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: "1rem", transition: "0.2s" },
  bottomBar: { position: "fixed", bottom: "0", left: "0", right: "0", padding: "30px", pointerEvents: "auto", background: "linear-gradient(to top, rgba(0,0,0,0.95), transparent)", display: "flex", justifyContent: "center", zIndex: 100 },
};