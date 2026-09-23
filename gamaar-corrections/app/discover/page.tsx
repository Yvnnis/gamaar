"use client";

import { useEffect, useRef, useState, forwardRef, createRef } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { useMediaInteraction } from "../../hooks/useMediaInteraction";
import { useRefillingRail, RailItem } from "../../hooks/useRefillingRail";
// 👇 AJOUT CLIENT SUPABASE
import { createClient } from "@/utils/supabase/client";

// --- COMPOSANT CARTE (Inchangé, il est parfait) ---
const DiscoverCard = forwardRef<HTMLAnchorElement, { item: any, onInteract: (id: number) => void }>(
  ({ item, onInteract }, ref) => {
    
    const type = item.media_type || "movie";
    const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(item, type);

    const handleInteraction = async (action: () => Promise<void>) => {
      await action(); 
      setTimeout(() => {
        onInteract(item.id); 
      }, 300);
    };

    const imageUrl = "https://image.tmdb.org/t/p/w500";

    return (
      <Link ref={ref} href={`/movie/${item.id}?type=${type}`} style={{ textDecoration: "none", color: "white" }}>
        <div 
          className="discover-card-inner"
          style={{ 
              backgroundColor: "#1f1f1f", borderRadius: "10px", overflow: "hidden", 
              height: "100%", display: "flex", flexDirection: "column", 
              minWidth: "220px", maxWidth: "220px"
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <div style={{ height: "330px", backgroundColor: "#333", position: "relative" }}>
            {item.poster_path ? (
              <img src={`${imageUrl}${item.poster_path}`} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#777" }}>Pas d'image</div>
            )}
            
            <button 
                onClick={(e) => { e.preventDefault(); handleInteraction(toggleList); }} 
                style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: inList ? "#e50914" : "rgba(0,0,0,0.6)", border: "1px solid white", color: "white", width: "35px", height: "35px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", zIndex: 10, paddingBottom: inList ? "0" : "4px", lineHeight: 1 }}
            >
                {inList ? "✓" : "+"}
            </button>
            <button 
                onClick={(e) => { e.preventDefault(); handleInteraction(toggleSeen); }} 
                style={{ position: "absolute", bottom: "10px", left: "10px", backgroundColor: isSeen ? "#46d369" : "rgba(0,0,0,0.6)", border: isSeen ? "none" : "1px solid white", color: "white", width: "35px", height: "35px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", zIndex: 10 }}
            >
                👁️
            </button>
            <button 
                onClick={(e) => { e.preventDefault(); handleInteraction(toggleLiked); }} 
                style={{ position: "absolute", bottom: "10px", right: "10px", backgroundColor: isLiked ? "#e50914" : "rgba(0,0,0,0.6)", border: isLiked ? "none" : "1px solid white", color: "white", width: "35px", height: "35px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", zIndex: 10 }}
            >
                ❤️
            </button>
          </div>
          <div style={{ padding: "15px", flex: 1 }}>
            <h3 style={{ fontSize: "1rem", margin: "0 0 5px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title || item.name}</h3>
            <p style={{ fontSize: "0.8rem", color: "#aaa", margin: 0 }}>
               {item.release_date ? item.release_date.split("-")[0] : ""}
               <span style={{float: "right", color: "#46d369"}}>⭐ {item.vote_average?.toFixed(1)}</span>
            </p>
          </div>
        </div>
      </Link>
    );
  }
);
DiscoverCard.displayName = "DiscoverCard";

// --- SOURCES DES RAILS (fonctions stables, paginées) ---
const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const getJson = (url: string) => fetch(url).then((r) => r.json());

const fetchTrendingPage = (page: number) =>
  getJson(`${TMDB}/trending/movie/week?api_key=${API_KEY}&language=fr-FR&page=${page}`);

const fetchClassicsPage = (page: number) =>
  getJson(`${TMDB}/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=3000&vote_average.gte=7.8&primary_release_date.lte=2005-01-01&page=${page}`);

const fetchWorldPage = (page: number) =>
  getJson(`${TMDB}/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=500&vote_average.gte=7.3&with_original_language=it|es|ja|ko|de&page=${page}`);

const movieKey = (item: RailItem) => `movie_${item.id}`;

// --- UN RAIL QUI SE RECHARGE ---
function DiscoverRail({
  title, color, fetchPage, excludeRef, enabled, emptyText,
}: {
  title: string;
  color: string;
  fetchPage: (page: number) => Promise<{ results: RailItem[]; total_pages?: number }>;
  excludeRef: React.MutableRefObject<Set<string>>;
  enabled: boolean;
  emptyText: string;
}) {
  const { items, loading, exhausted, remove } = useRefillingRail({
    fetchPage, keyOf: movieKey, excludeRef, enabled, targetSize: 20,
  });

  // Refs STABLES par carte (createRef() dans le map en recréait une à chaque rendu
  // et cassait l'animation de sortie)
  const nodeRefs = useRef(new Map<number, React.RefObject<HTMLAnchorElement | null>>());
  const getNodeRef = (id: number) => {
    if (!nodeRefs.current.has(id)) nodeRefs.current.set(id, createRef<HTMLAnchorElement>());
    return nodeRefs.current.get(id)!;
  };

  return (
    <section style={{ marginBottom: "60px" }}>
      <h2 style={{ borderLeft: `5px solid ${color}`, paddingLeft: "15px", marginBottom: "25px" }}>{title}</h2>
      <TransitionGroup className="scroll-hide" style={scrollContainerStyle}>
        {items.map((item) => {
          const nodeRef = getNodeRef(item.id);
          return (
            <CSSTransition key={item.id} timeout={400} classNames="card-transition" nodeRef={nodeRef}>
              <DiscoverCard ref={nodeRef} item={item} onInteract={() => remove(item)} />
            </CSSTransition>
          );
        })}
      </TransitionGroup>
      {!loading && items.length === 0 && (
        <p style={{ color: "#555" }}>{exhausted ? emptyText : "Chargement de nouvelles pépites..."}</p>
      )}
    </section>
  );
}

const scrollContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  overflowX: "auto",
  paddingBottom: "20px",
  scrollBehavior: "smooth",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

// --- PAGE DECOUVERTE ---
export default function DiscoverPage() {
  const supabase = createClient();

  // Set partagé : historique Supabase + tout ce qui est déjà affiché dans un rail
  const excludeRef = useRef<Set<string>>(new Set());
  const [historyReady, setHistoryReady] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: interactions } = await supabase
            .from("user_interactions")
            .select("tmdb_id, media_type")
            .eq("user_id", user.id)
            .eq("media_type", "movie");
          interactions?.forEach((i) => excludeRef.current.add(`movie_${i.tmdb_id}`));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setHistoryReady(true);
      }
    };
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      
      <style jsx global>{`
        .scroll-hide::-webkit-scrollbar { display: none; }
        .discover-card-inner { transition: transform 0.2s ease-in-out; }
        /* Animation de sortie : Fade Out + Shrink width */
        .card-transition-exit { opacity: 1; transform: scale(1); }
        .card-transition-exit-active { 
            opacity: 0; 
            transform: scale(0.8); 
            width: 0px !important; 
            min-width: 0px !important; 
            margin: 0 !important; 
            overflow: hidden; 
            transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1); 
        }
      `}</style>
      
      <Navbar />

      <div style={{ padding: "40px", maxWidth: "100%", margin: "0 auto", overflow: "hidden" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "10px", paddingLeft: "40px" }}>Explorer le Cinéma 🔭</h1>
        <p style={{ color: "#aaa", fontSize: "1.2rem", marginBottom: "50px", paddingLeft: "40px" }}>
          Des succès du moment aux horizons lointains.
        </p>

        {!historyReady ? (
            <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p>Chargement des collections...</p>
            </div>
        ) : (
            <div style={{ paddingLeft: "40px" }}>
                <DiscoverRail title="🔥 Ça cartonne en ce moment" color="#e50914" fetchPage={fetchTrendingPage}
                    excludeRef={excludeRef} enabled={historyReady} emptyText="Wow, vous êtes à jour sur les tendances !" />
                <DiscoverRail title="🍷 Les Incontournables (Classiques)" color="#f1c40f" fetchPage={fetchClassicsPage}
                    excludeRef={excludeRef} enabled={historyReady} emptyText="Vous avez fait le tour des classiques, chapeau !" />
                <DiscoverRail title="🌍 Sortir de sa zone de confort" color="#3498db" fetchPage={fetchWorldPage}
                    excludeRef={excludeRef} enabled={historyReady} emptyText="Plus rien à explorer ici pour le moment." />
            </div>
        )}
      </div>
    </div>
  );
}