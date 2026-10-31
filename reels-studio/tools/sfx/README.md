# SFX toolkit (`tools/sfx`)

Procedural sound design for the vertical reels: every sound is synthesized in Python
(numpy + scipy + soundfile, nothing downloaded, no API keys), plus a curated set of
CC0 one-shots from the Kenney packs. Output is 48 kHz WAV that Remotion loads with
`staticFile("audio/...")`.

```
tools/sfx/
  synth.py          the library (generators + helpers + metering)
  render_bank.py    renders the demo bank, copies Kenney picks, prints the table, runs checks
  README.md         this file
public/audio/sfx/     27 synthesized demo WAVs + bank.json (durations, LUFS, suggested volume)
public/audio/kenney/  20 Kenney CC0 one-shots (48 kHz / 24-bit) + MANIFEST.json
```

## Quick start

```bash
cd reels-studio/tools/sfx
python3 -I render_bank.py              # ~25 s: renders everything, prints table + checks
python3 -I render_bank.py --seed 7     # new takes of every random element
python3 -I render_bank.py --only drone # subset, skips the Kenney copy
```

Use the library from your own render script (e.g. one bed per scene, exact length):

```python
import sys; sys.path.insert(0, "tools/sfx")
import synth as S

bed = S.mix([
    (S.forest_ambience(42.0, seed=1),            0.0,  0.0),
    (S.bird_chirps(42.0, density=0.4, seed=2),   0.0, -6.0),
    (S.drone(42.0, 55, "calm", seed=3),          0.0, -4.0),
], duration=42.0)
bed = S.normalize(bed, -3.0)
print(S.lufs(bed), S.true_peak_db(bed))          # integrated LUFS, dBTP
S.write("public/audio/scene1_bed.wav", bed)

# a tree falls at 12.4 s, wings pass at 20 s
events = S.mix([
    (S.tree_fall(seed=5),               12.4, -4.0),
    (S.wing_flap(4, 0.5, seed=6),       20.0, -8.0),
], duration=42.0)
S.write("public/audio/scene1_events.wav", events)
```

## Conventions

* Sample rate `S.SR = 48000`, float32. Mono clips are shape `(n,)`, stereo `(n, 2)`.
  Beds/ambiences default to stereo, one-shots to mono (most take `stereo=True`).
* Every generator accepts `seed` (int or `np.random.Generator`). Same seed = identical audio;
  omit it for a fresh take. `ui_*` sounds have a fixed default seed so they are stable.
* Returned levels: one-shots are peak-normalised to **-1 dBFS**, beds to **-3 dBFS**.
  Set the actual level with `mix(..., gain_db)` or the Remotion `volume` prop (see loudness).
* All helpers accept mono or stereo and never resample: keep everything at 48 kHz.

## Generators

### Beds and ambiences (stereo by default)

| Function | Parameters | What it is |
|---|---|---|
| `drone(duration=10, root_hz=55, mood='calm', stereo=True, seed=None, reverb_wet=0.35)` | `mood` in `calm`, `tense`, `dread`, `dawn` | Cinematic pad: per interval two detuned polyBLEP saws + a sine, with slow random pitch drift and breathing; all through a slowly LFO-swept resonant low-pass, soft saturation, long dark reverb. `calm` = root/5th/octave, `tense` = adds minor third + minor-third shimmer partials 3-4 octaves up, `dread` = minor 2nd + tritone, very dark (450 Hz), sub an octave down, brown-noise bed, `dawn` = major stack, brighter, filter slowly opens, major-third shimmer. Energy sits below 2 kHz (verified). |
| `wind(duration=10, intensity=0.5, stereo=True, seed=None, gust_rate=0.12)` | `intensity` 0..1 | Pink noise through a gust-driven low-pass (body), brown rumble, resonant whistle that only appears in strong gusts, air hiss. Gusts are a shared slow random; channels decorrelated. 0.2 breeze, 0.5 steady, 0.9 storm. |
| `forest_ambience(duration=10, stereo=True, seed=None, wind_intensity=0.3, rustle_rate=0.45)` | | `wind` + sparse panned leaf rustles (crackle-modulated high-band noise bursts) + distant low hum. |
| `night_ambience(duration=10, stereo=True, seed=None, crickets=3, wind_intensity=0.18)` | | Darker, quieter wind (low-passed 650 Hz), soft mid air, deeper hum, 2-4 crickets (pulse trains on a 4-5.4 kHz carrier with vibrato) at different distances/pans. |
| `fire_crackle(duration=10, intensity=0.5, stereo=True, seed=None)` | `intensity` 0..1 | Flickering brown-noise bed + mid roar + Poisson crackle pops (1-9 ms decaying sine/noise) with occasional bigger snaps, panned; 3-29 pops/s. |
| `bird_chirps(duration=10, density=0.5, stereo=True, seed=None)` | `density` 0.05..1 | Dawn chorus: 2-7 birds, four species built from FM chirps (whistle, trill, chip, warble), each with a pan, a distance (level, low-pass, reverb send). |

