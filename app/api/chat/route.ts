import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. On simule un délai de réflexion (pour faire "vrai" AI)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    const { message } = await req.json();
    const text = message.toLowerCase();

    let reply = "";

    // --- LE CERVEAU SIMULÉ 🧠 ---
    
    // Salutations
    if (text.match(/bonjour|salut|hello|yo|coucou/)) {
      reply = "Salutations, âme cinéphile. L'Oracle t'écoute. Que cherches-tu ?";
    } 
    // Genres
    else if (text.match(/horreur|peur|frisson|effrayant/)) {
      reply = "Tu veux trembler ? Regarde 'Hérédité' (2018). C'est un cauchemar familial dont tu ne sortiras pas indemne. 🏚️";
    }
    else if (text.match(/action|bagarre|explosion|adrénaline/)) {
      reply = "Besoin que ça bouge ? 'Mad Max: Fury Road'. 2h de pure folie visuelle et de métal froissé. Accroche-toi. 🔥";
    }
    else if (text.match(/science-fiction|sf|espace|futur/)) {
      reply = "Lève les yeux vers les étoiles. 'Interstellar' est un chef-d'œuvre qui va retourner ton cerveau et ton cœur. 🚀";
    }
    else if (text.match(/comédie|rire|drôle|marrant/)) {
      reply = "La vie est trop sérieuse. Regarde 'The Big Lebowski'. Le Dude saura t'apprendre à lâcher prise. 🎳";
    }
    else if (text.match(/triste|pleurer|drame|émotion/)) {
      reply = "Prépare les mouchoirs. 'La Ligne Verte' est une claque émotionnelle inoubliable. 💧";
    }
    else if (text.match(/amour|romance|couple/)) {
      reply = "L'amour est un mystère. 'Eternal Sunshine of the Spotless Mind' te montrera pourquoi on ne devrait jamais oublier. ❤️";
    }
    else if (text.match(/thriller|suspense|enquête|policier/)) {
      reply = "Tu aimes les énigmes ? 'Seven' de David Fincher. La tension est insoutenable jusqu'à la dernière seconde. 📦";
    }
    else if (text.match(/famille|enfant|dessin animé/)) {
      reply = "Pour un moment magique, 'Le Voyage de Chihiro'. Une merveille visuelle pour petits et grands. 🐉";
    }
    // Questions spécifiques
    else if (text.includes("merci")) {
      reply = "Tout le plaisir est pour moi. Reviens quand tu veux.";
    }
    else if (text.includes("qui es-tu") || text.includes("t'es qui")) {
      reply = "Je suis l'Oracle de CinéMatch. Une entité numérique née pour guider tes soirées.";
    }
    // Réponse par défaut (si aucun mot clé trouvé)
    else {
      const defaults = [
        "Les astres sont flous... Je te conseille de regarder un classique comme 'Le Parrain'. On ne se trompe jamais avec la famille.",
        "Ta demande trouble mes capteurs. Dans le doute, regarde 'Pulp Fiction'.",
        "Je sens une perturbation dans la Force. As-tu essayé 'Matrix' ?",
        "Intéressant... Mais as-tu vu 'Forrest Gump' ? C'est souvent la réponse à tout."
      ];
      reply = defaults[Math.floor(Math.random() * defaults.length)];
    }

    return NextResponse.json({ reply });

  } catch (error) {
    return NextResponse.json({ reply: "Désolé, ma boule de cristal est cassée." }, { status: 500 });
  }
}