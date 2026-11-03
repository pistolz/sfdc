# Living Picture 🌸

Transforme une illustration fixe (par exemple une image générée par IA) en **vidéo vivante qui boucle parfaitement**, au format vertical 1080×1920 :

- **eau qui coule et scintille** : les zones bleu clair de l'image (ruisseau, fontaine) sont détectées automatiquement
- **pétales** qui tombent, **papillons**, **scintillements**, halo de soleil doux
- **caméra** qui respire lentement (zoom et léger déplacement)
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
