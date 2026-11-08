"""Worst Hotel — art kit. Re-uses the ORIGINAL hotel-clerk drawing (clerk_original.py, unchanged lines)
split into puppet parts, plus new sets drawn in the same ink style. Writes viral-formats/web/assets/worsthotel/art.js
"""
import json, math, random, re
from pathlib import Path

HERE = Path(__file__).parent
src = (HERE / 'clerk_original.py').read_text().split('\n')

# ---- 1) run the original drawing, but route each head line into a named puppet part (lines are 1-based)
PART = {}
for n in range(35, 45): PART[n] = 'h_base'
PART[45] = PART[46] = 'h_brows'
for n in (47, 48, 49): PART[n] = 'h_bags'
PART[50] = 'h_eyes'; PART[51] = 'h_pupils'; PART[52] = PART[53] = 'h_lids'
for n in range(54, 58): PART[n] = 'h_nose'
for n in range(59, 63): PART[n] = 'h_mouth'
for n in range(64, 68): PART[n] = 'h_cigar'
for n in range(69, 76): PART[n] = 'h_beard'
PART[76] = 'h_zits'
out = []
for i, line in enumerate(src, 1):
    if i in PART:
        line = line.replace('head+=', f"P['{PART[i]}']+=")
    if line.startswith("scene+=group(use('body')+use('head')"):
        line = "scene+='<!--GUS-->'"
    if line.startswith('right+=group(use(\'head\')'):
        line = "right+='<!--HEAD-->'"
    if line.startswith("Path(__file__)") or line.startswith("print("):
        line = '#' + line
    out.append(line)
code = 'from collections import defaultdict\nP=defaultdict(str)\n' + '\n'.join(out)
G = {'__file__': str(HERE / 'clerk_original.py')}
exec(compile(code, 'clerk', 'exec'), G)
P = G['P']; defs = G['defs']; scene = G['scene']; right = G['right']; body = G['body']
path, ellipse, rect, use, group = G['path'], G['ellipse'], G['rect'], G['use'], G['group']
ink = '#171510'
# defs without the head/body symbols (kept: gradients, flower, fly, zit)
defs = re.sub(r'<g id="head">.*?</g>(?=<g id="body">|$)', '', defs, flags=re.S)

# blink lids (closed) over the eye whites — same skin, lid line in the middle
blink = ''
for cx, cy in [(93, 113), (174, 122)]:
    blink += ellipse(cx, cy, 28.5, 27.5, 'url(#skin)', ink, 3)
    blink += path(f'M{cx-26} {cy+4}Q{cx} {cy+14} {cx+26} {cy+4}', 'none', ink, 3.5)
order = ['h_base', 'h_brows', 'h_bags', 'h_eyes', 'h_pupils', 'h_lids', 'h_blink', 'h_nose', 'h_mouth', 'h_cigar', 'h_beard', 'h_zits']
P['h_blink'] = blink
HEAD = ''.join(f'<g class="{k}">{P[k]}</g>' for k in order)

# ---- 2) new sets, same ink language (1080×1920 coordinates, stroke ≈ 8)
W = 8
def neon(d, col, w=10):
    return (f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w*3.2}" opacity=".35" filter="url(#glow)"/>'
            f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}"/><path d="{d}" fill="none" stroke="#fff" stroke-width="{w*0.35}" opacity=".8"/>')
NEWDEFS = ('<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>'
           '<filter id="soft"><feGaussianBlur stdDeviation="9"/></filter>'
           '<linearGradient id="night" x2="0" y2="1"><stop stop-color="#1b2347"/><stop offset=".7" stop-color="#3b4a78"/><stop offset="1" stop-color="#5a5f86"/></linearGradient>'
           '<linearGradient id="dawn" x2="0" y2="1"><stop stop-color="#f6b26b"/><stop offset=".6" stop-color="#f7d49a"/><stop offset="1" stop-color="#e8c58f"/></linearGradient>')

