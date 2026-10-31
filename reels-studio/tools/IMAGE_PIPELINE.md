# Image asset pipeline (AI stills → full-res PNG / transparent cut-outs)

Validated 2026-10-31 in this environment with the Canva connector (MCP tools `mcp__Canva__*`).

## What we get
- Text-to-image generation at ~944×1680 (9:16) or 1024×1024 (1:1), painterly/game-art quality. The tool returns only a
  thumbnail; the full-resolution file is obtained by placing the media in a scratch design and exporting it.
- Background removal (`remove-background`) → RGBA cut-outs (verified: transparent corners, clean edges).
- Export sizes up to 25 000 px (upscaled from the native resolution). We export plates at 1080×1920 and props at 1024×1024.

## Procedure (per batch of images)
1. `generate-image` with `prompt`, `aspectRatio` (PORTRAIT_9_16 for plates, SQUARE_1_1 for props). For props write
   "centered, completely isolated on a plain pure white background, no ground, no text". Poll `get-generate-image-job`
   until SUCCESS → `media_id`.
2. Props only: `remove-background` with `{type: "MEDIA", id: media_id}` → new `media_id` (RGBA).
3. Scratch design: our scratch design is `DAHZib90wKc` ("Blank black Instagram Story"; page 1 = 1080×1920, page 2 =
   1024×1024). To add pages: `read-design` (open_transaction) → `edit-design` `add_page` (width/height) → `commit` →
   `read-design` again to get the new page id.
4. Place: `read-design` (open_transaction) → `edit-design` `insert_fill` (`page_id`, `asset_id`, `top:0,left:0,
   width,height` = page size) → `edit-design` `commit`. Delete any previous element on that page first
   (`delete_element` with its locator_id) so pages can be reused.
5. Export: `export-design` `{type: "png", pages: [n], width, height, export_quality: "pro", lossless: true,
   transparent_background: true-for-props}` → signed URL (valid a few hours) → `curl -o file.png URL`.
6. Verify with Pillow: size, mode (RGBA for props), alpha coverage. Save backgrounds under `public/layers/bX.jpg`; cut characters out with `tools/cutout.py` into `public/layers/cX.png`.

## Style consistency rules
- One master style sentence reused verbatim in every prompt (e.g. "stylized painterly 3D game-art, soft tilt-shift,
  warm late-afternoon light, rich saturated palette"). Describe the same camera ("top-down bird's-eye, straight down").
- Generate the master plate first, then props "matching the lighting direction (light from top-left)".
- Day/night/dawn are NOT separate generations: grade in Remotion (color matrices, overlays, glows) so the scene stays
  pixel-identical across the episode and props stay aligned.
- Keep a `prompts.json` next to the assets with every prompt + media_id so Day 2+ can regenerate in the same style.