### One-shots (mono by default)

| Function | Parameters | What it is |
|---|---|---|
| `whoosh(duration=0.6, pitch_dir='up', stereo=False, seed=None, lo_hz=220, hi_hz=3800)` | `'up'`/`'down'` | Noise through a band-pass sweeping lo->hi (or hi->lo) + air + body layers. Envelope peaks at 62 % for `up` (land the cut on the peak), 36 % for `down`. Stereo adds auto-pan. |
| `wing_flap(count=3, interval=0.55, stereo=False, seed=None, size=1.0)` | | Heavy wings: each flap = filter-swept pink-noise whoosh + sub thump (72->36 Hz) + faint membrane snap, with timing/level jitter; `size>1` = bigger creature. |
| `impact(kind='thud', size=1.0, stereo=False, seed=None, room=0.12)` | `thud`, `wood`, `stone`, `metal` | `thud` = pitch-dropping sine + sub + low noise punch, saturated. `wood` = burst + 4 modal resonances + thump (plank/knock). `stone` = grit + rubble + inharmonic low modes + thump. `metal` = free-bar partial ratios (1, 2.76, 5.40, 8.93, 13.3) in detuned pairs for beating, bright strike. `size` lowers pitch / lengthens decay. |
| `tree_fall(stereo=True, seed=None)` | | ~4.6 s set piece: stick-slip creak (pitch-bent saw, formant band-passes) with small cracks, the snap, falling whoosh, crash (thud + wood + stone), decaying cluster of branch knocks, debris noise, rumble, short outdoor reverb. |
| `riser(duration=3, start_hz=100, end_hz=2000, stereo=False, seed=None, pulse=0.25)` | `pulse` 0..1 tremolo depth | Rising band-passed noise + two detuned saws gliding start->end with a tracking low-pass, accelerating tremolo (4->18 Hz), loudness ramp; ends hard at the peak (30 ms fade). |
| `sub_drop(duration=1.6, start_hz=90, end_hz=32, seed=None)` | | Sine glide 90->32 Hz with soft saturation (harmonics for small speakers), transient click, exponential decay. |
| `heartbeat(bpm=60, duration=4, seed=None)` | | Lub-dub: two pitch-dropping thumps per beat (S2 softer and a bit higher), 2nd harmonic for translation, low-passed 300 Hz, tiny jitter. |
| `roar(duration=1.5, pitch_hz=70, stereo=False, seed=None)` | | Creature: saw + breath noise, rise-then-fall pitch contour, irregular growl AM (24-31 Hz), three moving formants (aah->ooh), sub octave, saturation, reverb. |

### UI (all < 150 ms, mono, fixed seed)

| Function | Length | Character |
|---|---|---|
| `ui_tick(seed=0)` | 28 ms | soft mechanical tick (2.3 kHz + 4.1 kHz rings + filtered transient) |
| `ui_pop(seed=0)` | 80 ms | rounded pop: sine 1100->520 Hz exponential pitch drop + soft click |
| `ui_slide(seed=0)` | 130 ms | soft swipe: pink noise through a rising band-pass 900->3200 Hz |
| `counter_tick(seed=0)` | 22 ms | woody micro-tick (1.45/2.9 kHz modes), duller than `ui_tick`, made to repeat fast |
| `digit_flip(seed=0)` | 95 ms | split-flap: release click, plastic flap noise, landing click, faint 340 Hz body |
| `alarm_beep(freq=880, duration=0.12, count=1, gap=0.08)` | 120 ms per beep | clean sine + soft 2nd/3rd harmonics, 6 ms raised-cosine edges; `count>1` repeats |

### Helpers and metering

