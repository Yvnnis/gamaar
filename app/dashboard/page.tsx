"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation"; 
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useMediaInteraction } from "../../hooks/useMediaInteraction";
import { createClient } from "@/utils/supabase/client"; 
import { useRefillingRail, RailItem } from "../../hooks/useRefillingRail";

// --- CATEGORIES (Filtres Rapides avec Exclusions strictes) ---
const CATEGORIES = [
  { id: "all", label: "Pour Toi", genres: "", exclude: "" },
  // ✅ CORRECTION ICI : on a retiré le "16" des exclusions
  { id: "action", label: "Action & Aventure", genres: "28,12", exclude: "35,10749" }, 
  { id: "comedy", label: "Comédie", genres: "35", exclude: "18,28,27,53,878" },
  { id: "thrill", label: "Frissons", genres: "27,53", exclude: "35,10749" },
  { id: "sf", label: "Sci-Fi", genres: "878,14", exclude: "35,10749" },
  { id: "drama", label: "Émotion", genres: "18,10749", exclude: "28,35,27,878" },
];

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

// 🧠 SCORING V3 (Sans Archétype, pur ciblage)
const calculateMatch = (item: any, mood: any, mode: 'classics' | 'modern'): { score: number, label: MatchLabel } => {
    let score = (item.vote_average || 5) * 6;
    
    if (mood && mood.genres && item.genre_ids) {
        const moodGenres = mood.genres.split(',').map(Number);
        if (item.genre_ids.some((id: number) => moodGenres.includes(id) || Object.values(GENRE_MAP_MOVIE_TO_TV).includes(id))) {
            score += 25;
        }
    }
    
    if (item.vote_count > 2000) score += 5;

    if (mode === 'modern' && item.release_date) {
        const releaseYear = new Date(item.release_date).getFullYear();
        const currentYear = new Date().getFullYear();
        if (releaseYear >= currentYear - 1) score += 10; 
        else if (releaseYear >= currentYear - 3) score += 5;
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
                 <div className="cta" style={{ textAlign: "center", padding: "10px", border: "1px solid #555", borderRadius: "5px", color: "white", fontWeight: "bold", cursor: "pointer", transition: "0.2s", fontSize: "0.8rem", backgroundColor: "#222" }}>DÉTAILS</div>
              </Link>
              <button onClick={(e) => { e.preventDefault(); onPass(); }} style={{ flex: 1, padding: "10px", border: "1px solid #555", borderRadius: "5px", color: "#ccc", background: "transparent", cursor: "pointer", fontSize: "0.8rem" }}>SUIVANT ⏩</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SOURCE "SORTIES RÉCEMMENT" (paginée, sans les fiches "person") ---
const fetchTrendingAllPage = async (page: number) => {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
    const data = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=fr-FR&page=${page}`).then(r => r.json());
    return {
        results: (data.results || []).filter((m: any) => m.media_type === 'movie' || m.media_type === 'tv'),
        total_pages: data.total_pages,
    };
};
const mediaKey = (m: RailItem) => `${m.media_type || (m.first_air_date ? 'tv' : 'movie')}_${m.id}`;

const TrendingCard = ({ movie, onInteract }: { movie: any, onInteract: () => void }) => {
    const computedType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const itemWithType = { ...movie, media_type: computedType };
    const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(itemWithType, computedType);
    const title = movie.title || movie.name;

    // Après une action, la carte disparaît et une nouvelle prend sa place
    const handle = async (action: () => Promise<void>) => {
        await action();
        setTimeout(onInteract, 300);
    };

    return (
        <div style={{ borderRadius: "10px", overflow: "hidden", backgroundColor: "#1f1f1f", transition: "transform 0.2s", display: "flex", flexDirection: "column" }} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}>
            <Link href={`/movie/${movie.id}?type=${computedType}`} style={{ textDecoration: "none", color: "white", position: "relative" }}>
                {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover" }} />
                ) : <div style={{width:"100%", aspectRatio:"2/3", background:"#333"}}></div>}
            </Link>
            <div style={{ display: "flex", borderTop: "1px solid #333" }}>
                <button onClick={(e) => {e.preventDefault(); handle(toggleList)}} style={{ flex: 1, background: inList ? "#e50914" : "transparent", border: "none", borderRight: "1px solid #333", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{inList ? "✓" : "+"}</button>
                <button onClick={(e) => {e.preventDefault(); handle(toggleSeen)}} style={{ flex: 1, background: isSeen ? "#46d369" : "transparent", border: "none", borderRight: "1px solid #333", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{isSeen ? "✓" : "👁️"}</button>
                <button onClick={(e) => {e.preventDefault(); handle(toggleLiked)}} style={{ flex: 1, background: isLiked ? "#e50914" : "transparent", border: "none", color: "white", padding: "8px", cursor: "pointer", fontSize: "0.8rem" }}>{isLiked ? "❤️" : "🤍"}</button>
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
  // Rail "Sorties récemment" : se recharge quand on ajoute / like / marque vu
  const trendingExcludeRef = useRef<Set<string>>(new Set());
  const [historyReady, setHistoryReady] = useState(false);
  const recentRail = useRefillingRail({
      fetchPage: fetchTrendingAllPage,
      keyOf: mediaKey,
      excludeRef: trendingExcludeRef,
      enabled: historyReady,
      targetSize: 18, // on en affiche 12, on garde un petit stock d'avance
  });
  const [loading, setLoading] = useState(true);
  
  const [mood, setMood] = useState<any>(null); // Catégorie sélectionnée
  const [userId, setUserId] = useState<string>("");
  
  const [favDirectorId, setFavDirectorId] = useState<number | null>(null);
  const [favActorId, setFavActorId] = useState<number | null>(null);

  const [historySet, setHistorySet] = useState<Set<string>>(new Set());
  const [lastLikedItem, setLastLikedItem] = useState<{id: number, type: string} | null>(null);

  const fetchingRef = useRef<Record<CategoryKey, boolean>>({ movie: false, series: false, animation: false, anime: false });

  // --- LE CHALUTIER V11 ---
  const fetchBatch = async (
      category: CategoryKey, 
      startPage: number, 
      currentMood: any, 
      history: Set<string>,
      mode: 'classics' | 'modern', 
      dirId: number | null,
      actId: number | null,
      seedItem: {id: number, type: string} | null 
  ): Promise<{ results: any[], nextPageIndex: number }> => {
      
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      const baseUrl = "https://api.themoviedb.org/3";
      
      let typeToSearch = 'movie';
      let excludedGenresList = [];
      
      switch (category) {
        case 'movie': typeToSearch = 'movie'; excludedGenresList.push(ANIMATION_GENRE_ID); break;
        case 'series': typeToSearch = 'tv'; excludedGenresList.push(ANIMATION_GENRE_ID); break;
        case 'animation': typeToSearch = 'movie'; break; // On gérera with_genres=16 plus bas
        case 'anime': typeToSearch = 'tv'; break;
      }

      // Ajout des exclusions strictes de la catégorie choisie
      if (currentMood && currentMood.exclude) {
          excludedGenresList.push(currentMood.exclude);
      }

      let structuralFilter = "";
      if (excludedGenresList.length > 0 && category !== 'animation' && category !== 'anime') {
          structuralFilter = `&without_genres=${excludedGenresList.join(',')}`;
      } else if (category === 'animation' && currentMood && currentMood.exclude) {
          structuralFilter = `&without_genres=${currentMood.exclude}`;
      }

      // Filtres pour Animation/Anime
      if (category === 'animation') structuralFilter += `&with_genres=${ANIMATION_GENRE_ID}&without_original_language=ja`;
      if (category === 'anime') structuralFilter += `&with_genres=${ANIMATION_GENRE_ID}&with_original_language=ja`;

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

      // GENRES (Inclusions)
      let preferentialFilter = "";
      if (currentMood && currentMood.genres && category !== 'animation' && category !== 'anime') {
          let moodGenres = typeToSearch === 'tv' ? convertGenresToTV(currentMood.genres) : currentMood.genres;
          preferentialFilter = `&with_genres=${moodGenres}`;
      }

      // PROFIL UTILISATEUR
      let castCrewFilter = "";
      if (dirId) castCrewFilter += `&with_crew=${dirId}`;
      if (actId) castCrewFilter += `&with_cast=${actId}`;

      let collectedItems: any[] = [];
      let currentPage = startPage;
      let attempts = 0;
      const MAX_ATTEMPTS = 5; 
      
      const isPourToi = !currentMood || currentMood.id === "all";

      while (collectedItems.length < 4 && attempts < MAX_ATTEMPTS) {
          const promises = [];
          
          let currentGenreFilter = preferentialFilter;
          let currentCastCrewFilter = castCrewFilter;
          let currentSort = sortBy;

          if (attempts > 1) {
              currentGenreFilter = ""; 
              currentCastCrewFilter = ""; 
              if (attempts > 3) currentSort = "popularity.desc"; 
          }

          const baseQuery = `${baseUrl}/discover/${typeToSearch}?api_key=${apiKey}&language=fr-FR&sort_by=${currentSort}${structuralFilter}${currentGenreFilter}${dateFilter}${currentCastCrewFilter}&vote_count.gte=${minVotes}&vote_average.gte=${mode==='modern'?5:6.5}&page=${currentPage}`;
          promises.push(fetch(baseQuery).then(r => r.json()).catch(() => ({ results: [] })));

          // On n'utilise les recommandations du "Dernier Like" QUE si on est dans la section "Pour Toi"
          if (attempts === 0 && seedItem && seedItem.type === typeToSearch && isPourToi) {
              const recoQuery = `${baseUrl}/${typeToSearch}/${seedItem.id}/recommendations?api_key=${apiKey}&language=fr-FR&page=1`;
              promises.push(fetch(recoQuery).then(r => r.json()).catch(() => ({ results: [] })));
          }

          if (attempts === 0 && Math.random() > 0.7) {
               const serendipityQuery = `${baseUrl}/${typeToSearch}/top_rated?api_key=${apiKey}&language=fr-FR&page=${Math.floor(Math.random() * 5) + 1}`;
               promises.push(fetch(serendipityQuery).then(r => r.json()).catch(() => ({ results: [] })));
          }

          const results = await Promise.all(promises);
          let rawItems: any[] = [];
          results.forEach(r => { if(r.results) rawItems.push(...r.results); });

          const validItems = rawItems.filter(item => {
                if (!item.id) return false;
                if (history.has(`${typeToSearch}_${item.id}`)) return false;
                if (collectedItems.some(ci => ci.id === item.id)) return false;

                // Sécurité supplémentaire : On bloque l'anim dans les films live-action
                if ((category === 'movie' || category === 'series') && item.genre_ids?.includes(ANIMATION_GENRE_ID)) return false; 

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

      const finalItems = collectedItems.map(item => {
            const { score, label } = calculateMatch(item, currentMood, mode);
            return { ...item, matchScore: score, matchLabel: label, media_type: typeToSearch };
      });

      finalItems.sort((a, b) => b.matchScore - a.matchScore);

      return { results: finalItems, nextPageIndex: currentPage };
  };

  const initialLoad = async (moodObj: any, history: Set<string>, mode: 'classics' | 'modern', dirId: number | null, actId: number | null, lastLike: {id: number, type: string} | null) => {
      setLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      
      const [m, s, anim, jap] = await Promise.all([
          fetchBatch('movie', 1, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('series', 1, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('animation', 1, moodObj, history, mode, dirId, actId, lastLike),
          fetchBatch('anime', 1, moodObj, history, mode, dirId, actId, lastLike),
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

      setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
      if (!profile?.preferences?.calibrated) { router.push("/calibration"); return; }
      
      let dId = null, aId = null;
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY!;
      if (profile.preferences.favorites) {
          if (profile.preferences.favorites.director) { dId = await getPersonId(profile.preferences.favorites.director, apiKey); setFavDirectorId(dId); }
          if (profile.preferences.favorites.actor) { aId = await getPersonId(profile.preferences.favorites.actor, apiKey); setFavActorId(aId); }
      }

      const storedMood = localStorage.getItem("currentMood");
      let parsedMood = null;
      if (storedMood) { try { parsedMood = JSON.parse(storedMood); setMood(parsedMood); } catch(e){} }

      const { data: interactions } = await supabase.from("user_interactions").select("tmdb_id, media_type, is_liked, created_at").eq("user_id", user.id); // ⚠️ filtre user obligatoire
        
      const newHistorySet = new Set<string>();
      let latestLike = null;

      if (interactions) {
          const sortedInteractions = interactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          interactions.forEach(i => newHistorySet.add(`${i.media_type}_${i.tmdb_id}`));
          
          const lastLikedInteraction = sortedInteractions.find(i => i.is_liked);
          if (lastLikedInteraction) {
              latestLike = { id: lastLikedInteraction.tmdb_id, type: lastLikedInteraction.media_type };
              setLastLikedItem(latestLike);
          }
      }

      // ✅ FIX DU REFRESH : On ajoute les films swipés localement à l'historique !
      const localHistory = JSON.parse(localStorage.getItem("localMediaHistory") || "[]");
      localHistory.forEach((id: string) => newHistorySet.add(id));

      setHistorySet(newHistorySet);
      newHistorySet.forEach(k => trendingExcludeRef.current.add(k));
      setHistoryReady(true);
      await initialLoad(parsedMood, newHistorySet, 'modern', dId, aId, latestLike);
    };
    init();
  }, []);

  const handleFilterChange = async (mode: 'classics' | 'modern') => {
      setTimeFilter(mode);
      setPools({ movie: [], series: [], animation: [], anime: [] });
      setCurrentItems({ movie: null, series: null, animation: null, anime: null });
      setPageTrackers({ movie: 1, series: 1, animation: 1, anime: 1 });
      await initialLoad(mood, historySet, mode, favDirectorId, favActorId, lastLikedItem);
  };

  const handleCategorySelect = async (selectedCat: typeof CATEGORIES[0]) => {
      const isAll = selectedCat.id === "all";
      const newMood = isAll ? null : selectedCat;
      
      setMood(newMood);
      if (newMood) localStorage.setItem("currentMood", JSON.stringify(newMood));
      else localStorage.removeItem("currentMood");

      setPools({ movie: [], series: [], animation: [], anime: [] });
      setCurrentItems({ movie: null, series: null, animation: null, anime: null });
      setPageTrackers({ movie: 1, series: 1, animation: 1, anime: 1 });
      
      await initialLoad(newMood, historySet, timeFilter, favDirectorId, favActorId, lastLikedItem);
  };

  const nextItem = async (category: CategoryKey) => {
      const currentPool = pools[category];
      const current = currentItems[category];
      
      if (current) {
          const itemKey = `${current.media_type}_${current.id}`;
          
          // Mise à jour de l'historique local pour la session en cours
          const newItemHistory = new Set(historySet);
          newItemHistory.add(itemKey);
          setHistorySet(newItemHistory);

          // ✅ FIX DU REFRESH : Sauvegarde du swipe dans le navigateur
          const localHistory = JSON.parse(localStorage.getItem("localMediaHistory") || "[]");
          if (!localHistory.includes(itemKey)) {
              localHistory.push(itemKey);
              localStorage.setItem("localMediaHistory", JSON.stringify(localHistory));
          }
      }

      if (currentPool.length > 0) {
          const next = currentPool[0];
          const remainingPool = currentPool.slice(1);
          setCurrentItems(prev => ({ ...prev, [category]: next }));
          setPools(prev => ({ ...prev, [category]: remainingPool }));
          
          if (remainingPool.length < 3 && !fetchingRef.current[category]) {
              fetchingRef.current[category] = true;
              const { results, nextPageIndex } = await fetchBatch(category, pageTrackers[category], mood, historySet, timeFilter, favDirectorId, favActorId, lastLikedItem);
              setPools(prev => ({ ...prev, [category]: [...prev[category], ...results] }));
              setPageTrackers(prev => ({ ...prev, [category]: nextPageIndex }));
              fetchingRef.current[category] = false;
          }
      } else {
          setLoading(true);
          const { results, nextPageIndex } = await fetchBatch(category, pageTrackers[category], mood, historySet, timeFilter, favDirectorId, favActorId, lastLikedItem);
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
        
        {/* --- SELECTEUR DE CATEGORIES (Sans emojis) --- */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "12px", marginBottom: "40px", animation: "fadeIn 0.5s" }}>
            {CATEGORIES.map(cat => {
                const isActive = mood ? mood.id === cat.id : cat.id === "all";
                return (
                    <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat)}
                        style={{
                            padding: "10px 20px", borderRadius: "30px", fontSize: "0.95rem", fontWeight: "bold", cursor: "pointer",
                            backgroundColor: isActive ? "#e50914" : "#222",
                            color: "white",
                            border: isActive ? "none" : "1px solid #444", 
                            transition: "all 0.2s",
                            boxShadow: isActive ? "0 4px 15px rgba(229, 9, 20, 0.4)" : "none"
                        }}
                        onMouseOver={e => { if(!isActive) e.currentTarget.style.borderColor = "#aaa" }}
                        onMouseOut={e => { if(!isActive) e.currentTarget.style.borderColor = "#444" }}
                    >
                        {cat.label}
                    </button>
                )
            })}
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
                🏛️ Les Classiques 
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
                🔥 Les Tendances
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

        {/* --- SECTION SORTIES RÉCEMMENT --- */}
        <h2 style={{ borderLeft: "5px solid #e50914", paddingLeft: "15px", marginBottom: "20px", marginTop: "50px" }}>Sorties récemment</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "20px" }}>
            {recentRail.items.slice(0, 12).map((movie) => (
                <TrendingCard key={mediaKey(movie)} movie={movie} onInteract={() => recentRail.remove(movie)} />
            ))}
        </div>
        {!recentRail.loading && recentRail.items.length === 0 && (
            <p style={{ color: "#555" }}>Tu es à jour sur toutes les sorties du moment 👏</p>
        )}

      </div>
      <style jsx>{` 
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #e50914; borderRadius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}