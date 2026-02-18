"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../components/Navbar";

export default function PartyPage() {
  const supabase = createClient();
  const router = useRouter();

  // STATES
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [creating, setCreating] = useState(false);

  // SEARCH STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");

  // CHARGER LES AMIS
  useEffect(() => {
    const fetchFriends = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        // Amis acceptés uniquement
        const { data: sent } = await supabase.from("friendships").select("friend:profiles!friend_id(*)").eq("user_id", user.id).eq("status", "accepted");
        const { data: received } = await supabase.from("friendships").select("friend:profiles!user_id(*)").eq("friend_id", user.id).eq("status", "accepted");
        
        // Fonction pour gérer si Supabase renvoie un tableau ou un objet
        const normalizeFriend = (r: any) => Array.isArray(r.friend) ? r.friend[0] : r.friend;

        const allFriends = [
            ...(sent || []).map(normalizeFriend),
            ...(received || []).map(normalizeFriend)
        ].filter(Boolean); // On enlève les null/undefined
        
        // Dédoublonnage visuel (Cast 'item: any' pour corriger l'erreur TS)
        const uniqueFriends = Array.from(new Map(allFriends.map((item: any) => [item.id, item])).values());
        
        setFriends(uniqueFriends);
        setLoading(false);
    };
    fetchFriends();
  }, [router]);

  // GÉNÉRATEUR DE CODE SESSION (4 Lettres/Chiffres)
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Pas de I, O, 1, 0 pour éviter confusion
    let result = "";
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  // --- LOGIQUE DE LANCEMENT ---
  const startSessionWith = async (targetId: string) => {
    if (creating) return;
    setCreating(true);
    const code = generateCode();

    try {
        // 1. Créer la session
        const { data: session, error: sessError } = await supabase
            .from("match_sessions")
            .insert({ code: code, created_by: userId })
            .select()
            .single();

        if (sessError) throw sessError;

        // 2. Ajouter les participants (Moi + L'ami)
        // Note: On utilise upsert pour éviter les doublons si on spam le bouton
        await supabase.from("session_members").upsert([
            { session_id: session.id, user_id: userId },
            { session_id: session.id, user_id: targetId }
        ], { onConflict: "session_id, user_id" });

        // 3. Redirection
        router.push(`/party/${code}`);

    } catch (error) {
        console.error("Erreur lancement session:", error);
        alert("Oups, impossible de créer le salon. Réessaie !");
        setCreating(false);
    }
  };

  // --- HANDLER RECHERCHE MANUELLE ---
  const handleManualInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      setSearchFeedback("");
      setCreating(true);

      if (!searchQuery.includes("#")) {
          setSearchFeedback("⚠️ Format invalide. Utilise Pseudo#1234");
          setCreating(false);
          return;
      }

      const [username, discriminator] = searchQuery.split("#");
      
      // Chercher l'utilisateur
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .eq("discriminator", discriminator.trim())
        .single();

      if (!targetUser) {
          setSearchFeedback("❌ Utilisateur introuvable.");
          setCreating(false);
          return;
      }

      if (targetUser.id === userId) {
          setSearchFeedback("⚠️ Tu ne peux pas t'inviter toi-même.");
          setCreating(false);
          return;
      }

      await startSessionWith(targetUser.id);
  };

  if (loading) return <div style={{minHeight:"100vh", background:"#141414", color:"white", display:"flex", alignItems:"center", justifyContent:"center"}}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>Party Mode 👯‍♂️</h1>
            <p style={{ color: "#aaa", fontSize: "1.1rem" }}>
              Invite un ami ou tape un pseudo pour lancer une séance.
            </p>
        </div>

        {/* --- MÉTHODE 1 : INVITATION DIRECTE PAR TAG --- */}
        <div style={{ backgroundColor: "#222", padding: "25px", borderRadius: "15px", border: "1px solid #333", marginBottom: "40px" }}>
            <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem" }}>⚡ Invitation Rapide</h3>
            <form onSubmit={handleManualInvite} style={{ display: "flex", gap: "10px" }}>
                <input 
                    type="text"
                    placeholder="Ex: Batman#1234"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={creating}
                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #555", backgroundColor: "#141414", color: "white", outline: "none" }}
                />
                <button 
                    type="submit"
                    disabled={creating || !searchQuery.includes("#")}
                    style={{ padding: "12px 20px", backgroundColor: "#e50914", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", opacity: creating ? 0.7 : 1 }}
                >
                    {creating ? "..." : "GO"}
                </button>
            </form>
            {searchFeedback && <p style={{ marginTop: "10px", color: searchFeedback.includes("⚠️") || searchFeedback.includes("❌") ? "#ffbd3f" : "#46d369", fontSize: "0.9rem" }}>{searchFeedback}</p>}
        </div>

        {/* --- SÉPARATEUR --- */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#666", marginBottom: "30px" }}>
             <div style={{ flex: 1, height: "1px", background: "#333" }}></div>
             <span style={{ fontSize: "0.9rem", fontWeight: "bold" }}>OU CHOISIS UN AMI</span>
             <div style={{ flex: 1, height: "1px", background: "#333" }}></div>
        </div>

        {/* --- MÉTHODE 2 : LISTE D'AMIS --- */}
        <div style={{ display: "grid", gap: "15px" }}>
            {friends.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#666", fontStyle: "italic" }}>
                    Aucun ami connecté pour l'instant. Utilise l'invitation rapide ! 👆
                </div>
            ) : (
                friends.map((friend) => (
                    <button 
                        key={friend.id}
                        onClick={() => startSessionWith(friend.id)}
                        disabled={creating}
                        style={{
                            display: "flex", alignItems: "center", gap: "20px",
                            backgroundColor: "#1f1f1f", border: "1px solid #333",
                            padding: "15px 20px", borderRadius: "15px", cursor: "pointer",
                            textAlign: "left", transition: "all 0.2s"
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#2a2a2a"; e.currentTarget.style.borderColor = "#555"; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#1f1f1f"; e.currentTarget.style.borderColor = "#333"; }}
                    >
                        <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#333", overflow: "hidden", border: "2px solid #e50914", flexShrink: 0 }}>
                            {friend.avatar_url ? <img src={friend.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{display:"flex", alignItems:"center", justifyContent:"center", height:"100%", fontSize:"1.2rem"}}>👤</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "white" }}>{friend.username}</h3>
                            <span style={{ color: "#666", fontSize: "0.8rem" }}>#{friend.discriminator}</span>
                        </div>
                        <span style={{ color: "#e50914", fontWeight: "bold" }}>Inviter ➜</span>
                    </button>
                ))
            )}
        </div>
      </div>
    </div>
  );
}