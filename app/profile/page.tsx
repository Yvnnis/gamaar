"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../components/Navbar";

// --- CONFIGURATION AVATARS (OPEN PEEPS) ---
const AVATARS_LIST = [
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Felix&clothing=geeky",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Aneka&face=calm",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Christopher&face=serious",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Molly&face=cute",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Boo&face=concerned",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Buddy&face=smileBig",
  // Ajout de quelques variations supplémentaires pour avoir du choix
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Lucky&glasses=sunglasses",
  "https://api.dicebear.com/9.x/open-peeps/svg?seed=Midnight&face=suspicious"
];

const RANKS = [
  { threshold: 0, title: "Spectateur Curieux 👀" },
  { threshold: 5, title: "Amateur Éclairé 🍿" },
  { threshold: 20, title: "Cinéphile Confirmé 🎬" },
  { threshold: 50, title: "Critique Redouté 🧐" },
  { threshold: 100, title: "Encyclopédie Vivante 🧠" }
];

const BADGES_DEF = [
  { 
      id: 'seen_1', icon: '👶', label: 'Première Séance', 
      statKey: 'seen', target: 1, 
      descUnlocked: "L'aventure commence ! Vous avez vu votre premier film.",
      descLocked: "Marquez 1 film comme 'Vu' pour débloquer."
  },
  { 
      id: 'seen_10', icon: '🍿', label: 'Binge Watcher', 
      statKey: 'seen', target: 10, 
      descUnlocked: "Vous enchaînez les films comme du pop-corn !",
      descLocked: "Regardez 10 films pour prouver votre addiction."
  },
  { 
      id: 'seen_50', icon: '📽️', label: 'Marathonien', 
      statKey: 'seen', target: 50, 
      descUnlocked: "Une endurance cinéphilique à toute épreuve.",
      descLocked: "Atteignez 50 films vus pour ce badge légendaire."
  },
  { 
      id: 'list_5', icon: '📜', label: 'Planificateur', 
      statKey: 'list', target: 5, 
      descUnlocked: "Vous savez ce que vous voulez voir.",
      descLocked: "Ajoutez 5 films à votre liste 'À voir'."
  },
  { 
      id: 'friends_1', icon: '🤝', label: 'Sociable', 
      statKey: 'friends', target: 1, 
      descUnlocked: "Le cinéma, c'est mieux à plusieurs.",
      descLocked: "Ajoutez un ami via son #Tag pour débloquer."
  },
];

