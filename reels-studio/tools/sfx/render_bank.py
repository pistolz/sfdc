#!/usr/bin/env python3
"""
render_bank.py - render one demo WAV per generator into public/audio/sfx/, copy the most useful
Kenney CC0 one-shots into public/audio/kenney/ (48 kHz WAV + MANIFEST.json), verify everything
numerically and print a table.

Usage:
  python3 -I render_bank.py                  # full bank + Kenney + checks
  python3 -I render_bank.py --skip-kenney    # synthesized bank only
  python3 -I render_bank.py --only whoosh    # names containing 'whoosh'
  python3 -I render_bank.py --seed 7         # different takes (default seed 2024)

Exit code 1 if any check fails.
"""
import argparse
import datetime as _dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)                       # `python -I` does not add the script dir
import numpy as np                              # noqa: E402
import synth as S                               # noqa: E402

PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_SFX = os.path.join(PROJECT, "public", "audio", "sfx")
OUT_KENNEY = os.path.join(PROJECT, "public", "audio", "kenney")
KENNEY_ROOT = "/home/user/kapishdima/soundcn/assets"

BED_TARGET_LUFS = -30.0      # ambience bed target (README: -32..-28)
SFX_TARGET_DBTP = -6.0       # one-shot peak target (README: -8..-4 dBTP)

# name, category, generator call, suggested use
def bank(seed: int):
    r = np.random.default_rng(seed)
    s = lambda: int(r.integers(1 << 30))  # noqa: E731
    return [
        ("drone_calm",      "bed",   lambda: S.drone(10, 55, "calm", seed=s()),      "underscore: calm narration"),
        ("drone_tense",     "bed",   lambda: S.drone(10, 55, "tense", seed=s()),     "underscore: rule explained / stakes"),
        ("drone_dread",     "bed",   lambda: S.drone(10, 49, "dread", seed=s()),     "underscore: danger / mistake"),
        ("drone_dawn",      "bed",   lambda: S.drone(10, 65.4, "dawn", seed=s()),    "underscore: resolution / morning"),
        ("wind",            "bed",   lambda: S.wind(10, 0.5, seed=s()),              "outdoor bed, exposed places"),
        ("forest_ambience", "bed",   lambda: S.forest_ambience(10, seed=s()),        "day forest bed"),
        ("night_ambience",  "bed",   lambda: S.night_ambience(10, seed=s()),         "night forest bed (crickets)"),
        ("fire_crackle",    "bed",   lambda: S.fire_crackle(10, 0.5, seed=s()),      "campfire bed"),
        ("bird_chirps",     "bed",   lambda: S.bird_chirps(10, 0.5, seed=s()),       "dawn chorus layer (over forest)"),
        ("whoosh_up",       "sfx",   lambda: S.whoosh(0.6, "up", seed=s()),          "scene transition in / text fly-in"),
        ("whoosh_down",     "sfx",   lambda: S.whoosh(0.6, "down", seed=s()),        "transition out / drop-off"),
        ("wing_flap",       "sfx",   lambda: S.wing_flap(3, 0.55, seed=s()),         "big wings passing"),
        ("impact_thud",     "sfx",   lambda: S.impact("thud", seed=s()),             "boom on a big reveal"),
        ("impact_wood",     "sfx",   lambda: S.impact("wood", seed=s()),             "plank / knock / rule dock"),
        ("impact_stone",    "sfx",   lambda: S.impact("stone", seed=s()),            "heavy slab, cards landing hard"),
        ("impact_metal",    "sfx",   lambda: S.impact("metal", seed=s()),            "metallic hit / alert stinger"),
        ("tree_fall",       "sfx",   lambda: S.tree_fall(seed=s()),                  "tree fall set piece"),
        ("riser",           "sfx",   lambda: S.riser(3.0, 100, 2000, seed=s()),      "tension before reveal"),
        ("sub_drop",        "sfx",   lambda: S.sub_drop(),                           "drop on the reveal (after riser)"),
        ("heartbeat",       "sfx",   lambda: S.heartbeat(60, 4.0, seed=s()),         "suspense pulse under countdown"),
        ("ui_tick",         "ui",    lambda: S.ui_tick(),                            "HUD element appears"),
        ("ui_pop",          "ui",    lambda: S.ui_pop(),                             "HUD pop / card pop-in"),
        ("ui_slide",        "ui",    lambda: S.ui_slide(),                           "rule dock slides in"),
        ("counter_tick",    "ui",    lambda: S.counter_tick(),                       "number counter steps"),
        ("digit_flip",      "ui",    lambda: S.digit_flip(),                         "countdown digit flip"),
        ("alarm_beep",      "ui",    lambda: S.alarm_beep(),                         "timer / warning beep"),
        ("roar",            "sfx",   lambda: S.roar(1.5, seed=s()),                  "creature reveal"),
    ]