def motel(sky):
    s = rect(0, 0, 1080, 1920, f'url(#{sky})', 0)
    if sky == 'night':
        random.seed(4)
        for i in range(70): s += ellipse(random.uniform(0, 1080), random.uniform(0, 900), 2.2, 2.2, '#f4ecc8', 'none')
        s += ellipse(860, 230, 70, 70, '#f3ecc6', ink, 6) + ellipse(835, 215, 12, 10, '#d9cf9f', 'none') + ellipse(880, 260, 9, 8, '#d9cf9f', 'none')
    s += path('M0 1080Q180 960 360 1040T720 1010T1080 1050V1200H0Z', '#4b4a6b' if sky == 'night' else '#c79a66', ink, 6)
    # long motel building
    s += rect(-20, 1060, 1120, 360, '#c9b48f', W) + path('M-30 1060L1110 1060L1080 1000H0Z', '#8a4f3a', ink, W)
    for i, x in enumerate([60, 300, 540, 780, 1020]):
        s += rect(x - 50, 1170, 100, 250, '#3c82c0', W - 2) + ellipse(x + 30, 1300, 7, 7, '#e3bb57', ink, 3)
        s += rect(x + 70, 1170, 90, 90, '#f3d27a' if (i % 2 == 0 or sky != 'night') else '#4a4f62', W - 2)
        s += path(f'M{x-40} 1150h80', 'none', ink, 4) + f'<text x="{x}" y="1146" font-family="Nunito" font-weight="900" font-size="34" text-anchor="middle" fill="#171510">{i+1}</text>'
    s += path('M560 1150q20-30 60-10t50 40', 'none', '#6b5a3a', 5)
    # parking lot
    s += rect(-20, 1420, 1120, 520, '#3b3f4a' if sky == 'night' else '#6c6a63', 0) + path('M-20 1420H1100', 'none', ink, W)
    for x in range(-40, 1100, 220): s += path(f'M{x} 1500l60 400', 'none', '#e9e2c8', 10)
    s += path('M100 1700q60-20 120 10q40 20 0 40q-80 20-120-10Z', '#2c2f38' if sky == 'night' else '#55534d', 'none', 0)
    return s

def neon_sign(on_letters=(1, 1, 1, 1, 1), lit=True):
    s = rect(135, 420, 26, 700, '#5b5d67', W) + rect(100, 1100, 96, 30, '#5b5d67', W)
    s += rect(40, 430, 470, 270, '#22273f', W)
    # palm (neon teal) + MOTEL letters (neon pink)
    palm = 'M300 690C300 600 290 560 285 470M285 470Q230 430 170 455M285 470Q250 410 210 400M285 470Q300 405 350 395M285 470Q340 430 400 452'
    s += neon(palm, '#4fe3d0', 9) if lit else path(palm, 'none', '#3b6f6a', 9)
    s += f'<text x="275" y="660" font-family="Nunito" font-weight="900" font-size="64" text-anchor="middle" fill="#ffe7b0" stroke="{ink}" stroke-width="3">GOLDEN PALM</text>'
    s += rect(60, 720, 430, 150, '#22273f', W)
    for i, ch in enumerate('MOTEL'):
        col = '#ff5fa2' if on_letters[i] else '#5a3546'
        s += f'<g class="ltr ltr{i}"><text x="{100+i*82}" y="840" font-family="Nunito" font-weight="900" font-size="120" text-anchor="middle" fill="none" stroke="{col}" stroke-width="{26 if on_letters[i] else 0}" opacity=".35" filter="url(#glow)">{ch}</text>'
        s += f'<text x="{100+i*82}" y="840" font-family="Nunito" font-weight="900" font-size="120" text-anchor="middle" fill="{col}" stroke="{ink}" stroke-width="4">{ch}</text></g>'
    # review board: 1 star
    s += rect(560, 760, 330, 120, '#eadfc2', W) + f'<text x="725" y="800" font-family="Nunito" font-weight="900" font-size="30" text-anchor="middle" fill="{ink}">GUEST RATING</text>'
    for i in range(5):
        x = 625 + i * 50; star = ' '.join(f'{x+math.cos(a)*20*(1 if k%2==0 else .45):.1f},{845+math.sin(a)*20*(1 if k%2==0 else .45):.1f}' for k, a in enumerate([-math.pi/2 + j*math.pi/5 for j in range(10)]))
        s += f'<polygon points="{star}" fill="{"#f2c33a" if i == 0 else "#cfc3a3"}" stroke="{ink}" stroke-width="4"/>'
    s += rect(620, 880, 20, 300, '#5b5d67', 5) + rect(810, 880, 20, 300, '#5b5d67', 5)
    return s

