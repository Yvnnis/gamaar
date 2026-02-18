"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation"; 
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useMediaInteraction } from "../../hooks/useMediaInteraction";
import { createClient } from "@/utils/supabase/client"; 

// --- CONSTANTES ---
const MOVIE_GENRES: Record<string, string> = { 
  "VISIONARY": "878,14", "ACTION": "28,12", "EMOTIONAL": "18,10749", 
  "ANALYST": "9648,80", "THRILL": "27,53", "COMEDY": "35", "INTELLECTUAL": "36,99" 
};

const TV_GENRES: Record<string, string> = { 
  "VISIONARY": "10765", "ACTION": "10759", "EMOTIONAL": "18", 
  "ANALYST": "9648,80", "THRILL": "9648", "COMEDY": "35", "INTELLECTUAL": "99,10768" 
};

const ANIMATION_GENRE_ID = 16;
const GENRE_MAP_MOVIE_TO_TV: Record<number, number> = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 27: 9648 };

type CategoryKey = 'movie' | 'series' | 'animation' | 'anime';
type MatchLabel = "Match Parfait 🔥" | "Excellent ✨" | "Très Bon 👍" | "Recommandé";
type MediaItem = any & { matchScore: number; matchLabel: MatchLabel };

// --- UTILITAIRES ---
const convertGenresToTV = (genreString: string): string => {
    if (!genreString) return "";
    return genreString.split(',').map(idStr => {
        const id = parseInt(idStr);
        return GENRE_MAP_MOVIE_TO_TV[id] || id;
    }).join(',');
};

const getPersonId = async (query: string, apiKey: string) => {
    if (!query) return null;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      return data.results?.[0]?.id || null;
    } catch (e) { return null; }
};

// 🧠 SCORING V2 (Avec Pondération Temporelle)
const calculateMatch = (item: any, mood: any, archetype: string, mode: 'classics' | 'modern'): { score: number, label: MatchLabel } => {
    let score = (item.vote_average || 5) * 6; // Base sur 60 points max
    
    // 1. Bonus Mood (Le plus fort)
    if (mood && item.genre_ids) {
        const moodGenres = mood.genres.split(',').map(Number);
        if (item.genre_ids.some((id: number) => moodGenres.includes(id) || Object.values(GENRE_MAP_MOVIE_TO_TV).includes(id))) {
            score += 20;
        }
    }
    
    // 2. Bonus Archétype
    const archGenres = (MOVIE_GENRES[archetype] || "").split(',').map(Number);
    if (item.genre_ids && item.genre_ids.some((id: number) => archGenres.includes(id))) {
        score += 10;
    }

    // 3. Bonus Popularité / Vote
    if (item.vote_count > 2000) score += 5;

    // 4. 🔥 Bonus "Freshness" (Nouveauté) - Uniquement en mode Moderne
    if (mode === 'modern' && item.release_date) {
        const releaseYear = new Date(item.release_date).getFullYear();
        const currentYear = new Date().getFullYear();
        if (releaseYear >= currentYear - 1) {
            score += 10; // Gros bonus pour les films très récents
        } else if (releaseYear >= currentYear - 3) {
            score += 5;
        }
    }
    
    const finalScore = Math.min(99, Math.max(40, Math.round(score)));
    
    let label: MatchLabel = "Recommandé";
    if (finalScore >= 90) label = "Match Parfait 🔥";
    else if (finalScore >= 80) label = "Excellent ✨";
    else if (finalScore >= 70) label = "Très Bon 👍";
    return { score: finalScore, label };
};

