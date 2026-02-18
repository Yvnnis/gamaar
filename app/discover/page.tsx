"use client";

import { useEffect, useState, forwardRef, createRef } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { useMediaInteraction } from "../../hooks/useMediaInteraction";
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

// --- PAGE DECOUVERTE ---
export default function DiscoverPage() {
  const supabase = createClient(); // 👈 INIT SUPABASE

  const [trending, setTrending] = useState<any[]>([]);
  const [classics, setClassics] = useState<any[]>([]);
  const [discovery, setDiscovery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // IDs cachés localement (l'animation)
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const baseUrl = "https://api.themoviedb.org/3";

      try {
        // 1. RÉCUPÉRER L'USER & L'HISTORIQUE SUPABASE
        const { data: { user } } = await supabase.auth.getUser();
        const historySet = new Set<number>(); // On stocke les IDs (films uniquement pour simplifier ici)

        if (user) {
            const { data: interactions } = await supabase
                .from("user_interactions")
                .select("tmdb_id")
                .eq("user_id", user.id)
                .eq("media_type", "movie"); // On filtre movie pour cette page
            
            if (interactions) {
                interactions.forEach(i => historySet.add(i.tmdb_id));
            }
        }

        const uniqueIds = new Set<number>();
        // On ajoute l'historique aux IDs uniques pour ne pas les fetcher/afficher
        historySet.forEach(id => uniqueIds.add(id));

        // 2. TENDANCES
        const trendReq = await fetch(`${baseUrl}/trending/movie/week?api_key=${apiKey}&language=fr-FR`);
        const trendData = await trendReq.json();
        const trendResults = (trendData.results || []).filter((m: any) => {
            if (uniqueIds.has(m.id)) return false; // 🚫 Déjà vu/liké
            uniqueIds.add(m.id);
            return true;
        });
        setTrending(trendResults);

        // 3. CLASSIQUES
        const classicReq = await fetch(`${baseUrl}/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=3000&vote_average.gte=8.0&release_date.lte=2005-01-01`);
        const classicData = await classicReq.json();
        const classicFiltered = (classicData.results || []).filter((m: any) => {
            if (uniqueIds.has(m.id)) return false; // 🚫 Déjà vu/liké
            uniqueIds.add(m.id);
            return true;
        });
        setClassics(classicFiltered);

        // 4. DÉCOUVERTE (Cinéma du monde)
        const discoveryReq = await fetch(`${baseUrl}/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=500&vote_average.gte=7.5&with_original_language=it|es|ja|ko|de&page=1`);
        const discoveryData = await discoveryReq.json();
        const discoveryFiltered = (discoveryData.results || []).filter((m: any) => {
            if (uniqueIds.has(m.id)) return false; // 🚫 Déjà vu/liké
            uniqueIds.add(m.id);
            return true;
        });
        setDiscovery(discoveryFiltered);

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleHideMovie = (id: number) => {
    setHiddenIds((prev) => [...prev, id]);
  };

  const filterVisible = (list: any[]) => list.filter(item => !hiddenIds.includes(item.id));

  const scrollContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "20px",
    overflowX: "auto",
    paddingBottom: "20px",
    scrollBehavior: "smooth",
    scrollbarWidth: "none",
    msOverflowStyle: "none", 
  };

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

        {loading ? (
            <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p>Chargement des collections...</p>
            </div>
        ) : (
            <div style={{ paddingLeft: "40px" }}> 
                
                {/* SECTION 1 : TENDANCES */}
                <section style={{ marginBottom: "60px" }}>
                    <h2 style={{ borderLeft: "5px solid #e50914", paddingLeft: "15px", marginBottom: "25px" }}>🔥 Ça cartonne en ce moment</h2>
                    <TransitionGroup className="scroll-hide" style={scrollContainerStyle}>
                        {filterVisible(trending).map(item => {
                            const nodeRef = createRef<HTMLAnchorElement>(); // Ref stable pour l'animation
                            return (
                                <CSSTransition key={item.id} timeout={400} classNames="card-transition" nodeRef={nodeRef}>
                                    <DiscoverCard ref={nodeRef} item={item} onInteract={handleHideMovie} />
                                </CSSTransition>
                            );
                        })}
                    </TransitionGroup>
                    {filterVisible(trending).length === 0 && <p style={{color: "#555"}}>Wow, vous êtes à jour sur les tendances !</p>}
                </section>

                {/* SECTION 2 : CLASSIQUES */}
                <section style={{ marginBottom: "60px" }}>
                    <h2 style={{ borderLeft: "5px solid #f1c40f", paddingLeft: "15px", marginBottom: "25px" }}>🍷 Les Incontournables (Classiques)</h2>
                    <TransitionGroup className="scroll-hide" style={scrollContainerStyle}>
                        {filterVisible(classics).map(item => {
                            const nodeRef = createRef<HTMLAnchorElement>();
                            return (
                                <CSSTransition key={item.id} timeout={400} classNames="card-transition" nodeRef={nodeRef}>
                                    <DiscoverCard ref={nodeRef} item={item} onInteract={handleHideMovie} />
                                </CSSTransition>
                            );
                        })}
                    </TransitionGroup>
                </section>

                {/* SECTION 3 : HORS ZONE DE CONFORT */}
                <section style={{ marginBottom: "60px" }}>
                    <h2 style={{ borderLeft: "5px solid #3498db", paddingLeft: "15px", marginBottom: "25px" }}>🌍 Sortir de sa zone de confort</h2>
                    <TransitionGroup className="scroll-hide" style={scrollContainerStyle}>
                        {filterVisible(discovery).map(item => {
                            const nodeRef = createRef<HTMLAnchorElement>();
                            return (
                                <CSSTransition key={item.id} timeout={400} classNames="card-transition" nodeRef={nodeRef}>
                                    <DiscoverCard ref={nodeRef} item={item} onInteract={handleHideMovie} />
                                </CSSTransition>
                            );
                        })}
                    </TransitionGroup>
                </section>
            </div>
        )}
      </div>
    </div>
  );
}