# The Comment Marina 🛥️

Générateur de vidéos pour la série « 1 follow = 1 yacht avec ton nom dessus ».
Il produit chaque jour une vidéo verticale **1080×1920 MP4** (avec effets sonores) et une **miniature PNG**.

- Rendu 3D style « jouet miniature » (Three.js), bateaux procéduraux, eau animée, effet tilt-shift
- Day 01 : la marina vide, la règle, un yacht de démo « @your.name » et le poste VIP doré
- Day 02 et suivants : les yachts des commentateurs arrivent, gros plans sur les demandes perso, le **commentaire le plus liké** arrive en **superyacht VIP**
- Tout est déterministe : le même fichier d'épisode donne toujours la même vidéo

## Installation (une seule fois)

Il te faut **Node.js 20 ou plus** (https://nodejs.org, version LTS) et **git**.

```bash
git clone https://github.com/pistolz/sfdc.git
cd sfdc
git checkout yacht-marina
cd yacht-marina
npm install
```

`npm install` télécharge aussi Chrome (pour le rendu 3D) et ffmpeg (pour l'encodage). Rien d'autre à installer.

## Rendre le Day 01

```bash
npm run render -- --episode episodes/day01.json
```

Résultat dans `out/` :
- `out/day01.mp4` : la vidéo à publier
- `out/day01_cover.png` : la miniature (à choisir comme couverture du Reel)

Au démarrage, la ligne `GPU renderer:` indique ce qui calcule la 3D. Tu dois y voir ta carte graphique (NVIDIA, AMD, Intel…).
Si tu vois `SwiftShader` (rendu sur le processeur, beaucoup plus lent), relance avec `--headed` (Chrome s'ouvre en fenêtre visible et utilise le GPU), ou force le pilote : `--gl d3d11` (Windows), `--gl vulkan` (Linux), `--gl metal` (Mac).

Options utiles :

| Option | Effet |
|---|---|
| `--encoder nvenc` | encode la vidéo avec une carte NVIDIA (`amf` = AMD, `qsv` = Intel, `videotoolbox` = Mac). Par défaut `x264` (processeur, excellente qualité) |
| `--fps 60` | 60 images/seconde au lieu de 30 |
| `--still 2,8.5` | sauve seulement des images fixes à ces secondes (pour vérifier vite) |
| `--from 5 --to 9` | ne rend qu'un morceau |
| `--scale 0.5` | brouillon rapide en demi-résolution |

Aperçu en direct dans le navigateur : `npm run preview` puis ouvre l'adresse affichée.

## Chaque jour suivant

1. **Exporte les commentaires** de la vidéo du jour dans un fichier CSV (Excel ou Google Sheets → « Enregistrer en CSV ») avec ces colonnes :

   ```csv
   username,comment,likes
   kevin_88,🇫🇷 je veux un yacht rouge avec piscine,12
   maria.sea,Brasil 🇧🇷 black and gold with helipad,1840
   ```

   - le **pays** est lu depuis le drapeau emoji ou le nom du pays dans le commentaire
   - les **demandes** sont lues dans le texte (en/fr/es/pt) : couleurs (rouge, noir, or, bleu, rose…) et options **piscine**, **héliport**, **jet-ski**, **lumières de fête**
   - tu peux aussi ajouter des colonnes `country` (ex. `fr`) et `request` (ex. `red, pool`) pour corriger à la main

2. **Génère l'épisode** :

   ```bash
   npm run new-day -- --comments data/comments-day01.csv --followers 1250
   ```

   Ça crée `episodes/day02.json`. Tous les yachts des jours précédents gardent leur place pour toujours.
   - le commentaire **le plus liké** devient le **VIP du jour** (superyacht doré au poste VIP)
   - jusqu'à **4 nouveaux** avec une demande perso ont droit à un gros plan avec leur nom
   - `--followers` = le nombre d'abonnés affiché sur le compteur

3. **Vérifie et ajuste** `episodes/day02.json` si tu veux (noms, couleurs, qui a un gros plan avec `"featured": true`), puis :

   ```bash
   npm run render -- --episode episodes/day02.json
   ```

Un exemple complet est fourni : `data/comments-example.csv` → `episodes/example-day02.json`.

## Personnaliser

- `episodes/day01.json` : nom de la série (`brand`), textes, ambiance `theme` : `day`, `sunset` ou `night`
- `web/src/themes.js` : couleurs et lumières de chaque ambiance
- `web/style.css` : polices, tailles et couleurs des textes à l'écran
- `web/src/timeline.js` : le montage (caméra, timing des textes)

## Musique

La vidéo contient seulement des effets sonores (mer, « pop » à chaque yacht, corne de bateau, scintillement VIP).
Ajoute un **son tendance directement dans Instagram** au moment de publier : ça aide la portée. Baisse le volume du son d'origine à environ 30 %.

## Licences des ressources

Three.js (MIT), drapeaux flag-icons (MIT), polices Lilita One et Nunito (SIL Open Font License), ffmpeg (GPL/LGPL via ffmpeg-static).
