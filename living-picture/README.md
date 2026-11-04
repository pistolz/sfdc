# Living Picture 🌸

Transforme une illustration fixe (par exemple une image générée par IA) en **vidéo vivante qui boucle parfaitement**, au format vertical 1080×1920 :

- **eau qui coule et scintille** : les zones bleu clair de l'image (ruisseau, fontaine) sont détectées automatiquement
- **pétales** qui tombent, **papillons**, **scintillements**, halo de soleil doux
- **caméra** qui respire lentement (zoom et léger déplacement)
- **les personnages bougent** : têtes qui penchent, petits sauts, respiration, pattes qui font coucou, sans déformation IA (fichier `images/<nom>.rig.json`)
- chaque mouvement fait un nombre entier de cycles : la dernière image se raccorde à la première, donc la vidéo tourne en boucle sans coupure visible

## Installation

```bash
git clone https://github.com/pistolz/sfdc.git
cd sfdc
git checkout yacht-marina
cd living-picture
npm install
```

## Rendu

```bash
npm run render -- --image images/puppy-garden.png
```

→ `out/puppy-garden.mp4` (12 s, boucle parfaite).

Pour ton image : copie-la dans `images/`, puis `npm run render -- --image images/mon-image.png`.

| Option | Effet |
|---|---|
| `--loop 15` | durée de la boucle en secondes |
| `--repeat 3` | répète la boucle 3 fois dans le fichier (sans perte) |
| `--water 1.5` | eau plus agitée (`0` = désactivée) |
| `--petals 80` | nombre de pétales (`0` = aucun) |
| `--butterflies 6` | nombre de papillons |
| `--zoom 0.05` | mouvement de caméra plus fort |
| `--music son.mp3` | ajoute une musique (sinon pas de son : ajoute un son tendance dans Instagram) |
| `--encoder nvenc` | encodage sur carte NVIDIA |
| `--still 0,6` | images fixes seulement, pour vérifier |

Aperçu en direct : `npm run preview` puis ouvre `http://localhost:5173/web/index.html?image=images/puppy-garden.png`.

## Faire bouger les personnages (rig)

Chaque image peut avoir un fichier `images/<nom>.rig.json` qui place des points de mouvement sur les personnages. Celui de `puppy-garden.png` est fourni (94 points).

Pour ta propre image, crée-le en cliquant :

1. `npm run preview`
2. ouvre `http://localhost:5173/web/index.html?image=images/mon-image.png&edit=1`
3. clique sur chaque personnage :
   - **clic** sur une tête → elle penche (cercle rouge)
   - **Maj + clic** → petit saut (bleu)
   - **Alt + clic** → respiration (vert)
   - **Ctrl/Cmd + clic** sur une patte levée → coucou (jaune)
   - **Retour arrière** → annule le dernier point
4. appuie sur **C** pour copier, puis colle dans `images/mon-image.rig.json`
5. `npm run render -- --image images/mon-image.png`

Dans le JSON, `amp` règle l'amplitude, `m` la vitesse (nombre de mouvements par boucle) et `r` la taille de la zone. `--rig none` désactive les mouvements.
