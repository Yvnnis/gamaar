"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";

// --- 1. ALGORITHME DE CORRECTION (Levenshtein) ---
const getLevenshteinDistance = (a: string, b: string) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// --- 2. COMPOSANT CARTE ---
const SearchCard = ({ item }: { item: any }) => {
  const [inList, setInList] = useState(false);
  const [isSeen, setIsSeen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  const isPerson = item.media_type === "person";
  // Si c'est une personne, type = person, sinon on devine movie/tv
  const type = item.media_type || (item.title ? "movie" : "tv");

  useEffect(() => {
    if (isPerson) return; // Pas de gestion de liste pour les personnes ici
    try {
        const myList = JSON.parse(localStorage.getItem("myList") || "[]");
        setInList(myList.some((i: any) => i.id === item.id));
        const seenMovies = JSON.parse(localStorage.getItem("seenMovies") || "[]");
        setIsSeen(seenMovies.includes(item.id));
        const likedMovies = JSON.parse(localStorage.getItem("likedMovies") || "[]");
        setIsLiked(likedMovies.includes(item.id));
    } catch (e) {}
  }, [item, isPerson]);

  const toggleList = (e: any) => {
    e.preventDefault();
    const currentList = JSON.parse(localStorage.getItem("myList") || "[]");
    let newList;
    if (inList) newList = currentList.filter((i: any) => i.id !== item.id);
    else newList = [...currentList, { ...item, media_type: type }];
    localStorage.setItem("myList", JSON.stringify(newList));
    setInList(!inList);
  };

  const toggleSeen = (e: any) => {
    e.preventDefault();
    const currentSeen = JSON.parse(localStorage.getItem("seenMovies") || "[]");
    let newSeen;
    if (isSeen) newSeen = currentSeen.filter((id: number) => id !== item.id);
    else newSeen = [...currentSeen, item.id];
    localStorage.setItem("seenMovies", JSON.stringify(newSeen));
    setIsSeen(!isSeen);
  };

  const toggleLiked = (e: any) => {
    e.preventDefault();
    const currentLiked = JSON.parse(localStorage.getItem("likedMovies") || "[]");
    let newLiked;
    if (isLiked) newLiked = currentLiked.filter((id: number) => id !== item.id);
    else newLiked = [...currentLiked, item.id];
    localStorage.setItem("likedMovies", JSON.stringify(newLiked));
    setIsLiked(!isLiked);
  };

  const baseImage = "https://image.tmdb.org/t/p/w500";
  // Si c'est une personne, on prend profile_path, sinon poster_path
  const imagePath = isPerson ? item.profile_path : item.poster_path;
  const title = item.title || item.name;
  
  // URL de redirection : Personne -> /person/ID | Film -> /movie/ID
  const linkUrl = isPerson ? `/person/${item.id}` : `/movie/${item.id}?type=${type}`;

  return (
    <Link href={linkUrl} style={{ textDecoration: "none", color: "white" }}>
      <div 
        style={{ backgroundColor: "#1f1f1f", borderRadius: "10px", overflow: "hidden", transition: "transform 0.2s", height: "100%", display: "flex", flexDirection: "column" }}
        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <div style={{ height: "270px", backgroundColor: "#333", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {imagePath ? (
            <img 
                src={`${baseImage}${imagePath}`} 
                alt={title} 
                style={{ 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "cover",
                }} 
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#777" }}>Pas d'image</div>
          )}
          
          {/* BOUTONS ACTIONS (Uniquement si ce n'est PAS une personne) */}
          {!isPerson && (
            <>
                <button onClick={toggleList} style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: inList ? "#e50914" : "rgba(0,0,0,0.6)", border: "1px solid white", color: "white", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", zIndex: 10, paddingBottom: inList ? "0" : "4px", lineHeight: 1 }}>{inList ? "✓" : "+"}</button>
                <button onClick={toggleSeen} style={{ position: "absolute", bottom: "10px", left: "10px", backgroundColor: isSeen ? "#46d369" : "rgba(0,0,0,0.6)", border: isSeen ? "none" : "1px solid white", color: "white", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", zIndex: 10 }}>👁️</button>
                <button onClick={toggleLiked} style={{ position: "absolute", bottom: "10px", right: "10px", backgroundColor: isLiked ? "#e50914" : "rgba(0,0,0,0.6)", border: isLiked ? "none" : "1px solid white", color: "white", width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", zIndex: 10 }}>❤️</button>
            </>
          )}
        </div>

        <div style={{ padding: "15px", flex: 1 }}>
          <h3 style={{ fontSize: "1rem", margin: "0 0 5px 0" }}>{title}</h3>
          <p style={{ fontSize: "0.8rem", color: "#aaa", textTransform: "uppercase", margin: 0 }}>
            {isPerson ? "Artiste" : (type === "tv" ? "Série TV" : "Film")} 
            {!isPerson && item.release_date ? ` • ${item.release_date.split("-")[0]}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
};

// --- 3. PAGE PRINCIPALE (CONTENU) ---
// On renome ton ancienne fonction "SearchPage" en "SearchContent"
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;

    const fetchResults = async () => {
      setLoading(true);
      setSuggestion(null);
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const baseUrl = "https://api.themoviedb.org/3";

      try {
        // --- ETAPE 1 : Recherche Exacte ---
        const exactRes = await fetch(`${baseUrl}/search/multi?api_key=${apiKey}&language=fr-FR&query=${encodeURIComponent(query)}&page=1&include_adult=false`);
        const exactData = await exactRes.json();
        let finalResults = exactData.results || [];

        // --- ETAPE 2 : Si vide, Stratégie "Filet Large" ---
        if (finalResults.length === 0 && query.trim().includes(" ")) {
            console.log("Recherche stricte échouée, lancement du mode correction...");
            const parts = query.split(" ").filter(p => p.length > 2);
            const promises = parts.map(part => 
                fetch(`${baseUrl}/search/multi?api_key=${apiKey}&language=fr-FR&query=${encodeURIComponent(part)}&page=1&include_adult=false`)
                .then(r => r.json())
            );
            const responses = await Promise.all(promises);
            let allCandidates: any[] = [];
            responses.forEach(r => { if(r.results) allCandidates = [...allCandidates, ...r.results]; });
            const uniqueCandidates = Array.from(new Map(allCandidates.map(item => [item.id, item])).values());
            const fuzzyMatches = uniqueCandidates.map((item: any) => {
                const name = item.title || item.name || "";
                const dist = getLevenshteinDistance(query.toLowerCase(), name.toLowerCase());
                return { ...item, dist };
            })
            .filter((item) => item.dist <= 8)
            .sort((a, b) => a.dist - b.dist);

            if (fuzzyMatches.length > 0) {
                finalResults = fuzzyMatches;
                setSuggestion(fuzzyMatches[0].title || fuzzyMatches[0].name);
            }
        }

        // --- TRAITEMENT DES RÉSULTATS (Films + Personnes) ---
        let processedResults: any[] = [];
        
        finalResults.forEach((item: any) => {
            if (item.media_type === "movie" || item.media_type === "tv" || item.media_type === "person") {
                processedResults.push(item);
            }
        });

        setResults(processedResults);

      } catch (error) {
        console.error("Erreur recherche :", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", fontFamily: "sans-serif" }}>
      <Navbar />
      <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ marginBottom: "30px" }}>
            <h1 style={{ margin: 0 }}>
            Résultats pour : <span style={{ color: "#e50914", fontStyle: "italic" }}>"{query}"</span>
            </h1>
            {suggestion && (
                <p style={{ color: "#bbb", marginTop: "10px", fontSize: "1.1rem" }}>
                    🤔 Aucun résultat exact. Affichage des résultats pour : <strong style={{ color: "white" }}>{suggestion}</strong>
                </p>
            )}
        </div>

        {loading ? (
          <p>Recherche en cours...</p>
        ) : results.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "25px" }}>
            {results.map((item) => <SearchCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: "50px", color: "#777" }}>
            <h2>Aucun résultat trouvé 🕵️‍♂️</h2>
            <p>Essayez de vérifier l'orthographe ou d'utiliser un mot-clé plus simple.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 4. EXPORT PAR DÉFAUT (WRAPPER SUSPENSE) ---
export default function SearchPage() {
  return (
    <Suspense fallback={
        <div style={{ minHeight: "100vh", backgroundColor: "#141414", color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>
            Chargement de la recherche...
        </div>
    }>
      <SearchContent />
    </Suspense>
  );
}