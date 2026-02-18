"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { createClient } from "@/utils/supabase/client";

// --- TYPE ---
type MediaItem = {
  tmdb_id: number;
  media_type: string;
  title?: string;
  name?: string; 
  poster_path?: string;
  vote_average?: number;
  in_list: boolean;
  is_seen: boolean;
  is_liked: boolean;
};

// --- COMPOSANT CARTE ---
const LibraryCard = ({ 
  item, 
  activeTab, 
  isSelectionMode, 
  isSelected, 
  onSelect, 
  onUpdate,
  hasConfirmed,
  setHasConfirmed
}: { 
  item: MediaItem, 
  activeTab: string, 
  isSelectionMode: boolean, 
  isSelected: boolean, 
  onSelect: () => void, 
  onUpdate: () => void,
  hasConfirmed: boolean,
  setHasConfirmed: (val: boolean) => void
}) => {
  const supabase = createClient();
  const type = item.media_type || 'movie';
  const imageUrl = "https://image.tmdb.org/t/p/w500";
  // Gestion robuste du titre (Film ou Série)
  const displayTitle = item.title || item.name || "Titre en chargement...";

  const updateStatus = async (newState: Partial<MediaItem>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_interactions").upsert({
        user_id: user.id,
        tmdb_id: item.tmdb_id,
        media_type: type,
        ...newState,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,tmdb_id,media_type" });

    setTimeout(() => onUpdate(), 300);
  };

  const handleRemove = () => {
    const newState = { in_list: false }; 
    if (!hasConfirmed) {
        if (confirm("Retirer cet élément ?")) {
            setHasConfirmed(true);
            updateStatus(newState);
        }
    } else {
        updateStatus(newState);
    }
  };

  const handleToggleSeen = () => {
    if (activeTab === 'list') updateStatus({ in_list: false, is_seen: true }); 
    else if (activeTab === 'seen') updateStatus({ is_seen: false }); 
  };

  const handleToggleLiked = () => {
    if (activeTab === 'liked') updateStatus({ is_liked: false });
    else updateStatus({ is_seen: true, is_liked: true });
  };

  const handleCardClick = (e: React.MouseEvent) => {
      if (isSelectionMode) {
          e.preventDefault();
          onSelect();
      }
  };

  return (
    <div 
        onClick={handleCardClick}
        style={{ position: "relative", transition: "transform 0.2s", cursor: isSelectionMode ? "pointer" : "default" }} 
        onMouseOver={(e) => !isSelectionMode && (e.currentTarget.style.transform = "scale(1.05)")} 
        onMouseOut={(e) => !isSelectionMode && (e.currentTarget.style.transform = "scale(1)")}
    >
        <Link href={isSelectionMode ? "#" : `/movie/${item.tmdb_id}?type=${type}`} style={{ textDecoration: "none", color: "white", pointerEvents: isSelectionMode ? "none" : "auto" }}>
            <div style={{ 
                borderRadius: "10px", 
                overflow: "hidden", 
                aspectRatio: "2/3", 
                backgroundColor: "#333", 
                marginBottom: "10px", 
                position: "relative",
                border: isSelected ? "4px solid #e50914" : "none",
                opacity: isSelectionMode && !isSelected ? 0.6 : 1
            }}>
                {item.poster_path ? (
                    <img src={`${imageUrl}${item.poster_path}`} alt={displayTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#777", flexDirection: "column", padding: "10px", textAlign: "center" }}>
                        <span>📷</span>
                        <span style={{fontSize: "0.7rem", marginTop: "5px"}}>Pas d'image</span>
                    </div>
                )}

                {isSelected && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "3rem" }}>✅</div>
                )}

                {activeTab === 'list' && !isSelectionMode && (
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(); }}
                        style={{
                            position: "absolute", top: "5px", right: "5px",
                            background: "rgba(0,0,0,0.6)", color: "white", border: "1px solid rgba(255,255,255,0.3)",
                            borderRadius: "50%", width: "25px", height: "25px",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", zIndex: 10
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>
        </Link>
        
        <h3 style={{ fontSize: "0.9rem", margin: "0 0 10px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayTitle}
        </h3>

        {!isSelectionMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {activeTab !== 'liked' && (
                    <button 
                        onClick={(e) => { e.preventDefault(); handleToggleSeen(); }} 
                        style={{ background: activeTab === 'seen' ? "#46d369" : "#222", border: "1px solid #444", color: "white", borderRadius: "5px", padding: "6px", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                        {activeTab === 'seen' ? "✓ Vu" : "👁️ Vu"}
                    </button>
                )}
                <button 
                    onClick={(e) => { e.preventDefault(); handleToggleLiked(); }} 
                    style={{ background: activeTab === 'liked' ? "#e50914" : "#222", border: "1px solid #444", color: "white", borderRadius: "5px", padding: "6px", cursor: "pointer", fontSize: "0.8rem", width: activeTab === 'liked' ? "100%" : "auto" }}
                >
                    {activeTab === 'liked' ? "❤️ Aimé" : "🤍 Aimé"}
                </button>
            </div>
        )}
    </div>
  );
};

// --- PAGE PRINCIPALE ---
export default function MyListPage() {
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState<'list' | 'seen' | 'liked'>('list');
  const [medias, setMedias] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const fetchMyList = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Récupérer les interactions (ce que tu as liké/vu)
      const { data: interactions } = await supabase
        .from("user_interactions")
        .select("*")
        .eq("user_id", user.id);

      if (!interactions || interactions.length === 0) {
        setMedias([]);
        setLoading(false);
        return;
      }

      // 2. Récupérer les infos du CACHE SUPABASE
      const mediaIds = interactions.map(i => i.tmdb_id);
      const { data: cacheData } = await supabase
        .from("media_cache")
        .select("*")
        .in("tmdb_id", mediaIds);

      // 3. FUSION INTELLIGENTE : CACHE + TMDB FALLBACK
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      
      const promises = interactions.map(async (interaction) => {
          // A. Essayer de trouver dans le cache
          let details = cacheData?.find(c => c.tmdb_id === interaction.tmdb_id && c.media_type === interaction.media_type);

          // B. Si PAS dans le cache -> Récupérer depuis TMDB en urgence
          if (!details) {
              try {
                  const type = interaction.media_type || 'movie';
                  const res = await fetch(`https://api.themoviedb.org/3/${type}/${interaction.tmdb_id}?api_key=${apiKey}&language=fr-FR`);
                  const tmdbData = await res.json();
                  
                  if (tmdbData) {
                      details = {
                          title: tmdbData.title || tmdbData.name,
                          poster_path: tmdbData.poster_path,
                          vote_average: tmdbData.vote_average
                      };
                      
                      // C. AUTO-RÉPARATION : On sauve dans le cache pour la prochaine fois
                      supabase.from("media_cache").upsert({
                          tmdb_id: interaction.tmdb_id,
                          media_type: type,
                          title: details.title,
                          poster_path: details.poster_path,
                          vote_average: details.vote_average
                      }, { onConflict: "tmdb_id,media_type" }).then(); // .then() pour ne pas bloquer l'affichage
                  }
              } catch (e) { console.error("Erreur fetch TMDB", e); }
          }

          return {
              ...interaction,
              title: details?.title || details?.name || "Titre introuvable",
              poster_path: details?.poster_path || null,
              vote_average: details?.vote_average || 0
          };
      });

      const mergedData = await Promise.all(promises);
      setMedias(mergedData);
      setLoading(false);
  };

  useEffect(() => { fetchMyList(); }, []);

  const toggleSelection = (uniqueId: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(uniqueId)) newSet.delete(uniqueId);
      else newSet.add(uniqueId);
      setSelectedIds(newSet);
  };

  const handleBatchDelete = async () => {
      if (selectedIds.size === 0) return;

      if (!hasConfirmed) {
          if (!confirm(`Supprimer ces ${selectedIds.size} titres ?`)) return;
          setHasConfirmed(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates = Array.from(selectedIds).map(async (uniqueId) => {
          const [type, idStr] = uniqueId.split('_');
          const tmdbId = parseInt(idStr);

          const updatePayload: any = {};
          if (activeTab === 'list') updatePayload.in_list = false;
          else if (activeTab === 'seen') updatePayload.is_seen = false;
          else if (activeTab === 'liked') updatePayload.is_liked = false;

          await supabase.from("user_interactions").update(updatePayload)
            .eq("user_id", user.id)
            .eq("tmdb_id", tmdbId)
            .eq("media_type", type);
      });

      await Promise.all(updates);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      fetchMyList();
  };

  // Filtrage
  const filteredList = medias.filter(m => {
      if (activeTab === 'list') return m.in_list === true && m.is_seen === false && m.is_liked === false;
      if (activeTab === 'seen') return m.is_seen === true && m.is_liked === false; 
      if (activeTab === 'liked') return m.is_liked === true;
      return false;
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "2.5rem", margin: 0 }}>Ma Bibliothèque 📚</h1>
            
            {filteredList.length > 0 && (
                <button 
                    onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: isSelectionMode ? "#333" : "#e50914",
                        border: isSelectionMode ? "1px solid #555" : "none",
                        color: "white", borderRadius: "30px", cursor: "pointer", fontWeight: "bold"
                    }}
                >
                    {isSelectionMode ? "Annuler" : "Gérer"}
                </button>
            )}
        </div>

        {isSelectionMode && (
            <div style={{ 
                marginBottom: "20px", padding: "15px", backgroundColor: "#222", 
                borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center",
                border: "1px solid #444"
            }}>
                <span>{selectedIds.size} sélectionné(s)</span>
                {selectedIds.size > 0 && (
                    <button 
                        onClick={handleBatchDelete}
                        style={{ backgroundColor: "#e50914", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                    >
                        🗑️ Supprimer de {activeTab === 'list' ? "la liste" : (activeTab === 'seen' ? "Vus" : "Aimés")}
                    </button>
                )}
            </div>
        )}

        <div style={{ display: "flex", gap: "20px", marginBottom: "40px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
            <button onClick={() => {setActiveTab('list'); setIsSelectionMode(false);}} style={{ background: "none", border: "none", color: activeTab === 'list' ? "white" : "#888", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer", borderBottom: activeTab === 'list' ? "3px solid #e50914" : "3px solid transparent", paddingBottom: "5px" }}>À voir</button>
            <button onClick={() => {setActiveTab('seen'); setIsSelectionMode(false);}} style={{ background: "none", border: "none", color: activeTab === 'seen' ? "white" : "#888", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer", borderBottom: activeTab === 'seen' ? "3px solid #46d369" : "3px solid transparent", paddingBottom: "5px" }}>Vus</button>
            <button onClick={() => {setActiveTab('liked'); setIsSelectionMode(false);}} style={{ background: "none", border: "none", color: activeTab === 'liked' ? "white" : "#888", fontSize: "1.2rem", fontWeight: "bold", cursor: "pointer", borderBottom: activeTab === 'liked' ? "3px solid #ffbd3f" : "3px solid transparent", paddingBottom: "5px" }}>Aimés ❤️</button>
        </div>

        {loading ? (
            <p>Chargement...</p>
        ) : filteredList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>
                <h2>C'est vide ici... 🕸️</h2>
                {activeTab === 'list' && <p>Ajoute des films depuis le Dashboard !</p>}
                <Link href="/dashboard" style={{ display: "inline-block", marginTop: "20px", color: "#e50914", textDecoration: "none", border: "1px solid #e50914", padding: "10px 20px", borderRadius: "20px" }}>Aller au Dashboard</Link>
            </div>
        ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "25px" }}>
                {filteredList.map((media) => {
                    const uniqueKey = `${media.media_type}_${media.tmdb_id}`;
                    return (
                        <LibraryCard 
                            key={uniqueKey} 
                            item={media} 
                            activeTab={activeTab}
                            onUpdate={fetchMyList}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(uniqueKey)}
                            onSelect={() => toggleSelection(uniqueKey)}
                            hasConfirmed={hasConfirmed}
                            setHasConfirmed={setHasConfirmed}
                        />
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
}   