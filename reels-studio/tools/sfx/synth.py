#!/usr/bin/env python3
"""
synth.py - procedural sound-design toolkit for the reels (48 kHz, float32).

Every generator returns a float32 numpy array at SR = 48000 Hz:
  * mono  -> shape (n,)
  * stereo -> shape (n, 2)   (ambiences / drones default to stereo, one-shots to mono)

Generators are deterministic when you pass `seed`; otherwise each call is a new take.
Levels: one-shots return peak-normalised to -1 dBFS, beds/ambiences to -3 dBFS. Set the
final level with mix(..., gain_db) or in Remotion (<Audio volume={...} />). See README.md.

Dependencies: numpy, scipy, soundfile. pyloudnorm is used for lufs() if installed,
otherwise a built-in ITU-R BS.1770-4 implementation is used (they agree within ~0.1 LU).
"""
from __future__ import annotations

import os
import math
import warnings
from typing import Iterable, Sequence

import numpy as np
from scipy import signal
import soundfile as sf

SR = 48000
TWO_PI = 2.0 * math.pi

__all__ = [
    "SR",
    # beds / ambiences
    "drone", "wind", "forest_ambience", "night_ambience", "fire_crackle", "bird_chirps",
    # one-shots
    "whoosh", "wing_flap", "impact", "tree_fall", "riser", "sub_drop", "heartbeat", "roar",
    "ui_tick", "ui_pop", "ui_slide", "counter_tick", "digit_flip", "alarm_beep",
    # helpers
    "normalize", "fade", "mix", "write", "read", "lufs", "lufs_short_term", "true_peak_db",
    "peak_db", "spectral_centroid", "centroid_track", "band_energy_fraction",
    "reverb", "pan", "to_stereo", "to_mono", "db2lin", "lin2db", "concat", "silence",
]

# --------------------------------------------------------------------------------------
# basic utilities
# --------------------------------------------------------------------------------------

def db2lin(db: float) -> float:
    return float(10.0 ** (db / 20.0))


def lin2db(x: float, floor: float = -120.0) -> float:
    x = float(abs(x))
    return max(floor, 20.0 * math.log10(x)) if x > 0 else floor


def _rng(seed) -> np.random.Generator:
    return seed if isinstance(seed, np.random.Generator) else np.random.default_rng(seed)


def _n(duration: float) -> int:
    return max(1, int(round(duration * SR)))


def _t(duration: float) -> np.ndarray:
    return np.arange(_n(duration), dtype=np.float64) / SR


def _f32(x) -> np.ndarray:
    return np.ascontiguousarray(np.asarray(x, dtype=np.float32))


def _2d(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x)
    return x[:, None] if x.ndim == 1 else x


def _rms(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float64)
    return float(np.sqrt(np.mean(x * x))) if x.size else 0.0


def silence(duration: float, stereo: bool = False) -> np.ndarray:
    n = _n(duration)
    return np.zeros((n, 2) if stereo else n, dtype=np.float32)


def to_stereo(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x)
    if x.ndim == 2 and x.shape[1] == 2:
        return x
    if x.ndim == 2:
        x = x[:, 0]
    return np.stack([x, x], axis=1)


def to_mono(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x)
    return x if x.ndim == 1 else x.mean(axis=1)


def pan(x: np.ndarray, position: float) -> np.ndarray:
    """Constant-power pan of a mono signal. position: -1 (left) .. 0 (centre) .. +1 (right)."""
    x = to_mono(x)
    a = (np.clip(position, -1.0, 1.0) + 1.0) * 0.25 * math.pi
    return _f32(np.stack([x * math.cos(a), x * math.sin(a)], axis=1))


def concat(parts: Sequence[np.ndarray], gap_s: float = 0.0) -> np.ndarray:
    """Concatenate clips (any mix of mono/stereo) with an optional gap of silence."""
    stereo = any(_2d(p).shape[1] == 2 for p in parts)
    out = []
    gap = silence(gap_s, stereo) if gap_s > 0 else None
    for i, p in enumerate(parts):
        out.append(to_stereo(p) if stereo else to_mono(p))
        if gap is not None and i < len(parts) - 1:
            out.append(gap)
    return _f32(np.concatenate(out, axis=0))


# --------------------------------------------------------------------------------------
# oscillators, noise, envelopes
# --------------------------------------------------------------------------------------

def _phase(freq, n: int | None = None, phase0: float = 0.0) -> np.ndarray:
    """Instantaneous phase (radians) for a scalar or per-sample frequency."""
    if np.isscalar(freq):
        if n is None:
            raise ValueError("n required for scalar frequency")
        f = np.full(n, float(freq))
    else:
        f = np.asarray(freq, dtype=np.float64)
    ph = np.cumsum(f) * (TWO_PI / SR)
    ph = np.concatenate([[0.0], ph[:-1]]) + phase0
    return ph


def _sine(freq, n: int | None = None, phase0: float = 0.0) -> np.ndarray:
    return np.sin(_phase(freq, n, phase0))


def _saw(freq, n: int | None = None, phase0: float = 0.0) -> np.ndarray:
    """PolyBLEP anti-aliased sawtooth (-1..1) for a scalar or per-sample frequency."""
    ph = _phase(freq, n, phase0)
    f = np.full(len(ph), float(freq)) if np.isscalar(freq) else np.asarray(freq, dtype=np.float64)
    t = (ph / TWO_PI) % 1.0
    dt = np.maximum(f, 1e-6) / SR
    y = 2.0 * t - 1.0
    # polyBLEP correction around the discontinuity
    m = t < dt
    xx = t[m] / dt[m]
    y[m] -= (xx + xx - xx * xx - 1.0)
    m2 = t > (1.0 - dt)
    xx = (t[m2] - 1.0) / dt[m2]
    y[m2] -= (xx * xx + xx + xx + 1.0)
    return y


def _noise(n: int, rng, color: str = "white") -> np.ndarray:
    """Unit-RMS noise. color: 'white' | 'pink' (1/f power) | 'brown' (1/f^2 power)."""
    w = rng.standard_normal(n)
    if color == "white":
        return w
    alpha = {"pink": 0.5, "brown": 1.0}[color]
    X = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f = np.maximum(f, 20.0) / 20.0          # floor at 20 Hz so brown noise does not drift
    X = X / (f ** alpha)
    y = np.fft.irfft(X, n)
    return y / (_rms(y) + 1e-12)


def _slow_random(n: int, rng, rate_hz: float, octaves: int = 1) -> np.ndarray:
    """Smooth random modulation in roughly -1..1, bandwidth ~rate_hz (for LFO-like drift)."""
    w = rng.standard_normal(n)
    sos = signal.butter(2, max(0.01, rate_hz), "low", fs=SR, output="sos")
    y = signal.sosfiltfilt(sos, w)
    y = y / (np.std(y) + 1e-12) * 0.5
    return np.clip(y, -1.0, 1.0)


def _exp_decay(n: int, tau_s: float, t0_s: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR - t0_s
    return np.where(t >= 0, np.exp(-np.maximum(t, 0) / max(tau_s, 1e-5)), 0.0)


def _ramp(n: int, a: float, b: float, curve: float = 1.0) -> np.ndarray:
    x = np.linspace(0.0, 1.0, n)
    return a + (b - a) * (x ** curve)


def _exp_ramp(n: int, a: float, b: float) -> np.ndarray:
    return np.geomspace(max(a, 1e-6), max(b, 1e-6), n)


def _adsr(n: int, a: float, d: float, s: float, r: float, curve: float = 2.0) -> np.ndarray:
    """Attack/decay/sustain/release envelope in seconds, fitted to n samples."""
    na, nd, nr = _n(a), _n(d), _n(r)
    ns = max(0, n - na - nd - nr)
    att = np.linspace(0, 1, na) ** (1.0 / curve)
    dec = 1.0 - (1.0 - s) * (np.linspace(0, 1, nd) ** (1.0 / curve))
    sus = np.full(ns, s)
    rel = s * (1.0 - np.linspace(0, 1, nr)) ** curve
    env = np.concatenate([att, dec, sus, rel])
    if len(env) < n:
        env = np.concatenate([env, np.zeros(n - len(env))])
    return env[:n]


def _window(n: int, peak_pos: float = 0.5, power: float = 1.0) -> np.ndarray:
    """Asymmetric raised-cosine 'bell' with its peak at peak_pos (0..1)."""
    k = int(np.clip(round(n * peak_pos), 1, n - 1))
    up = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, k))
    dn = 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, n - k))
    return np.concatenate([up, dn]) ** power


