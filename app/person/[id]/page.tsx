"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import { useMediaInteraction } from "@/hooks/useMediaInteraction";

// --- SOUS-COMPOSANT CARTE AVEC ACTIONS ---
const FilmographyCard = ({ item }: { item: any }) => {
    // On force le type car l'API combined_credits renvoie parfois media_type, parfois non
    const type = item.media_type || (item.first_air_date ? "tv" : "movie");
    const itemWithType = { ...item, media_type: type };
    
    // On récupère toutes les interactions
    const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(itemWithType, type);

    // Fonction pour empêcher le clic de nous emmener sur la page détail
    const handleAction = async (e: React.MouseEvent, action: () => Promise<void>) => {
        e.preventDefault(); 
        e.stopPropagation();
        await action();
    };

    return (
        <div style={{ position: "relative" }}>
            <Link href={`/movie/${item.id}?type=${type}`} style={{ textDecoration: "none", color: "white" }}>
                <div style={{ 
                    position: "relative", 
                    borderRadius: "10px", 
                    overflow: "hidden", 
                    transition: "transform 0.2s", 
                    aspectRatio: "2/3", 
                    backgroundColor: "#222", 
                    boxShadow: "0 5px 15px rgba(0,0,0,0.3)" 
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                    {item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={item.title || item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color: "#555"}}>Pas d'image</div>
                    )}
                    
                    {/* Note (Badge vert en haut à DROITE) */}
                    {item.vote_average > 0 && (
                        <div style={{position: "absolute", top: "5px", right: "5px", background: "rgba(0,0,0,0.8)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold", color: "#46d369", border: "1px solid #46d369"}}>
                            {item.vote_average.toFixed(1)}
                        </div>
                    )}
                </div>
            </Link>

            {/* --- BARRE D'ACTIONS (En haut à GAUCHE) --- */}
            <div style={{
                position: "absolute",
                top: "5px",
                left: "5px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                zIndex: 10
            }}>
                {/* LISTE */}
                <button 
                    onClick={(e) => handleAction(e, toggleList)}
                    style={{
                        background: inList ? "#e50914" : "rgba(0,0,0,0.7)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "5px",
                        width: "30px", height: "30px",
                        cursor: "pointer", fontSize: "1rem",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                    title={inList ? "Retirer de ma liste" : "Ajouter à ma liste"}
                >
                    {inList ? "✓" : "+"}
                </button>

                {/* VU */}
                <button 
                    onClick={(e) => handleAction(e, toggleSeen)}
                    style={{
                        background: isSeen ? "#46d369" : "rgba(0,0,0,0.7)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "5px",
                        width: "30px", height: "30px",
                        cursor: "pointer", fontSize: "0.9rem",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                    title={isSeen ? "Non vu" : "Marquer comme vu"}
                >
                    {isSeen ? "✓" : "👁️"}
                </button>

                {/* LIKE */}
                <button 
                    onClick={(e) => handleAction(e, toggleLiked)}
                    style={{
                        background: isLiked ? "#e50914" : "rgba(0,0,0,0.7)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "5px",
                        width: "30px", height: "30px",
                        cursor: "pointer", fontSize: "0.9rem",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                    title={isLiked ? "Je n'aime plus" : "J'aime"}
                >
                    {isLiked ? "❤️" : "🤍"}
                </button>
            </div>

            <p style={{ marginTop: "10px", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#ddd", fontWeight: "bold" }}>
                {item.title || item.name}
            </p>
            
            <p style={{ fontSize: "0.8rem", color: "#777", marginTop: "2px" }}>
                {new Date(item.release_date || item.first_air_date).getFullYear() || "N/A"} 
                {item.character && <span style={{color: "#555"}}> • {item.character}</span>}
            </p>
        </div>
    );
};

// --- LOGIQUE METIER & AGE ---
const getAge = (birthDate: string, deathDate?: string | null) => {
  const start = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age;
};

const formatLifeInfo = (birthday: string | null, deathday: string | null) => {
  if (!birthday) return "Date de naissance inconnue";
  const birthYear = new Date(birthday).getFullYear();
  const age = getAge(birthday, deathday);
  if (deathday) {
    const deathYear = new Date(deathday).getFullYear();
    return `${birthYear} - ${deathYear} (Décédé à ${age} ans)`;
  }
  return `${age} ans (Né en ${birthYear})`;
};

const getJobTitle = (department: string, gender: number) => {
  if (department === "Acting") return gender === 1 ? "Actrice" : "Acteur";
  if (department === "Directing") return gender === 1 ? "Réalisatrice" : "Réalisateur";
  if (department === "Writing") return gender === 1 ? "Scénariste" : "Scénariste";
  return department; 
};

// --- PAGE PRINCIPALE ---
export default function PersonPage() {
  const params = useParams();
  const id = params?.id;

  const [person, setPerson] = useState<any>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    
    const fetchData = async () => {
      try {
        const personRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&language=fr-FR`);
        const personData = await personRes.json();

        const creditsRes = await fetch(`https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${apiKey}&language=fr-FR`);
        const creditsData = await creditsRes.json();

        let rawList = [];
        if (personData.known_for_department === "Directing") {
            rawList = creditsData.crew.filter((c: any) => c.job === "Director");
        } else {
            rawList = creditsData.cast;
        }

        const uniqueIds = new Set();
        const cleanList = rawList
            .filter((item: any) => {
                const isDuplicate = uniqueIds.has(item.id);
                uniqueIds.add(item.id);
                return !isDuplicate && item.poster_path && item.vote_count > 10;
            })
            .sort((a: any, b: any) => b.vote_average - a.vote_average); 

        setPerson(personData);
        setCredits(cleanList);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div style={{ background: "#141414", minHeight: "100vh", color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>Chargement...</div>;
  if (!person) return <div style={{ background: "#141414", minHeight: "100vh", color: "white", padding: "50px", textAlign: "center" }}>Artiste introuvable</div>;

  const jobTitle = getJobTitle(person.known_for_department, person.gender);
  const lifeInfo = formatLifeInfo(person.birthday, person.deathday);

  return (
    <div style={{ backgroundColor: "#141414", minHeight: "100vh", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        
        <Link href="/dashboard" style={{ color: "#ccc", textDecoration: "none", marginBottom: "30px", display: "inline-block" }}>← Retour</Link>

        {/* EN-TÊTE */}
        <div style={{ display: "flex", gap: "40px", alignItems: "center", marginBottom: "60px", flexWrap: "wrap" }}>
            <div style={{ width: "180px", height: "180px", borderRadius: "50%", overflow: "hidden", border: "4px solid #333", flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                {person.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w500${person.profile_path}`} alt={person.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : <div style={{width:"100%", height:"100%", background:"#333", display:"flex", alignItems:"center", justifyContent:"center"}}>?</div>}
            </div>

            <div>
                <h1 style={{ fontSize: "3rem", margin: "0 0 10px 0" }}>{person.name}</h1>
                <div style={{ display: "flex", gap: "15px", alignItems: "center", fontSize: "1.1rem", color: "#ccc" }}>
                    <span style={{ color: "#e50914", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", border: "1px solid #e50914", padding: "2px 8px", borderRadius: "5px", fontSize: "0.9rem" }}>{jobTitle}</span>
                    <span>•</span>
                    <span>{lifeInfo}</span>
                </div>
                {person.place_of_birth && <p style={{ color: "#888", marginTop: "10px", fontSize: "0.9rem" }}>📍 {person.place_of_birth}</p>}
            </div>
        </div>

        {person.biography && (
            <div style={{ marginBottom: "50px", maxWidth: "800px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "10px", color: "#ddd" }}>Biographie</h3>
                <p style={{ lineHeight: "1.6", color: "#aaa" }}>{person.biography.length > 600 ? person.biography.substring(0, 600) + "..." : person.biography}</p>
            </div>
        )}

        <h2 style={{ borderLeft: "5px solid #e50914", paddingLeft: "15px", marginBottom: "30px", fontSize: "1.8rem" }}>
            Filmographie <span style={{fontSize: "1rem", fontWeight: "normal", color: "#777"}}>(Classée par note ⭐)</span>
        </h2>

        {/* GRILLE FILMS AVEC BOUTONS D'INTERACTION */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "25px" }}>
            {credits.map((item) => (
                <FilmographyCard key={`${item.media_type}-${item.id}`} item={item} />
            ))}
        </div>
      </div>
    </div>
  );
}