def bulldozer():
    s = rect(-170, -40, 340, 80, '#2d2b28', W, 40)
    for x in range(-140, 160, 56): s += ellipse(x, 0, 22, 22, '#55524c', ink, 5)
    s += path('M-150 -40V-170H60L120 -110V-40Z', '#f2b632', ink, W) + rect(-110, -300, 150, 135, '#f2b632', W) + rect(-90, -280, 110, 90, '#a9d6e8', 5)
    s += path('M-150 -120H-240V20H-290L-300 -150L-250 -170Z', '#c98e1c', ink, W)
    s += rect(60, -260, 26, 100, '#55524c', 5) + ellipse(73, -275, 18, 12, '#bdb6a6', ink, 4)
    s += path('M-120 -140h150', 'none', ink, 5) + f'<text x="-20" y="-60" font-family="Nunito" font-weight="900" font-size="34" text-anchor="middle" fill="{ink}">DEMO CO.</text>'
    return s

def phone():
    s = rect(190, 380, 700, 1220, '#17181d', 14, 80) + rect(225, 470, 630, 1040, '#ece7d8', 6, 24)
    s += rect(430, 420, 220, 26, '#2b2d34', 0, 13)
    s += rect(225, 470, 630, 120, '#3c82c0', 0, 24) + f'<text x="260" y="550" font-family="Nunito" font-weight="900" font-size="50" fill="#fff">Inbox</text>'
    s += rect(260, 630, 560, 520, '#fffaf0', 5, 18)
    s += ellipse(320, 700, 38, 38, '#d9a8c6', ink, 4) + f'<text x="320" y="714" font-family="Nunito" font-weight="900" font-size="34" text-anchor="middle" fill="{ink}">MF</text>'
    s += f'<text x="375" y="694" font-family="Nunito" font-weight="900" font-size="36" fill="{ink}">Margot Fields</text>'
    s += f'<text x="375" y="732" font-family="Nunito" font-weight="800" font-size="27" fill="#8a7f6a">Luxury Hotel Critic ★★★★★</text>'
    s += f'<text x="290" y="820" font-family="Nunito" font-weight="900" font-size="44" fill="{ink}">My stay is booked.</text>'
    s += f'<text x="290" y="880" font-family="Nunito" font-weight="800" font-size="34" fill="#4a4237">Arriving in <tspan fill="#d6402e" font-weight="900">30 days</tspan>.</text>'
    s += f'<text x="290" y="935" font-family="Nunito" font-weight="800" font-size="34" fill="#4a4237">I rate honestly.</text>'
    s += f'<text x="290" y="1060" font-family="Nunito" font-weight="800" font-size="30" fill="#8a7f6a">— M.F.</text>'
    return s

def roach_svg():
    s = ''
    for i in range(3):
        for sd in (-1, 1): s += f'<path class="leg" d="M{-12+i*12} {sd*4}l-4 {sd*12}l-6 {sd*5}" fill="none" stroke="{ink}" stroke-width="3"/>'
    s += ellipse(0, 0, 26, 13, '#71451e', ink, 4) + ellipse(22, 0, 9, 9, '#4a2a18', ink, 4)
    s += path('M-18 -5q14-7 30 0', 'none', '#a8784a', 3)
    s += path('M28 -4q16-10 30-6M28 4q18 6 32 2', 'none', ink, 2.5)
    return s

def bathroom():
    s = rect(0, 0, 1080, 1920, '#9fb39a', 0)
    for y in range(0, 1500, 90): s += path(f'M0 {y}H1080', 'none', '#7f9479', 4)
    for x in range(0, 1080, 90): s += path(f'M{x} 0V1500', 'none', '#7f9479', 4)
    for x, y, r in [(150, 300, 60), (900, 520, 80), (700, 1200, 50)]: s += ellipse(x, y, r * 1.4, r, '#86955f', 'none')
    s += rect(0, 1500, 1080, 420, '#8d846f', 0) + path('M0 1500H1080', 'none', ink, W)
    s += rect(250, 330, 560, 1190, '#5a3f2c', W)                                       # frame
    s += '<g class="glow"><rect x="270" y="350" width="520" height="1160" fill="#7dff5a" opacity=".85"/></g>'
    s += '<g class="door">' + rect(270, 350, 520, 1160, '#8a5a3a', W) + rect(320, 420, 420, 420, 'none', 6) + rect(320, 900, 420, 520, 'none', 6) + ellipse(720, 940, 22, 22, '#e3bb57', ink, 5)
    s += rect(380, 560, 300, 130, '#f2e6c4', 5) + f'<text x="530" y="640" font-family="Nunito" font-weight="900" font-size="54" text-anchor="middle" fill="{ink}">RESTROOM</text>'
    s += '<g transform="rotate(-8 530 760)">' + rect(410, 720, 240, 90, '#f7e27a', 4) + f'<text x="530" y="778" font-family="Nunito" font-weight="900" font-size="34" text-anchor="middle" fill="#c73b2d">OUT OF ORDER</text></g>'
    s += '</g>'
    return s

