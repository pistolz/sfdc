"""Hand-authored vector illustration. No images, AI generation, or external assets.
Run: python draw_clerk.py. Produces hotel-clerk.svg alongside this file.
"""
from pathlib import Path
import random, math
random.seed(26)
def path(d, fill='none', stroke='#171510', w=4, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" {extra}/>'
def ellipse(x,y,rx,ry,fill,stroke='#171510',w=4):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>'
def rect(x,y,w,h,fill,sw=4,rx=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="#171510" stroke-width="{sw}"/>'
def use(id,x=0,y=0,s=1):
    return f'<use href="#{id}" transform="translate({x} {y}) scale({s})"/>'
def group(content, transform=''):
    return f'<g transform="{transform}">{content}</g>'
skin='#ffb179'; ink='#171510'
defs='''<linearGradient id="skin" x2="0.8" y2="1"><stop stop-color="#ffba86"/><stop offset="1" stop-color="#f6a36c"/></linearGradient>
<radialGradient id="zitGradient"><stop stop-color="#ff9d78"/><stop offset=".55" stop-color="#ed654d"/><stop offset="1" stop-color="#ca4639"/></radialGradient>
<linearGradient id="wall" x2="0" y2="1"><stop stop-color="#74829b"/><stop offset="1" stop-color="#606b80"/></linearGradient>
<clipPath id="left"><rect width="600" height="1067"/></clipPath><clipPath id="right"><rect x="604" width="596" height="1067"/></clipPath>
'''
# Reusable tiny motifs, all vector geometry.
flower=''
for a in range(0,360,72): flower+=group(ellipse(0,-8,6,10,'#f2ce72','none'),f'rotate({a})')
flower+=ellipse(0,0,4,4,'#bf8b3e','none')
defs+=f'<g id="flower">{flower}</g>'
fly=ellipse(-8,-9,5,9,'#f2eedf',ink,2)+ellipse(7,-9,5,9,'#f2eedf',ink,2)+ellipse(0,0,7,6,'#191a17',ink,2)
fly+=path('M-4 4l-3 6M3 4l3 6','none',ink,1.5)
defs+=f'<g id="fly">{fly}</g>'
zit=ellipse(0,0,5,6,'url(#zitGradient)','none')+ellipse(-1.3,-2,1.5,1.6,'#ffd0a0','none')
defs+=f'<g id="zit">{zit}</g>'
# Head in local coordinates; reused at two scales without any embedded image.
head=''
head+=path('M65 116Q34 90 53 51Q35 57 32 73Q18 48 48 23Q29 24 23 14Q57 22 73-5Q104-33 150-16Q184-5 201 35Q210 62 224 55Q223 74 211 76Q227 91 233 88Q229 105 214 108L209 171L58 176Z','#49321f',ink,5)
head+=path('M60 110Q25 84 23 119Q19 155 55 164M207 110Q235 91 241 124Q245 156 211 167','url(#skin)',ink,5)
head+=path('M41 122Q29 110 33 133Q35 142 43 142M225 121Q238 112 231 138L223 142','none',ink,3)
head+=path('M63 64Q66 9 131 5Q180 7 199 45Q213 74 209 118L216 169Q217 205 188 224Q160 246 125 243Q82 245 58 218Q37 197 44 168L52 124Z','url(#skin)',ink,5)
head+=path('M58 115Q47 85 58 51Q62 25 87 14Q105-6 144 0Q162 2 180 16Q139 1 113 21Q81 39 63 39Q88 45 118 25Q144 9 174 21Q141 17 118 36Q88 57 61 48Q62 79 58 115Z','#49321f',ink,4)
head+=path('M64 24Q93-11 135-4M62 31Q95 35 121 11Q143-2 163 10M71 45Q103 49 135 27','none','#946944',3)
head+=path('M198 53Q211 79 206 111L214 128L215 90L224 100Q215 74 211 60Z','#49321f',ink,3)
head+=path('M55 101L49 137L60 130L63 101Z','#49321f',ink,2)
# Forehead creases, brows, eyelids, bags.
head+=path('M91 49Q131 58 169 47M107 65Q137 71 164 62','none','#805335',1.7)
head+=path('M72 89Q86 69 112 79L117 89Q92 81 72 89M148 83Q167 72 190 90L193 101Q169 87 147 93Z',ink,ink,2)
head+=path('M119 72l3 13M139 73l-3 12','none',ink,2)
head+=path('M66 115Q63 157 90 160Q116 158 118 120Z','#a6777b',ink,3)
head+=path('M146 124Q143 161 173 164Q198 165 201 128Z','#a6777b',ink,3)
head+=path('M69 134Q86 160 109 140M151 143Q172 165 192 145','none','#77555c',2)
head+=ellipse(93,113,27,26,'#f5edcf',ink,3)+ellipse(174,122,27,26,'#f5edcf',ink,3)
head+=ellipse(97,118,6,7,ink,'none')+ellipse(171,127,6,7,ink,'none')
head+=path('M66 113Q67 85 94 87Q119 88 120 117Z','#eaa071',ink,3)
head+=path('M147 121Q149 94 176 97Q200 99 201 127Z','#eaa071',ink,3)
head+=path('M123 116Q128 104 136 116L143 139Q162 151 148 161Q133 171 118 159Q105 158 111 145','url(#skin)',ink,3)
head+=ellipse(134,146,15,15,'#ed8c69','none')
head+=path('M111 145Q103 158 119 161Q138 172 151 157','none',ink,3)
for x,y in [(125,137),(137,135),(133,150),(143,147),(121,149)]: head+=ellipse(x,y,1,1,'#ac593b','none')
# Mouth and teeth.
head+=path('M91 191Q107 167 137 179Q154 174 168 192L166 203Q151 194 130 195Q108 194 88 201Z','#34241c',ink,3)
for x,y,w,h in [(99,185,10,11),(111,181,12,13),(136,182,14,14),(151,186,11,12)]:
    head+=rect(x,y,w,h,'#e3c063',1.5,1)
head+=path('M113 211Q132 216 147 211M118 229Q136 236 150 226','none','#ab6946',2)
# Cigar is a separate curved shape.
head+=path('M164 189L218 208Q225 212 220 223Q217 231 209 227L158 203Z','#79512b',ink,3)
head+=ellipse(216,218,7,10,'#aa8053',ink,2)
head+=path('M176 194l-5 12M189 199l-5 13M202 204l-5 14','none','#49331f',2)
for x,y in [(214,214),(218,217),(212,221),(216,224)]: head+=ellipse(x,y,.8,.9,ink,'none')
# Individually placed beard strokes, sparse enough to read as cartoon ink.
for i in range(190):
    x=random.uniform(54,205); y=random.uniform(157,237)
    if ((x-130)/87)**2+((y-180)/64)**2>1: continue
    if 82<x<171 and 172<y<214: continue
    if 109<x<155 and y<170: continue
    if x>158 and 189<y<228: continue
    head+=path(f'M{x:.1f} {y:.1f}l{random.uniform(-1.5,1.5):.1f} -{random.uniform(2,4):.1f}','none',ink,1.4)
for x,y,s in [(177,56,1),(63,159,1),(192,166,.7),(164,222,.75),(76,185,.65)]: head+=use('zit',x,y,s)
defs+=f'<g id="head">{head}</g>'
# Torso, open shirt, skin, undershirt, flowers and seams.
body=path('M96 225Q67 222 45 248L13 346L42 361L30 440Q17 474 39 478L56 465L69 371L80 441Q137 469 217 438L221 366L238 467Q256 489 266 472L263 435L250 350L273 338L236 251Q212 228 185 225Z','url(#skin)',ink,5)
body+=path('M90 233Q137 258 193 233L224 340L223 445Q146 476 72 439L74 341Z','url(#skin)',ink,4)
body+=path('M94 231Q136 260 190 233L211 327Q154 310 77 339L83 281Z','#f5ead0',ink,4)
body+=path('M82 324Q146 299 210 322L212 341Q150 323 77 349Z','#e8dbc1',ink,3)
body+=path('M91 228L64 233Q40 248 14 333L53 354L68 319L55 447L87 454L103 330L87 270L110 279Z','#347c88',ink,5)
body+=path('M187 229L212 235Q239 253 270 334L233 356L222 322L236 447L208 457L180 326L194 272L174 278Z','#347c88',ink,5)
for x,y,s in [(64,253,.8),(42,295,.9),(38,326,.65),(79,300,.65),(76,373,.9),(65,426,.75),(216,264,.7),(237,308,.9),(209,309,.6),(221,376,.8),(222,429,.75)]: body+=use('flower',x,y,s)
body+=path('M65 235l20 36l-18 24M210 235l-18 37l20 24M17 326l37 18M235 344l29-16','none',ink,2)
for x,y in [(110,277),(160,288),(185,308),(94,318)]: body+=path('M0 0q6-8 11 0q12-3 8 7q-1 6-8 3q-8 10-13 0Z','#bba16a','none',0, f'transform="translate({x} {y})"')
body+=path('M135 407q10-9 19 0q-9 13-19 0M146 411q-7 7-3 13','none',ink,2)
for i in range(125):
    x=random.uniform(83,211);y=random.uniform(351,444)
    body+=path(f'M{x:.1f} {y:.1f}l1 3','none','#5d3e2a',1.1)
body+=path('M39 449l-3 19M46 450l-3 18M252 449l3 20M245 449l3 17','none',ink,2)
defs+=f'<g id="body">{body}</g>'
# Scene at 600 x 1067.
scene=rect(0,0,600,1067,'url(#wall)',0)
scene+=rect(0,831,600,236,'#a59b83',0)
for y in [865,923,990,1065]: scene+=path(f'M0 {y}H600','none','#544d3f',3)
for x in [-280,-80,120,320,520,720,920]: scene+=path(f'M300 750L{x} 1067','none','#544d3f',2)
scene+=rect(-12,20,154,128,'#4b3321',5)+rect(0,32,129,102,'#ceac6a',3)+rect(8,40,113,87,'#98afba',2)
scene+=path('M8 99L35 67L62 89L87 61L121 95V127H8Z','#66756b',ink,1)
scene+=path('M8 116Q56 85 121 113V127H8Z','#8a8b51','none')
scene+=rect(-7,192,155,287,'#412d20',5)
for row in range(4):
    for col in range(4):
        x=col*36;y=202+row*67
        scene+=rect(x,y,32,62,'#302d23',2)
        scene+=ellipse(x+16,y+19,5,7,'#e3bb57',ink,2)
        scene+=path(f'M{x+16} {y+24}v24h5m-5-7h5','none','#e3bb57',4)
scene+=rect(446,191,161,387,'#493b2d',5)+rect(458,204,150,366,'#7b796b',3)
scene+=rect(469,269,115,104,'#5c6b76',4)
for y in range(275,366,9):scene+=path(f'M473 {y}H579','none','#404b52',3)
scene+=ellipse(550,84,45,57,'#34332c',ink,5)+ellipse(550,84,37,49,'#c6bea1',ink,3)
for i in range(12):
    a=i*math.pi/6; x=550+30*math.sin(a);y=84-40*math.cos(a)
    scene+=path(f'M{x} {y}l{-3*math.sin(a)} {4*math.cos(a)}','none',ink,2)
scene+=path('M550 48v36l23 14','none',ink,4)
scene+=rect(471,454,125,128,'#32393a',5)+rect(483,467,101,93,'#485256',3)
scene+=path('M538 449V378M517 452H560','none','#554222',7)
scene+=path('M510 338H569L587 394Q548 406 495 394Z','#f0cd77',ink,4)
scene+=path('M523 343L515 394M553 343L565 395','none','#c69a4d',2)
# Legs behind counter.
scene+=path('M225 691L222 857Q246 884 270 859L280 690M325 690L334 859Q359 876 382 854L378 689',skin,ink,5)
for x in [220,334]:
    scene+=path(f'M{x} 837q24 12 51 0l-2 66l25 31q-29 22-71 1l6-30Z','#e5ddbd',ink,4)
    scene+=path(f'M{x+1} 849q25 10 47 0M{x+2} 857q23 10 45 0','none','#aca286',2)
    scene+=path(f'M{x+3} 908q24-17 43 0l29 28q-17 25-66 18l-20-10Z','#62442c',ink,5)
    scene+=path(f'M{x+7} 915l14-10l24 30l-14 12ZM{x+44} 919l12 9l-10 17l-13-10Z','#a18254',ink,3)
scene+=group(use('body')+use('head'), 'translate(128 99) scale(1.38)')
# Stink wisps and flies.
for x,y in [(171,137),(430,140),(97,344)]: scene+=path(f'M{x} {y+125}q-19-25 0-46t0-43q-12-17 0-36','none','#a5a55e',5, 'opacity=".65"')
for x,y,s in [(169,115,.7),(430,119,.85),(98,310,.7),(416,264,.7)]:scene+=use('fly',x,y,s)
# Counter with front panels and wood damage.
scene+='<g transform="translate(0 80)">'
scene+=rect(-6,603,612,150,'#65684c',5)
for x in range(0,601,75):scene+=path(f'M{x} 610V748','none','#333c2e',3)
for x,y,s in [(36,652,2),(177,676,1.5),(310,641,1.6),(460,670,1.5),(556,706,1.2)]:
    scene+=path('M0 0q12-9 17 2l-4 15l9 6l-13 12l-2 16l-9-9l4-15l-7-8Z','#a88e56','none',0,f'transform="translate({x} {y}) scale({s})"')
scene+=path('M0 565L600 565V620H0Z','#92723e',ink,5)+rect(-4,610,610,17,'#4e3524',4)
for x,y in [(18,593),(257,599),(346,580),(465,602)]: scene+=ellipse(x,y,18,3,'#624b2a','none')
# Pizza box, ashtray, mug, bell.
scene+=path('M-8 537L67 521L129 545L124 579L-7 569Z','#e9d9ae',ink,3)
scene+=path('M-8 537l76 19l61-11M68 556v20','none',ink,2)
for x,y in [(20,540),(53,538),(87,546)]:scene+=ellipse(x,y,9,3,'#b78b40','none')
scene+=ellipse(160,576,44,12,'#34312b',ink,3)+path('M118 561v17q44 20 85-1v-17Z','#77776a',ink,3)+ellipse(160,559,42,12,'#292924',ink,3)
for i in range(16):
    x=random.randint(131,185);y=random.randint(539,559);a=random.randint(-35,35)
    scene+=group(rect(-3,-22,6,25,'#e0d7ba',1)+rect(-3,-3,6,7,'#ae7737',1),f'translate({x} {y}) rotate({a})')
scene+=ellipse(371,583,34,8,'#483d22',ink,3)+path('M343 578q-3-34 27-35q28 1 28 35Z','#d0a741',ink,3)
scene+=path('M350 563q5-14 19-13','none','#f8da77',3)+ellipse(370,540,6,4,'#a78132',ink,2)
scene+=path('M516 537q28-11 29 13q0 28-29 22','none',ink,9)+path('M516 537q28-11 29 13q0 28-29 22','none','#e3d5b4',5)
scene+=path('M477 522h43v58q-21 10-43-1Z','#eee0b9',ink,3)+ellipse(499,522,22,6,'#57432e',ink,3)
scene+=path('M488 529v22m18-17v8m-21 15v14','none','#ad9162',4)
scene+=ellipse(439,587,15,7,'#71451e',ink,2)+path('M430 585l-9-10m11 14l-9 7m19-11l14-6m-12 11l9 7','none',ink,2)
scene+='</g>'
# Wastebasket and floor debris.
scene+=path('M-9 887L60 887L48 1007L0 1007Z','#41473b',ink,4)+ellipse(24,887,37,11,'#272d25',ink,3)
for i in range(15):
    x=random.randint(0,54);y=random.randint(868,889)
    scene+=path(f'M{x} {y}l5-9l9 4l5 11l-9 5Z','#d8cfb5',ink,1.5)
scene+=path('M76 1023l16-17l12 5l-4 12l9 11l-24 1Z','#ded6bd',ink,2)
scene+=path('M526 1004l74-8v71h-91Z','#70473a',ink,4)
# Large closeup, same carefully drawn head, matching floral shirt.
right=rect(604,0,596,1067,'#778c99',0)
right+=path('M605 1067V910Q639 818 758 802L1069 800Q1166 826 1200 934V1067Z','#357e89',ink,6)
right+=path('M765 819Q895 898 1048 817L1085 1067H728Z','#f5e5c4',ink,5)
right+=path('M762 803Q738 933 894 965Q1032 955 1050 812Z','url(#skin)',ink,5)
right+=path('M752 811L676 869L751 900L710 945L778 1067L803 922Z','#347c88',ink,5)
right+=path('M1051 811L1129 873L1056 904L1092 944L1030 1067L1003 925Z','#347c88',ink,5)
for x,y,s in [(660,935,1.6),(686,1024,1.8),(750,987,1.1),(1138,947,1.8),(1158,1046,1.5),(1083,1009,1.3)]:right+=use('flower',x,y,s)
right+=group(use('head'),'translate(554 82) scale(2.55 3.25)')
for x,y,s in [(660,91,1.15),(1152,720,.95)]:right+=use('fly',x,y,s)
right+=path('M1118 237q-25-40 0-77t2-79M666 395q-24-35 0-71t-1-64','none','#a3a35b',9,'opacity=".75"')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 1067" width="1200" height="1067" stroke-linecap="round" stroke-linejoin="round">
<title>Hotel clerk — hand-coded SVG illustration</title>
<desc>Entirely vector drawing: two views of a tired hotel clerk. No raster images or external assets.</desc>
<defs>{defs}</defs><g clip-path="url(#left)">{scene}</g><g clip-path="url(#right)">{right}</g><path d="M602 0V1067" stroke="#171510" stroke-width="7"/></svg>'''
# xlink fallback for older SVG renderers.
svg=svg.replace(' href=', ' xlink:href=')
Path(__file__).with_name('hotel-clerk.svg').write_text(svg)
print('Created hotel-clerk.svg')