const getTimeAgo = (dateString: string) => {
  if (!dateString) return "Hors ligne";
  const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
  if (diff < 5) return "🟢 En ligne";
  if (diff < 60) return `${diff} min`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return "Hors ligne";
};

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  
  // STATES
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'infos' | 'friends'>('infos');
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // STATES AMIS
  const [friendInput, setFriendInput] = useState("");
  const [friendStatus, setFriendStatus] = useState<{type: 'success' | 'error' | null, msg: string}>({ type: null, msg: "" });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({ username: "", bio: "" });
  const [friends, setFriends] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]); 

  const [stats, setStats] = useState<{[key: string]: number}>({ seen: 0, list: 0, liked: 0, friends: 0 });
  const [currentTitle, setCurrentTitle] = useState(RANKS[0].title);
  const [progressToNext, setProgressToNext] = useState(0);

  // FETCH DATA
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (myProfile) {
        setProfile(myProfile);
        setFormData({ username: myProfile.username || "", bio: myProfile.bio || "" });
    }

    const { data: interactions } = await supabase
        .from("user_interactions")
        .select("tmdb_id, media_type, in_list, is_seen, is_liked, created_at")
        .eq("user_id", user.id);

    const statsCount = {
        seen: interactions?.filter(i => i.is_seen).length || 0,
        list: interactions?.filter(i => i.in_list).length || 0,
        liked: interactions?.filter(i => i.is_liked).length || 0,
        friends: 0
    };

    const recentListItems = interactions
        ?.filter(i => i.in_list)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10) || [];
    
    if (recentListItems.length > 0) {
        const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
        const promises = recentListItems.map(async (item) => {
            const { data: cached } = await supabase.from("media_cache").select("*").eq("tmdb_id", item.tmdb_id).eq("media_type", item.media_type).single();
            if (cached) return cached;
            try {
                const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.tmdb_id}?api_key=${apiKey}&language=fr-FR`);
                const data = await res.json();
                if (data) {
                    const toCache = { tmdb_id: item.tmdb_id, media_type: item.media_type, title: data.title || data.name, poster_path: data.poster_path, vote_average: data.vote_average };
                    supabase.from("media_cache").upsert(toCache, { onConflict: "tmdb_id,media_type" }).then();
                    return toCache;
                }
            } catch (e) { return null; }
            return null;
        });
        const results = await Promise.all(promises);
        setWatchlist(results.filter(r => r !== null));
    } else {
        setWatchlist([]);
    }

    const { data: sent } = await supabase.from("friendships").select("friend:profiles!friend_id(*)").eq("user_id", user.id).eq("status", "accepted");
    const { data: received } = await supabase.from("friendships").select("friend:profiles!user_id(*)").eq("friend_id", user.id).eq("status", "accepted");
    const allFriends = [...(sent || []).map(r => r.friend), ...(received || []).map(r => r.friend)];
    setFriends(allFriends);
    statsCount.friends = allFriends.length;

    const { data: requests } = await supabase
        .from("friendships")
        .select("sender:profiles!user_id(*)") 
        .eq("friend_id", user.id) 
        .eq("status", "pending");
    
    if (requests) {
        setPendingRequests(requests.map(r => r.sender));
    }
    
    setStats(statsCount);

    let title = RANKS[0].title;
    let nextT = RANKS[1].threshold;
    let prevT = 0;
    for (let i = 0; i < RANKS.length; i++) {
        if (statsCount.seen >= RANKS[i].threshold) {
            title = RANKS[i].title;
            prevT = RANKS[i].threshold;
            nextT = RANKS[i + 1]?.threshold || 1000;
        }
    }
    setCurrentTitle(title);
    setProgressToNext(Math.min(100, Math.max(0, ((statsCount.seen - prevT) / (nextT - prevT)) * 100)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- ACTIONS ---

  const handleSaveProfile = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ username: formData.username, bio: formData.bio }).eq("id", userId);
    setProfile({ ...profile, ...formData });
    setIsEditing(false);
  };

  const handleChangeAvatar = async (url: string) => {
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      setProfile((prev: any) => ({...prev, avatar_url: url}));
      setShowAvatarModal(false);
  };

  const handleCopyTag = () => {
      if (!profile) return;
      const fullTag = `${profile.username}#${profile.discriminator}`;
      navigator.clipboard.writeText(fullTag);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleAddFriend = async () => {
    setFriendStatus({ type: null, msg: "" });

    if (!friendInput.includes("#")) {
        setFriendStatus({ type: 'error', msg: "Format invalide. Utilisez Pseudo#Tag" });
        return;
    }

    const [targetUsername, targetDiscriminator] = friendInput.split("#");
    if (!targetUsername || !targetDiscriminator) {
        setFriendStatus({ type: 'error', msg: "Pseudo ou Tag manquant." });
        return;
    }

    try {
        const { data: targetUser, error: searchError } = await supabase
            .from("profiles")
            .select("id, username")
            .eq("username", targetUsername.trim())
            .eq("discriminator", targetDiscriminator.trim())
            .single();

        if (searchError || !targetUser) {
            setFriendStatus({ type: 'error', msg: "Utilisateur introuvable 🧐" });
            return;
        }

        if (targetUser.id === userId) {
            setFriendStatus({ type: 'error', msg: "Tu ne peux pas t'ajouter toi-même 😉" });
            return;
        }

        const { data: existingFriendship } = await supabase
            .from("friendships")
            .select("*")
            .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`)
            .single();

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                setFriendStatus({ type: 'error', msg: "Vous êtes déjà amis ! 🎉" });
            } else if (existingFriendship.status === 'pending') {
                setFriendStatus({ type: 'error', msg: "Une demande est déjà en cours ⏳" });
            } else {
                 setFriendStatus({ type: 'error', msg: "Impossible d'ajouter cet utilisateur." });
            }
            return;
        }

        const { error: insertError } = await supabase
            .from("friendships")
            .insert({
                user_id: userId,
                friend_id: targetUser.id,
                status: 'pending' 
            });

        if (insertError) throw insertError;

        setFriendStatus({ type: 'success', msg: `Demande envoyée à ${targetUser.username} ! 🚀` });
        setFriendInput(""); 

    } catch (e) {
        setFriendStatus({ type: 'error', msg: "Erreur serveur. Réessayez plus tard." });
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
      try {
          await supabase
            .from("friendships")
            .update({ status: 'accepted' })
            .eq("user_id", senderId) 
            .eq("friend_id", userId); 

          const newFriend = pendingRequests.find(p => p.id === senderId);
          if (newFriend) {
              setFriends(prev => [...prev, newFriend]); 
              setPendingRequests(prev => prev.filter(p => p.id !== senderId)); 
              setStats(prev => ({ ...prev, friends: prev.friends + 1 })); 
          }

      } catch (e) { console.error(e); }
  };

  const handleDeclineRequest = async (senderId: string) => {
      try {
          await supabase
            .from("friendships")
            .delete()
            .eq("user_id", senderId)
            .eq("friend_id", userId);

          setPendingRequests(prev => prev.filter(p => p.id !== senderId));
      } catch (e) { console.error(e); }
  };


  if (loading) return <div style={{minHeight:"100vh", background:"#141414", display:"flex", alignItems:"center", justifyContent:"center", color:"white"}}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", gap: "30px", alignItems: "center", marginBottom: "40px", flexWrap: "wrap" }}>
             <div style={{ position: "relative" }}>
                <div onClick={() => setShowAvatarModal(true)} style={{ width: "120px", height: "120px", borderRadius: "50%", border: "3px solid #e50914", overflow: "hidden", cursor: "pointer", position: "relative", backgroundColor: "white" }}>
                    <img src={profile?.avatar_url} style={{ width: "100%", height: "100%", objectFit: "contain", padding:"5px" }} />
                    <div style={{ position: "absolute", bottom: 0, width: "100%", background: "rgba(0,0,0,0.6)", fontSize: "0.7rem", textAlign: "center", padding: "2px 0", color: "white" }}>MODIFIER</div>
                </div>
             </div>

             <div style={{ flex: 1 }}>
                {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                        <label style={{ fontSize: "0.8rem", color: "#888", marginBottom: "-5px" }}>Pseudo</label>
                        <input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} style={{background: "#333", border: "1px solid #555", color: "white", padding: "10px", borderRadius: "5px", outline: "none", fontSize: "1rem"}} />
                        <label style={{ fontSize: "0.8rem", color: "#888", marginBottom: "-5px" }}>Biographie</label>
                        <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={3} maxLength={150} style={{background: "#333", border: "1px solid #555", color: "white", padding: "10px", borderRadius: "5px", outline: "none", fontSize: "0.95rem", resize: "none", fontFamily: "inherit"}} />
                        <div style={{ textAlign: "right", fontSize: "0.7rem", color: "#666" }}>{formData.bio.length}/150</div>
                        <div style={{display:"flex", gap:"10px", marginTop: "5px"}}>
                            <button onClick={handleSaveProfile} style={{background:"#e50914", color:"white", border:"none", padding:"8px 20px", borderRadius:"5px", cursor:"pointer", fontWeight:"bold"}}>Sauvegarder</button>
                            <button onClick={() => setIsEditing(false)} style={{background:"transparent", border:"1px solid #555", color:"#aaa", padding:"8px 20px", borderRadius:"5px", cursor:"pointer"}}>Annuler</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                            <h1 style={{ fontSize: "2.5rem", margin: 0 }}>{profile?.username}</h1>
                            {profile?.discriminator && (
                                <span onClick={handleCopyTag} title="Copier mon tag d'ami" style={{ fontSize: "1.2rem", color: "#888", cursor: "pointer", backgroundColor: "#222", padding: "2px 8px", borderRadius: "5px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "white"} onMouseOut={(e) => e.currentTarget.style.color = "#888"}>
                                    #{profile.discriminator}
                                    {copySuccess && <span style={{marginLeft: "10px", fontSize: "0.8rem", color: "#46d369"}}>Copié !</span>}
                                </span>
                            )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "15px", marginTop: "10px" }}>
                            <span style={{ background: "linear-gradient(45deg, #e50914, #ff4757)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold" }}>{currentTitle}</span>
                            <span style={{ color: "#666" }}>•</span>
                            <span style={{ color: "#aaa" }}>{stats.friends} Amis</span>
                        </div>
                        <p style={{ color: "#ccc", fontStyle: "italic", marginTop: "15px", lineHeight: "1.5" }}>"{profile?.bio || "Pas de bio..."}"</p>
                    </>
                )}
             </div>
             <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                 <button onClick={() => !isEditing && setIsEditing(true)} style={{ background: "#333", border: "1px solid #555", color: "white", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>✏️ Modifier profil</button>
                 <button onClick={() => router.push("/calibration?rec=true")} style={{ background: "transparent", border: "1px solid #e50914", color: "#e50914", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>🔄 Refaire le quiz</button>
             </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "30px", borderBottom: "1px solid #333", marginBottom: "30px" }}>
            <button onClick={() => setActiveTab('infos')} style={{ padding: "15px 0", background: "none", border: "none", color: activeTab==='infos'?"white":"#666", borderBottom: activeTab==='infos'?"2px solid #e50914":"2px solid transparent", cursor:"pointer", fontSize:"1.1rem", fontWeight:"bold" }}>Mon Univers</button>
            <button onClick={() => setActiveTab('friends')} style={{ padding: "15px 0", background: "none", border: "none", color: activeTab==='friends'?"white":"#666", borderBottom: activeTab==='friends'?"2px solid #e50914":"2px solid transparent", cursor:"pointer", fontSize:"1.1rem", fontWeight:"bold" }}>Mes Amis {pendingRequests.length > 0 && <span style={{background:"#e50914", padding:"2px 6px", borderRadius:"10px", fontSize:"0.7rem", verticalAlign:"middle", marginLeft:"5px"}}>{pendingRequests.length}</span>}</button>
        </div>

        {activeTab === 'infos' && (
            <div style={{ animation: "fadeIn 0.5s" }}>
                {/* FAVORIS & WATCHLIST & STATS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "40px" }}>
                    <div style={{ background: "#1f1f1f", padding: "20px", borderRadius: "15px", border: "1px solid #333" }}>
                        <div style={{ color: "#aaa", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "5px" }}>Film Culte</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#e50914" }}>{profile?.preferences?.favorites?.movie || "Non défini"}</div>
                    </div>
                    <div style={{ background: "#1f1f1f", padding: "20px", borderRadius: "15px", border: "1px solid #333" }}>
                        <div style={{ color: "#aaa", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "5px" }}>Réalisateur</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{profile?.preferences?.favorites?.director || "Non défini"}</div>
                    </div>
                    <div style={{ background: "#1f1f1f", padding: "20px", borderRadius: "15px", border: "1px solid #333" }}>
                        <div style={{ color: "#aaa", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "5px" }}>Acteur / Actrice</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{profile?.preferences?.favorites?.actor || "Non défini"}</div>
                    </div>
                </div>

                <h3 style={{ borderLeft: "4px solid #e50914", paddingLeft: "15px", marginBottom: "20px" }}>Ma Liste du moment 📜</h3>
                {watchlist.length > 0 ? (
                    <div style={{ display: "flex", gap: "15px", overflowX: "auto", paddingBottom: "20px" }} className="scroll-hide">
                        {watchlist.map((m) => (
                            <Link key={m.tmdb_id} href={`/movie/${m.tmdb_id}?type=${m.media_type}`}>
                                <div style={{ minWidth: "140px", borderRadius: "10px", overflow: "hidden", position: "relative", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.05)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>
                                    <img src={m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : "https://via.placeholder.com/300x450?text=No+Image"} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover" }} />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : <p style={{ color: "#666", fontStyle: "italic" }}>Votre liste est vide. Allez dans Découvrir !</p>}

                <h3 style={{ borderLeft: "4px solid #46d369", paddingLeft: "15px", margin: "40px 0 20px 0" }}>Statistiques</h3>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: "200px", background: "#222", padding: "20px", borderRadius: "15px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                            <span>Films Vus</span>
                            <span style={{ color: "#46d369", fontWeight: "bold" }}>{stats.seen}</span>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "#444", borderRadius: "3px" }}><div style={{ width: `${Math.min(100, stats.seen)}%`, height: "100%", background: "#46d369", borderRadius: "3px" }}></div></div>
                    </div>
                    {BADGES_DEF.map((badge) => {
                        const currentValue = stats[badge.statKey] || 0;
                        const isUnlocked = currentValue >= badge.target;
                        const progressPercent = Math.min(100, (currentValue / badge.target) * 100);
                        return (
                            <div key={badge.id} className="badge-container" style={{ position: "relative" }}>
                                <div style={{ padding: "15px", background: isUnlocked ? "#1f1f1f" : "#111", border: isUnlocked ? "1px solid #444" : "1px dashed #333", borderRadius: "10px", opacity: isUnlocked ? 1 : 0.4, display: "flex", flexDirection: "column", alignItems: "center", minWidth: "100px", cursor: "help", transition: "all 0.2s" }}>
                                    <div style={{ fontSize: "2rem" }}>{badge.icon}</div>
                                    <div style={{ fontSize: "0.8rem", marginTop: "5px", textAlign: "center" }}>{badge.label}</div>
                                </div>
                                <div className="tooltip">
                                    <div style={{ fontWeight: "bold", marginBottom: "5px", color: isUnlocked ? "#46d369" : "#aaa" }}>{isUnlocked ? "✅ Débloqué" : "🔒 Verrouillé"}</div>
                                    <div style={{ fontSize: "0.8rem", marginBottom: "8px" }}>{isUnlocked ? badge.descUnlocked : badge.descLocked}</div>
                                    {!isUnlocked && (<div style={{ width: "100%", background: "#444", height: "4px", borderRadius: "2px" }}><div style={{ width: `${progressPercent}%`, background: "#e50914", height: "100%", borderRadius: "2px" }}></div></div>)}
                                    {!isUnlocked && (<div style={{ fontSize: "0.7rem", marginTop: "4px", color: "#aaa" }}>{currentValue} / {badge.target}</div>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* --- ONGLETS AMIS --- */}
        {activeTab === 'friends' && (
            <div style={{ animation: "fadeIn 0.5s" }}>
                
                <div style={{ background: "#222", padding: "20px", borderRadius: "15px", marginBottom: "30px", border: "1px solid #333" }}>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span>➕ Ajouter un ami</span>
                    </h3>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <input 
                            value={friendInput}
                            onChange={(e) => setFriendInput(e.target.value)}
                            placeholder="Entrez le Pseudo#Tag (ex: Neo#1234)" 
                            style={{ 
                                flex: 1, padding: "12px", borderRadius: "8px", 
                                background: "#111", border: "1px solid #444", 
                                color: "white", outline: "none" 
                            }} 
                        />
                        <button 
                            onClick={handleAddFriend}
                            disabled={!friendInput.trim()}
                            style={{ 
                                padding: "10px 20px", background: "#e50914", 
                                border: "none", borderRadius: "8px", color: "white", 
                                fontWeight: "bold", cursor: friendInput.trim() ? "pointer" : "not-allowed",
                                opacity: friendInput.trim() ? 1 : 0.6
                            }}
                        >
                            Ajouter
                        </button>
                    </div>
                    
                    {friendStatus.msg && (
                        <div style={{ 
                            marginTop: "15px", padding: "10px", borderRadius: "8px", fontSize: "0.9rem",
                            background: friendStatus.type === 'success' ? "rgba(70, 211, 105, 0.1)" : "rgba(229, 9, 20, 0.1)",
                            color: friendStatus.type === 'success' ? "#46d369" : "#ff4757",
                            border: `1px solid ${friendStatus.type === 'success' ? "#46d369" : "#ff4757"}`
                        }}>
                            {friendStatus.msg}
                        </div>
                    )}
                </div>

                {pendingRequests.length > 0 && (
                    <div style={{ marginBottom: "40px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "15px", color: "#e50914" }}>📩 Demandes reçues ({pendingRequests.length})</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                            {pendingRequests.map((req) => (
                                <div key={req.id} style={{ background: "#2a1a1a", padding: "15px", borderRadius: "15px", border: "1px solid #e50914", display: "flex", alignItems: "center", gap: "15px" }}>
                                    <div style={{width:"50px", height:"50px", borderRadius:"50%", overflow:"hidden", background: "white"}}>
                                        <img src={req.avatar_url || "https://via.placeholder.com/100"} style={{ width: "100%", height: "100%", objectFit:"contain", padding:"5px" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: "bold" }}>{req.username}</div>
                                        <div style={{ fontSize: "0.8rem", color: "#aaa" }}>Veut être ton ami</div>
                                    </div>
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button onClick={() => handleAcceptRequest(req.id)} style={{ background: "#46d369", border: "none", borderRadius: "8px", padding:"5px 10px", cursor: "pointer", fontWeight:"bold", color:"black" }}>Accepter</button>
                                        <button onClick={() => handleDeclineRequest(req.id)} style={{ background: "#333", border: "1px solid #555", color:"white", borderRadius: "8px", padding:"5px 10px", cursor: "pointer" }}>Refuser</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Mes Amis ({friends.length})</h3>

                {friends.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" }}>
                        {friends.map((friend) => (
                            <Link key={friend.id} href={`/profile/${friend.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                <div style={{ background: "#1f1f1f", padding: "20px", borderRadius: "15px", border: "1px solid #333", display: "flex", alignItems: "center", gap: "15px", cursor: "pointer", transition: "transform 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="translateY(-5px)"} onMouseOut={e=>e.currentTarget.style.transform="translateY(0)"}>
                                    <div style={{ width: "50px", height: "50px", borderRadius: "50%", overflow: "hidden", background: "white" }}>
                                        <img src={friend.avatar_url || "https://via.placeholder.com/100"} style={{ width: "100%", height: "100%", objectFit:"contain", padding:"5px" }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: "bold" }}>{friend.username}</div>
                                        <div style={{ fontSize: "0.8rem", color: getTimeAgo(friend.last_seen).includes("En ligne") ? "#46d369" : "#666" }}>{getTimeAgo(friend.last_seen)}</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: "center", padding: "40px", color: "#666", border: "1px dashed #333", borderRadius: "15px" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🕸️</div>
                        <p>Aucun ami pour le moment.</p>
                        <p style={{ fontSize: "0.9rem" }}>Utilisez la recherche ci-dessus pour envoyer des demandes !</p>
                    </div>
                )}
            </div>
        )}

      </div>

      {/* MODALE AVATAR AVEC FOND BLANC */}
      {showAvatarModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
              <div style={{ background: "#1f1f1f", padding: "30px", borderRadius: "20px", maxWidth: "500px", width: "90%" }}>
                  <h3 style={{ textAlign: "center", marginBottom: "20px" }}>Choisir un Avatar</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "15px", marginBottom: "20px" }}>
                      {AVATARS_LIST.map((url, i) => (
                          // ✅ FOND BLANC AJOUTÉ ICI pour que le dessin soit visible
                          <img 
                            key={i} 
                            src={url} 
                            onClick={() => handleChangeAvatar(url)} 
                            style={{ 
                                width: "100%", 
                                borderRadius: "50%", 
                                border: profile.avatar_url === url ? "3px solid #e50914" : "2px solid transparent", 
                                cursor: "pointer", 
                                transition: "transform 0.2s",
                                backgroundColor: "white", // Fond blanc
                                padding: "5px" // Petit padding
                            }} 
                          />
                      ))}
                  </div>
                  <button onClick={() => setShowAvatarModal(false)} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #555", color: "white", borderRadius: "10px", cursor: "pointer" }}>Fermer</button>
              </div>
          </div>
      )}

      <style jsx>{` 
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } 
        .scroll-hide::-webkit-scrollbar { display: none; }
        .badge-container .tooltip { visibility: hidden; width: 200px; background-color: #333; color: #fff; text-align: center; border-radius: 8px; padding: 10px; position: absolute; z-index: 1; bottom: 110%; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border: 1px solid #555; pointer-events: none; }
        .badge-container:hover .tooltip { visibility: visible; opacity: 1; }
        .badge-container .tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #333 transparent transparent transparent; }
      `}</style>
    </div>
  );
}