def _sat(x: np.ndarray, drive: float = 1.5) -> np.ndarray:
    """Soft saturation (tanh), unity gain for small signals."""
    return np.tanh(x * drive) / math.tanh(min(drive, 20.0)) if drive > 0 else x


# --------------------------------------------------------------------------------------
# filters
# --------------------------------------------------------------------------------------

def _butter(x: np.ndarray, cutoff, kind: str = "low", order: int = 2, zero_phase: bool = False):
    nyq = 0.49 * SR
    if np.isscalar(cutoff):
        cutoff = float(np.clip(cutoff, 5.0, nyq))
    else:
        cutoff = [float(np.clip(cutoff[0], 5.0, nyq)), float(np.clip(cutoff[1], 6.0, nyq))]
        if cutoff[1] <= cutoff[0]:
            cutoff[1] = min(nyq, cutoff[0] * 1.1)
    sos = signal.butter(order, cutoff, kind, fs=SR, output="sos")
    return (signal.sosfiltfilt if zero_phase else signal.sosfilt)(sos, x, axis=0)


def _lp(x, cutoff, order=2):
    return _butter(x, cutoff, "low", order)


def _hp(x, cutoff, order=2):
    return _butter(x, cutoff, "high", order)


def _bp(x, lo, hi, order=2):
    return _butter(x, [lo, hi], "band", order)


def _biquad_sos(kind: str, f0: np.ndarray, q: float) -> np.ndarray:
    """RBJ cookbook biquads, vectorised over f0 -> (len(f0), 6) sos rows."""
    f0 = np.clip(np.asarray(f0, dtype=np.float64), 10.0, 0.45 * SR)
    w0 = TWO_PI * f0 / SR
    cs, sn = np.cos(w0), np.sin(w0)
    alpha = sn / (2.0 * q)
    if kind == "low":
        b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0
    elif kind == "high":
        b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0
    elif kind == "band":          # constant 0 dB peak gain
        b0 = alpha; b1 = np.zeros_like(alpha); b2 = -alpha
    else:
        raise ValueError(kind)
    a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha
    sos = np.stack([b0, b1, b2, a0, a1, a2], axis=1) / a0[:, None]
    return sos