# (new name, source relative to KENNEY_ROOT, suggested use)
KENNEY_PICKS = [
    ("ui-click",          "kenney_interface-sounds/click_002.ogg",            "soft button click"),
    ("ui-tick",           "kenney_interface-sounds/tick_004.ogg",             "tick for HUD / cursor steps"),
    ("ui-select",         "kenney_interface-sounds/select_001.ogg",           "select / highlight"),
    ("ui-confirm",        "kenney_interface-sounds/confirmation_001.ogg",     "warm confirm chime"),
    ("ui-drop",           "kenney_interface-sounds/drop_002.ogg",             "low drop / element docks"),
    ("ui-pluck",          "kenney_interface-sounds/pluck_002.ogg",            "pluck pop, card pop-in"),
    ("ui-open",           "kenney_interface-sounds/open_001.ogg",             "panel open swish"),
    ("ui-close",          "kenney_interface-sounds/close_001.ogg",            "panel close swish"),
    ("impact-wood-heavy", "kenney_impact-sounds/impactWood_heavy_000.ogg",    "heavy wood hit"),
    ("impact-plank",      "kenney_impact-sounds/impactPlank_medium_001.ogg",  "plank knock"),
    ("impact-thud-soft",  "kenney_impact-sounds/impactSoft_heavy_000.ogg",    "soft heavy thud (body fall)"),
    ("impact-punch",      "kenney_impact-sounds/impactPunch_heavy_000.ogg",   "punchy hit / boom"),
    ("impact-metal",      "kenney_impact-sounds/impactMetal_medium_000.ogg",  "metal clank"),
    ("impact-light",      "kenney_impact-sounds/impactGeneric_light_000.ogg", "small generic tap"),
    ("wood-creak",        "kenney_rpg-audio/creak1.ogg",                      "wood creak"),
    ("door-open",         "kenney_rpg-audio/doorOpen_1.ogg",                  "wooden door opens"),
    ("door-close",        "kenney_rpg-audio/doorClose_4.ogg",                 "wooden door closes"),
    ("wood-chop",         "kenney_rpg-audio/chop.ogg",                        "axe chop"),
    ("swish-cloth",       "kenney_rpg-audio/cloth1.ogg",                      "cloth swish / wing-ish"),
    ("swish-fast",        "kenney_rpg-audio/clothBelt.ogg",                   "fast bright swish"),
]


def fmt_row(cols, widths):
    return "  ".join(str(c).ljust(w) if i == 0 else str(c).rjust(w) for i, (c, w) in enumerate(zip(cols, widths)))


def suggested_volume(category: str, lufs_v: float, tp: float) -> float:
    gain_db = (BED_TARGET_LUFS - lufs_v) if category == "bed" else (SFX_TARGET_DBTP - tp)
    return round(S.db2lin(gain_db), 3)


