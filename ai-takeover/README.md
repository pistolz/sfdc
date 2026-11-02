# AI TAKEOVER : série interactive 🤖

Générateur de vidéos pour la série « Dans 200 jours, l'IA contrôle la Terre ». Chaque partie se termine par un choix, les spectateurs votent en commentaire, et le résultat décide de la partie suivante.

- Animation 2D en aplats, format vertical **1080×1920 MP4**, plus une **miniature PNG**
- HUD permanent : **jours restants** et **budget** qui baisse à chaque achat (avec un « ka-ching »)
- Le bunker se construit en **vue en coupe** au fil des achats (maison, abri, solaire, électricité, nourriture, eau, ferme)
- **Voix off** générée automatiquement (voix neuronale Microsoft gratuite) ou tes propres enregistrements ; la vidéo se cale sur la voix
- Mots-clés à l'écran synchronisés avec la narration, effets sonores, nappe de tension
- **Série** : le script `next-part` compte les votes et prépare la partie suivante avec l'état de l'histoire

## Installation (une seule fois)

Il te faut **Node.js 20+**, **git** et **Python 3** (pour la voix).

```bash
git clone https://github.com/pistolz/sfdc.git
cd sfdc
git checkout yacht-marina
cd ai-takeover
npm install
pip install edge-tts
```

## Rendre la partie 1

```bash
npm run voice  -- --episode episodes/part1.json
npm run render -- --episode episodes/part1.json
```

Résultat : `out/part1.mp4` (environ 2 min 20) et `out/part1_cover.png`.

- `npm run voice` crée une piste audio par phrase dans `out/voice/part1/` et mesure sa durée. Relance-le seulement si tu changes le texte (les phrases inchangées sont réutilisées).
- Changer de voix : `npm run voice -- --episode episodes/part1.json --voice en-US-GuyNeural --rate +10%` (liste des voix : `edge-tts --list-voices`).
- **Ta propre voix ou ElevenLabs** : mets un fichier par phrase dans `voice/part1/01.mp3`, `02.mp3`… (les numéros `id` de `episodes/part1.json`). Ils passent toujours avant la voix automatique.
- Options du rendu : `--encoder nvenc` (carte NVIDIA), `--fps 60`, `--still 12,40` (images fixes pour vérifier), `--from 30 --to 45` (un extrait), `--headed`.

Aperçu dans le navigateur : `npm run preview`.

## Après la publication : la partie suivante

1. Exporte les commentaires en CSV avec les colonnes `username,comment`.
2. Compte les votes et prépare la partie 2 :

   ```bash
   npm run next-part -- --from episodes/part1.json --comments data/part1-comments.csv
   ```

   Ou, si tu as compté toi-même : `--votes open=1834,leave=912`.

   Ça crée `episodes/part2.json` avec :
   - l'**état de l'histoire** repris de la partie 1 : jour 10, $295,000, tout ce qui a été construit
   - un **premier plan de résultats** : « In part 1, you voted. 68 percent of you chose to open the door. » avec les barres de pourcentage
   - un plan `TODO` à remplacer par le script de la suite, et le **nouveau choix** à la fin

3. Écris la suite (ou envoie le résultat du vote à Claude pour qu'il l'écrive), puis `npm run voice` et `npm run render` sur `episodes/part2.json`.

Exemple fourni : `data/part1-comments-example.csv` → `episodes/example-part2.json`.

## Écrire une partie

Chaque plan (`beat`) de `episodes/partN.json` correspond à une phrase de la voix off :

```json
{
  "id": "13", "scene": "xsection", "args": { "focus": "solar", "hero": "living" },
  "say": "You immediately purchase an off-grid solar system for $65,000.",
  "events": [
    { "at": "$65,000", "spend": 65000, "label": "SOLAR SYSTEM" },
    { "at": "off-grid", "build": "solar" }
  ],
  "keys": [{ "at": "off-grid", "slot": "top", "style": "tag", "show": "OFF-GRID SOLAR" }]
}
```

- `at` = le mot de la phrase où l'action se produit (calé automatiquement sur la voix)
- `events` : `spend` (dépense), `build` (`house`, `basement`, `bunker`, `solar`, `power`, `food`, `water`, `farm`), `days` (change le compteur), `showBudget`
- `keys` = texte à l'écran ; `slot` : `top`, `upper`, `center`, `lower`, `bottom` ; `style` : `big`, `white`, `yellow`, `cyan`, `red`, `green`, `tag`, `stamp-red`, `stamp-green`
- `scene` : `globe`, `lab`, `screens`, `devices`, `cityai`, `hero`, `daycard`, `xsection` (le bunker en coupe, `focus` : `surface`, `basement`, `bunker`, `solar`, `power`, `food`, `water`, `farm`, `overview`), `news`, `griddown`, `blackout`, `chaos`, `cctv`, `family`, `noicons`, `phone`, `choice`, `recap`, `ai`
- `sfx` (optionnel) : `alarm`, `glitch`, `beep`, `heartbeat`
- `choice` (à la fin du fichier) : la question, les options et les mots-clés pour compter les votes (anglais, français, espagnol)

## Musique

La vidéo contient la voix, les effets et une nappe grave. Ajoute un son tendance dans Instagram à faible volume si tu veux.
