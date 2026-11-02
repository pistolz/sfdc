# SKY FLEET ✈️

Série « 1 follow = 1 jet privé avec ton nom dessus ». Chaque jour, les jets des nouveaux commentateurs rejoignent la flotte qui vole en formation dans le ciel de nuit, au-dessus de la ville. Le **commentaire le plus liké** devient le **jet doré du jour**, en tête de formation.

Style 2D en aplats : ciel de nuit, lune, nuages, ville illuminée, textes Oswald blancs à contour avec mots-clés jaunes et rouges. Sortie **1080×1920 MP4** + miniature PNG.

## Installation (une seule fois)

```bash
git clone https://github.com/pistolz/sfdc.git
cd sfdc
git checkout yacht-marina
cd jet-fleet
npm install
```

## Day 01

```bash
npm run render -- --episode episodes/day01.json
```

→ `out/day01.mp4` et `out/day01_cover.png`. Options : `--encoder nvenc`, `--fps 60`, `--still 3,9` (images fixes), `--from 5 --to 9`, `--headed`.

## Les jours suivants

1. Exporte les commentaires en CSV : `username,comment,likes`
2. `npm run new-day -- --comments data/comments-day01.csv --followers 1250`
   - le pays vient du drapeau emoji ou du nom du pays (drapeau peint sur la dérive du jet)
   - première couleur citée = carlingue, deuxième = dérive (rouge, noir, or, bleu, rose…) ; « lights / néon / party » = hublots illuminés
   - le plus liké = jet doré ; jusqu'à 4 nouveaux avec une demande = gros plan
3. `npm run render -- --episode episodes/day02.json`

Chaque jet garde sa place dans la formation pour toujours. Exemple : `data/comments-example.csv` → `episodes/example-day02.json`.
