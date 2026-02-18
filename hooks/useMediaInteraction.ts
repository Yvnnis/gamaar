import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useMediaInteraction(item: any, type: string) {
  const supabase = createClient();
  const [inList, setInList] = useState(false);
  const [isSeen, setIsSeen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sécurité : On s'assure que le type envoyé à la BDD est TOUJOURS 'movie' ou 'tv'
  const safeMediaType = (type === 'movie' || type === 'tv') ? type : (item?.first_air_date ? 'tv' : 'movie');

  useEffect(() => {
    if (!item?.id) return;

    const checkInteractions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("user_interactions")
          .select("in_list, is_seen, is_liked")
          .eq("user_id", user.id)
          .eq("tmdb_id", item.id)
          .eq("media_type", safeMediaType)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
             console.error("Erreur fetch interactions:", error.message);
        }

        if (data) {
          setInList(data.in_list);
          setIsSeen(data.is_seen);
          setIsLiked(data.is_liked);
        } else {
          setInList(false);
          setIsSeen(false);
          setIsLiked(false);
        }
      } catch (err) {
        console.error("Erreur connexion Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    checkInteractions();
  }, [item?.id, safeMediaType]);

  const updateInteraction = async (updates: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Tu dois être connecté !");
        return;
      }

      // --- 1. SAUVEGARDE DANS LE CACHE MÉDIA (Important pour le Profil/Liste) ---
      // On extrait les infos utiles pour l'affichage futur
      const title = item.title || item.name;
      const poster = item.poster_path;
      const vote = item.vote_average;
      const date = item.release_date || item.first_air_date;

      // On upsert dans media_cache sans bloquer si ça échoue (c'est du cache)
      const { error: cacheError } = await supabase.from("media_cache").upsert({
          tmdb_id: item.id,
          media_type: safeMediaType,
          title: title,
          poster_path: poster,
          vote_average: vote,
          release_date: date
      }, { onConflict: "tmdb_id,media_type" });

      if (cacheError) console.error("⚠️ Erreur Cache Média:", cacheError.message);
      // -----------------------------------------------------------------------

      // --- 2. SAUVEGARDE L'INTERACTION UTILISATEUR ---
      const payload = {
        user_id: user.id,
        tmdb_id: item.id,
        media_type: safeMediaType,
        in_list: updates.inList !== undefined ? updates.inList : inList,
        is_seen: updates.isSeen !== undefined ? updates.isSeen : isSeen,
        is_liked: updates.isLiked !== undefined ? updates.isLiked : isLiked,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("user_interactions")
        .upsert(payload, { onConflict: "user_id,tmdb_id,media_type" });

      if (error) throw error;

    } catch (error: any) {
      console.error("❌ ERREUR SUPABASE :", error.message || error);
    }
  };

  const toggleList = async () => {
    const newVal = !inList;
    setInList(newVal); 
    await updateInteraction({ inList: newVal });
  };

  const toggleSeen = async () => {
    const newVal = !isSeen;
    setIsSeen(newVal);
    await updateInteraction({ isSeen: newVal });
  };

  const toggleLiked = async () => {
    const newVal = !isLiked;
    setIsLiked(newVal);
    await updateInteraction({ isLiked: newVal });
  };

  return { inList, isSeen, isLiked, toggleList, toggleSeen, toggleLiked, loading };
}