| Function | Purpose |
|---|---|
| `normalize(x, peak_db=-1.0, true_peak=False)` | scale to a sample peak (or 4x-oversampled true peak) in dBFS |
| `fade(x, in_s, out_s)` | raised-cosine fades |
| `mix(tracks, duration=None, stereo=None)` | `tracks = [(array, start_s, gain_db), ...]`; stereo out if any input is stereo; length = `duration` or last clip end; no normalisation |
| `concat(parts, gap_s=0)` | join clips with optional silence |
| `pan(x, position)` / `to_stereo(x)` / `to_mono(x)` | constant-power pan (-1..1), channel conversion |
| `reverb(x, rt60=1.5, wet=0.3, damp_hz=5000, predelay=0.01, stereo_out=None, seed=0)` | synthetic diffuse reverb (decaying-noise IR, FFT convolution); output includes the tail |
| `write(path, x, subtype='PCM_24')` / `read(path)` | 48 kHz WAV out (creates folders, warns + clips if > 0 dBFS); read + resample any soundfile format |
| `lufs(x, method='auto')` | integrated loudness, ITU-R BS.1770-4 (K-weighting, 400 ms blocks, -70 LUFS absolute + -10 LU relative gates). Uses pyloudnorm when installed, else the built-in meter; they agree within 0.1 LU. Clips shorter than 400 ms are zero-padded, so for UI blips compare peaks instead. |
| `lufs_short_term(x, hop_s=0.1)` | 3 s short-term loudness track (for the -16 LUFS voice check) |
| `true_peak_db(x)` / `peak_db(x)` | dBTP (4x oversampled) / sample peak |
| `spectral_centroid(x)` / `centroid_track(x, frame_s)` / `band_energy_fraction(x, hi_hz, lo_hz=0)` | spectral descriptors used by the checks |
| `db2lin`, `lin2db`, `silence(duration, stereo)` | small utilities |

## Sound table: what to use where

All files live in `public/audio/sfx/` (synthesized) or `public/audio/kenney/` (CC0).
`vol` is the Remotion `volume` that lands the file on target (beds -30 LUFS, one-shots -6 dBTP);
exact per-file values are printed by `render_bank.py` and stored in `bank.json` / `MANIFEST.json`.

| Moment in the video | First choice | Alternatives | Notes |
|---|---|---|---|
| HUD element pops in | `sfx/ui_pop.wav` | `kenney/ui-pluck.wav`, `kenney/ui-click.wav` | one per element, never per frame; stagger 40-60 ms if several |
| Rule dock slides in / docks | `sfx/ui_slide.wav` then `kenney/ui-drop.wav` on landing | `sfx/impact_wood.wav` at -14 dB for a heavier dock | slide starts with the motion, drop lands on the ease-out |
| Counter tick (numbers rolling) | `sfx/counter_tick.wav` | `kenney/ui-tick.wav` | max ~12 ticks/s, each at -16 to -20 dBTP; drop every other tick on fast counts |
| Countdown digit flip | `sfx/digit_flip.wav` | `sfx/ui_tick.wav` | add `sfx/heartbeat.wav` (60-90 bpm) under the last 5 s |
| Caption pop (word highlight) | none | `sfx/ui_tick.wav` at -24 dBTP or quieter | default to silence; if used, only on emphasised words, never on every word |
| Confirm / correct | `kenney/ui-confirm.wav` | `sfx/ui_pop.wav` | |
| Wrong / warning | `sfx/alarm_beep.wav` (count=2) | `sfx/impact_metal.wav` at -12 dB | |
| Scene transition | `sfx/whoosh_up.wav` into the cut, `sfx/whoosh_down.wav` out | `kenney/swish-fast.wav` | align the whoosh peak (62 % of the file for `up`) with the cut |
| Big reveal | `sfx/riser.wav` -> `sfx/sub_drop.wav` + `sfx/impact_thud.wav` on the hit | `kenney/impact-punch.wav` | riser ends hard: start the drop exactly at riser end |
| Tree fall | `sfx/tree_fall.wav` (crash lands at 2.75 s) | `kenney/wood-creak.wav` + `kenney/impact-wood-heavy.wav` | place so the 2.75 s crash hits the frame of the fall |
| Wings | `sfx/wing_flap.wav` (3 flaps @ 0.55 s) | `kenney/swish-cloth.wav` per flap | regenerate with `wing_flap(count, interval)` to match the animation |
| Dawn birds | `sfx/bird_chirps.wav` over `sfx/forest_ambience.wav` | | birds -6 dB under the forest bed |
| Fire | `sfx/fire_crackle.wav` | | `intensity` 0.2 embers .. 0.9 blaze |
| Night | `sfx/night_ambience.wav` | + `sfx/drone_dread.wav` at -8 dB for menace | |
| Underscore | `sfx/drone_calm.wav`, `drone_tense`, `drone_dread`, `drone_dawn` | | regenerate at scene length rather than looping; crossfade 1.5 s between moods |
| Creature | `sfx/roar.wav` | `kenney/impact-thud-soft.wav` for footsteps | |
| Doors / wood | `kenney/door-open.wav`, `door-close.wav`, `wood-chop.wav`, `impact-plank.wav` | `sfx/impact_wood.wav` | |

