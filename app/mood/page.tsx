"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Navbar from "../../components/Navbar";

const MOODS = [
  { id: "chill", label: "Détente & Rire 😂", emoji: "🍿", genres: "35,10751" },
  { id: "thrill", label: "Adrénaline & Frissons 😱", emoji: "🔥", genres: "28,27,53" },
  { id: "escape", label: "Évasion & Imaginaire 🚀", emoji: "✨", genres: "878,14,12" },
  { id: "think", label: "Intrigue & Réflexion 🧠", emoji: "🤔", genres: "9648,80,18" },
  { id: "love", label: "Émotion & Romance ❤️", emoji: "🌹", genres: "10749,18" },
  { id: "learn", label: "Découverte & Culture 🌍", emoji: "💡", genres: "99,36" },
];

export default function MoodPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, preferences")
        .eq("id", user.id)
        .single();

      // 🚨 CORRECTION ICI : Si pas de profil, on va vers CALIBRATION (pas quiz)
      if (!profile || !profile.preferences || !profile.preferences.archetype) {
        router.push("/calibration");
      } else {
        setUserName(profile.username || "Cinéphile");
        setLoading(false);
      }
    };

    checkProfile();
  }, [router, supabase]);

  const handleMoodSelect = (mood: any) => {
    localStorage.setItem("currentMood", JSON.stringify(mood));
    
    // Nettoyage pour forcer le refresh des recommandations
    localStorage.removeItem("dashboardRecs"); 
    localStorage.removeItem("dashboardReasons");

    router.push("/dashboard");
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#141414", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ padding: "40px 20px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>Bonsoir, {userName} 👋</h1>
        <p style={{ color: "#aaa", fontSize: "1.2rem", marginBottom: "50px" }}>
          Quelle est ton envie pour ce soir ?
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              onClick={() => handleMoodSelect(mood)}
              onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              style={{
                backgroundColor: "#1f1f1f",
                border: "1px solid #333",
                borderRadius: "15px",
                padding: "30px 20px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "15px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
              }}
            >
              <span style={{ fontSize: "3rem" }}>{mood.emoji}</span>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white" }}>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}