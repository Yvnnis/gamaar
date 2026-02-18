"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../components/Navbar";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(""); // Message succès/erreur
  
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [userId, setUserId] = useState("");

  // CHARGEMENT INITIAL
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    // 1. Récupérer les demandes reçues (pending)
    const { data: requests } = await supabase
      .from("friendships")
      .select("*, sender:profiles!user_id(username, discriminator, avatar_url)")
      .eq("friend_id", user.id)
      .eq("status", "pending");
    
    if (requests) setIncomingRequests(requests);

    // 2. Récupérer les amis (accepted)
    // C'est un peu complexe car je peux être user_id OU friend_id.
    // Pour simplifier ici, on fait deux requêtes (optimisable plus tard)
    const { data: sent } = await supabase
      .from("friendships")
      .select("*, friend:profiles!friend_id(username, discriminator, avatar_url)")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    const { data: received } = await supabase
      .from("friendships")
      .select("*, friend:profiles!user_id(username, discriminator, avatar_url)")
      .eq("friend_id", user.id)
      .eq("status", "accepted");

    // On combine tout en une seule liste propre
    const allFriends = [
        ...(sent || []).map(r => r.friend), 
        ...(received || []).map(r => r.friend)
    ];
    setFriends(allFriends);
  };

  useEffect(() => { fetchData(); }, []);

  // --- ACTIONS ---

  // 🔍 CHERCHER ET AJOUTER UN AMI
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback("");

    // 1. Parser le Pseudo#1234
    const [username, discriminator] = searchQuery.split("#");
    
    if (!username || !discriminator) {
        setFeedback("Format incorrect. Utilise Pseudo#1234");
        setLoading(false);
        return;
    }

    // 2. Trouver l'utilisateur cible
    const { data: targetUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .eq("discriminator", discriminator.trim())
        .single();

    if (!targetUser) {
        setFeedback("Utilisateur introuvable. Vérifie le #Tag.");
        setLoading(false);
        return;
    }

    if (targetUser.id === userId) {
        setFeedback("Tu ne peux pas t'ajouter toi-même (triste, je sais).");
        setLoading(false);
        return;
    }

    // 3. Envoyer la demande
    const { error } = await supabase
        .from("friendships")
        .insert({
            user_id: userId,
            friend_id: targetUser.id,
            status: 'pending'
        });

    if (error) {
        if (error.code === '23505') setFeedback("Demande déjà envoyée ou vous êtes déjà amis.");
        else setFeedback("Erreur lors de l'envoi.");
    } else {
        setFeedback("Demande envoyée avec succès ! 🚀");
        setSearchQuery("");
    }
    setLoading(false);
  };

  // ✅ ACCEPTER UNE DEMANDE
  const handleAccept = async (friendshipId: string) => {
      await supabase
        .from("friendships")
        .update({ status: 'accepted' })
        .eq("id", friendshipId);
      
      // Refresh UI
      fetchData();
  };

  // ❌ REFUSER / SUPPRIMER
  const handleDelete = async (friendshipId: string) => {
      if(!confirm("Es-tu sûr ?")) return;
      await supabase.from("friendships").delete().eq("id", friendshipId);
      fetchData();
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "30px", textAlign: "center" }}>Mes Relations 🕸️</h1>

        {/* 1. ZONE D'AJOUT */}
        <div style={{ backgroundColor: "#1f1f1f", padding: "20px", borderRadius: "15px", marginBottom: "40px", border: "1px solid #333" }}>
            <h3 style={{ margin: "0 0 15px 0" }}>Ajouter un ami</h3>
            <form onSubmit={handleSendRequest} style={{ display: "flex", gap: "10px" }}>
                <input 
                    type="text" 
                    placeholder="Ex: Batman#4092" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #555", backgroundColor: "#141414", color: "white" }}
                />
                <button 
                    disabled={loading}
                    type="submit" 
                    style={{ padding: "12px 20px", backgroundColor: "#e50914", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? "..." : "Envoyer"}
                </button>
            </form>
            {feedback && <p style={{ marginTop: "10px", color: feedback.includes("succès") ? "#46d369" : "#ffbd3f", fontSize: "0.9rem" }}>{feedback}</p>}
        </div>

        {/* 2. DEMANDES EN ATTENTE */}
        {incomingRequests.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
                <h3 style={{ color: "#aaa", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px" }}>Demandes reçues</h3>
                {incomingRequests.map(req => (
                    <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#222", padding: "15px", borderRadius: "10px", marginBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#444", overflow:"hidden" }}>
                                {req.sender.avatar_url && <img src={req.sender.avatar_url} style={{width:"100%", height:"100%"}} />}
                            </div>
                            <div>
                                <span style={{ fontWeight: "bold", display:"block" }}>{req.sender.username}</span>
                                <span style={{ color: "#666", fontSize: "0.8rem" }}>#{req.sender.discriminator}</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button onClick={() => handleAccept(req.id)} style={{ background: "#46d369", border: "none", borderRadius: "5px", padding: "5px 10px", cursor: "pointer" }}>✅</button>
                            <button onClick={() => handleDelete(req.id)} style={{ background: "#e50914", border: "none", borderRadius: "5px", padding: "5px 10px", cursor: "pointer" }}>❌</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* 3. LISTE D'AMIS */}
        <div>
            <h3 style={{ color: "#aaa", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "15px" }}>Mes Amis ({friends.length})</h3>
            {friends.length === 0 ? (
                <p style={{ color: "#555", fontStyle: "italic" }}>Pas encore d'amis. Ajoute quelqu'un via son #Tag !</p>
            ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                    {friends.map((friend, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1a1a1a", padding: "15px", borderRadius: "10px", border: "1px solid #333" }}>
                             <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#333", overflow:"hidden", border: "1px solid #555" }}>
                                    {friend.avatar_url ? <img src={friend.avatar_url} style={{width:"100%", height:"100%"}} /> : <span style={{display:"flex", alignItems:"center", justifyContent:"center", height:"100%"}}>👤</span>}
                                </div>
                                <div>
                                    <span style={{ fontWeight: "bold", display:"block" }}>{friend.username}</span>
                                    <span style={{ color: "#666", fontSize: "0.8rem" }}>#{friend.discriminator}</span>
                                </div>
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "#46d369", border: "1px solid #46d369", padding: "2px 8px", borderRadius: "10px" }}>Amis</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}