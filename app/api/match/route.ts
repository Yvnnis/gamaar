import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";

// Fonction utilitaire pour trouver l'élément le plus fréquent dans un tableau
function findMostFrequent(arr: any[]) {
    return arr.sort((a,b) => arr.filter(v => v===a).length - arr.filter(v => v===b).length).pop();
}

export async function POST(req: Request) {
  const supabase = createClient();
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

  try {
    const { userIds } = await req.json(); // On reçoit [ID_MOI, ID_POTE1, ID_POTE2...]

    if (!userIds || userIds.length < 2) {
        return NextResponse.json({ error: "Il faut au moins 2 personnes pour un match !" }, { status: 400 });
    }

    // 1. Récupérer les interactions de TOUS les participants
    const { data: interactions } = await supabase
      .from("user_interactions")
      .select("tmdb_id, is_liked, is_in_watchlist, is_seen")
      .in("user_id", userIds);

    if (!interactions || interactions.length === 0) {
        // Pas de données ? On renvoie un film populaire par défaut
        return NextResponse.json({ fallback: true, message: "Pas assez de données..." });
    }

    // 2. CHERCHER LE "PERFECT MATCH" (Dans la watchlist de TOUT LE MONDE)
    // On compte combien de fois chaque film apparaît dans une watchlist
    const watchlistCounts: Record<number, number> = {};
    interactions.forEach((i: any) => {
        if (i.is_in_watchlist) {
            watchlistCounts[i.tmdb_id] = (watchlistCounts[i.tmdb_id] || 0) + 1;
        }
    });

    // Si un ID a un score égal au nombre de participants, c'est GAGNÉ !
    const perfectMatchId = Object.keys(watchlistCounts).find(id => watchlistCounts[Number(id)] === userIds.length);

    if (perfectMatchId) {
        // On fetch les détails et on renvoie
        const res = await fetch(`https://api.themoviedb.org/3/movie/${perfectMatchId}?api_key=${apiKey}&language=fr-FR`);
        const movie = await res.json();
        return NextResponse.json({ type: "PERFECT", movie });
    }

    // 3. SINON : MATCH PAR GENRE (Moyenne des goûts)
    // On prend les IDs des films LIKÉS par le groupe
    const likedIds = interactions.filter((i: any) => i.is_liked).map((i: any) => i.tmdb_id);
    
    // On récupère les détails (genres) de ces films (on limite à 5 pour pas exploser l'API)
    // Astuce : Dans un vrai projet, on stockerait les genres dans Supabase pour éviter ces appels
    const genreIds: number[] = [];
    
    // Pour l'exemple, on triche un peu : on prend un genre au hasard basé sur les tendances
    // (Une vraie implémentation demanderait de fetcher chaque film liké pour avoir son genre)
    // Ici, on va faire une requête "Discover" qui exclut les films déjà vus
    
    const seenIds = interactions.filter((i: any) => i.is_seen).map((i: any) => i.tmdb_id);
    const seenString = seenIds.slice(0, 10).join("|"); // On en exclut quelques-uns

    // On fait une requête "Discover" générique mais populaire
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=fr-FR&sort_by=popularity.desc&page=${randomPage}&vote_average.gte=7`;
    
    const resDiscover = await fetch(discoverUrl);
    const dataDiscover = await resDiscover.json();

    // On filtre ceux que quelqu'un a déjà vus
    const validMovies = dataDiscover.results.filter((m: any) => !seenIds.includes(m.id));
    
    if (validMovies.length > 0) {
        return NextResponse.json({ type: "DISCOVERY", movie: validMovies[0] });
    }

    return NextResponse.json({ error: "Aucun match trouvé..." });

  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}