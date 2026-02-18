"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../../components/Navbar";

// --- CONFIGURATION GENRES ---
const ARCHETYPE_TO_GENRES: Record<string, string> = { 
  "VISIONARY": "878|14", "ACTION": "28|12", "EMOTIONAL": "18|10749", 
  "ANALYST": "9648|80", "THRILL": "27|53", "COMEDY": "35", "INTELLECTUAL": "36|99" 
};

const GENRE_MAP_MOVIE_TO_TV: Record<number, number> = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 27: 9648 };
const convertGenresToTV = (ids: number[]): string => {
    return ids.map(id => GENRE_MAP_MOVIE_TO_TV[id] || id).join('|');
};

const BANNED_TV_GENRES = "10763,10764,10766,10767"; 
const ANIMATION_GENRE_ID = 16;

type CategorySlot = {
    id: string; 
    label: string;
    items: any[];
    currentIndex: number;
    source?: string;
};

export default function PartyRoomPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const code = params.code as string;

  // STATES
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  
  const [gameState, setGameState] = useState<'waiting' | 'oracle' | 'match' | 'searching'>('waiting');
  const gameStateRef = useRef(gameState); 

  const [categories, setCategories] = useState<CategorySlot[]>([]);
  const [ratingItem, setRatingItem] = useState<number | null>(null);

  const [myLikes, setMyLikes] = useState<number[]>([]); 
  const [filterMode, setFilterMode] = useState<'trending' | 'classic'>('trending');
  
  const [finalMatch, setFinalMatch] = useState<any>(null);
  const skippedMatchesRef = useRef<number[]>([]); 
  
  const [loading, setLoading] = useState(false); // Mis à false par défaut pour waiting

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // --- INIT ---
  useEffect(() => {
    if (!code) return;
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data: session } = await supabase.from("match_sessions").select("id").eq("code", code).single();
        if (!session) { 
            if (code) { alert("Session introuvable"); router.push("/party"); }
            return; 
        }
        setSessionId(session.id);
        
        await supabase.from("session_members").upsert({ session_id: session.id, user_id: user.id }, { onConflict: "session_id,user_id" });
        checkMembers(session.id);
    };
    init();
  }, [code]);

  // BOUCLES
  useEffect(() => {
      if (!sessionId || gameState === 'match') return;
      const interval = setInterval(() => { checkForMatch(sessionId); }, 2000);
      return () => clearInterval(interval);
  }, [sessionId, gameState]);

  useEffect(() => {
      if (!sessionId || gameState === 'match') return;
      const interval = setInterval(() => { checkMembers(sessionId); }, 3000);
      return () => clearInterval(interval);
  }, [sessionId, gameState]);

  useEffect(() => {
      if (gameState === 'oracle') {
          setCategories([]); 
          generateOracleSuggestions(sessionId);
      }
  }, [filterMode]);

  // --- LOGIQUE ---

  const checkMembers = async (sessId: string) => {
      if (gameStateRef.current === 'match') return;
      // On récupère les profils liés
      const { data: mems } = await supabase.from("session_members").select("user_id, profile:profiles!user_id(username, avatar_url)").eq("session_id", sessId);
      
      if (mems) {
          // Astuce pour rafraichir si un nouveau membre arrive
          const currentCount = members.length;
          const newCount = mems.length;
          if (newCount !== currentCount) {
              setMembers(mems);
          }
      }
  };

  const generateOracleSuggestions = async (sessId: string) => {
      setLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const baseUrl = "https://api.themoviedb.org/3";

      try {
          const { data: allPrefs } = await supabase.rpc('get_session_preferences', { session_uuid: sessId });
          const { data: burnedIds } = await supabase.rpc('get_session_burned_ids', { session_uuid: sessId });
          const burnedSet = new Set(burnedIds?.map((b:any) => b.tmdb_id) || []);

          const genreCounts: Record<number, number> = {};
          
          allPrefs?.forEach((p: any) => {
               let userGenres: number[] = [];
               if (p.preferences?.genres) {
                   userGenres = p.preferences.genres;
               } else if (p.preferences?.archetype) {
                   userGenres = (ARCHETYPE_TO_GENRES[p.preferences.archetype] || "").split(',').map(Number);
               }
               userGenres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
          });

          const sortedGenres = Object.keys(genreCounts)
            .map(Number)
            .sort((a, b) => genreCounts[b] - genreCounts[a])
            .slice(0, 4);

          const blendedMovieGenres = sortedGenres.join('|');
          const blendedTVGenres = convertGenresToTV(sortedGenres);

          let sortParam = "";
          let dateParamMovie = "";
          let dateParamTV = "";
          
          if (filterMode === 'classic') {
              sortParam = "&sort_by=vote_count.desc"; 
              dateParamMovie = "&primary_release_date.lte=2015-12-31"; 
              dateParamTV = "&first_air_date.lte=2015-12-31"; 
          } else {
              sortParam = "&sort_by=popularity.desc";
              dateParamMovie = "&primary_release_date.gte=2020-01-01";
              dateParamTV = "&first_air_date.gte=2020-01-01";
          }

          const baseParams = `api_key=${apiKey}&language=fr-FR${sortParam}&vote_average.gte=6.0&vote_count.gte=100&page=1`;

          const queries = [
              fetch(`${baseUrl}/discover/movie?${baseParams}${dateParamMovie}&with_genres=${blendedMovieGenres}&without_genres=${ANIMATION_GENRE_ID}`),
              fetch(`${baseUrl}/discover/tv?${baseParams}${dateParamTV}&with_genres=${blendedTVGenres}&without_genres=${ANIMATION_GENRE_ID},${BANNED_TV_GENRES}`),
              fetch(`${baseUrl}/discover/movie?${baseParams}${dateParamMovie}&with_genres=${ANIMATION_GENRE_ID}`),
              fetch(`${baseUrl}/discover/tv?${baseParams}${dateParamTV}&with_genres=${ANIMATION_GENRE_ID}&with_original_language=ja`)
          ];

          const responses = await Promise.all(queries);
          const results = await Promise.all(responses.map(r => r.json()));

          const processResults = (apiItems: any[], type: string) => {
              return (apiItems || [])
                .filter((i: any) => !burnedSet.has(i.id) && i.poster_path) 
                .map((i: any) => ({ ...i, media_type: type }))
                .slice(0, 15);
          };

          const newCategories: CategorySlot[] = [
              { id: 'movie', label: '🎬 Films', currentIndex: 0, items: processResults(results[0].results, 'movie') },
              { id: 'tv', label: '📺 Séries', currentIndex: 0, items: processResults(results[1].results, 'tv') },
              { id: 'anim', label: '🎨 Animation', currentIndex: 0, items: processResults(results[2].results, 'movie') },
              { id: 'anime', label: '👺 Animés', currentIndex: 0, items: processResults(results[3].results, 'tv') },
          ];

          setCategories(newCategories);
          // Si on était en loading manuel depuis le bouton, on passe en oracle
          if (gameState === 'waiting' || gameState === 'searching') {
             setGameState('oracle');
          }

      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- ACTIONS ---

  const handleStartGame = () => {
      setGameState('oracle');
      setLoading(true);
      generateOracleSuggestions(sessionId);
  };

  const handleHeart = async (item: any) => {
      setMyLikes(prev => [...prev, item.id]);
      if (!item.poster_path) return;
      const cleanPosterPath = item.poster_path.startsWith('/') ? item.poster_path : `/${item.poster_path}`;

      await supabase.from("media_cache").upsert({
          tmdb_id: item.id, media_type: item.media_type, 
          title: item.title || item.name, poster_path: cleanPosterPath, vote_average: item.vote_average
      }, { onConflict: "tmdb_id,media_type" });

      await supabase.from("user_interactions").upsert({
          user_id: userId, tmdb_id: item.id, media_type: item.media_type,
          in_list: true, is_seen: false, is_liked: true, updated_at: new Date().toISOString()
      }, { onConflict: "user_id,tmdb_id,media_type" });

      checkForMatch(sessionId);
  };

  const handleNext = (slotIndex: number) => {
      setCategories(prev => {
          const newCats = [...prev];
          const len = newCats[slotIndex].items.length;
          if (len > 0) newCats[slotIndex].currentIndex = (newCats[slotIndex].currentIndex + 1) % len;
          return newCats;
      });
      setRatingItem(null);
  };

  const handleSeenClick = (itemId: number) => setRatingItem(itemId === ratingItem ? null : itemId);

  const handleRateSeen = async (item: any, liked: boolean, slotIndex: number) => {
      await supabase.from("user_interactions").upsert({
          user_id: userId, tmdb_id: item.id, media_type: item.media_type,
          is_seen: true, is_liked: liked, in_list: false, updated_at: new Date().toISOString()
      }, { onConflict: "user_id,tmdb_id,media_type" });
      handleNext(slotIndex);
  };

  const checkForMatch = async (sessId: string) => {
      const { data: matches } = await supabase.rpc('get_session_matches', { session_uuid: sessId });
      if (matches && matches.length > 0) {
          const validMatches = matches.filter((m: any) => !skippedMatchesRef.current.includes(m.tmdb_id));
          if (validMatches.length > 0) {
              validMatches.sort((a: any, b: any) => new Date(b.last_liked_at).getTime() - new Date(a.last_liked_at).getTime());
              setFinalMatch(validMatches[0]);
              setGameState('match');
          }
      }
  };

  const handleSkipMatch = () => {
      if (!finalMatch) return;
      skippedMatchesRef.current.push(finalMatch.tmdb_id);
      setFinalMatch(null);
      setGameState('searching');
      setTimeout(() => { setGameState('oracle'); }, 1000);
  };

  const handleBack = () => { if (confirm("Quitter le salon ?")) router.push('/party'); };

  const getPosterUrl = (path: string | null | undefined) => {
      if (!path || path === "undefined" || path === "null") return "https://via.placeholder.com/500x750?text=Affiche+Manquante";
      if (path.startsWith("http")) return path;
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `https://image.tmdb.org/t/p/w500${cleanPath}`;
  };

  // --- RENDER ---

  // 1. WAITING ROOM (Avec Bouton !)
  if (gameState === 'waiting') {
    return (
      // On modifie ce div :
      <div style={{ 
          minHeight: "100vh", 
          color: "white", 
          display: "flex", 
          flexDirection: "column", 
          fontFamily: "sans-serif",
          // --- NOUVEAU BACKGROUND (L'ANCIEN DE L'ACCUEIL) ---
          backgroundImage: "url('/party-bg.jpg')", // Pointe vers l'image cinéma
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          // On ajoute un voile sombre pour que les avatars ressortent bien
          backgroundColor: "rgba(0,0,0,0.6)", 
          backgroundBlendMode: "overlay"
          // --------------------------------------------------
      }}>
          <Navbar />
            <button onClick={handleBack} style={{ position: "absolute", top: "80px", left: "20px", background: "none", border: "none", color: "#aaa", fontSize: "1.2rem", cursor: "pointer" }}>⬅ Retour</button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <div style={{ fontSize: "4rem", marginBottom: "20px", animation: "pulse 1.5s infinite" }}>⏳</div>
                <h1>En attente des joueurs...</h1>
                <p>Code Salon : <span style={{ color: "#e50914", fontWeight: "bold", fontSize: "1.5rem", letterSpacing: "2px" }}>{code}</span></p>
                
                <div style={{ display: "flex", gap: "20px", margin: "40px 0", justifyContent: "center", flexWrap: "wrap", minHeight: "80px" }}>
                    {members.map((m, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "popIn 0.5s" }}>
                             <img src={m.profile?.avatar_url || "https://via.placeholder.com/100"} style={{ width: "80px", height: "80px", borderRadius: "50%", border: "3px solid #46d369", objectFit: "cover", boxShadow: "0 0 15px rgba(70, 211, 105, 0.4)" }} />
                             <span style={{ marginTop: "10px", fontWeight: "bold" }}>{m.profile?.username || "Joueur"}</span>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px", alignItems: "center" }}>
                    <button 
                        onClick={handleStartGame}
                        style={{ 
                            padding: "15px 40px", 
                            background: "#e50914", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "30px", 
                            fontSize: "1.2rem", 
                            fontWeight: "bold", 
                            cursor: "pointer", 
                            boxShadow: "0 5px 20px rgba(229, 9, 20, 0.4)",
                            animation: members.length > 0 ? "popIn 0.5s" : "none"
                        }}
                    >
                        LANCER LA RECHERCHE 🚀
                    </button>
                    {members.length < 2 && <p style={{color: "#666", fontStyle: "italic", fontSize: "0.9rem"}}>Vous pouvez tester en solo ou attendre un ami.</p>}
                </div>
            </div>
            <style jsx>{` @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } } @keyframes popIn { from { transform: scale(0); opacity:0; } to { transform: scale(1); opacity:1; } } `}</style>
        </div>
      );
  }

  // 2. SEARCHING
  if (gameState === 'searching' || (gameState === 'oracle' && loading)) {
      return (
        <div style={{ minHeight: "100vh", background: "#141414", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div className="spinner"></div>
            <p style={{ marginTop: "20px", color: "#aaa" }}>Synchronisation des goûts...</p>
            <style jsx>{` .spinner { width: 50px; height: 50px; border: 4px solid #333; border-top: 4px solid #e50914; borderRadius: 50%; animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } `}</style>
        </div>
      );
  }

  // 3. MATCH SCREEN
  if (gameState === 'match' && finalMatch) {
      return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1f0000 0%, #141414 100%)", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: "20px" }}>
            <div style={{ animation: "popIn 0.5s", textAlign: "center" }}>
                <h1 style={{ fontSize: "3.5rem", textShadow: "0 0 20px #e50914", margin: "0 0 10px 0" }}>IT'S A MATCH! 🔥</h1>
                <p style={{ fontSize: "1.2rem", marginBottom:"30px", color: "#ccc" }}>Tout le monde veut voir :</p>
                
                <div style={{ 
                    position: "relative", width: "280px", aspectRatio: "2/3", margin: "0 auto 30px auto", 
                    borderRadius: "15px", overflow: "hidden", boxShadow: "0 0 40px rgba(229, 9, 20, 0.6)",
                    border: "4px solid white", transform: "rotate(-2deg)"
                }}>
                    <img src={getPosterUrl(finalMatch.poster_path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={finalMatch.title} />
                </div>

                <h2 style={{ fontSize: "2rem", marginBottom: "30px", fontWeight: "bold", maxWidth: "90%", margin: "0 auto 30px auto" }}>{finalMatch.title || finalMatch.name}</h2>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", maxWidth: "350px", margin: "0 auto" }}>
                    <button onClick={() => router.push(`/movie/${finalMatch.tmdb_id}?type=${finalMatch.media_type}&returnTo=${code}`)} style={{ padding: "18px", background: "#e50914", color: "white", border: "none", borderRadius: "50px", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", boxShadow: "0 5px 15px rgba(0,0,0,0.3)" }}>Voir les détails 🍿</button>
                    <button onClick={handleSkipMatch} style={{ padding: "15px", background: "rgba(255,255,255,0.1)", color: "#ccc", border: "1px solid #555", borderRadius: "50px", fontSize: "0.9rem", cursor: "pointer" }}>Chercher un autre match ⏭️</button>
                </div>
            </div>
            <style jsx>{` @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } } `}</style>
        </div>
      );
  }

  // 4. SELECTION SCREEN (GRID)
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px" }}>
         <button onClick={handleBack} style={{ background: "none", border: "none", color: "#aaa", fontSize: "1rem", cursor: "pointer" }}>⬅ Quitter</button>
         <div style={{color: "#46d369", fontSize: "0.9rem", fontWeight:"bold"}}>🟢 {members.length} connectés</div>
      </div>
      
      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ color: "#e50914", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "10px" }}>Sélection du Groupe 🔮</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "15px" }}>
                <button onClick={() => setFilterMode('trending')} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: filterMode === 'trending' ? "#e50914" : "#333", color: "white", fontWeight: "bold", cursor: "pointer" }}>🔥 Tendances</button>
                <button onClick={() => setFilterMode('classic')} style={{ padding: "8px 20px", borderRadius: "20px", border: "none", background: filterMode === 'classic' ? "#e50914" : "#333", color: "white", fontWeight: "bold", cursor: "pointer" }}>🏆 Classiques</button>
            </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px" }}>
            {categories.map((cat, index) => {
                const item = cat.items[cat.currentIndex];
                if (!item) return (
                    <div key={cat.id} style={{ backgroundColor: "#1f1f1f", borderRadius: "10px", height: "500px", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", flexDirection:"column", border: "1px dashed #333" }}>
                        <span style={{fontSize:"2rem"}}>🏁</span>
                        <p>{cat.label} épuisé</p>
                    </div>
                );

                const isLiked = myLikes.includes(item.id);
                const title = item.title || item.name;
                const isRatingThis = ratingItem === item.id;

                return (
                    <div key={`${cat.id}-${item.id}`} style={{ backgroundColor: "#1f1f1f", borderRadius: "10px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
                        <div style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.8)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold", zIndex: 1, border: "1px solid #555" }}>{cat.label}</div>
                        
                        <div style={{ position: "relative", flex: 1, minHeight: "400px" }}>
                            <img src={getPosterUrl(item.poster_path)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isLiked ? 0.4 : 1 }} />
                            {isRatingThis && (
                                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", animation: "fadeIn 0.2s", zIndex: 10 }}>
                                    <p style={{ fontWeight: "bold", fontSize: "1.2rem" }}>Déjà vu ?</p>
                                    <div style={{ display: "flex", gap: "30px" }}>
                                        <button onClick={() => handleRateSeen(item, true, index)} style={{ fontSize: "3rem", background: "none", border: "none", cursor: "pointer" }}>👍</button>
                                        <button onClick={() => handleRateSeen(item, false, index)} style={{ fontSize: "3rem", background: "none", border: "none", cursor: "pointer" }}>👎</button>
                                    </div>
                                    <button onClick={() => setRatingItem(null)} style={{ color: "#aaa", background: "none", border: "none", marginTop: "20px", cursor: "pointer" }}>Annuler</button>
                                </div>
                            )}
                        </div>
                        
                        <div style={{ padding: "15px", background: "#222", borderTop: "1px solid #333" }}>
                            <h3 style={{ fontSize: "1rem", margin: "0 0 15px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign:"center" }}>{title}</h3>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button onClick={() => handleSeenClick(item.id)} style={{ flex: 1, padding: "12px", background: "#333", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>👁️</button>
                                <button onClick={() => handleNext(index)} style={{ flex: 1, padding: "12px", background: "#333", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>⏭️</button>
                                <button onClick={() => !isLiked && handleHeart(item)} disabled={isLiked} style={{ flex: 1, padding: "12px", background: isLiked ? "#222" : "#e50914", color: "white", border: "1px solid " + (isLiked ? "#444" : "#e50914"), borderRadius: "8px", cursor: isLiked ? "default" : "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isLiked ? "none" : "0 4px 10px rgba(229, 9, 20, 0.4)" }}>{isLiked ? "⏳" : "❤️"}</button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
      <style jsx>{` @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } `}</style>
    </div>
  );
}