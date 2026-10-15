"""Modular dungeon kit: cobbled floor tiles, cut-stone wall panels and caps, doors, stairs, traps, sconces, dressing.

Conventions: Z is up in Blender (exported to Y-up).  Floor tiles are 1x1 centred on the origin with the
cobble tops at z ~ +0.05 (the game sits them on the board).  Wall panels face -Y (glTF +Z) with their base at
z = 0 and the wall line at y = 0 running along X.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import bmesh
from mathutils import Vector, Matrix
V = Vector

# zone indices
ST1, ST2, ST3, ST4, MORTAR, MOSS, MOSS2, WOOD, WOOD2, IRON, GOLD, BONE, DIRT, CLOTH, GLOW_P, GLOW_G, GLOW_O, WATER, RUST, GLASS = range(20)

def kit_zones(stone=0x948c7a):
    def tint(h, f):
        r, g, b = (h >> 16) & 255, (h >> 8) & 255, h & 255
        return (min(255, int(r * f)) << 16) | (min(255, int(g * f)) << 8) | min(255, int(b * f))
    return [
        dict(name='st1', color=tint(stone, 1.0), rough=0.92, var=0.12, var_scale=9, wash=1.2, edge=1.1),
        dict(name='st2', color=tint(stone, 0.82) & 0xffffff, rough=0.92, var=0.12, var_scale=9, wash=1.2, edge=1.1),
        dict(name='st3', color=(int(((stone >> 16) & 255) * 1.1) << 16 | int(((stone >> 8) & 255) * 1.0) << 8 | int((stone & 255) * 0.9)) & 0xffffff, rough=0.92, var=0.12, var_scale=9, wash=1.2, edge=1.1),
        dict(name='st4', color=tint(stone, 0.68), rough=0.95, var=0.1, var_scale=9, wash=1.2, edge=1.0),
        dict(name='mortar', color=0x2a241d, rough=1.0, var=0.06, ao=1.0, wash=0.5, edge=0.0),
        dict(name='moss', color=0x3e6224, rough=0.95, var=0.2, var_scale=12, edge=0.8, wash=0.8),
        dict(name='moss2', color=0x55702a, rough=0.95, var=0.2, var_scale=12, edge=0.8),
        dict(name='wood', color=0x6a4426, rough=0.78, var=0.12, edge=1.0),
        dict(name='wood2', color=0x4a2e18, rough=0.8, var=0.1),
        dict(name='iron', color=0x3a3a42, rough=0.45, metal=0.85, edge=1.4, var=0.06),
        dict(name='gold', color=0xe0b040, rough=0.3, metal=0.9, edge=1.3, var=0.03),
        dict(name='bone', color=0xe6dcc0, rough=0.5, edge=1.3, var=0.06),
        dict(name='dirt', color=0x3a3026, rough=1.0, var=0.12, edge=0.2),
        dict(name='cloth', color=0x8a2a24, rough=0.9, var=0.12),
        dict(name='glowp', color=0xc070ff, rough=0.4, emit=0xa040ff, emit_strength=2.4, ao=0.0, wash=0.0, edge=0.0, var=0.0),
        dict(name='glowg', color=0x70ff90, rough=0.4, emit=0x30ff70, emit_strength=1.8, ao=0.0, wash=0.0, edge=0.0, var=0.0, alpha=0.8),
        dict(name='glowo', color=0xffb050, rough=0.4, emit=0xff8a20, emit_strength=3.0, ao=0.0, wash=0.0, edge=0.0, var=0.0),
        dict(name='water', color=0x1a2a3a, rough=0.04, metal=0.0, var=0.0, ao=0.3, wash=0.0, edge=0.0),
        dict(name='rust', color=0x8a4a22, rough=0.7, metal=0.4, var=0.2, edge=0.8),
        dict(name='glass', color=0x9fd0e8, rough=0.05, alpha=0.5, ao=0.2, wash=0.0, edge=0.0, var=0.0),
    ]

def stone_blob(center, size, rnd, zone, segs=(10, 6), flat=0.55, seed=0.0, rough=0.012):
    """A rounded, slightly irregular stone: squashed sphere with noise relief."""
    sx, sy, sz = size
    rot = (rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), rnd.uniform(0, math.tau))
    bm = sphere(1.0, segs[0], segs[1], loc=(0, 0, 0), scale=(sx, sy, sz * flat), zone=zone)
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Rotation(rot[1], 4, 'Y'), verts=bm.verts)
    noise_displace(bm, rough, 14.0, 2, seed + rnd.random() * 20)
    top = sz * flat * rnd.uniform(0.62, 0.78)
    for v in bm.verts:               # worn flat top
        if v.co.z > top:
            v.co.z = top + (v.co.z - top) * 0.12
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm

def cobble_tile(seed, mossy=0.4, big=False, cols=4, rows=4, wear=1.0):
    rnd = random.Random(seed)
    parts = []
    # mortar bed / dirt
    base = box((1.0, 1.0, 0.07), loc=(0, 0, -0.045), zone=MORTAR)
    parts.append(base)
    cs = 1.0 / cols
    pts = []
    for j in range(rows):
        for i in range(cols):
            jx = rnd.uniform(-0.28, 0.28) * cs + (0.5 * cs if j % 2 else 0.0) * 0.55
            jy = rnd.uniform(-0.28, 0.28) * cs
            x = -0.5 + (i + 0.5) * cs + jx - (0.5 * cs * 0.55 if j % 2 else 0) + 0.0
            y = -0.5 + (j + 0.5) / rows + jy
            x = max(-0.5 + cs * 0.4, min(0.5 - cs * 0.4, x))
            y = max(-0.5 + cs * 0.4, min(0.5 - cs * 0.4, y))
            pts.append((x, y))
    for (x, y) in pts:
        r = cs * rnd.uniform(0.5, 0.58)
        if big:
            r *= 1.05
        h = rnd.uniform(0.05, 0.085)
        zone = rnd.choice([ST1, ST1, ST2, ST3, ST4])
        st = stone_blob((x, y, 0.0), (r * rnd.uniform(0.92, 1.12), r * rnd.uniform(0.92, 1.08), h / 0.5), rnd, zone, flat=0.5, rough=0.008 * wear)
        # clamp the stone's belly into the mortar
        for v in st.verts:
            if v.co.z < -0.04:
                v.co.z = -0.04
        parts.append(st)
    # moss tufts nestled between stones
    for _ in range(int(14 * mossy)):
        x, y = rnd.uniform(-0.45, 0.45), rnd.uniform(-0.45, 0.45)
        parts.append(sphere(rnd.uniform(0.03, 0.06), 8, 5, loc=(x, y, 0.012), scale=(1.0, 1.0, 0.4), zone=rnd.choice([MOSS, MOSS2])))
    bm = merge(parts)
    # moss on stone tops, dirt in the cracks
    rn = random.Random(seed + 5)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.material_index in (ST1, ST2, ST3, ST4):
            n = noise.noise(V((c.x * 9 + seed, c.y * 9, 0)))
            if f.normal.z > 0.35 and n > 0.45 - mossy * 0.55:
                f.material_index = MOSS if n > 0.62 else MOSS2
            elif c.z < 0.0 and n > 0.1:
                f.material_index = DIRT
    return bm

def wall_panel(seed, mossy=0.35, courses=5, height=1.02, width=1.0):
    """A cut-stone facade: running-bond blocks of varied size, protruding randomly, on a recessed mortar plane."""
    rnd = random.Random(seed)
    parts = [box((width + 0.04, 0.24, height), loc=(0, 0.14, height / 2), zone=MORTAR)]
    ch = height / courses
    for c in range(courses):
        z0 = c * ch
        # stone widths in this course, offset every other course
        offset = rnd.uniform(0.0, 0.3) if c % 2 else 0.0
        x = -width / 2 - 0.02 - offset
        while x < width / 2 + 0.02:
            w = rnd.uniform(0.3, 0.52)
            x1 = min(x + w, width / 2 + 0.02)
            xa, xb = max(x, -width / 2 - 0.02), x1
            if xb - xa > 0.12:
                prot = rnd.uniform(0.0, 0.05)
                depth = 0.17
                hh = ch * rnd.uniform(0.9, 0.97)
                zone = rnd.choice([ST1, ST1, ST2, ST3, ST4])
                b = box((xb - xa - 0.018, depth, hh), bevel=rnd.uniform(0.016, 0.026), bsegs=2, loc=((xa + xb) / 2, 0.035 - prot + depth / 2 - 0.02, z0 + ch / 2), zone=zone, smooth=True)
                # relief on the visible front
                bm_n = noise_displace(b, 0.012, 11.0, 2, seed + c * 3.1 + x * 7, mask=lambda v: 1.0 if v.co.y < 0.02 else 0.0)
                parts.append(bm_n)
            x = x1
    bm = merge(parts)
    ridge = random.Random(seed + 9)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.material_index in (ST1, ST2, ST3, ST4):
            n = noise.noise(V((c.x * 7 + seed, c.z * 7, c.y * 7)))
            lowness = 1.0 - c.z / height
            if (f.normal.z > 0.5 and n > 0.3 - mossy * 0.4) or (f.normal.y < -0.6 and lowness * 0.5 + n * 0.7 > 0.85 - mossy * 0.45 and n > 0.15):
                f.material_index = MOSS if n > 0.5 else MOSS2
    return bm

def wall_cap(seed, mossy=0.3):
    rnd = random.Random(seed)
    parts = [box((1.02, 1.02, 0.05), loc=(0, 0, 0.0), zone=MORTAR)]
    # 2x2 or 2x3 flagstones with chipped bevels
    splitx = rnd.uniform(-0.15, 0.15)
    splity = [rnd.uniform(-0.15, 0.15), rnd.uniform(-0.2, 0.2)]
    xs = [-0.51, splitx, 0.51]
    for i in range(2):
        sy = splity[i]
        ys = [-0.51, sy, 0.51]
        for j in range(2):
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
            sl = box((x1 - x0 - 0.02, y1 - y0 - 0.02, 0.1), bevel=0.02, bsegs=2, loc=((x0 + x1) / 2, (y0 + y1) / 2, 0.03), zone=rnd.choice([ST1, ST2, ST3]), smooth=True)
            noise_displace(sl, 0.008, 10, 2, seed + i * 3 + j, mask=lambda v: 1.0 if v.co.z > 0.04 else 0.0)
            parts.append(sl)
    bm = merge(parts)
    for f in bm.faces:
        c = f.calc_center_median()
        n = noise.noise(V((c.x * 6 + seed, c.y * 6, 0)))
        if f.material_index in (ST1, ST2, ST3) and f.normal.z > 0.5 and n > 0.5 - mossy * 0.6:
            f.material_index = MOSS if n > 0.65 else MOSS2
    return bm

# ----------------------------------------------------------------------------------- single-mesh export
def export_single(name, bm_fn, out, Z=None, ao=22, ao_dist=0.14, props=None, edge=0.1, wash=0.6):
    clear()
    Z = Z or kit_zones()
    rig = Rig(name, Z)
    rig.part('mesh', bm_fn(), pivot=(0, 0, 0))
    paint(rig, Z, ao_samples=ao, ao_dist=ao_dist, ao_strength=0.78, wash=wash, edge=edge)
    print('KIT', name, 'tris', tri_count(rig))
    export(rig, os.path.join(out, name + '.glb'), props or {})

def build_floors(out):
    for i in range(6):
        export_single(f'kit_floor{i}', lambda i=i: cobble_tile(100 + i * 17, mossy=0.25 + 0.05 * (i % 3)), out)
    for i in range(4):
        export_single(f'kit_corr{i}', lambda i=i: cobble_tile(300 + i * 23, mossy=0.7, cols=3, rows=4, wear=1.5, big=True), out)

def build_walls(out):
    for i in range(5):
        export_single(f'kit_wall{i}', lambda i=i: wall_panel(500 + i * 31, mossy=0.28 + 0.06 * (i % 3)), out, ao_dist=0.12)
    for i in range(3):
        export_single(f'kit_cap{i}', lambda i=i: wall_cap(700 + i * 13, mossy=0.08), out, ao_dist=0.1)

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'raw')
    what = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['floors', 'walls']
    for w in what:
        {'floors': build_floors, 'walls': build_walls}[w](out)
