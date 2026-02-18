"use client";

import { useState, useEffect, use } from "react"; // 'use' pour les params
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../../components/Navbar";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const targetUserId = unwrappedParams.id;
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ seen: 0, list: 0, liked: 0 });
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
        // 1. Profil Infos
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single();
        if (!userProfile) { alert("Utilisateur introuvable"); router.push("/profile"); return; }
        setProfile(userProfile);

        // 2. Interactions (Pour stats et liste)
        const { data: interactions } = await supabase.from("user_interactions").select("*").eq("user_id", targetUserId);
        
        setStats({
            seen: interactions?.filter(i => i.is_seen).length || 0,
            list: interactions?.filter(i => i.in_list).length || 0,
            liked: interactions?.filter(i => i.is_liked).length || 0,
        });

        // 3. Watchlist Visuelle
        const listIds = interactions?.filter(i => i.in_list).slice(0, 8).map(i => i.tmdb_id) || [];
        if (listIds.length > 0) {
            const { data: cached } = await supabase.from("media_cache").select("*").in("tmdb_id", listIds);
            setWatchlist(cached || []);
        }

        setLoading(false);
    };
    fetchProfile();
  }, [targetUserId]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#141414", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px" }}>
          
          {/* HEADER */}
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
              <img src={profile.avatar_url || "https://via.placeholder.com/150"} style={{ width: "120px", height: "120px", borderRadius: "50%", border: "4px solid #e50914", marginBottom: "20px" }} />
              <h1 style={{ fontSize: "2.5rem", margin: 0 }}>{profile.username}</h1>
              <p style={{ color: "#aaa", fontStyle: "italic", marginTop: "10px" }}>"{profile.bio || "Pas de bio."}"</p>
          </div>

          {/* STATS RAPIDES */}
          <div style={{ display: "flex", justifyContent: "center", gap: "40px", marginBottom: "50px" }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: "bold", color: "#46d369" }}>{stats.seen}</div><div style={{ color: "#666", fontSize: "0.8rem" }}>FILMS VUS</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: "bold", color: "#e50914" }}>{stats.liked}</div><div style={{ color: "#666", fontSize: "0.8rem" }}>LIKES</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ffbd3f" }}>{stats.list}</div><div style={{ color: "#666", fontSize: "0.8rem" }}>À VOIR</div></div>
          </div>

          {/* FAVORIS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px", marginBottom: "50px" }}>
              <div style={{ background: "#222", padding: "15px", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.8rem", color: "#aaa" }}>Film Culte</div>
                  <div style={{ fontWeight: "bold", color: "#e50914" }}>{profile.preferences?.favorites?.movie || "-"}</div>
              </div>
              <div style={{ background: "#222", padding: "15px", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.8rem", color: "#aaa" }}>Réalisateur</div>
                  <div style={{ fontWeight: "bold" }}>{profile.preferences?.favorites?.director || "-"}</div>
              </div>
              <div style={{ background: "#222", padding: "15px", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.8rem", color: "#aaa" }}>Acteur</div>
                  <div style={{ fontWeight: "bold" }}>{profile.preferences?.favorites?.actor || "-"}</div>
              </div>
          </div>

          {/* SA LISTE */}
          {watchlist.length > 0 && (
              <div>
                  <h3 style={{ borderLeft: "4px solid #ffbd3f", paddingLeft: "15px", marginBottom: "20px" }}>Sa liste du moment</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px" }}>
                      {watchlist.map(m => (
                          <div key={m.tmdb_id} style={{ borderRadius: "8px", overflow: "hidden" }}>
                              <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover" }} />
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}