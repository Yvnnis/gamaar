"use client"; // <--- La ligne magique obligatoire pour l'interactivité !

// On ajoute "onClick" dans la liste des choses acceptées
export default function Button({ 
  text, 
  variant = "primary",
  onClick 
}: { 
  text: string, 
  variant?: "primary" | "secondary",
  onClick?: () => void  // C'est une fonction (une action) optionnelle
}) {
  
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={onClick} // On relie le clic réel à l'action qu'on lui passera
      style={{
        backgroundColor: isPrimary ? "#e50914" : "transparent",
        color: isPrimary ? "white" : "#333",
        border: isPrimary ? "none" : "1px solid #ccc",
        padding: "10px 20px",
        borderRadius: "5px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "16px",
        marginTop: "10px",
        width: "100%" // Petit bonus: le bouton prend toute la largeur, c'est plus joli sur mobile
      }}
    >
      {text}
    </button>
  );
}