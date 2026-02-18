"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; 
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // ✅ Inscription par défaut (true)
  const [isSignUp, setIsSignUp] = useState(true); 
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. GESTION EMAIL / PASSWORD
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // --- INSCRIPTION ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: email.split("@")[0],
              full_name: "",
              avatar_url: "",
            },
          },
        });
        if (error) throw error;
        
        // Si besoin de confirmation email
        if (data.user && !data.session) {
             setError("Inscription réussie ! Vérifie tes emails pour confirmer.");
        } else {
             router.push("/mood");
        }

      } else {
        // --- CONNEXION ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/mood");
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  // 2. GESTION GOOGLE
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        // Image de fond style "Cinéma/Streaming"
        backgroundImage: "url('https://assets.nflxext.com/ffe/siteui/vlv3/f841d4c7-10e1-40af-bcae-07a3f8dc141a/f6d7434e-d6de-4185-a6d4-c77a2d08737b/US-en-20220502-popsignuptwoweeks-perspective_alpha_website_medium.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Filtre sombre pour lisibilité */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1 }}></div>

      {/* Logo en haut à gauche */}
      <div style={{ position: "absolute", top: "20px", left: "40px", zIndex: 10 }}>
         <Link href="/" style={{textDecoration: "none"}}>
            <h1 style={{ color: "#e50914", fontSize: "2.5rem", margin: 0, cursor: "pointer", fontWeight: "bold", letterSpacing: "2px" }}>CINEMATCH</h1>
         </Link>
      </div>

      {/* Boite de Connexion */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.75)",
          padding: "60px 68px 40px",
          borderRadius: "4px",
          width: "100%",
          maxWidth: "450px",
          zIndex: 10,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <h2 style={{ fontSize: "2rem", marginBottom: "28px", fontWeight: "bold" }}>
          {isSignUp ? "Créer un compte" : "Se connecter"}
        </h2>

        {error && (
          <div style={{ backgroundColor: "#e87c03", padding: "10px", borderRadius: "4px", marginBottom: "15px", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            suppressHydrationWarning={true} // ✅ Fix Dashlane
            style={{ padding: "16px 20px", borderRadius: "4px", border: "none", backgroundColor: "#333", color: "white", fontSize: "1rem", outline: "none" }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            suppressHydrationWarning={true} // ✅ Fix Dashlane
            style={{ padding: "16px 20px", borderRadius: "4px", border: "none", backgroundColor: "#333", color: "white", fontSize: "1rem", outline: "none" }}
          />
          
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: "#e50914",
              color: "white",
              padding: "16px",
              borderRadius: "4px",
              border: "none",
              fontSize: "1rem",
              fontWeight: "bold",
              marginTop: "24px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "0.2s"
            }}
          >
            {loading ? "Chargement..." : (isSignUp ? "S'inscrire" : "Se connecter")}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#b3b3b3", fontSize: "0.8rem", marginTop: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "#b3b3b3" }} /> Se souvenir de moi
          </label>
          <span style={{ cursor: "pointer", textDecoration: "hover:underline" }}>Besoin d'aide ?</span>
        </div>

        {/* --- SOCIAL LOGIN --- */}
        <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{color: "#737373", fontSize: "0.9rem", textAlign: "center"}}>Ou continuer avec</p>
            
            <button 
                onClick={handleGoogleLogin}
                style={{ 
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", 
                  padding: "10px", borderRadius: "4px", border: "none", 
                  backgroundColor: "white", color: "#333", cursor: "pointer", fontWeight: "bold",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e6e6e6"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
            >
                <img src="https://authjs.dev/img/providers/google.svg" width="20" alt="Google" /> Google
            </button>
        </div>

        <div style={{ marginTop: "30px", color: "#737373", fontSize: "1rem" }}>
          {isSignUp ? "Déjà membre ? " : "Nouveau sur Cinematch ? "}
          <span
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ color: "white", cursor: "pointer", fontWeight: "bold" }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}
          >
            {isSignUp ? "Connectez-vous." : "Inscrivez-vous maintenant."}
          </span>
        </div>
      </div>
    </div>
  );
}