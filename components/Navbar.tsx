"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isLandingPage = pathname === "/";
  const isAuthPage = pathname === "/auth";

  // --- ÉTATS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // État pour le profil utilisateur
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // --- CHARGEMENT DU PROFIL ---
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .single();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      }
    };
    if (!isLandingPage && !isAuthPage) fetchProfile();
  }, [isLandingPage, isAuthPage, supabase]);

  // --- LOGIQUE RECHERCHE ---
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  // Live Search
  useEffect(() => {
    if (searchTerm.length < 3) { setSuggestions([]); return; }
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(searchTerm)}&page=1&include_adult=false`);
        const data = await res.json();
        
        // On filtre pour ne garder que Films, Séries et Personnes
        const filtered = (data.results || [])
            .filter((item: any) => item.media_type === "movie" || item.media_type === "tv" || item.media_type === "person")
            .slice(0, 5);

        setSuggestions(filtered);
        setShowSuggestions(true);
      } catch (error) { console.error(error); }
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Fermeture au clic dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const imageUrl = "https://image.tmdb.org/t/p/w92";
  const defaultAvatar = "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";

  if (isAuthPage) {
    return (
      <nav style={{ padding: "20px 40px", position: "absolute", top: 0, left: 0, width: "100%", zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <h2 style={{ color: "#e50914", margin: 0, fontSize: "2.5rem", fontWeight: "bold" }}>GAMAAR</h2>
        </Link>
      </nav>
    );
  }

  return (
    <nav 
      style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        padding: "15px 40px", 
        backgroundColor: "transparent", 
        position: "relative", 
        zIndex: 100, 
        height: "80px", 
        gap: "20px" 
      }}
    >
      
      {/* GAUCHE : LOGO + LIENS */}
      <div style={{ display: "flex", alignItems: "center", gap: "40px", flexShrink: 0, height: "100%" }}>
        <Link href={isLandingPage ? "/" : "/dashboard"} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <h2 style={{ color: "#e50914", margin: 0, fontSize: "2rem", fontWeight: "bold", lineHeight: "1" }}>GAMAAR</h2>
        </Link>
        {!isLandingPage && (
          <div style={{ display: "flex", gap: "20px", alignItems: "center", height: "100%" }}>
            <Link href="/dashboard" style={{ color: pathname === "/dashboard" ? "white" : "#b3b3b3", textDecoration: "none", fontWeight: pathname === "/dashboard" ? "bold" : "normal", transition: "color 0.3s", display: "flex", alignItems: "center" }}>
              Recommandations
            </Link>
            <Link href="/discover" style={{ color: pathname === "/discover" ? "white" : "#b3b3b3", textDecoration: "none", fontWeight: pathname === "/discover" ? "bold" : "normal", transition: "color 0.3s", display: "flex", alignItems: "center" }}>
              Découvrir
            </Link>
            <Link href="/mylist" style={{ color: pathname === "/mylist" ? "white" : "#b3b3b3", textDecoration: "none", fontWeight: pathname === "/mylist" ? "bold" : "normal", transition: "color 0.3s", display: "flex", alignItems: "center" }}>
              Ma Liste
            </Link>
            <Link href="/party" style={{ color: pathname === "/party" ? "white" : "#b3b3b3", textDecoration: "none", fontWeight: pathname === "/party" ? "bold" : "normal", transition: "color 0.3s", display: "flex", alignItems: "center" }}>
              Party
            </Link>
          </div>
        )}
      </div>

      {/* CENTRE : RECHERCHE */}
      {!isLandingPage && (
        <div 
            ref={searchContainerRef} 
            style={{ 
                flex: 1, 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                maxWidth: "500px", 
                position: "relative",
                height: "100%",
                paddingTop: "15px" 
            }}
        >
          <form onSubmit={handleSearch} style={{ width: "100%", display: "flex", alignItems: "center" }}>
            <input 
                type="text" 
                placeholder="Films, acteurs, réalisateurs..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }} 
                style={{ 
                    width: "100%", 
                    height: "36px", 
                    backgroundColor: "rgba(0,0,0,0.75)", 
                    border: "1px solid #444", 
                    borderRadius: "50px", 
                    color: "white", 
                    outline: "none", 
                    fontSize: "0.9rem", 
                    textAlign: "center", 
                    padding: "0 20px", 
                    transition: "all 0.3s ease"
                }} 
            />
          </form>
          
          {/* SUGGESTIONS */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "65px", left: 0, width: "100%", backgroundColor: "#1f1f1f", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)", border: "1px solid #333", overflow: "hidden", zIndex: 200 }}>
              {suggestions.map((item) => {
                const title = item.title || item.name;
                const type = item.media_type;
                
                // 🔥 MODIFICATION ICI : Redirection intelligente vers /person/ID ou /movie/ID
                const linkHref = type === "person" 
                    ? `/person/${item.id}` 
                    : `/movie/${item.id}?type=${type}`;

                return (
                  <Link key={item.id} href={linkHref} onClick={() => { setShowSuggestions(false); setSearchTerm(""); }} style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px", padding: "10px 15px", borderBottom: "1px solid #333", cursor: "pointer" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#333"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                      <div style={{ width: "40px", height: "60px", backgroundColor: "#333", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                        {(item.poster_path || item.profile_path) && <img src={`${imageUrl}${item.poster_path || item.profile_path}`} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <div style={{ color: "white" }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.95rem" }}>{title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#aaa" }}>{type === "person" ? "👤 Artiste" : (type === "tv" ? "📺 Série" : "🎬 Film")}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DROITE : PROFIL */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0, height: "100%" }}>
        {isLandingPage ? (
          <Link href="/auth"><button style={{ backgroundColor: "#e50914", color: "white", border: "none", padding: "8px 17px", borderRadius: "5px", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}>Se connecter</button></Link>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            
            <Link href="/profile" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <div 
                style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", transition: "transform 0.2s" }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                title="Mon Profil"
              >
                <img 
                  src={avatarUrl || defaultAvatar} 
                  alt="Profil" 
                  style={{ 
                    width: "38px", 
                    height: "38px", 
                    borderRadius: "50%", 
                    objectFit: "cover", 
                    border: "1px solid #333" 
                  }} 
                />
              </div>
            </Link>

            <button 
              onClick={handleLogout} 
              style={{ backgroundColor: "transparent", color: "#b3b3b3", border: "1px solid #b3b3b3", padding: "6px 12px", borderRadius: "5px", fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "white"; e.currentTarget.style.color = "white"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "#b3b3b3"; e.currentTarget.style.color = "#b3b3b3"; }}
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}