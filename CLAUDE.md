# Gamaar — règles de travail pour Claude Code

Projet : site de recommandations films / séries / animation / animés.
Stack : Next.js (App Router) + React + TypeScript, Supabase (auth + BDD), API TMDB. Hébergé sur Vercel (gamaar.vercel.app), déploiement automatique à chaque push sur `main`.

## Mode de travail : autonomie complète
Yannis décrit la modification, tu t'occupes de tout le reste sans lui demander de lancer de commande :
1. `git pull` sur `main` avant de commencer.
2. Faire les modifications demandées.
3. Vérifier que ça compile : `npx tsc --noEmit` doit passer (corriger sinon).
4. Commit avec un message clair en français.
5. `git push` directement sur `main` (Yannis est le seul utilisateur du site).
6. Terminer par un court résumé : ce qui a changé, et quoi vérifier sur gamaar.vercel.app.

Si une demande est ambiguë ou risquée (suppression de données Supabase, changement de schéma BDD), demander avant d'agir.

## Conventions
- Répondre en français, simplement (Yannis n'est pas développeur de métier).
- Ne jamais committer `.env.local` ni aucune clé API.
- Styles : inline styles + `app/globals.css`. Les animations de survol des boutons sont dans `globals.css` (classes `.cta`, `.cta-primary`) : ne pas remettre de `onMouseOver` qui modifie `transform` sur les boutons.
- Rubriques qui se rechargent : utiliser `hooks/useRefillingRail.ts`.
- Clés d'historique : toujours `${media_type}_${id}` (les IDs TMDB films et séries se chevauchent).
