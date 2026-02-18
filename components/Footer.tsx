import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ 
      backgroundColor: "#080808", 
      color: "#666", 
      padding: "30px 40px", 
      fontSize: "0.8rem",
      marginTop: "auto",
      borderTop: "1px solid #222",
    }}>
      <div style={{ 
        maxWidth: "1200px", 
        margin: "0 auto", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        flexWrap: "wrap",
        gap: "20px"
      }}>
        
        {/* GAUCHE : LOGO TMDB & LÉGAL */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px", maxWidth: "600px" }}>
            {/* ✅ Utilisation de ton fichier local */}
            <img 
                src="/tmdb-logo.svg" 
                alt="TMDB Logo" 
                style={{ width: "50px", height: "auto", opacity: 0.9 }} 
            />
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: "bold", color: "#888" }}>© 2026 Gamaar.</span>
                <span style={{ opacity: 0.6, fontSize: "0.75rem", lineHeight: "1.3" }}>
                    This product uses the TMDB API but is not endorsed or certified by TMDB.
                </span>
            </div>
        </div>

        {/* DROITE : NAVIGATION RAPIDE */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <Link href="/dashboard" style={linkStyle}>Accueil</Link>
            <Link href="/mylist" style={linkStyle}>Ma Liste</Link>
            <Link href="/profile" style={linkStyle}>Mon Compte</Link>
            <span style={{ color: "#333" }}>|</span>
            <Link href="/calibration?rec=true" style={linkStyle}>Recalibrer</Link>
        </div>

      </div>
    </footer>
  );
}

const linkStyle: React.CSSProperties = {
    color: "#888",
    textDecoration: "none",
    transition: "color 0.2s",
    cursor: "pointer",
    fontSize: "0.9rem"
};