def floor_bg():
    s = rect(0, 0, 1080, 1920, '#a59b83', 0)
    for y in range(-60, 1920, 160): s += path(f'M0 {y}H1080', 'none', '#544d3f', 4)
    for x in range(-60, 1200, 180): s += path(f'M{x} 0L{x-120} 1920', 'none', '#544d3f', 4)
    for x, y in [(200, 500), (820, 900), (400, 1500)]: s += path(f'M{x} {y}l40 30l-10 40l50 20', 'none', '#544d3f', 4)
    s += rect(-10, -10, 1100, 260, '#65684c', W) + path('M-10 250H1090', 'none', ink, W)
    return s

def icon_roach(x, y, s): return f'<g transform="translate({x} {y}) scale({s}) rotate(-90)">{roach_svg()}</g>'
def icon_toilet(x, y, s):
    t = rect(-40, -70, 80, 50, '#f4f0e3', 5, 8) + path('M-60 -20H60Q60 40 0 50Q-60 40 -60 -20Z', '#f4f0e3', ink, 5) + rect(-25, 45, 50, 30, '#f4f0e3', 5)
    t += path('M-40 0q40 20 80 0', 'none', '#9fb39a', 6)
    return f'<g transform="translate({x} {y}) scale({s})">{t}</g>'
def vote_card(x, y, label, icon):
    s = f'<g transform="translate({x} {y})">' + rect(-200, -230, 400, 460, '#f1e6c8', W, 30)
    s += icon + f'<text x="0" y="170" font-family="Nunito" font-weight="900" font-size="70" text-anchor="middle" fill="{ink}">{label}</text></g>'
    return s

def phone_chat():
    s = rect(190, 380, 700, 1220, '#17181d', 14, 80) + rect(225, 470, 630, 1040, '#e6ded0', 6, 24)
    s += rect(430, 420, 220, 26, '#2b2d34', 0, 13)
    s += rect(225, 470, 630, 130, '#f6f1e6', 0, 24) + path('M225 600H855', 'none', ink, 4)
    s += ellipse(300, 535, 42, 42, '#d9a8c6', ink, 4) + f'<text x="300" y="550" font-family="Nunito" font-weight="900" font-size="36" text-anchor="middle" fill="{ink}">M</text>'
    s += f'<text x="365" y="530" font-family="Nunito" font-weight="900" font-size="40" fill="{ink}">Margot ❤️‍🩹</text>'
    s += f'<text x="365" y="570" font-family="Nunito" font-weight="800" font-size="26" fill="#8a7f6a">ex-wife · online</text>'
    return s

ART = {
    'defs': defs + NEWDEFS,
    'lobby': scene,                       # 600×1067, Gus removed
    'body': body, 'head': HEAD,
    'closeBg': right,                     # x 604..1200 panel, head removed
    'motelNight': motel('night'), 'motelDawn': motel('dawn'),
    'neon': neon_sign(), 'neonDim': neon_sign((1, 0, 1, 1, 0), True),
    'bulldozer': bulldozer(), 'phone': phone(), 'phoneChat': phone_chat(), 'roach': roach_svg(),
    'bathroom': bathroom(), 'floor': floor_bg(),
    'cardRoach': vote_card(0, 0, 'ROACHES', icon_roach(0, -60, 3.2)), 'cardToilet': vote_card(0, 0, 'TOILET', icon_toilet(0, -60, 1.6)),
}
dst = HERE.parent.parent / 'viral-formats/web/assets/worsthotel/art.js'
dst.write_text('export const ART = ' + json.dumps(ART) + ';\n')
print('art.js', round(dst.stat().st_size / 1024), 'KB', {k: len(v) for k, v in ART.items()})
