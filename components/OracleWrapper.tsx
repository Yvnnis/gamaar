"use client";

import { usePathname } from "next/navigation";
import Oracle from "./OracleWidget"; // Assure-toi que le chemin est bon vers ton fichier Oracle actuel

export default function OracleWrapper() {
  const pathname = usePathname();

  // Liste des pages où l'Oracle doit être CACHÉ
  const hiddenRoutes = [
    "/",              // Landing Page
    "/login",         // Page de connexion (si elle existe)
    "/auth",          // Pages d'auth
    "/quiz",          // Le Quiz
    "/calibration"    // La Calibration
  ];

  // Si l'URL actuelle commence par l'un des chemins interdits, on cache l'Oracle
  // (On utilise startsWith pour gérer les sous-pages éventuelles comme /quiz/step2)
  const shouldHide = hiddenRoutes.some((route) => 
    pathname === route || pathname.startsWith(route + "/")
  );

  if (shouldHide) {
    return null; // On n'affiche rien du tout
  }

  // Sinon, on affiche l'Oracle (Dashboard, Movie, MyList, Party...)
  return <Oracle />;
}