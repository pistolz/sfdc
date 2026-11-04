# reel-engine

Moteur de vidéos verticales (1080×1920) entièrement dessinées en code, utilisé par les skills `interactive-series` et `product-promo`.

- `episodes/*.json` → un épisode = des plans (`beats`), une phrase de voix off par plan
- `"scene": "compose"` + `args.layers` : décor, personnages, emoji (Twemoji), textes, cartes… (voir `.claude/skills/*/reference/layers.md`)
- styles : `story` (séries), `ai` (GAIA), `editorial` (pub produit)

```bash
npm install
npm run voice  -- --episode examples/story-example.json   # voix (pip install edge-tts)
npm run render -- --episode examples/story-example.json   # vidéo + miniature dans out/
npm run render -- --episode examples/promo-example.json --still 2,8   # images fixes pour vérifier
npm run next-part -- --from episodes/part1.json --comments votes.csv  # séries : partie suivante
npm run qa -- --episode examples/promo-product.json   # contrôle qualité + planche de toutes les images
npm run render -- --episode … --workers 4             # rendu en parallèle
```

Emoji : Twemoji © Twitter/X, CC-BY 4.0. Polices : SIL Open Font License.