### Kenney CC0 picks (`public/audio/kenney/`, see MANIFEST.json)

ui-click, ui-tick, ui-select, ui-confirm, ui-drop, ui-pluck, ui-open, ui-close,
impact-wood-heavy, impact-plank, impact-thud-soft, impact-punch, impact-metal, impact-light,
wood-creak, door-open, door-close, wood-chop, swish-cloth, swish-fast.
Source: `kenney_interface-sounds`, `kenney_impact-sounds`, `kenney_rpg-audio`
(Creative Commons Zero; credit "Kenney (www.kenney.nl)" is optional but appreciated).
Processing: decoded from OGG, resampled to 48 kHz, trailing silence trimmed, peak-normalised to -3 dBTP, 24-bit WAV.

## Loudness guidelines

Targets for a vertical short-form master (phone speakers first, headphones second):

| Element | Target | How to check |
|---|---|---|
| Voice | **-16 LUFS short-term** (3 s window), peaks <= -3 dBTP | `S.lufs_short_term(voice).max()` and `S.true_peak_db(voice)` |
| Ambience bed (wind, forest, fire, drone) | **-32 to -28 LUFS** integrated, measured on the bed alone | `S.lufs(bed)`; duck a further 3-6 dB under dense narration |
| SFX one-shots | **peaks -8 to -4 dBTP** (UI blips -16 to -10 dBTP, caption ticks <= -24 dBTP) | `S.true_peak_db(clip * volume)` |
| Final master | **-14 LUFS integrated, -1 dBTP** | `S.lufs(master)`, `S.true_peak_db(master)` |

Translating to Remotion `volume` (linear): `volume = 10 ** (gain_db / 20)`.

* Beds are delivered peak-normalised to -3 dBTP and measure about -13 to -18 LUFS on their own
  (dense signals), so a bed needs roughly **-17 to -12 dB** -> `volume` 0.14-0.25 to sit at -30 LUFS.
  Use the `vol@tgt` column / `suggested_volume` in `bank.json`; it is computed from the measured LUFS.
* One-shots are delivered at -1 dBTP, so `volume` 0.5 (-6 dB) puts them at -7 dBTP; UI sounds want
  0.2-0.3 (-14 to -10 dB).
* Voice from `tts_pipeline.py` is peak-normalised to -1 dBTP; it typically needs -3 to -6 dB to read -16 LUFS
  short-term. Measure, do not guess.
* Mastering: sum voice + beds + SFX, then `S.lufs()`; apply the offset to reach -14 LUFS, then confirm
  `true_peak_db <= -1`. If the peak is the limiting factor, lower the SFX (they carry the peaks), not the voice.

```python
voice = S.read("out/voice.wav")                     # -1 dBTP from tts_pipeline
v_gain = -16.0 - float(np.nanmax(S.lufs_short_term(voice)))
master = S.mix([(voice, 0, v_gain), (bed, 0, -30.0 - S.lufs(bed)), (events, 0, -6.0)], duration=42.0)
master = master * S.db2lin(-14.0 - S.lufs(master))
assert S.true_peak_db(master) <= -1.0
```

```tsx
// Remotion: beds at the suggested volume, one-shot on a frame
<Audio src={staticFile("audio/sfx/forest_ambience.wav")} volume={0.17} />
<Sequence from={fps * 12.4}>
  <Audio src={staticFile("audio/sfx/tree_fall.wav")} volume={0.5} />
</Sequence>
```

## Verification done by `render_bank.py`

* every clip finite, no sample above 0 dBFS, written as 24-bit WAV
* UI sounds <= 150 ms, impacts <= 2 s
* drones: >= 90 % of spectral energy below 2 kHz (measured ~100 %)
* whoosh up/down and riser: spectral centroid sweeps in the expected direction (first vs last third)
* sub_drop centroid < 150 Hz
* built-in LUFS meter vs pyloudnorm within 0.3 LU (measured <= 0.1)
* 20 Kenney files present, converted and listed in MANIFEST.json

## Notes and limits

* No real recordings except the Kenney picks; everything else is synthesis, so re-render with another
  `seed` if a take feels wrong, or tweak the parameters rather than EQing the result.
* `reverb()` is a synthetic diffuse tail (no early reflections); good for beds and tails, not for
  convincing room placement of dialogue.
* `lufs()` on clips shorter than 400 ms is a padded-window figure; use peaks for UI blips.
* `.gitignore` ignores only `public/audio/*.wav`; the `sfx/` and `kenney/` subfolders are regenerable
  with `render_bank.py`, so add `public/audio/**/*.wav` to `.gitignore` if you do not want them tracked.
