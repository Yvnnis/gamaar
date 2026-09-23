"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div style={{ 
      minHeight: "100vh", 
      position: "relative", 
      display: "flex", 
      flexDirection: "column", 
      justifyContent: "center", 
      alignItems: "center", 
      color: "white",
      fontFamily: "sans-serif",
      textAlign: "center",
      padding: "20px",
      overflow: "hidden"
    }}>
      
      {/* 1. L'IMAGE DE FOND */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        // Remplace '/cinema-bg.jpg' par ton image si nécessaire, ou garde celle de Netflix utilisée ailleurs
        backgroundImage: "url('/cinema-bg.jpg')", 
        backgroundSize: "cover",
        backgroundPosition: "center",
        zIndex: 0
      }}></div>

      {/* 2. LE FILTRE NOIR */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.6)", 
        zIndex: 1
      }}></div>

      {/* 3. LE LOGO (AJOUTÉ POUR LA COHÉRENCE) */}
      <div style={{ position: "absolute", top: "20px", left: "40px", zIndex: 10 }}>
          <h1 style={{ color: "#e50914", fontSize: "2.5rem", margin: 0, fontWeight: "bold", letterSpacing: "2px" }}>
            GAMAAR
          </h1>
      </div>

      {/* 4. LE CONTENU CENTRAL */}
      <div style={{ zIndex: 2, maxWidth: "800px", position: "relative" }}>
        <h1 style={{ 
          fontSize: "3.5rem", 
          marginBottom: "20px", 
          fontWeight: "bold",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)" 
        }}>
          Ne cherche plus,<br />
          <span style={{ color: "#e50914" }}>regarde.</span>
        </h1>
        
        <p style={{ 
          fontSize: "1.3rem", 
          color: "#ddd", 
          marginBottom: "40px", 
          lineHeight: "1.6",
          textShadow: "0 1px 5px rgba(0,0,0,0.8)"
        }}>
          Votre pizza refroidit pendant que vous scrollez ? Stop ! Notre algorithme tranche pour vous en 30 secondes chrono.
        </p>

        {/* 👇 LIEN CORRIGÉ VERS /LOGIN */}
        {/* Un <Link> stylé (et non <Link><button>, HTML invalide). Animation de survol : classes .cta / .cta-primary */}
        <Link
          href="/login"
          className="cta cta-primary"
          style={{ 
            display: "inline-block",
            padding: "18px 45px", 
            fontSize: "1.2rem", 
            backgroundColor: "#e50914", 
            color: "white", 
            borderRadius: "50px", 
            fontWeight: "bold",
          }}
        >
          Trouver mon film 🍿
        </Link>
      </div>
    </div>
  );
}