def _sweep_filter(x: np.ndarray, cutoff, kind: str = "low", q: float = 0.707, block: int = 64,
                  passes: int = 1) -> np.ndarray:
    """Time-varying 2-pole filter (block-wise coefficient update, state carried across blocks).

    cutoff: scalar or per-sample array of Hz. kind: 'low' | 'high' | 'band'. passes>1 steepens.
    Works on mono (n,) or multichannel (n, c)."""
    x = np.asarray(x, dtype=np.float64)
    n = x.shape[0]
    c = np.full(n, float(cutoff)) if np.isscalar(cutoff) else np.asarray(cutoff, dtype=np.float64)
    nb = int(math.ceil(n / block))
    centres = np.array([c[min(n - 1, i * block + block // 2)] for i in range(nb)])
    sos_all = _biquad_sos(kind, centres, q)
    y = x.copy()
    for _ in range(passes):
        out = np.empty_like(y)
        zi = np.zeros((1, 2) if y.ndim == 1 else (1, 2, y.shape[1]))
        for i in range(nb):
            s, e = i * block, min(n, (i + 1) * block)
            out[s:e], zi = signal.sosfilt(sos_all[i:i + 1], y[s:e], axis=0, zi=zi)
        y = out
    return y


def _modes(n: int, freqs: Sequence[float], taus: Sequence[float], amps: Sequence[float],
           rng=None, t0_s: float = 0.0) -> np.ndarray:
    """Sum of exponentially decaying sines (modal resonator)."""
    t = np.arange(n) / SR - t0_s
    y = np.zeros(n)
    for f, tau, a in zip(freqs, taus, amps):
        if f >= 0.49 * SR:
            continue
        ph = rng.uniform(0, TWO_PI) if rng is not None else 0.0
        y += a * np.where(t >= 0, np.exp(-np.maximum(t, 0) / tau), 0.0) * np.sin(TWO_PI * f * t + ph)
    return y


# --------------------------------------------------------------------------------------
# reverb (synthetic exponentially-decaying noise IR, FFT convolution)
# --------------------------------------------------------------------------------------

def _make_ir(rt60: float, damp_hz: float, rng, predelay: float = 0.0) -> np.ndarray:
    length = _n(rt60 * 1.1 + predelay + 0.05)
    t = np.arange(length) / SR
    tau = rt60 / 6.91
    bright = _lp(rng.standard_normal(length), damp_hz, 2) * np.exp(-t / (tau * 0.5))
    dark = _lp(rng.standard_normal(length), max(200.0, damp_hz * 0.3), 2) * np.exp(-t / tau)
    ir = bright + dark
    ir[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))      # no clicky onset
    if predelay > 0:
        ir = np.concatenate([np.zeros(_n(predelay)), ir])
    return ir / (np.sqrt(np.sum(ir ** 2)) + 1e-12)


def reverb(x: np.ndarray, rt60: float = 1.5, wet: float = 0.3, damp_hz: float = 5000.0,
           predelay: float = 0.01, stereo_out: bool | None = None, seed=0) -> np.ndarray:
    """Simple diffuse reverb. Returns dry + wet*tail; output is longer than the input by the tail.

    Mono in -> mono out (or stereo if stereo_out=True); stereo in -> stereo out (decorrelated)."""
    rng = _rng(seed)
    x2 = _2d(np.asarray(x, dtype=np.float64))
    chans = x2.shape[1]
    if stereo_out is None:
        stereo_out = chans == 2
    out_ch = 2 if stereo_out else 1
    irs = [_make_ir(rt60, damp_hz, rng, predelay) for _ in range(out_ch)]
    n_out = x2.shape[0] + len(irs[0]) - 1
    out = np.zeros((n_out, out_ch))
    for ch in range(out_ch):
        src = x2[:, ch] if chans == 2 else x2[:, 0]
        out[: x2.shape[0], ch] += src
        out[:, ch] += wet * signal.fftconvolve(src, irs[ch])
    return _f32(out if out_ch == 2 else out[:, 0])


# --------------------------------------------------------------------------------------
# helpers: normalize / fade / mix / write / read
# --------------------------------------------------------------------------------------

def normalize(x: np.ndarray, peak_db: float = -1.0, true_peak: bool = False) -> np.ndarray:
    """Scale so the (sample or 4x-oversampled true) peak sits at peak_db dBFS."""
    x = np.asarray(x, dtype=np.float64)
    p = db2lin(true_peak_db(x)) if true_peak else float(np.max(np.abs(x))) if x.size else 0.0
    if p <= 1e-9:
        return _f32(x)
    return _f32(x * (db2lin(peak_db) / p))


def fade(x: np.ndarray, in_s: float = 0.01, out_s: float = 0.01) -> np.ndarray:
    """Raised-cosine fade in/out (seconds). Works on mono or stereo."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = x.shape[0]
    ni, no = min(n, _n(in_s)) if in_s > 0 else 0, min(n, _n(out_s)) if out_s > 0 else 0
    env = np.ones(n)
    if ni > 0:
        env[:ni] *= 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, ni))
    if no > 0:
        env[n - no:] *= 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, no))
    return _f32(x * env if x.ndim == 1 else x * env[:, None])


def mix(tracks: Iterable[tuple], duration: float | None = None, stereo: bool | None = None) -> np.ndarray:
    """Mix clips: tracks = [(array, start_s, gain_db), ...]. Output is stereo if any input is.
    Output length = duration (s) if given, else the end of the latest clip. No normalisation."""
    tracks = [(np.asarray(a), float(s), float(g)) for a, s, g in tracks]
    if stereo is None:
        stereo = any(_2d(a).shape[1] == 2 for a, _, _ in tracks)
    ch = 2 if stereo else 1
    ends = [_n(s) + a.shape[0] for a, s, _ in tracks]
    n = _n(duration) if duration is not None else (max(ends) if ends else 1)
    out = np.zeros((n, ch))
    for a, s, g in tracks:
        a2 = _2d(a.astype(np.float64))
        if ch == 2 and a2.shape[1] == 1:
            a2 = np.repeat(a2, 2, axis=1)
        elif ch == 1 and a2.shape[1] == 2:
            a2 = a2.mean(axis=1, keepdims=True)
        s0 = _n(s) if s > 0 else 0
        e = min(n, s0 + a2.shape[0])
        if e > s0:
            out[s0:e] += a2[: e - s0] * db2lin(g)
    return _f32(out if ch == 2 else out[:, 0])


def write(path: str, x: np.ndarray, subtype: str = "PCM_24") -> str:
    """Write a 48 kHz WAV. Hard-clips (with a warning) if anything exceeds 0 dBFS."""
    x = np.asarray(x, dtype=np.float32)
    if not np.all(np.isfinite(x)):
        raise ValueError(f"{path}: non-finite samples")
    p = float(np.max(np.abs(x))) if x.size else 0.0
    if p > 1.0:
        warnings.warn(f"{path}: peak {lin2db(p):.2f} dBFS > 0, clipping")
        x = np.clip(x, -1.0, 1.0)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sf.write(path, x, SR, subtype=subtype)
    return path


def read(path: str, to_sr: int = SR) -> np.ndarray:
    """Read any soundfile-supported file, resampled to 48 kHz float32 (mono or stereo)."""
    d, sr = sf.read(path, always_2d=True, dtype="float64")
    if sr != to_sr:
        g = math.gcd(sr, to_sr)
        d = signal.resample_poly(d, to_sr // g, sr // g, axis=0)
    return _f32(d[:, 0] if d.shape[1] == 1 else d[:, :2])


# --------------------------------------------------------------------------------------
# metering
# --------------------------------------------------------------------------------------

def peak_db(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float64)
    return lin2db(np.max(np.abs(x))) if x.size else -120.0


def true_peak_db(x: np.ndarray) -> float:
    """dBTP via 4x oversampling (ITU-R BS.1770-4 Annex 2 style)."""
    x = np.asarray(x, dtype=np.float64)
    if x.size == 0:
        return -120.0
    up = signal.resample_poly(x, 4, 1, axis=0)
    return lin2db(max(np.max(np.abs(up)), np.max(np.abs(x))))


def _k_weight(x2: np.ndarray) -> np.ndarray:
    """ITU-R BS.1770-4 K-weighting (coefficients for 48 kHz)."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x2, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def _block_loudness(x2: np.ndarray, win_s: float, hop_s: float) -> np.ndarray:
    """Per-block loudness (LKFS) of K-weighted channels, rectangular blocks."""
    n = x2.shape[0]
    win, hop = _n(win_s), _n(hop_s)
    if n < win:
        x2 = np.concatenate([x2, np.zeros((win - n, x2.shape[1]))])
        n = win
    nblk = 1 + (n - win) // hop
    kw = _k_weight(x2)
    c = np.concatenate([np.zeros((1, kw.shape[1])), np.cumsum(kw * kw, axis=0)])
    idx = np.arange(nblk) * hop
    z = (c[idx + win] - c[idx]) / win                       # mean square per block per channel
    g = np.ones(x2.shape[1])                                 # L/R/C weights (no surrounds here)
    return -0.691 + 10.0 * np.log10(np.maximum((z * g).sum(axis=1), 1e-20))


def _lufs_builtin(x2: np.ndarray) -> float:
    lk = _block_loudness(x2, 0.4, 0.1)
    z = 10.0 ** ((lk + 0.691) / 10.0)
    gate_abs = lk > -70.0
    if not np.any(gate_abs):
        return -120.0
    rel = -0.691 + 10 * np.log10(np.mean(z[gate_abs])) - 10.0
    gate = gate_abs & (lk > rel)
    if not np.any(gate):
        return -120.0
    return float(-0.691 + 10 * np.log10(np.mean(z[gate])))


try:  # optional
    import pyloudnorm as _pyln  # type: ignore
except Exception:  # pragma: no cover
    _pyln = None


def lufs(x: np.ndarray, method: str = "auto") -> float:
    """Integrated loudness (LUFS, BS.1770-4 gated). Signals shorter than 400 ms are zero-padded,
    so for UI blips this is an 'energy over 400 ms' figure - compare peaks for those instead.
    method: 'auto' (pyloudnorm if installed), 'pyloudnorm', 'builtin'."""
    x2 = _2d(np.asarray(x, dtype=np.float64))
    if x2.shape[0] < _n(0.4) + 1:
        x2 = np.concatenate([x2, np.zeros((_n(0.4) + 1 - x2.shape[0], x2.shape[1]))])
    if method == "builtin" or (method == "auto" and _pyln is None):
        return _lufs_builtin(x2)
    if _pyln is None:
        raise RuntimeError("pyloudnorm not installed")
    meter = _pyln.Meter(SR)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        v = float(meter.integrated_loudness(x2 if x2.shape[1] == 2 else x2[:, 0]))
    return v if np.isfinite(v) else -120.0


def lufs_short_term(x: np.ndarray, hop_s: float = 0.1) -> np.ndarray:
    """Short-term loudness track (3 s window, LUFS), one value per hop. Ungated."""
    x2 = _2d(np.asarray(x, dtype=np.float64))
    return _block_loudness(x2, 3.0, hop_s)


def spectral_centroid(x: np.ndarray) -> float:
    """Magnitude-weighted spectral centroid (Hz) of the whole (mono-summed) clip."""
    m = to_mono(np.asarray(x, dtype=np.float64))
    if m.size < 16:
        return 0.0
    spec = np.abs(np.fft.rfft(m * np.hanning(m.size)))
    f = np.fft.rfftfreq(m.size, 1.0 / SR)
    return float((spec * f).sum() / (spec.sum() + 1e-12))


def centroid_track(x: np.ndarray, frame_s: float = 0.05) -> np.ndarray:
    """Spectral centroid per frame (Hz) - handy to verify sweeps."""
    m = to_mono(np.asarray(x, dtype=np.float64))
    fr = _n(frame_s)
    out = []
    for s in range(0, max(1, m.size - fr + 1), fr):
        seg = m[s: s + fr]
        if _rms(seg) < 1e-4:
            out.append(np.nan); continue
        out.append(spectral_centroid(seg))
    return np.array(out)


def band_energy_fraction(x: np.ndarray, hi_hz: float, lo_hz: float = 0.0) -> float:
    """Fraction of total spectral power between lo_hz and hi_hz."""
    m = to_mono(np.asarray(x, dtype=np.float64))
    P = np.abs(np.fft.rfft(m * np.hanning(m.size))) ** 2
    f = np.fft.rfftfreq(m.size, 1.0 / SR)
    sel = (f >= lo_hz) & (f <= hi_hz)
    return float(P[sel].sum() / (P.sum() + 1e-12))


# --------------------------------------------------------------------------------------
# BEDS & AMBIENCES
# --------------------------------------------------------------------------------------

_MOODS = {
    #            semitone stack      lpf   lfo   depth detune shimmer  sub  noise  drift(rise)
    "calm":  dict(iv=[0, 7, 12, 19],      lpf=900,  lfo=0.06, depth=0.35, det=5,  shim=None, sub=0.30, noise=0.00, rise=0.0),
    "tense": dict(iv=[0, 3, 7, 12, 15],   lpf=1200, lfo=0.15, depth=0.50, det=9,  shim=3,    sub=0.35, noise=0.06, rise=0.0),
    "dread": dict(iv=[0, 1, 6, 12],       lpf=450,  lfo=0.04, depth=0.55, det=13, shim=None, sub=0.60, noise=0.18, rise=0.0),
    "dawn":  dict(iv=[0, 7, 12, 16, 23],  lpf=1700, lfo=0.08, depth=0.40, det=4,  shim=4,    sub=0.15, noise=0.03, rise=0.6),
}


def drone(duration: float = 10.0, root_hz: float = 55.0, mood: str = "calm",
          stereo: bool = True, seed=None, reverb_wet: float = 0.35) -> np.ndarray:
    """Cinematic pad/drone. Detuned polyBLEP saws + sines per interval, through a slowly
    LFO-swept resonant low-pass, optional third 'shimmer' partials, sub, soft saturation, reverb.
    moods: 'calm' (root/5th/octave), 'tense' (minor third, breathing filter),
           'dread' (minor 2nd + tritone, very dark, sub-heavy), 'dawn' (major, brightening)."""
    if mood not in _MOODS:
        raise ValueError(f"mood must be one of {list(_MOODS)}")
    cfg = _MOODS[mood]
    rng = _rng(seed)
    n = _n(duration)
    t = np.arange(n) / SR
    chans = 2 if stereo else 1
    out = np.zeros((n, chans))
    for ch in range(chans):
        acc = np.zeros(n)
        for k, semis in enumerate(cfg["iv"]):
            f0 = root_hz * 2 ** (semis / 12.0)
            gain = 1.0 / (1.0 + 0.55 * k)
            # two detuned saws + one sine, each with its own slow drift
            for sgn in (-1.0, 1.0):
                cents = sgn * cfg["det"] * rng.uniform(0.7, 1.3) + 2.5 * _slow_random(n, rng, 0.07)
                f = f0 * 2 ** (cents / 1200.0)
                amp = 0.5 * (1 + 0.25 * _slow_random(n, rng, 0.05))           # breathing
                acc += gain * 0.35 * amp * _saw(f, phase0=rng.uniform(0, TWO_PI))
            acc += gain * 0.45 * _sine(f0 * 2 ** (1.5 * _slow_random(n, rng, 0.03) / 1200), phase0=rng.uniform(0, TWO_PI))
        # filter sweep
        lfo = np.sin(TWO_PI * cfg["lfo"] * t + rng.uniform(0, TWO_PI)) * 0.7 + 0.3 * _slow_random(n, rng, 0.05)
        cutoff = cfg["lpf"] * 2 ** (cfg["depth"] * lfo) * 2 ** (cfg["rise"] * _ramp(n, -0.5, 0.5))
        voice = _sweep_filter(acc, cutoff, "low", q=1.1)
        voice = _sweep_filter(voice, np.minimum(cutoff * 2.5, 16000), "low", q=0.6)  # extra rolloff
        # shimmer: third partials three/four octaves up with slow tremolo & vibrato
        if cfg["shim"] is not None:
            for octs, lvl in ((3, 0.11), (4, 0.06)):
                fs = root_hz * 2 ** (octs + cfg["shim"] / 12.0)
                vib = fs * 2 ** (3.0 * _slow_random(n, rng, 0.3) / 1200)
                trem = 0.5 + 0.5 * np.sin(TWO_PI * rng.uniform(0.15, 0.35) * t + rng.uniform(0, TWO_PI))
                acc_s = lvl * trem * _sine(vib, phase0=rng.uniform(0, TWO_PI))
                voice += _lp(acc_s, 2500, 2)
        # sub
        sub_f = root_hz * (0.5 if mood == "dread" else 1.0)
        voice += cfg["sub"] * 0.42 * _sine(sub_f, n, rng.uniform(0, TWO_PI)) * (1 + 0.15 * _slow_random(n, rng, 0.05))
        # dark noise bed
        if cfg["noise"] > 0:
            nz = _lp(_noise(n, rng, "brown"), 350, 2) * (0.7 + 0.3 * _slow_random(n, rng, 0.1))
            voice += cfg["noise"] * nz / (_rms(nz) + 1e-9) * 0.25
        out[:, ch] = voice
    out = out / (np.max(np.abs(out)) + 1e-9)
    out = _sat(out, 1.3)
    out = reverb(out, rt60=3.2, wet=reverb_wet, damp_hz=3500, seed=rng.integers(1 << 30))[:n]
    out = _hp(out, 24, 2)
    out = fade(out, min(1.5, duration * 0.2), min(2.0, duration * 0.25))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


def wind(duration: float = 10.0, intensity: float = 0.5, stereo: bool = True, seed=None,
         gust_rate: float = 0.12) -> np.ndarray:
    """Filtered-noise wind with gusts. intensity 0..1 (0.2 breeze, 0.5 steady, 0.9 storm).
    Layers: low rumble, body (pink noise through gust-driven low-pass), whistle (resonant
    band-pass that only appears in strong gusts), air hiss."""
    rng = _rng(seed)
    n = _n(duration)
    inten = float(np.clip(intensity, 0.0, 1.0))
    chans = 2 if stereo else 1
    gust = _slow_random(n, rng, gust_rate)                    # -1..1 shared between channels
    g = np.clip(0.55 * inten + 0.45 * inten * gust + 0.25 * inten ** 2 * np.maximum(gust, 0), 0.03, 1.2)
    out = np.zeros((n, chans))
    for ch in range(chans):
        gl = np.clip(g * (1 + 0.12 * _slow_random(n, rng, 0.3)), 0.02, 1.3)
        body = _sweep_filter(_noise(n, rng, "pink"), 180 + 1700 * gl ** 1.5, "low", q=0.8, passes=2)
        body *= (0.25 + gl) ** 1.4
        rumble = _lp(_noise(n, rng, "brown"), 110, 2) * (0.3 + 0.7 * gl) * 0.45
        wc = 380 + 700 * gl + 120 * _slow_random(n, rng, 0.4)
        whistle = _sweep_filter(_noise(n, rng, "white"), wc, "band", q=7.0) * (gl ** 2.2) * 0.9
        hiss = _hp(_noise(n, rng, "white"), 2500, 2) * (gl ** 3) * 0.08
        out[:, ch] = body + rumble + whistle + hiss
    out = _hp(out, 25, 2)
    out = fade(out, min(0.5, duration * 0.1), min(0.8, duration * 0.15))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


def _leaf_rustle(dur: float, rng) -> np.ndarray:
    n = _n(dur)
    crackle = np.abs(_lp(rng.standard_normal(n), 45, 1))
    crackle = crackle / (np.max(crackle) + 1e-9)
    env = _window(n, peak_pos=rng.uniform(0.25, 0.5), power=1.5)
    x = _bp(_noise(n, rng, "white"), 1800, 7000, 2) * env * (0.4 + 0.6 * crackle)
    return x / (np.max(np.abs(x)) + 1e-9)


def _low_hum(n: int, rng, f: float = 48.0, level: float = 1.0) -> np.ndarray:
    wob = 1 + 0.25 * _slow_random(n, rng, 0.08)
    hum = _sine(f, n, rng.uniform(0, TWO_PI)) + 0.35 * _sine(f * 1.5, n, rng.uniform(0, TWO_PI))
    hum = hum * wob + 0.6 * _lp(_noise(n, rng, "brown"), 90, 2)
    return level * hum / (np.max(np.abs(hum)) + 1e-9)


def forest_ambience(duration: float = 10.0, stereo: bool = True, seed=None,
                    wind_intensity: float = 0.3, rustle_rate: float = 0.45) -> np.ndarray:
    """Daytime forest bed: light wind + sparse panned leaf rustles + a distant low hum."""
    rng = _rng(seed)
    n = _n(duration)
    w = wind(duration, wind_intensity, stereo=True, seed=rng.integers(1 << 30))
    tracks = [(w, 0.0, 0.0)]
    # Poisson-ish rustle events
    t_ev = 0.6
    while t_ev < duration - 0.4:
        d = rng.uniform(0.35, 1.3)
        r = pan(_leaf_rustle(d, rng), rng.uniform(-0.8, 0.8))
        tracks.append((r, t_ev, rng.uniform(-22, -13)))
        t_ev += rng.exponential(1.0 / max(rustle_rate, 1e-3))
    hum = _low_hum(n, rng, 48.0)
    tracks.append((to_stereo(hum), 0.0, -24.0))
    out = mix(tracks, duration=duration)
    out = fade(out, min(0.5, duration * 0.1), min(0.8, duration * 0.15))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


def _cricket(duration: float, rng, f_hz: float, pulse_hz: float, chirp_s: float, gap_s: float) -> np.ndarray:
    """One cricket: trains of raised-cosine pulses (pulse_hz) on a ~4-5 kHz carrier with vibrato."""
    n = _n(duration)
    t = np.arange(n) / SR
    env = np.zeros(n)
    pos = rng.uniform(0, gap_s)
    pw = _n(0.5 / pulse_hz)
    pulse = 0.5 - 0.5 * np.cos(np.linspace(0, TWO_PI, pw))
    while pos < duration:
        c_len = chirp_s * rng.uniform(0.8, 1.25)
        p = pos
        while p < min(duration, pos + c_len):
            i = _n(p)
            e = min(n, i + pw)
            env[i:e] = np.maximum(env[i:e], pulse[: e - i])
            p += 1.0 / pulse_hz
        pos += c_len + gap_s * rng.uniform(0.6, 1.6)
    f = f_hz * (1 + 0.004 * np.sin(TWO_PI * 11 * t) + 0.003 * _slow_random(n, rng, 0.5))
    x = env * (_sine(f) + 0.18 * _sine(2 * f))
    return x / (np.max(np.abs(x)) + 1e-9)


def night_ambience(duration: float = 10.0, stereo: bool = True, seed=None,
                   crickets: int = 3, wind_intensity: float = 0.18) -> np.ndarray:
    """Night bed: darker, quieter wind + deeper hum + a few crickets at different distances."""
    rng = _rng(seed)
    n = _n(duration)
    w = wind(duration, wind_intensity, stereo=True, seed=rng.integers(1 << 30))
    w = _lp(w, 650, 2)
    tracks = [(w, 0.0, -1.0), (to_stereo(_low_hum(n, rng, 41.0)), 0.0, -24.0)]
    air = np.stack([_bp(_noise(n, rng, "pink"), 250, 2600, 2) * (1 + 0.3 * _slow_random(n, rng, 0.2)) for _ in range(2)], axis=1)
    tracks.append((air / (np.max(np.abs(air)) + 1e-9), 0.0, -21.0))
    for i in range(int(crickets)):
        dist = rng.uniform(0.0, 1.0)                           # 0 near .. 1 far
        c = _cricket(duration, rng, f_hz=rng.uniform(4000, 5400), pulse_hz=rng.uniform(22, 42),
                     chirp_s=rng.uniform(0.3, 0.9), gap_s=rng.uniform(0.5, 2.2))
        c = _lp(c, 9000 - 5000 * dist, 2)
        c = reverb(c, rt60=0.9, wet=0.15 + 0.5 * dist, damp_hz=4000, seed=rng.integers(1 << 30))[:n]
        tracks.append((pan(c, rng.uniform(-0.9, 0.9)), 0.0, -22.0 - 12.0 * dist))
    out = mix(tracks, duration=duration)
    out = fade(out, min(0.5, duration * 0.1), min(0.8, duration * 0.15))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


def fire_crackle(duration: float = 10.0, intensity: float = 0.5, stereo: bool = True, seed=None) -> np.ndarray:
    """Fire: low flickering noise bed + mid 'roar' + random crackle pops and occasional snaps.
    intensity 0..1 sets pop density and roar level (0.2 embers, 0.5 campfire, 0.9 blaze)."""
    rng = _rng(seed)
    n = _n(duration)
    inten = float(np.clip(intensity, 0.0, 1.0))
    chans = 2 if stereo else 1
    out = np.zeros((n, chans))
    for ch in range(chans):
        flick = 1 + 0.45 * _slow_random(n, rng, 4.0)
        bed = _lp(_noise(n, rng, "brown"), 300 + 200 * inten, 2) * flick
        flick2 = 1 + 0.6 * _slow_random(n, rng, 6.0)
        roar = _bp(_noise(n, rng, "pink"), 350, 2200 + 1500 * inten, 2) * flick2 * (0.18 + 0.45 * inten)
        out[:, ch] = bed / (_rms(bed) + 1e-9) * 0.35 + roar / (_rms(roar) + 1e-9) * 0.12 * (0.5 + inten)
    # pops
    rate = 3.0 + 26.0 * inten
    t_ev = rng.exponential(1.0 / rate)
    pops = np.zeros((n, chans))
    while t_ev < duration:
        i = _n(t_ev)
        amp = rng.lognormal(-0.3, 0.6)
        if rng.uniform() < 0.14:                            # bigger snap
            d = rng.uniform(0.02, 0.06)
            m = _n(d)
            p = _bp(_noise(m, rng, "white"), 700, 4500, 2) * _exp_decay(m, d / 4)
            p += 0.6 * _sine(rng.uniform(120, 220), m) * _exp_decay(m, 0.012)
            amp *= 1.8
        else:
            d = rng.uniform(0.002, 0.009)
            m = _n(d)
            fpop = rng.uniform(1200, 5500)
            p = _sine(fpop, m) * _exp_decay(m, d / 3) + 0.4 * _hp(rng.standard_normal(m), 3000, 1) * _exp_decay(m, d / 4)
        p = p / (np.max(np.abs(p)) + 1e-9) * min(amp, 3.0)
        e = min(n, i + m)
        pp = pan(p, rng.uniform(-0.75, 0.75)) if chans == 2 else p[:, None]
        pops[i:e] += pp[: e - i]
        t_ev += rng.exponential(1.0 / rate)
    out = out + 0.32 * pops
    out = _sat(out, 1.4)
    out = _hp(out, 35, 2)
    out = fade(out, min(0.5, duration * 0.1), min(0.8, duration * 0.15))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


_BIRD_SPECIES = ("whistle", "trill", "chip", "warble")


def _bird_phrase(species: str, rng) -> np.ndarray:
    """One FM-chirp phrase (mono, peak 1)."""
    notes = []

    def note(dur, f_start, f_end, curve=1.0, att=0.15, vib_hz=0.0, vib_depth=0.0, fm_hz=0.0, fm_index=0.0):
        m = _n(dur)
        t = np.arange(m) / SR
        x = np.linspace(0, 1, m)
        f = f_start + (f_end - f_start) * (x ** curve)
        if vib_hz:
            f = f * (1 + vib_depth * np.sin(TWO_PI * vib_hz * t))
        ph = _phase(f)
        if fm_hz:
            ph = ph + fm_index * np.sin(TWO_PI * fm_hz * t)
        env = _window(m, peak_pos=att, power=1.2)
        return (np.sin(ph) + 0.12 * np.sin(2 * ph)) * env

    if species == "whistle":
        for _ in range(rng.integers(1, 4)):
            f0 = rng.uniform(2300, 3600)
            notes.append(note(rng.uniform(0.12, 0.26), f0, f0 + rng.uniform(-800, 900), curve=rng.uniform(0.6, 1.6),
                              att=rng.uniform(0.1, 0.3), vib_hz=rng.uniform(20, 40), vib_depth=rng.uniform(0.002, 0.008),
                              fm_hz=rng.uniform(90, 160), fm_index=rng.uniform(0.1, 0.5)))
            notes.append(np.zeros(_n(rng.uniform(0.06, 0.18))))
    elif species == "trill":
        f0 = rng.uniform(3200, 4800)
        rep = rng.uniform(12, 19)
        for i in range(rng.integers(6, 14)):
            fs = f0 * (1 + 0.02 * i * rng.choice([-1, 1]) * 0.3)
            notes.append(note(rng.uniform(0.03, 0.05), fs + 450, fs, curve=0.8, att=0.3, fm_hz=120, fm_index=0.2))
            notes.append(np.zeros(_n(max(0.005, 1.0 / rep - 0.04))))
    elif species == "chip":
        f0 = rng.uniform(2800, 3800)
        notes.append(note(rng.uniform(0.045, 0.08), f0, f0 + rng.uniform(1200, 2000), curve=0.5, att=0.4,
                          fm_hz=rng.uniform(100, 200), fm_index=0.4))
        if rng.uniform() < 0.5:
            notes.append(np.zeros(_n(rng.uniform(0.08, 0.2))))
            notes.append(note(rng.uniform(0.045, 0.08), f0 + 300, f0 + 1500, curve=0.5, att=0.4, fm_hz=150, fm_index=0.4))
    else:  # warble
        fa, fb = rng.uniform(2700, 3300), rng.uniform(3500, 4300)
        for i in range(rng.integers(3, 6)):
            fs, fe = (fa, fb) if i % 2 == 0 else (fb, fa)
            notes.append(note(rng.uniform(0.07, 0.12), fs, fe, curve=1.3, att=0.2, vib_hz=35, vib_depth=0.004,
                              fm_hz=130, fm_index=0.3))
            notes.append(np.zeros(_n(rng.uniform(0.02, 0.05))))
    x = np.concatenate(notes)
    return x / (np.max(np.abs(x)) + 1e-9)


def bird_chirps(duration: float = 10.0, density: float = 0.5, stereo: bool = True, seed=None) -> np.ndarray:
    """Dawn chorus from FM chirps. density 0..1 -> number of birds and how often they sing.
    Each bird has a species, a pan position and a distance (level, low-pass, reverb amount)."""
    rng = _rng(seed)
    n = _n(duration)
    dens = float(np.clip(density, 0.05, 1.0))
    n_birds = int(2 + round(5 * dens))
    near, far = [], []
    for b in range(n_birds):
        species = _BIRD_SPECIES[b % len(_BIRD_SPECIES)] if b < 4 else rng.choice(_BIRD_SPECIES)
        dist = rng.uniform(0.0, 1.0)
        posn = rng.uniform(-0.9, 0.9)
        t_ev = rng.uniform(0.2, 2.5 / dens)
        bus = near if dist < 0.5 else far
        while t_ev < duration - 0.3:
            ph = _bird_phrase(species, rng)
            ph = _lp(ph, 8000 - 4500 * dist, 2)
            gain = -6.0 - 16.0 * dist + rng.uniform(-2, 2)
            bus.append((pan(ph, posn + rng.uniform(-0.05, 0.05)), t_ev, gain))
            t_ev += len(ph) / SR + rng.exponential((1.6 + 3.0 * dist) / dens) + 0.4
    near_bus = mix(near, duration=duration, stereo=True) if near else silence(duration, True)
    far_bus = mix(far, duration=duration, stereo=True) if far else silence(duration, True)
    near_bus = reverb(near_bus, rt60=1.1, wet=0.18, damp_hz=6000, seed=rng.integers(1 << 30))[:n]
    far_bus = reverb(far_bus, rt60=1.6, wet=0.55, damp_hz=3500, seed=rng.integers(1 << 30))[:n]
    out = mix([(near_bus, 0, 0), (far_bus, 0, 0)], duration=duration, stereo=True)
    out = fade(out, 0.05, min(0.6, duration * 0.1))
    out = normalize(out, -3.0)
    return out if stereo else to_mono(out)


# --------------------------------------------------------------------------------------
# ONE-SHOTS: movement
# --------------------------------------------------------------------------------------

def whoosh(duration: float = 0.6, pitch_dir: str = "up", stereo: bool = False, seed=None,
           lo_hz: float = 220.0, hi_hz: float = 3800.0) -> np.ndarray:
    """Transition whoosh: noise through a band-pass whose centre sweeps lo->hi ('up') or hi->lo ('down'),
    with an air layer and a body layer. The envelope peaks late for 'up' (land the cut on the peak)
    and early for 'down'."""
    if pitch_dir not in ("up", "down"):
        raise ValueError("pitch_dir must be 'up' or 'down'")
    rng = _rng(seed)
    n = _n(duration)
    up = pitch_dir == "up"
    centre = _exp_ramp(n, lo_hz, hi_hz) if up else _exp_ramp(n, hi_hz, lo_hz)
    env = _window(n, peak_pos=0.62 if up else 0.36, power=1.6)
    chans = 2 if stereo else 1
    out = np.zeros((n, chans))
    for ch in range(chans):
        src = _noise(n, rng, "white")
        main = _sweep_filter(src, centre, "band", q=1.6, passes=2)
        air = _sweep_filter(_noise(n, rng, "white"), np.minimum(centre * 1.8, 15000), "band", q=4.0) * 0.5
        body = _sweep_filter(_noise(n, rng, "pink"), np.maximum(centre * 0.5, 80), "low", q=0.9) * 0.6
        out[:, ch] = (main + air + body) * env
    if stereo:   # gentle auto-pan with the motion
        a = np.linspace(-0.6, 0.6, n) if up else np.linspace(0.6, -0.6, n)
        ang = (a + 1) * 0.25 * math.pi
        out[:, 0] *= np.cos(ang); out[:, 1] *= np.sin(ang)
    out = _hp(out, 60, 2)
    out = fade(out, 0.004, 0.02)
    out = normalize(out, -1.0)
    return out if stereo else out[:, 0]


def _single_flap(rng, size: float = 1.0) -> np.ndarray:
    d = 0.5 * size
    n = _n(d)
    # air: pink noise through a low-pass that opens quickly and closes slowly
    cut = 120 + 900 * _window(n, peak_pos=0.22, power=1.0)
    air = _sweep_filter(_noise(n, rng, "pink"), cut / math.sqrt(size), "low", q=1.0, passes=2)
    air *= _window(n, peak_pos=0.28, power=1.3)
    # thump at the bottom of the stroke
    m = _n(0.22)
    fth = 72 * np.exp(-np.arange(m) / SR / 0.05) / math.sqrt(size) + 36
    thump = _sine(fth) * _exp_decay(m, 0.09)
    thump = _sat(thump * 1.5, 2.0)
    # membrane snap
    k = _n(0.03)
    snap = _bp(_noise(k, rng, "white"), 900, 3500, 2) * _exp_decay(k, 0.006)
    x = mix([(air / (np.max(np.abs(air)) + 1e-9), 0.0, 0.0),
             (thump / (np.max(np.abs(thump)) + 1e-9), 0.035 * size, -3.5),
             (snap / (np.max(np.abs(snap)) + 1e-9), 0.06 * size, -20.0)], duration=d + 0.15)
    return x


def wing_flap(count: int = 3, interval: float = 0.55, stereo: bool = False, seed=None, size: float = 1.0) -> np.ndarray:
    """Big heavy wings: each flap = low whoosh (filter-swept pink noise) + sub thump + faint membrane snap.
    count flaps spaced `interval` seconds apart with natural jitter; size>1 = bigger creature."""
    rng = _rng(seed)
    tracks = []
    t0 = 0.0
    for i in range(int(count)):
        f = _single_flap(rng, size * rng.uniform(0.95, 1.05))
        tracks.append((pan(f, rng.uniform(-0.25, 0.25)) if stereo else f, t0, rng.uniform(-1.5, 0.0)))
        t0 += interval * rng.uniform(0.94, 1.06)
    x = mix(tracks)
    n_end = x.shape[0] + _n(0.5)
    x = reverb(x, rt60=1.1, wet=0.18, damp_hz=2500, seed=rng.integers(1 << 30))[:n_end]
    x = fade(x, 0.005, 0.3)
    return normalize(x, -1.0)


# --------------------------------------------------------------------------------------
# ONE-SHOTS: impacts
# --------------------------------------------------------------------------------------

def impact(kind: str = "thud", size: float = 1.0, stereo: bool = False, seed=None, room: float = 0.12) -> np.ndarray:
    """Impacts. kind: 'thud' (deep boom), 'wood' (plank/knock), 'stone' (gritty slab + rubble),
    'metal' (inharmonic ring). size scales pitch down and decay up (1 = default). room = reverb wet."""
    rng = _rng(seed)
    s = max(0.25, float(size))
    ps = 1.0 / math.sqrt(s)             # pitch scale
    ts = math.sqrt(s)                   # time scale
    if kind == "thud":
        n = _n(1.1 * ts)
        t = np.arange(n) / SR
        f = (150 * np.exp(-t / (0.055 * ts)) + 38) * ps
        body = _sine(f) * _exp_decay(n, 0.22 * ts)
        sub = _sine(44 * ps, n) * _exp_decay(n, 0.42 * ts, 0.01) * 0.7
        punch = _lp(_noise(n, rng, "white"), 600, 2) * _exp_decay(n, 0.035) * 0.8
        x = _sat(body + sub + punch, 2.2)
    elif kind == "wood":
        n = _n(0.7 * ts)
        burst = _bp(_noise(n, rng, "white"), 250, 2600, 2) * _exp_decay(n, 0.02)
        ratios = np.array([1.0, 2.2, 3.7, 6.1]) * rng.uniform(0.97, 1.03, 4)
        modes = _modes(n, 185 * ps * ratios, np.array([0.17, 0.11, 0.07, 0.045]) * ts, [1.0, 0.55, 0.32, 0.18], rng)
        thump = _sine((95 * np.exp(-np.arange(n) / SR / 0.04) + 55) * ps) * _exp_decay(n, 0.09 * ts)
        x = _sat(0.9 * burst + 1.2 * modes + 0.9 * thump, 1.6)
    elif kind == "stone":
        n = _n(1.2 * ts)
        grit = _bp(_noise(n, rng, "white"), 200, 4000, 2) * _exp_decay(n, 0.05 * ts)
        rubble_am = np.abs(_lp(rng.standard_normal(n), 60, 1))
        rubble = _bp(_noise(n, rng, "white"), 400, 3000, 2) * rubble_am * _exp_decay(n, 0.28 * ts, 0.03) * 1.6
        modes = _modes(n, np.array([92, 160, 290]) * ps, np.array([0.12, 0.09, 0.06]) * ts, [1.0, 0.6, 0.35], rng)
        thump = _sine((120 * np.exp(-np.arange(n) / SR / 0.05) + 42) * ps) * _exp_decay(n, 0.16 * ts)
        x = _sat(1.0 * grit + 0.5 * rubble + 1.0 * modes + 1.3 * thump, 1.9)
    elif kind == "metal":
        n = _n(1.9)
        strike = _hp(_noise(n, rng, "white"), 1200, 2) * _exp_decay(n, 0.008)
        base = 215 * ps
        ratios = [1.0, 2.756, 5.404, 8.933, 13.34]
        freqs, taus, amps = [], [], []
        for i, r in enumerate(ratios):
            for det in (0.997, 1.004):                   # slight pairs -> beating shimmer
                freqs.append(base * r * det); taus.append([1.5, 1.0, 0.65, 0.4, 0.26][i] * ts); amps.append([1.0, 0.65, 0.45, 0.28, 0.18][i] * 0.5)
        ring = _modes(n, freqs, taus, amps, rng)
        clank = _bp(_noise(n, rng, "white"), 800, 6000, 2) * _exp_decay(n, 0.03)
        x = _sat(0.8 * strike + 1.0 * ring + 0.6 * clank, 1.3)
    else:
        raise ValueError("kind must be thud|wood|stone|metal")
    x = _hp(x, 28, 2)
    x = reverb(x, rt60=0.9 if kind != "metal" else 1.3, wet=room, damp_hz=3500, stereo_out=stereo, seed=rng.integers(1 << 30))
    x = x[: min(len(x), n + _n(0.45), _n(2.0))]
    x = fade(x, 0.001, 0.08)
    return normalize(x, -1.0)


def _creak(duration: float, rng, f_start: float = 270.0, f_end: float = 130.0) -> np.ndarray:
    """Stick-slip wood creak: pitch-bent polyBLEP saw with wobble, AM grain, formant band-passes."""
    n = _n(duration)
    t = np.arange(n) / SR
    f = _exp_ramp(n, f_start, f_end) * (1 + 0.04 * np.sin(TWO_PI * rng.uniform(3, 7) * t) + 0.03 * _slow_random(n, rng, 2.0))
    grain = 0.55 + 0.45 * np.abs(_lp(rng.standard_normal(n), 28, 1)) / 0.4
    src = _saw(f) * np.clip(grain, 0.2, 1.6)
    body = _bp(src, 230, 900, 2) + 0.6 * _bp(src, 900, 2200, 2) + 0.25 * _bp(src, 2200, 4500, 2)
    env = _window(n, peak_pos=0.75, power=0.8)
    x = body * env
    return x / (np.max(np.abs(x)) + 1e-9)


def tree_fall(stereo: bool = True, seed=None) -> np.ndarray:
    """Set piece (~4.5 s): creaking trunk with cracks, the snap, falling whoosh, crash (thud+wood+stone),
    branch debris and a low rumble, through an outdoor-ish short reverb."""
    rng = _rng(seed)
    tracks = []
    # 1) creak with small cracks
    cr = _creak(1.7, rng)
    tracks.append((pan(cr, -0.25), 0.0, -7.0))
    for tc, g in ((0.85, -14.0), (1.25, -11.0)):
        tracks.append((pan(impact("wood", size=0.6, seed=rng.integers(1 << 30), room=0.05), -0.2), tc, g))
    # 2) the snap
    tracks.append((pan(impact("wood", size=1.3, seed=rng.integers(1 << 30), room=0.1), -0.1), 1.62, -3.0))
    # 3) falling whoosh
    wh = whoosh(1.1, "down", stereo=True, seed=rng.integers(1 << 30), lo_hz=140, hi_hz=1600)
    tracks.append((wh, 1.75, -6.0))
    # 4) crash
    t_hit = 2.75
    tracks.append((impact("thud", size=1.6, stereo=True, seed=rng.integers(1 << 30), room=0.15), t_hit, -0.5))
    tracks.append((pan(impact("wood", size=1.9, seed=rng.integers(1 << 30), room=0.12), 0.15), t_hit + 0.01, -2.5))
    tracks.append((impact("stone", size=1.2, stereo=True, seed=rng.integers(1 << 30), room=0.15), t_hit + 0.03, -5.0))
    # 5) branch debris: cluster of small wood knocks, density decaying
    te = t_hit + 0.08
    while te < t_hit + 1.1:
        tracks.append((pan(impact("wood", size=rng.uniform(0.3, 0.7), seed=rng.integers(1 << 30), room=0.05),
                           rng.uniform(-0.9, 0.9)), te, rng.uniform(-24, -13) - 8 * (te - t_hit)))
        te += rng.exponential(0.07 + 0.12 * (te - t_hit))
    # 6) debris noise + rumble
    nd = _n(1.6)
    deb = _bp(_noise(nd, rng, "white"), 500, 6000, 2) * np.abs(_lp(rng.standard_normal(nd), 50, 1)) * _exp_decay(nd, 0.45)
    tracks.append((to_stereo(deb / (np.max(np.abs(deb)) + 1e-9)), t_hit + 0.05, -16.0))
    rum = _lp(_noise(nd, rng, "brown"), 80, 2) * _exp_decay(nd, 0.7)
    tracks.append((to_stereo(rum / (np.max(np.abs(rum)) + 1e-9)), t_hit, -9.0))
    x = mix(tracks, duration=4.6)
    x = _sat(x / (np.max(np.abs(x)) + 1e-9), 1.3)
    x = reverb(x, rt60=1.6, wet=0.2, damp_hz=3000, seed=rng.integers(1 << 30))[: _n(4.6)]
    x = fade(x, 0.01, 0.6)
    x = normalize(x, -1.0)
    return x if stereo else to_mono(x)


# --------------------------------------------------------------------------------------
# ONE-SHOTS: tension & pulse
# --------------------------------------------------------------------------------------

def riser(duration: float = 3.0, start_hz: float = 100.0, end_hz: float = 2000.0, stereo: bool = False,
          seed=None, pulse: float = 0.25) -> np.ndarray:
    """Tension riser: noise through a rising band-pass + detuned saws gliding start_hz->end_hz with a
    tracking low-pass, accelerating tremolo (pulse 0..1 depth), loudness ramp. Ends hard at the peak
    (30 ms fade) so an impact/sub_drop can land on it."""
    rng = _rng(seed)
    n = _n(duration)
    t = np.arange(n) / SR
    f = _exp_ramp(n, start_hz, end_hz)
    ramp = _ramp(n, 0.0, 1.0, 1.6)
    chans = 2 if stereo else 1
    out = np.zeros((n, chans))
    for ch in range(chans):
        nz = _sweep_filter(_noise(n, rng, "white"), np.minimum(f * 2.0, 12000), "band", q=1.3, passes=2)
        nz = _lp(nz, 9000, 2) * (0.1 + 0.9 * ramp)
        saws = _saw(f * 2 ** (-8 / 1200), phase0=rng.uniform(0, TWO_PI)) + _saw(f * 2 ** (8 / 1200), phase0=rng.uniform(0, TWO_PI))
        saws = _sweep_filter(saws, np.minimum(f * 4.5, 14000), "low", q=1.2, passes=2) * (0.25 + 0.75 * ramp)
        subs = _sine(f * 0.5) * (1 - ramp) ** 0.5 * 0.5
        trem_rate = _ramp(n, 4.0, 18.0, 2.0)
        trem = 1 - pulse * (0.5 - 0.5 * np.cos(_phase(trem_rate)))
        out[:, ch] = (0.9 * nz + 0.5 * saws + subs) * trem
    out = _hp(out, 40, 2)
    out = fade(out, 0.05, 0.03)
    out = normalize(out, -1.0)
    return out if stereo else out[:, 0]


def sub_drop(duration: float = 1.6, start_hz: float = 90.0, end_hz: float = 32.0, seed=None) -> np.ndarray:
    """Cinematic sub drop: sine gliding start_hz->end_hz (fast exponential glide), soft saturation for
    audibility on small speakers, short transient click, exponential decay."""
    n = _n(duration)
    t = np.arange(n) / SR
    f = end_hz + (start_hz - end_hz) * np.exp(-t / 0.22)
    env = _adsr(n, 0.004, 0.0, 1.0, duration * 0.75, curve=2.5) * np.exp(-t / (duration * 0.6))
    x = _sat(_sine(f) * env * 1.4, 1.6)
    k = _n(0.004)
    click = _lp(np.concatenate([[1.0], np.zeros(k - 1)]), 2500, 2) * 0.12
    x[:k] += click
    x = _hp(x, 18, 2)
    return normalize(fade(x, 0.0, 0.05), -1.0)


def heartbeat(bpm: float = 60.0, duration: float = 4.0, seed=None) -> np.ndarray:
    """Lub-dub heartbeat at bpm: two pitch-dropping sub thumps per beat (S2 softer, slightly higher),
    low-passed, with tiny timing/level jitter."""
    rng = _rng(seed)
    period = 60.0 / max(20.0, bpm)
    gap = float(np.clip(0.16 + 0.14 * period, 0.2, 0.36))
    tracks = []

    def thump(f0, f1, tau):
        m = _n(0.35)
        f = f1 + (f0 - f1) * np.exp(-np.arange(m) / SR / 0.05)
        x = (_sine(f) + 0.3 * _sine(2 * f)) * _adsr(m, 0.006, 0.0, 1.0, 0.3, 2.0) * _exp_decay(m, tau)
        x += _lp(_noise(m, rng, "white"), 180, 2) * _exp_decay(m, 0.03) * 0.25
        return _sat(x, 1.8)

    tb = 0.05
    while tb < duration - 0.4:
        tracks.append((thump(62, 36, 0.10), tb + rng.normal(0, 0.004), rng.uniform(-0.8, 0.0)))
        tracks.append((thump(74, 42, 0.07), tb + gap + rng.normal(0, 0.004), rng.uniform(-5.0, -3.5)))
        tb += period
    x = mix(tracks, duration=duration)
    x = _lp(x, 300, 2)
    x = fade(x, 0.005, min(0.4, duration * 0.1))
    return normalize(x, -1.0)


# --------------------------------------------------------------------------------------
# ONE-SHOTS: UI (all < 150 ms, clean & modern)
# --------------------------------------------------------------------------------------

def _click(n: int, f: float, tau: float, rng, noise_mix: float = 0.3, hp: float = 1500.0) -> np.ndarray:
    ring = _sine(f, n) * _exp_decay(n, tau)
    nz = _hp(rng.standard_normal(n), hp, 2) * _exp_decay(n, tau * 0.6)
    return ring + noise_mix * nz


def ui_tick(seed=0) -> np.ndarray:
    """28 ms soft mechanical tick (HUD element appears / cursor step)."""
    rng = _rng(seed)
    n = _n(0.028)
    x = _click(n, 2300, 0.0045, rng, 0.35, 2500) + 0.5 * _click(n, 4100, 0.002, rng, 0.2, 4000)
    x = _lp(x, 7500, 2)
    return normalize(fade(x, 0.0004, 0.01), -1.0)


def ui_pop(seed=0) -> np.ndarray:
    """80 ms rounded pop: sine with a fast exponential pitch drop (1100->520 Hz) and a soft click (card/HUD pop-in)."""
    rng = _rng(seed)
    n = _n(0.08)
    t = np.arange(n) / SR
    f = 520 + (1100 - 520) * np.exp(-t / 0.022)
    body = _sine(f) * _adsr(n, 0.0015, 0.0, 1.0, 0.075, 2.5) * np.exp(-t / 0.028)
    click = _click(_n(0.006), 3000, 0.0015, rng, 0.4, 3000) * 0.25
    x = body.copy()
    x[: len(click)] += click
    x = _lp(x, 7000, 2)
    return normalize(fade(x, 0.0005, 0.01), -1.0)


def ui_slide(seed=0) -> np.ndarray:
    """130 ms soft swipe: pink noise through a rising band-pass (900->3200 Hz) with a bell envelope (panel slide / dock)."""
    rng = _rng(seed)
    n = _n(0.13)
    centre = _exp_ramp(n, 900, 3200)
    x = _sweep_filter(_noise(n, rng, "pink"), centre, "band", q=1.8, passes=2) * _window(n, 0.45, 1.4)
    x += 0.25 * _sweep_filter(_noise(n, rng, "white"), centre * 2.2, "band", q=3.0) * _window(n, 0.5, 2.0)
    return normalize(fade(x, 0.003, 0.02), -1.0)


def counter_tick(seed=0) -> np.ndarray:
    """22 ms woody micro-tick for number counters (quieter and duller than ui_tick, so it can repeat fast)."""
    rng = _rng(seed)
    n = _n(0.022)
    x = _modes(n, [1450, 2900], [0.0035, 0.002], [1.0, 0.45], rng) + 0.3 * _bp(rng.standard_normal(n), 1000, 5000, 2) * _exp_decay(n, 0.002)
    x = _lp(x, 5500, 2)
    return normalize(fade(x, 0.0003, 0.008), -1.0)


def digit_flip(seed=0) -> np.ndarray:
    """95 ms split-flap style digit flip: release click, plastic flap noise, landing click, faint body resonance (countdown)."""
    rng = _rng(seed)
    n = _n(0.095)
    x = np.zeros(n)
    a = _click(_n(0.012), 1900, 0.0025, rng, 0.5, 1500) * 0.6
    x[: len(a)] += a
    m = _n(0.05)
    flap = _bp(_noise(m, rng, "white"), 700, 4200, 2) * _window(m, 0.3, 1.5) * 0.35
    x[_n(0.008): _n(0.008) + m] += flap
    b = _click(_n(0.03), 1250, 0.004, rng, 0.45, 1200)
    i = _n(0.052)
    x[i: i + len(b)] += b
    x[i:] += _sine(340, n - i) * _exp_decay(n - i, 0.012) * 0.35
    x = _lp(x, 8000, 2)
    return normalize(fade(x, 0.0005, 0.02), -1.0)


def alarm_beep(freq: float = 880.0, duration: float = 0.12, count: int = 1, gap: float = 0.08) -> np.ndarray:
    """Clean modern beep (sine + soft 2nd/3rd harmonics, 6 ms raised-cosine edges). count>1 repeats with gap."""
    n = _n(duration)
    t = np.arange(n) / SR
    x = np.sin(TWO_PI * freq * t) + 0.2 * np.sin(TWO_PI * 2 * freq * t) + 0.08 * np.sin(TWO_PI * 3 * freq * t)
    x = fade(x, 0.006, 0.008)
    if count > 1:
        x = concat([x] * int(count), gap_s=gap)
    return normalize(x, -1.0)


# --------------------------------------------------------------------------------------
# ONE-SHOTS: creature
# --------------------------------------------------------------------------------------

def roar(duration: float = 1.5, pitch_hz: float = 70.0, stereo: bool = False, seed=None) -> np.ndarray:
    """Low creature roar: saw + breath noise with a rise-then-fall pitch contour, irregular growl AM,
    three moving formants (aah -> ooh), sub octave, saturation, reverb."""
    rng = _rng(seed)
    n = _n(duration)
    t = np.arange(n) / SR
    x01 = np.linspace(0, 1, n)
    contour = 0.82 + 0.33 * np.sin(math.pi * np.clip(x01 / 0.75, 0, 1)) - 0.25 * np.clip((x01 - 0.7) / 0.3, 0, 1) ** 1.5
    jitter = 1 + 0.025 * _slow_random(n, rng, 18.0)
    f = pitch_hz * contour * jitter
    src = _saw(f) + 0.35 * _noise(n, rng, "pink")
    growl_rate = 24 + 7 * _slow_random(n, rng, 2.0)
    growl_depth = 0.55 * np.clip((x01 - 0.25) / 0.35, 0, 1)
    growl = 1 - growl_depth * (0.5 - 0.5 * np.cos(_phase(growl_rate)))
    src = src * growl
    F1 = _ramp(n, 560, 340, 1.0) * (1 + 0.06 * _slow_random(n, rng, 1.0))
    F2 = _ramp(n, 1150, 760, 1.0)
    F3 = _ramp(n, 2600, 2100, 1.0)
    form = (_sweep_filter(src, F1, "band", q=5.0) * 1.5 + _sweep_filter(src, F2, "band", q=6.0) * 0.8
            + _sweep_filter(src, F3, "band", q=7.0) * 0.25)
    body = _lp(src, 260, 2) * 0.45
    sub = _sine(f * 0.5) * 0.28
    env = _adsr(n, 0.12, 0.0, 1.0, 0.38, 2.0)
    x = _sat((form + body) * env, 3.0) + sub * env
    x = _lp(x, 5000, 2)
    x = _hp(x, 30, 2)
    x = reverb(x, rt60=1.9, wet=0.3, damp_hz=3000, stereo_out=stereo, seed=rng.integers(1 << 30))[: n + _n(0.9)]
    x = fade(x, 0.005, 0.4)
    return normalize(x, -1.0)


if __name__ == "__main__":  # tiny smoke test
    for name in ["ui_tick", "ui_pop", "whoosh", "impact", "sub_drop"]:
        y = globals()[name]()
        print(f"{name:12s} {len(y)/SR:6.3f}s peak {peak_db(y):6.2f} dB centroid {spectral_centroid(y):7.0f} Hz")
