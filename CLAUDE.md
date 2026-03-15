# Tâche planifiée — Suivi Élections Municipales France 2026

## Description
Compte rendu régulier des résultats des élections municipales françaises 2026 (1er et 2e tour), mis à jour automatiquement chaque dimanche de scrutin.

## Instructions pour Claude

### Objectif
Maintenir à jour le fichier `elections-municipales-2026.html` dans ce dépôt avec :
1. Les résultats du **1er tour** (15 mars 2026) dans les principales villes françaises
2. L'évolution des **sondages** et des **alliances** pour le second tour
3. Les résultats du **2e tour** (22 mars 2026)
4. Un **bilan final** des villes ayant changé de maire et/ou de bord politique

### Villes à couvrir (prioritaires)
- Paris, Marseille, Lyon, Toulouse, Nice
- Nantes, Strasbourg, Montpellier, Bordeaux, Lille
- Rennes, Grenoble, Le Havre, Saint-Étienne, Toulon
- Perpignan, Hénin-Beaumont, et autres villes RN/LFI emblématiques

### Bords politiques à préciser pour chaque parti
| Parti | Bord politique |
|-------|---------------|
| PS (Parti Socialiste) | Gauche |
| LFI (La France Insoumise) | Gauche radicale |
| PCF (Parti Communiste Français) | Gauche |
| EELV / Écologistes | Centre-gauche / Gauche |
| LR (Les Républicains) | Droite |
| Horizons / Renaissance / MoDem | Centre |
| RN (Rassemblement National) | Extrême droite |
| UDR (Union des Droites pour la République) | Droite souverainiste (allié RN) |
| Reconquête | Extrême droite |
| DVG / DVD / DIV | Divers gauche / droite / centre |

### Format du fichier HTML
Le fichier `elections-municipales-2026.html` est une page web autonome (tout en un) contenant :
- Un tableau de bord des statistiques nationales (participation, nombre de communes, etc.)
- Des barres de participation par ville
- Des fiches détaillées par ville avec scores des candidats et bords politiques
- Un tableau des alliances pour le second tour
- Des sondages sur les attitudes envers les fusions de listes
- Une section bilan final (à remplir après le 2e tour)

### Processus de mise à jour
1. Rechercher les derniers résultats via WebSearch avec des requêtes comme :
   - `"élections municipales 2026 résultats [ville]"`
   - `"municipales 2026 second tour alliances"`
   - `"municipales 2026 bilan résultats finaux"`
2. Mettre à jour le fichier HTML avec les nouvelles données
3. Commiter et pusher sur ce dépôt GitHub

### Bilan final (après le 22 mars 2026)
Créer une section "Bilan" dans le fichier HTML listant :
- Les villes ayant changé de maire
- Les villes ayant changé de bord politique (ex : gauche → droite)
- Les villes où le RN a fait une percée ou a été battu
- La synthèse nationale (bords politiques des nouvelles équipes municipales)

## Commandes Git utiles

```bash
# Cloner le dépôt
git clone https://github.com/Aldwyr/municipal2026.git

# Mettre à jour le dépôt
git pull origin main

# Ajouter les modifications
git add elections-municipales-2026.html

# Commiter
git commit -m "Mise à jour résultats — [date]"

# Pousser
git push origin main
```

## Configuration Git (si nécessaire)
```bash
git config user.name "Aldwyr"
git config user.email "votre-email@exemple.com"
```

Pour l'authentification GitHub depuis un terminal, utiliser un **Personal Access Token (PAT)** :
1. Aller sur https://github.com/settings/tokens
2. Générer un token avec les droits `repo`
3. Utiliser le token comme mot de passe lors du push

---
*Fichier créé le 15 mars 2026 — Maintenu par Claude (tâche planifiée)*