def render_synth(seed: int, only: str | None):
    os.makedirs(OUT_SFX, exist_ok=True)
    rows, meta, fails = [], [], []
    rendered = {}
    for name, cat, fn, use in bank(seed):
        if only and only not in name:
            continue
        y = fn()
        rendered[name] = y
        path = os.path.join(OUT_SFX, name + ".wav")
        finite = bool(np.all(np.isfinite(y)))
        if not finite:
            fails.append(f"{name}: non-finite samples")
            y = np.nan_to_num(y)
        S.write(path, y)
        dur = y.shape[0] / S.SR
        ch = 1 if y.ndim == 1 else y.shape[1]
        pk, tp = S.peak_db(y), S.true_peak_db(y)
        lu = S.lufs(y)
        cen = S.spectral_centroid(y)
        vol = suggested_volume(cat, lu, tp)
        if pk > 0.0:
            fails.append(f"{name}: clipping (peak {pk:.2f} dBFS)")
        if cat == "ui" and dur > 0.150:
            fails.append(f"{name}: UI sound longer than 150 ms ({dur*1000:.0f} ms)")
        if name.startswith("impact") and dur > 2.0 + 1e-6:
            fails.append(f"{name}: impact longer than 2 s")
        rows.append((name, f"{dur:.2f}", ch, f"{tp:.1f}", f"{lu:.1f}", f"{cen:.0f}", f"{vol:.3f}"))
        meta.append(dict(name=name, file=f"audio/sfx/{name}.wav", category=cat, duration_s=round(dur, 3), channels=ch,
                         peak_dbtp=round(tp, 2), lufs_integrated=round(lu, 2), spectral_centroid_hz=round(cen),
                         suggested_volume=vol, suggested_use=use))
    return rows, meta, fails, rendered