// --- COMPOSANT CARTE PRINCIPALE ---
const MovieCard = ({ item, label, onAction, onPass }: { item: MediaItem, label: string, onAction: () => void, onPass: () => void }) => {
  const computedType = item?.media_type === 'movie' || item?.media_type === 'tv' ? item.media_type : (item?.name ? 'tv' : 'movie');
  const itemWithType = { ...item, media_type: computedType };
  
  const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(itemWithType, computedType);
  
  const handleInteract = async (actionFn: () => Promise<void>) => {
    await actionFn(); 
    setTimeout(() => { onAction(); }, 300); 
  };

  if (!item) return (
      <div style={{height: "100%", minHeight: "450px", background: "#1f1f1f", borderRadius: "10px", display:"flex", flexDirection: "column", alignItems:"center", justifyContent:"center", color: "#555"}}>
          <div className="spinner" style={{marginBottom: "10px"}}></div>
          <span>Recherche intelligente...</span>
      </div>
  );

  const title = item.title || item.name;
  const link = `/movie/${item.id}?type=${computedType}`;
  const imageUrl = "https://image.tmdb.org/t/p/w500";
  const dateStr = item.release_date || item.first_air_date;
  const year = dateStr ? new Date(dateStr).getFullYear() : 0;
  const badgeColor = item.matchLabel.includes("Parfait") ? "#e50914" : (item.matchLabel.includes("Excellent") ? "#46d369" : "#ffbd3f");

  return (
    <div style={{ animation: "fadeIn 0.5s", display: "flex", flexDirection: "column" }}>
      <h3 style={{ color: "#e50914", marginBottom: "10px", textTransform: "uppercase", fontSize: "0.9rem", letterSpacing: "1px", height: "20px" }}>{label}</h3>
      <div style={{ backgroundColor: "#1f1f1f", borderRadius: "10px", overflow: "hidden", boxShadow: "0 10px 20px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", flex: 1 }}>
        <Link href={link}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "2/3" }}>
            {item.poster_path ? (
               <img src={`${imageUrl}${item.poster_path}`} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : <div style={{width:"100%", height:"100%", background:"#333", display:"flex", alignItems:"center", justifyContent:"center"}}>Pas d'image</div>}
            
            <div style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0,0,0,0.9)", color: badgeColor, padding: "5px 12px", borderRadius: "20px", fontWeight: "bold", border: `1px solid ${badgeColor}`, boxShadow: "0 2px 10px black", fontSize: "0.8rem", textTransform: "uppercase" }}>{item.matchLabel}</div>
            {year >= 2024 && <div style={{ position: "absolute", top: "10px", left: "10px", background: "#e50914", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>NOUVEAU</div>}
          </div>
        </Link>
        
        <div style={{display: "flex", gap: "10px", padding: "10px 20px", marginTop: "-20px", position: "relative", zIndex: 10}}>
             <button onClick={(e) => { e.preventDefault(); handleInteract(toggleList); }} style={{flex: 1, background: inList ? "#e50914" : "#222", border: "1px solid #444", color: "white", borderRadius: "5px", padding: "8px", cursor: "pointer", fontSize: "0.9rem"}} title="À voir">{inList ? "✓" : "+"}</button>
             <button onClick={(e) => { e.preventDefault(); handleInteract(toggleSeen); }} style={{flex: 1, background: isSeen ? "#46d369" : "#222", border: "1px solid #444", color: "white", borderRadius: "5px", padding: "8px", cursor: "pointer", fontSize: "0.9rem"}} title="Déjà vu">{isSeen ? "✓" : "👁️"}</button>
             <button onClick={(e) => { e.preventDefault(); handleInteract(toggleLiked); }} style={{flex: 1, background: isLiked ? "#e50914" : "#222", border: "1px solid #444", color: "white", borderRadius: "5px", padding: "8px", cursor: "pointer", fontSize: "0.9rem"}} title="J'aime">{isLiked ? "❤️" : "🤍"}</button>
        </div>

        <div style={{ padding: "15px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 5px 0", lineHeight: "1.3" }}>{title} {year > 0 && <span style={{fontSize: "0.8rem", color: "#666", fontWeight: "normal"}}> ({year})</span>}</h2>
          
          <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "15px" }}>
              <Link href={link} style={{ flex: 1, textDecoration: "none" }}>
                 <div style={{ textAlign: "center", padding: "10px", border: "1px solid #555", borderRadius: "5px", color: "white", fontWeight: "bold", cursor: "pointer", transition: "0.2s", fontSize: "0.8rem", backgroundColor: "#222" }}>DÉTAILS</div>
              </Link>
              <button onClick={(e) => { e.preventDefault(); onPass(); }} style={{ flex: 1, padding: "10px", border: "1px solid #555", borderRadius: "5px", color: "#ccc", background: "transparent", cursor: "pointer", fontSize: "0.8rem" }}>SUIVANT ⏩</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT CARTE TENDANCE ---
const TrendingCard = ({ movie }: { movie: any }) => {
    const computedType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const itemWithType = { ...movie, media_type: computedType };
    const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(itemWithType, computedType);
    const title = movie.title || movie.name;

    return (
        <div style={{ borderRadius: "10px", overflow: "hidden", backgroundColor: "#1f1f1f", transition: "transform 0.2s", display: "flex", flexDirection: "column" }} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}>
            <Link href={`/movie/${movie.id}?type=${computedType}`} style={{ textDecoration: "none", color: "white", position: "relative" }}>
                {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover" }} />
                ) : <div style={{width:"100%", aspectRatio:"2/3", background:"#333"}}></div>}
            </Link>
            <div style={{ display: "flex", borderTop: "1px solid #333" }}>
                <button onClick={(e) => {e.preventDefault(); toggleList()}} style={{ flex: 1, background: inList ? "#e50914" : "transparent", border: "none", borderRight: "1px solid #333", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{inList ? "✓" : "+"}</button>
                <button onClick={(e) => {e.preventDefault(); toggleSeen()}} style={{ flex: 1, background: isSeen ? "#46d369" : "transparent", border: "none", borderRight: "1px solid #333", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{isSeen ? "✓" : "👁️"}</button>
                <button onClick={(e) => {e.preventDefault(); toggleLiked()}} style={{ flex: 1, background: isLiked ? "#e50914" : "transparent", border: "none", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{isLiked ? "❤️" : "🤍"}</button>
            </div>
            <div style={{ padding: "10px" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "bold" }}>{title}</p>
            </div>
        </div>
    );
};

// --- PAGE PRINCIPALE ---
export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // STATES
  const [pools, setPools] = useState<Record<CategoryKey, MediaItem[]>>({ movie: [], series: [], animation: [], anime: [] });
  const [currentItems, setCurrentItems] = useState<Record<CategoryKey, MediaItem | null>>({ movie: null, series: null, animation: null, anime: null });
  const [pageTrackers, setPageTrackers] = useState<Record<CategoryKey, number>>({ movie: 1, series: 1, animation: 1, anime: 1 });
  
  const [timeFilter, setTimeFilter] = useState<'classics' | 'modern'>('modern'); 
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [archetype, setArchetype] = useState("ACTION");
  const [mood, setMood] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  
  const [favDirectorId, setFavDirectorId] = useState<number | null>(null);
  const [favActorId, setFavActorId] = useState<number | null>(null);

  const [historySet, setHistorySet] = useState<Set<string>>(new Set());
  // 💡 NOUVEAU STATE : Stocker le dernier like pour les recommandations
  const [lastLikedItem, setLastLikedItem] = useState<{id: number, type: string} | null>(null);

  const fetchingRef = useRef<Record<CategoryKey, boolean>>({ movie: false, series: false, animation: false, anime: false });

  // --- LE CHALUTIER V10 (HYBRIDE : Discover + Recommendations + Serendipity) ---
  const fetchBatch = async (
      category: CategoryKey, 
      startPage: number, 
      currentArch: string, 
      currentMood: any, 
      history: Set<string>,
      mode: 'classics' | 'modern', 
      dirId: number | null,
      actId: number | null,
      seedItem: {id: number, type: string} | null // L'item source pour les recommandations
  ): Promise<{ results: any[], nextPageIndex: number }> => {
      
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      const baseUrl = "https://api.themoviedb.org/3";
      
      // 1. DÉFINITION IMMUTABLE
      let typeToSearch = 'movie';
      let structuralFilter = ""; 
      
      switch (category) {
        case 'movie': typeToSearch = 'movie'; structuralFilter = `&without_genres=${ANIMATION_GENRE_ID}`; break;
        case 'series': typeToSearch = 'tv'; structuralFilter = `&without_genres=${ANIMATION_GENRE_ID}`; break;
        case 'animation': typeToSearch = 'movie'; structuralFilter = `&with_genres=${ANIMATION_GENRE_ID}&without_original_language=ja`; break;
        case 'anime': typeToSearch = 'tv'; structuralFilter = `&with_genres=${ANIMATION_GENRE_ID}&with_original_language=ja`; break;
      }

      // 2. CONFIG FILTRES
      let dateFilter = "";
      let sortBy = "vote_average.desc"; 
      let minVotes = 100;

      if (mode === 'classics') {
          const maxDate = "2010-12-31"; 
          dateFilter = typeToSearch === 'movie' ? `&primary_release_date.lte=${maxDate}` : `&first_air_date.lte=${maxDate}`;
          sortBy = "vote_count.desc"; 
          minVotes = 300; 
      } else {
          const minDate = "2020-01-01";
          dateFilter = typeToSearch === 'movie' ? `&primary_release_date.gte=${minDate}` : `&first_air_date.gte=${minDate}`;
          sortBy = "popularity.desc"; 
          minVotes = 50; 
      }

      // 3. GENRES (Préférentiels)
      let moodGenres = "";
      if (currentMood) {
          if (typeToSearch === 'tv') moodGenres = convertGenresToTV(currentMood.genres);
          else moodGenres = currentMood.genres;
      } else {
          moodGenres = (category === 'movie' || category === 'animation') ? MOVIE_GENRES[currentArch] : TV_GENRES[currentArch];
      }
      
      let preferentialFilter = "";
      if (category !== 'animation' && category !== 'anime' && moodGenres) {
          preferentialFilter = `&with_genres=${moodGenres}`;
      }

      // 4. BOUCLE DE RECHERCHE HYBRIDE
      let collectedItems: any[] = [];
      let currentPage = startPage;
      let attempts = 0;
      const MAX_ATTEMPTS = 5; 

      while (collectedItems.length < 4 && attempts < MAX_ATTEMPTS) {
          const promises = [];
          
          // A. REQUÊTE PRINCIPALE (DISCOVER - V9)
          // Fallback logic inside
          let currentGenreFilter = preferentialFilter;
          let currentDirFilter = dirId ? `&with_crew=${dirId}` : "";
          let currentSort = sortBy;

          if (attempts > 1) {
              currentGenreFilter = ""; 
              currentDirFilter = ""; 
              if (attempts > 3) currentSort = "popularity.desc"; 
          }

          const baseQuery = `${baseUrl}/discover/${typeToSearch}?api_key=${apiKey}&language=fr-FR&sort_by=${currentSort}${structuralFilter}${currentGenreFilter}${dateFilter}${currentDirFilter}&vote_count.gte=${minVotes}&vote_average.gte=${mode==='modern'?5:6.5}&page=${currentPage}`;
          promises.push(fetch(baseQuery).then(r => r.json()).catch(() => ({ results: [] })));

          // B. REQUÊTE HYBRIDE (RECOMMENDATIONS - V10) 🧠
          // Si on a un "seedItem" (dernier like) et qu'on est au premier tour
          if (attempts === 0 && seedItem && seedItem.type === typeToSearch) {
              // On demande à TMDB : "Donne-moi des films comme celui que j'ai aimé"
              const recoQuery = `${baseUrl}/${typeToSearch}/${seedItem.id}/recommendations?api_key=${apiKey}&language=fr-FR&page=1`;
              promises.push(fetch(recoQuery).then(r => r.json()).catch(() => ({ results: [] })));
          }

          // C. SERENDIPITY (Un peu de hasard qualitatif) 🎲
          // Une fois de temps en temps, on injecte un Top Rated
          if (attempts === 0 && Math.random() > 0.7) {
               const serendipityQuery = `${baseUrl}/${typeToSearch}/top_rated?api_key=${apiKey}&language=fr-FR&page=${Math.floor(Math.random() * 5) + 1}`;
               promises.push(fetch(serendipityQuery).then(r => r.json()).catch(() => ({ results: [] })));
          }

          // EXÉCUTION
          const results = await Promise.all(promises);
          let rawItems: any[] = [];
          results.forEach(r => { if(r.results) rawItems.push(...r.results); });

          // FILTRAGE
          const validItems = rawItems.filter(item => {
                if (!item.id) return false;
                if (history.has(`${typeToSearch}_${item.id}`)) return false;
                if (collectedItems.some(ci => ci.id === item.id)) return false;

                // Filtre structurel strict
                if ((category === 'movie' || category === 'series') && item.genre_ids?.includes(ANIMATION_GENRE_ID)) return false; 
                if ((category === 'animation' || category === 'anime') && !item.genre_ids?.includes(ANIMATION_GENRE_ID)) return false;

                // Filtre date
                const date = item.release_date || item.first_air_date;
                if (date) {
                    const year = new Date(date).getFullYear();
                    if (mode === 'classics' && year >= 2012) return false;
                    if (mode === 'modern' && year < 2019) return false;
                }
                return true;
          });

          collectedItems = [...collectedItems, ...validItems];
          currentPage++;
          attempts++;
      }

      // 5. FORMATAGE & SCORING AMÉLIORÉ
      const finalItems = collectedItems.map(item => {
            // On passe 'mode' pour le bonus de nouveauté
            const { score, label } = calculateMatch(item, currentMood, currentArch, mode);
            return { ...item, matchScore: score, matchLabel: label, media_type: typeToSearch };
      });

      // On trie par score pour mettre les "Match Parfait" en premier
      finalItems.sort((a, b) => b.matchScore - a.matchScore);

      return { results: finalItems, nextPageIndex: currentPage };
  };

  const initialLoad = async (arch: string, moodObj: any, history: Set<string>, mode: 'classics' | 'modern', dirId: number | null, actId: number | null, lastLike: {id: number, type: string} | null) => {
      setLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      
      const [m, s, anim, jap, trends] = await Promise.all([
          fetchBatch('movie', 1, arch, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('series', 1, arch, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('animation', 1, arch, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('anime', 1, arch, moodObj, history, mode, dirId, actId, lastLike),
          fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=fr-FR`).then(r => r.json())
      ]);

      setCurrentItems({ 
          movie: m.results[0] || null, 
          series: s.results[0] || null, 
          animation: anim.results[0] || null, 
          anime: jap.results[0] || null 
      });
      
      setPools({ 
          movie: m.results.slice(1), 
          series: s.results.slice(1), 
          animation: anim.results.slice(1), 
          anime: jap.results.slice(1) 
      });

      setPageTrackers({
          movie: m.nextPageIndex,
          series: s.nextPageIndex,
          animation: anim.nextPageIndex,
          anime: jap.nextPageIndex
      });

      const cleanTrends = (trends.results || []).filter((m: any) => {
          const type = m.media_type || (m.first_air_date ? 'tv' : 'movie');
          return !history.has(`${type}_${m.id}`);
      });
      setTrendingMovies(cleanTrends);

      setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
      if (!profile?.preferences || !profile.preferences.archetype) { router.push("/calibration"); return; }
      
      setArchetype(profile.preferences.archetype || "ACTION");

      let dId = null, aId = null;
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      if (profile.preferences.favorites) {
          if (profile.preferences.favorites.director) { dId = await getPersonId(profile.preferences.favorites.director, apiKey); setFavDirectorId(dId); }
          if (profile.preferences.favorites.actor) { aId = await getPersonId(profile.preferences.favorites.actor, apiKey); setFavActorId(aId); }
      }

      const storedMood = localStorage.getItem("currentMood");
      let parsedMood = null;
      if (storedMood) { try { parsedMood = JSON.parse(storedMood); setMood(parsedMood); } catch(e){} }

      // CHARGEMENT HISTORIQUE & DERNIER LIKE (POUR L'ALGO V10)
      const { data: interactions } = await supabase
        .from("user_interactions")
        .select("tmdb_id, media_type, is_liked, created_at"); // On a besoin de la date pour trouver le dernier
        
      const newHistorySet = new Set<string>();
      let latestLike = null;

      if (interactions) {
          // Trier par date pour trouver le plus récent
          const sortedInteractions = interactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          interactions.forEach(i => newHistorySet.add(`${i.media_type}_${i.tmdb_id}`));
          
          // Trouver le dernier like pertinent
          const lastLikedInteraction = sortedInteractions.find(i => i.is_liked);
          if (lastLikedInteraction) {
              latestLike = { id: lastLikedInteraction.tmdb_id, type: lastLikedInteraction.media_type };
              setLastLikedItem(latestLike);
          }
      }
      setHistorySet(newHistorySet);

      await initialLoad(profile.preferences.archetype, parsedMood, newHistorySet, 'modern', dId, aId, latestLike);
    };
    init();
  }, []);

  const handleFilterChange = async (mode: 'classics' | 'modern') => {
      setTimeFilter(mode);
      setPools({ movie: [], series: [], animation: [], anime: [] });
      setCurrentItems({ movie: null, series: null, animation: null, anime: null });
      setPageTrackers({ movie: 1, series: 1, animation: 1, anime: 1 });
      await initialLoad(archetype, mood, historySet, mode, favDirectorId, favActorId, lastLikedItem);
  };

  const nextItem = async (category: CategoryKey) => {
      const currentPool = pools[category];
      const current = currentItems[category];
      
      if (current) {
          const newItemHistory = new Set(historySet);
          newItemHistory.add(`${current.media_type}_${current.id}`);
          setHistorySet(newItemHistory);
      }

      if (currentPool.length > 0) {
          const next = currentPool[0];
          const remainingPool = currentPool.slice(1);
          setCurrentItems(prev => ({ ...prev, [category]: next }));
          setPools(prev => ({ ...prev, [category]: remainingPool }));
          
          if (remainingPool.length < 3 && !fetchingRef.current[category]) {
              fetchingRef.current[category] = true;
              // On passe lastLikedItem pour continuer à alimenter l'algo hybride
              const { results, nextPageIndex } = await fetchBatch(category, pageTrackers[category], archetype, mood, historySet, timeFilter, favDirectorId, favActorId, lastLikedItem);
              setPools(prev => ({ ...prev, [category]: [...prev[category], ...results] }));
              setPageTrackers(prev => ({ ...prev, [category]: nextPageIndex }));
              fetchingRef.current[category] = false;
          }
      } else {
          setLoading(true);
          const { results, nextPageIndex } = await fetchBatch(category, pageTrackers[category], archetype, mood, historySet, timeFilter, favDirectorId, favActorId, lastLikedItem);
          if (results.length > 0) {
              setCurrentItems(prev => ({ ...prev, [category]: results[0] }));
              setPools(prev => ({ ...prev, [category]: results.slice(1) }));
              setPageTrackers(prev => ({ ...prev, [category]: nextPageIndex }));
          } else {
              setPageTrackers(prev => ({ ...prev, [category]: nextPageIndex + 1 }));
          }
          setLoading(false);
      }
  };

  if (loading) return (
      <div style={{background:"#141414", minHeight:"100vh", color:"white", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column"}}>
          <div className="spinner" style={{marginBottom: "20px"}}></div>
          <p>Préparation de ta séance... 🍿</p>
      </div>
  );

  return (
    <div style={{ fontFamily: "sans-serif", backgroundColor: "#141414", minHeight: "100vh", color: "white" }}>
      <Navbar />
      <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto" }}>
        
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>
              {mood ? `Ta sélection ${mood.label}` : "Ta sélection du moment 🍿"}
            </h1>
            <p style={{ color: "#aaa" }}>
               {mood ? "Le meilleur du cinéma selon ton envie." : `Basé sur ton profil ${archetype}`}
            </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginBottom: "40px" }}>
            <button 
                onClick={() => handleFilterChange('classics')}
                style={{
                    padding: "12px 25px", borderRadius: "30px", fontSize: "0.95rem", fontWeight: "bold", cursor: "pointer",
                    backgroundColor: timeFilter === 'classics' ? "white" : "#222",
                    color: timeFilter === 'classics' ? "black" : "#aaa",
                    border: "1px solid #333", transition: "all 0.2s"
                }}
            >
                🏛️ Les Classiques Incontournables
            </button>
            <button 
                onClick={() => handleFilterChange('modern')}
                style={{
                    padding: "12px 25px", borderRadius: "30px", fontSize: "0.95rem", fontWeight: "bold", cursor: "pointer",
                    backgroundColor: timeFilter === 'modern' ? "#e50914" : "#222",
                    color: "white",
                    border: timeFilter === 'modern' ? "none" : "1px solid #333", transition: "all 0.2s"
                }}
            >
                🔥 L'Ère Moderne & Tendances
            </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "25px", marginBottom: "80px" }}>
            <MovieCard 
                key={currentItems.movie ? `m-${currentItems.movie.id}` : 'm-load'} 
                item={currentItems.movie} 
                label={timeFilter === 'modern' ? "🎬 Film Tendance" : "🎬 Film Culte"} 
                onAction={() => nextItem('movie')} 
                onPass={() => nextItem('movie')} 
            />
            <MovieCard 
                key={currentItems.series ? `s-${currentItems.series.id}` : 's-load'} 
                item={currentItems.series} 
                label={timeFilter === 'modern' ? "📺 Série du Moment" : "📺 Série Légendaire"} 
                onAction={() => nextItem('series')} 
                onPass={() => nextItem('series')} 
            />
            <MovieCard 
                key={currentItems.animation ? `a-${currentItems.animation.id}` : 'a-load'} 
                item={currentItems.animation} 
                label="🎨 Animation" 
                onAction={() => nextItem('animation')} 
                onPass={() => nextItem('animation')} 
            />
            <MovieCard 
                key={currentItems.anime ? `j-${currentItems.anime.id}` : 'j-load'} 
                item={currentItems.anime} 
                label="🗾 Animé" 
                onAction={() => nextItem('anime')} 
                onPass={() => nextItem('anime')} 
            />
        </div>

        {/* --- SECTION TENDANCES --- */}
        <h2 style={{ borderLeft: "5px solid #e50914", paddingLeft: "15px", marginBottom: "20px", marginTop: "50px" }}>Les tendances mondiales 🔥</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "20px" }}>
            {trendingMovies.slice(0, 12).map((movie) => (
                <TrendingCard key={movie.id} movie={movie} />
            ))}
        </div>

      </div>
      <style jsx>{` 
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } 
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #e50914; borderRadius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}