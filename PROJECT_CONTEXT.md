# 🎬 CINEMATCH - Documentation & Architecture

## 1. Vue d'ensemble
**CinéMatch** est une application web de recommandation de films et séries.
Elle se distingue par une approche centrée sur la psychologie utilisateur (Archétypes & Moods) et une interface fluide type "Tinder" pour combattre la paralysie du choix.

## 2. Tech Stack
- **Frontend :** Next.js 14 (App Router), React, TypeScript.
- **Styling :** CSS-in-JS (Inline styles) pour un développement rapide. Pas de Tailwind.
- **Backend / Auth :** Supabase (PostgreSQL, Auth).
- **API Données :** TMDB (The Movie Database) API v3.
- **Hébergement cible :** Vercel.

## 3. Architecture des Dossiers
.
├── app/
│   ├── api/
│   │   ├── chat/             # Route Handler pour le chat IA
│   │   └── match/            # Route Handler pour le matchmaking
│   ├── auth/
│   │   ├── callback/         # Callback OAuth Supabase
│   │   └── page.tsx          # Page d'authentification principale
│   ├── calibration/
│   │   └── page.tsx          # Page de calibration (Setup initial ?)
│   ├── dashboard/
│   │   └── page.tsx          # Cœur de l'app : Le "Chalutier" (Recommandations par paquets)
│   ├── discover/
│   │   └── page.tsx          # Page Découvrir (Navigation par genres/catégories)
│   ├── login/
│   │   └── page.tsx          # Page de Login spécifique
│   ├── mood/
│   │   └── page.tsx          # Sélection de l'humeur du moment
│   ├── movie/
│   │   └── [id]/
│   │       └── page.tsx      # Détails Film/Série (Trailer, Streaming, Casting cliquable)
│   ├── mylist/
│   │   └── page.tsx          # Ma Liste (Données synchronisées avec Supabase)
│   ├── party/
│   │   └── page.tsx          # Mode Party (Swipe multijoueur)
│   ├── person/
│   │   └── [id]/
│   │       └── page.tsx      # Fiche Artiste (Bio, Filmographie triée par note)
│   ├── profile/
│   │   └── page.tsx          # Gestion du profil utilisateur
│   ├── quiz/
│   │   └── page.tsx          # Quiz d'onboarding (Définition de l'archétype)
│   ├── search/
│   │   └── page.tsx          # Résultats de recherche (Algorithme Levenshtein inclus)
│   ├── globals.css           # Styles globaux & Reset CSS
│   ├── layout.tsx            # Layout racine (Metadatas, Polices)
│   └── page.tsx              # Landing Page (Accueil visiteur)
├── components/
│   ├── Button.tsx            # Composant Bouton UI
│   ├── Navbar.tsx            # Navigation avec Live Search & Redirection intelligente
│   ├── OracleWidget.tsx      # Widget Assistant IA
│   └── OracleWrapper.tsx     # Wrapper Logiciel Oracle
├── data/
│   └── movies.ts             # Données statiques / Types
├── hooks/
│   └── useMediaInteraction.ts # Hook global pour gérer les états (List, Seen, Liked)
├── public/                   # Assets (images, svg...)
├── utils/
│   └── supabase/
│       └── requests.ts       # Clients et requêtes Supabase
├── .env.local                # Clés API (TMDB_API_KEY, SUPABASE_URL...)
└── package.json