def spectral_checks(rendered, fails):
    notes = []
    for m in ("drone_calm", "drone_tense", "drone_dread", "drone_dawn"):
        if m in rendered:
            fr = S.band_energy_fraction(rendered[m], 2000)
            notes.append(f"{m}: {fr*100:.1f}% of energy below 2 kHz")
            if fr < 0.9:
                fails.append(f"{m}: only {fr*100:.0f}% of energy below 2 kHz")
    for w, up in (("whoosh_up", True), ("whoosh_down", False), ("riser", True)):
        if w in rendered:
            ct = S.centroid_track(rendered[w], 0.05 if w != "riser" else 0.25)
            ct = ct[~np.isnan(ct)]
            k = max(1, len(ct) // 3)
            a, b = float(np.mean(ct[:k])), float(np.mean(ct[-k:]))
            notes.append(f"{w}: centroid {a:.0f} Hz -> {b:.0f} Hz")
            if (b / a < 1.5) if up else (a / b < 1.5):
                fails.append(f"{w}: centroid does not sweep {'up' if up else 'down'} ({a:.0f} -> {b:.0f} Hz)")
    if "sub_drop" in rendered and S.spectral_centroid(rendered["sub_drop"]) > 150:
        fails.append("sub_drop: centroid above 150 Hz")
    if S._pyln is not None:
        d = max(abs(S.lufs(y, "builtin") - S.lufs(y, "pyloudnorm")) for y in rendered.values())
        notes.append(f"built-in LUFS vs pyloudnorm: max |delta| = {d:.2f} LU")
        if d > 0.3:
            fails.append(f"LUFS implementations disagree by {d:.2f} LU")
    else:
        notes.append("pyloudnorm not installed: using built-in BS.1770 meter")
    return notes


def copy_kenney():
    os.makedirs(OUT_KENNEY, exist_ok=True)
    entries, fails, rows = [], [], []
    for name, rel, use in KENNEY_PICKS:
        src = os.path.join(KENNEY_ROOT, rel)
        if not os.path.exists(src):
            fails.append(f"kenney: missing {src}")
            continue
        y = S.read(src)
        # trim trailing digital silence (< -70 dBFS), keep 20 ms
        env = np.max(np.abs(S._2d(y)), axis=1)
        nz = np.where(env > S.db2lin(-70))[0]
        if len(nz):
            y = y[: min(len(y), nz[-1] + S._n(0.02))]
        y = S.fade(y, 0.0, 0.005)
        y = S.normalize(y, -3.0, true_peak=True)
        path = os.path.join(OUT_KENNEY, name + ".wav")
        S.write(path, y)
        dur = y.shape[0] / S.SR
        ch = 1 if y.ndim == 1 else y.shape[1]
        tp, lu, cen = S.true_peak_db(y), S.lufs(y), S.spectral_centroid(y)
        rows.append((name, f"{dur:.2f}", ch, f"{tp:.1f}", f"{lu:.1f}", f"{cen:.0f}", f"{suggested_volume('sfx', lu, tp):.3f}"))
        entries.append(dict(name=name, file=f"audio/kenney/{name}.wav", source=f"assets/{rel}", source_pack=rel.split("/")[0],
                            author="Kenney (www.kenney.nl)", license="CC0-1.0",
                            license_url="https://creativecommons.org/publicdomain/zero/1.0/",
                            processing="decoded from OGG, resampled to 48 kHz, trailing silence trimmed, peak-normalised to -3 dBTP, 24-bit WAV",
                            duration_s=round(dur, 3), channels=ch, peak_dbtp=round(tp, 2), lufs_integrated=round(lu, 2),
                            suggested_use=use))
    manifest = dict(generated=_dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
                    license="CC0-1.0 (Creative Commons Zero) - free for personal, educational and commercial use, credit optional",
                    source_root=KENNEY_ROOT, sample_rate=S.SR, files=entries)
    with open(os.path.join(OUT_KENNEY, "MANIFEST.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    if len(entries) != len(KENNEY_PICKS):
        fails.append(f"kenney: expected {len(KENNEY_PICKS)} files, wrote {len(entries)}")
    return rows, fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=2024)
    ap.add_argument("--only", default=None, help="render only generators whose name contains this")
    ap.add_argument("--skip-kenney", action="store_true")
    args = ap.parse_args()

    rows, meta, fails, rendered = render_synth(args.seed, args.only)
    notes = spectral_checks(rendered, fails)
    with open(os.path.join(OUT_SFX, "bank.json"), "w") as f:
        json.dump(dict(generated=_dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"), seed=args.seed,
                       sample_rate=S.SR, bed_target_lufs=BED_TARGET_LUFS, sfx_target_dbtp=SFX_TARGET_DBTP,
                       note="suggested_volume = Remotion <Audio volume> that puts beds at bed_target_lufs and one-shots at sfx_target_dbtp",
                       files=meta), f, indent=2)

    widths = (18, 7, 2, 9, 7, 9, 7)
    hdr = ("name", "dur s", "ch", "peak dBTP", "LUFS", "centroid", "vol@tgt")
    print(f"\nSynthesized bank -> {OUT_SFX}")
    print(fmt_row(hdr, widths)); print("-" * (sum(widths) + 2 * (len(widths) - 1)))
    for r in rows:
        print(fmt_row(r, widths))
    print("(LUFS of clips < 400 ms is energy over a 400 ms window; vol@tgt = Remotion volume for -30 LUFS beds / -6 dBTP one-shots)")

    if not args.skip_kenney and not args.only:
        krows, kfails = copy_kenney()
        fails += kfails
        print(f"\nKenney CC0 picks -> {OUT_KENNEY} (MANIFEST.json)")
        print(fmt_row(hdr, widths)); print("-" * (sum(widths) + 2 * (len(widths) - 1)))
        for r in krows:
            print(fmt_row(r, widths))

    print("\nChecks:")
    for n_ in notes:
        print("  -", n_)
    if fails:
        print("\nFAILED:")
        for f_ in fails:
            print("  x", f_)
        sys.exit(1)
    print(f"  - all {len(rows)} synthesized clips finite, no clipping, UI <= 150 ms, impacts <= 2 s: OK")


if __name__ == "__main__":
    main()
