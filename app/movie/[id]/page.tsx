"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import Link from "next/link";
import { useMediaInteraction } from "@/hooks/useMediaInteraction";

export default function MovieDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const id = params?.id;
  
  // On récupère le type et le code de retour (si on vient d'une Party)
  const urlType = searchParams.get("type");
  const returnToCode = searchParams.get("returnTo"); 

  const safeType = (urlType === 'tv' || urlType === 'movie') ? urlType : 'movie';

  const [media, setMedia] = useState<any>(null);
  const [cast, setCast] = useState<any[]>([]);
  
  // Info Director / Creator
  const [directorInfo, setDirectorInfo] = useState<{name: string, id: number | null, image: string | null}>({ name: "Non spécifié", id: null, image: null });

  const [providers, setProviders] = useState<any[]>([]);
  const [trailer, setTrailer] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<{ text: string, color: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSeries, setIsSeries] = useState(false);

  // Hook d'interaction (Liste, Vu, Aimé)
  const { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked } = useMediaInteraction(media, safeType);

  useEffect(() => {
    if (!id) return;
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const baseUrl = "https://api.themoviedb.org/3";

    const fetchData = async () => {
      try {
        setLoading(true);

        let type = safeType;
        
        // Sécurité : si pas de type dans l'URL, on tente de deviner (fallback)
        if (!urlType) {
           const checkReq = await fetch(`${baseUrl}/movie/${id}?api_key=${apiKey}`);
           type = checkReq.ok ? "movie" : "tv";
        }
        setIsSeries(type === "tv");

        // Main Request
        const mainReq = await fetch(`${baseUrl}/${type}/${id}?api_key=${apiKey}&language=fr-FR&append_to_response=videos,credits,release_dates`);
        if (!mainReq.ok) throw new Error("Média introuvable");
        const mainData = await mainReq.json();

        // Gestion du Trailer (FR puis EN)
        let trailerKey = null;
        if (mainData.videos?.results) {
            const frTrailer = mainData.videos.results.find((v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
            if (frTrailer) trailerKey = frTrailer.key;
        }
        if (!trailerKey) {
            const enVideoReq = await fetch(`${baseUrl}/${type}/${id}/videos?api_key=${apiKey}&language=en-US`);
            const enData = await enVideoReq.json();
            const enTrailer = enData.results?.find((v: any) => v.type === "Trailer");
            if (enTrailer) trailerKey = enTrailer.key;
        }
        setTrailer(trailerKey);

        // Statut Cinéma (Seulement pour les films)
        if (type === 'movie' && mainData.release_date) {
            let releaseDate = new Date(mainData.release_date);
            const frRelease = mainData.release_dates?.results?.find((r: any) => r.iso_3166_1 === "FR");
            const cinemaDate = frRelease?.release_dates?.find((d: any) => d.type === 3);
            if (cinemaDate) releaseDate = new Date(cinemaDate.release_date);

            const today = new Date();
            const diffDays = Math.ceil((today.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));

            if (releaseDate > today) setReleaseStatus({ text: `Bientôt (le ${releaseDate.toLocaleDateString()})`, color: "#3498db" });
            else if (diffDays < 90) setReleaseStatus({ text: "Actuellement au cinéma 🍿", color: "#e50914" });
        }

        // Providers (Où regarder)
        const provReq = await fetch(`${baseUrl}/${type}/${id}/watch/providers?api_key=${apiKey}`);
        const provData = await provReq.json();
        const frData = provData.results?.FR;
        const allProv = [...(frData?.flatrate || []), ...(frData?.rent || []), ...(frData?.buy || [])];
        const uniqueProv: any[] = [];
        const seenP = new Set();
        allProv.forEach(p => { if (!seenP.has(p.provider_name)) { seenP.add(p.provider_name); uniqueProv.push(p); } });
        setProviders(uniqueProv);

        // Réalisateur / Créateur
        const credits = mainData.credits || {};
        let dirObj = { name: "Non spécifié", id: null, image: null };

        if (type === 'movie') {
            const director = credits.crew?.find((p: any) => p.job === "Director");
            if (director) dirObj = { name: director.name, id: director.id, image: director.profile_path };
        } else {
            if (mainData.created_by?.length > 0) {
                const creator = mainData.created_by[0];
                dirObj = { name: creator.name, id: creator.id, image: creator.profile_path };
            }
        }
        setDirectorInfo(dirObj as any);
        setCast(credits.cast ? credits.cast.slice(0, 6) : []);
        setMedia(mainData);

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [id, safeType, urlType]);

  const handleAction = async (fn: () => Promise<void>) => { await fn(); };

  // Helper pour formater la durée (ex: 135 -> 2h 15min)
  const formatRuntime = (mins: number) => {
      if (!mins) return "";
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  // LOGIQUE RETOUR INTELLIGENT
  const handleBack = () => {
      if (returnToCode) {
          router.push(`/party/${returnToCode}`);
      } else {
          router.push("/dashboard");
      }
  };

  if (loading || !media) return <div style={{background:"#141414", minHeight:"100vh", color:"white", display:"flex", justifyContent:"center", alignItems:"center"}}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "sans-serif", backgroundColor: "#141414", minHeight: "100vh", color: "white" }}>
      <Navbar />
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px" }}>
        
        {/* BOUTON RETOUR DYNAMIQUE */}
        <button 
            onClick={handleBack}
            style={{ display: "inline-block", marginBottom: "30px", background: "none", border: "none", color: "#ccc", fontSize: "1rem", cursor: "pointer", textDecoration: "underline" }}
        >
            ← Retour {returnToCode ? "au salon" : "au dashboard"}
        </button>

        <div style={{ display: "flex", gap: "50px", flexWrap: "wrap", alignItems: "flex-start" }}>
          
          {/* GAUCHE : Affiche + Trailer */}
          <div style={{ flex: "1 1 300px", maxWidth: "350px" }}>
            <img src={`https://image.tmdb.org/t/p/w500${media.poster_path}`} alt={media.title} style={{ width: "100%", borderRadius: "10px", boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }} />
            
            {trailer && (
                <div style={{ marginTop: "30px" }}>
                    <h3 style={{ fontSize: "1rem", color: "#ccc", marginBottom: "15px", borderLeft: "3px solid #e50914", paddingLeft: "10px", textTransform: "uppercase" }}>Bande-annonce</h3>
                    <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: "10px", overflow: "hidden" }}>
                        <iframe src={`https://www.youtube.com/embed/${trailer}?rel=0`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen></iframe>
                    </div>
                </div>
            )}
          </div>

          {/* DROITE : Info + Real + Cast + Watch */}
          <div style={{ flex: "2 1 400px" }}>
            
            {releaseStatus && <div style={{ display: "inline-block", marginBottom: "15px", padding: "5px 12px", borderRadius: "20px", backgroundColor: releaseStatus.color, fontWeight: "bold", fontSize: "0.9rem" }}>{releaseStatus.text}</div>}

            <h1 style={{ fontSize: "2.8rem", margin: "0 0 10px 0", lineHeight: "1.1" }}>
                {media.title || media.name} {isSeries && <span style={{fontSize: "1rem", color: "#e50914", border: "1px solid #e50914", padding: "2px 6px", borderRadius: "4px", verticalAlign: "middle", marginLeft: "10px"}}>SÉRIE</span>}
            </h1>
            
            {/* META DONNÉES (Date, Durée, Note) */}
            <div style={{ color: "#aaa", fontSize: "1.1rem", marginTop: "10px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                <span>{media.release_date?.split("-")[0] || media.first_air_date?.split("-")[0]}</span>
                
                {isSeries ? (
                    <span>{media.number_of_seasons} Saison{media.number_of_seasons > 1 ? 's' : ''} • {media.number_of_episodes} Ép.</span>
                ) : (
                    media.runtime > 0 && <span>{formatRuntime(media.runtime)}</span>
                )}

                {media.vote_average > 0 && <span style={{ color: "#46d369" }}>⭐ {media.vote_average.toFixed(1)}/10</span>}
            </div>

            {/* BOUTONS D'ACTION */}
            <div style={{ display: "flex", gap: "10px", margin: "25px 0", flexWrap: "wrap" }}>
              <button onClick={() => handleAction(toggleList)} style={{ flex: 1, padding: "12px", borderRadius: "5px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: inList ? "#e50914" : "#333", color: "white" }}>{inList ? "✅ Liste" : "📋 Ma liste"}</button>
              <button onClick={() => handleAction(toggleSeen)} style={{ flex: 1, padding: "12px", borderRadius: "5px", border: isSeen ? "1px solid #46d369" : "1px solid #555", backgroundColor: isSeen ? "rgba(70, 211, 105, 0.2)" : "transparent", color: isSeen ? "#46d369" : "#ccc", cursor: "pointer", fontWeight: "bold" }}>{isSeen ? "👀 Vu" : "Vu"}</button>
              <button onClick={() => handleAction(toggleLiked)} style={{ flex: 1, padding: "12px", borderRadius: "5px", border: isLiked ? "1px solid #e50914" : "1px solid #555", backgroundColor: isLiked ? "rgba(229, 9, 20, 0.2)" : "transparent", color: isLiked ? "#e50914" : "#ccc", cursor: "pointer", fontWeight: "bold" }}>{isLiked ? "❤️ Aimé" : "J'aime"}</button>
            </div>

            <div style={{ margin: "30px 0" }}>
              <h3 style={{fontSize: "1rem", color: "#ccc", marginBottom: "8px", textTransform: "uppercase"}}>Synopsis</h3>
              <p style={{ lineHeight: "1.6", color: "#ddd", fontSize: "1rem" }}>{media.overview || "Aucun synopsis disponible."}</p>
            </div>

            {/* REALISATEUR / CRÉATEUR */}
            <div style={{ marginBottom: "25px" }}>
                <h3 style={{fontSize: "1rem", color: "#ccc", marginBottom: "15px", textTransform: "uppercase"}}>{isSeries ? "Création" : "Réalisation"}</h3>
                {directorInfo.id ? (
                    <Link href={`/person/${directorInfo.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ textAlign: "center", width: "80px", cursor: "pointer" }}>
                            <div style={{width: "80px", height: "80px", borderRadius: "50%", overflow: "hidden", marginBottom: "8px", background: "#333", border: "2px solid #e50914", transition: "transform 0.2s"}} onMouseOver={(e) => e.currentTarget.style.transform="scale(1.05)"} onMouseOut={(e) => e.currentTarget.style.transform="scale(1)"}>
                                {directorInfo.image ? (
                                    <img src={`https://image.tmdb.org/t/p/w200${directorInfo.image}`} alt={directorInfo.name} style={{width: "100%", height: "100%", objectFit: "cover"}} />
                                ) : <div style={{width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#777"}}>?</div>}
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "#fff", display: "block", lineHeight: "1.2", fontWeight: "bold" }}>{directorInfo.name}</span>
                        </div>
                    </Link>
                ) : <p>{directorInfo.name}</p>}
            </div>

            {/* CASTING */}
            <div style={{ marginBottom: "30px" }}>
                 <h3 style={{fontSize: "1rem", color: "#ccc", marginBottom: "15px", textTransform: "uppercase"}}>Têtes d'affiche</h3>
                 <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                    {cast.map((actor) => (
                      <Link key={actor.id} href={`/person/${actor.id}`} style={{ textDecoration: "none" }}>
                          <div style={{ textAlign: "center", width: "80px", cursor: "pointer" }}>
                              <div style={{width: "80px", height: "80px", borderRadius: "50%", overflow: "hidden", marginBottom: "8px", background: "#333", border: "2px solid #444", transition: "border-color 0.2s"}} onMouseOver={(e) => e.currentTarget.style.borderColor = "white"} onMouseOut={(e) => e.currentTarget.style.borderColor = "#444"}>
                                {actor.profile_path ? (
                                    <img src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`} alt={actor.name} style={{width: "100%", height: "100%", objectFit: "cover"}} />
                                ) : <div style={{width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#777"}}>?</div>}
                              </div>
                              <span style={{ fontSize: "0.8rem", color: "#ddd", display: "block", lineHeight: "1.2", fontWeight: "bold" }}>{actor.name}</span>
                              <span style={{ fontSize: "0.7rem", color: "#777", display: "block", lineHeight: "1.2" }}>{actor.character}</span>
                          </div>
                      </Link>
                    ))}
                </div>
            </div>

            {/* PROVIDERS */}
            <div style={{ padding: "20px", backgroundColor: "#1f1f1f", borderRadius: "10px", border: "1px solid #333" }}>
              <h3 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                  📺 Où regarder ? <span style={{fontSize: "0.7rem", color: "#777", fontWeight: "normal"}}>(Liens)</span>
              </h3>
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  {providers.length > 0 ? providers.map((p: any) => (
                      <a key={p.provider_id} href={`https://www.google.com/search?q=regarder+${encodeURIComponent(media.title || media.name || "")}+sur+${encodeURIComponent(p.provider_name)}`} target="_blank" rel="noopener noreferrer">
                          <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} alt={p.provider_name} style={{ width: "60px", height: "60px", borderRadius: "12px", border: "1px solid #333" }} />
                      </a>
                  )) : <p style={{ color: "#aaa", fontSize: "0.9rem" }}>Aucune plateforme trouvée.</p>}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}