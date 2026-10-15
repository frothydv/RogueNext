"""Dungeon props: door, stairwell, 8 trap plates, wall sconce and floor dressing.

Model space: Blender Z up, origin at the cell centre on the floor-top plane (the game lifts the model to the
board).  Front (towards the room / the camera) is -Y, which becomes glTF +Z.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from dungeon_kit import *   # zone constants, kit_zones, stone_blob
import bmesh
from mathutils import Vector, Matrix
V = Vector

def disc(r, h, z0=0.0, seg=28, zone=ST1, bevel_top=0.0):
    return cylinder(r, r, h, seg, loc=(0, 0, z0 + h / 2), zone=zone)

def ring_of(n, R, fn, start=0.0):
    out = []
    for i in range(n):
        a = start + i / n * math.tau
        out.append(fn(i, a, V((math.cos(a) * R, math.sin(a) * R, 0))))
    return out

def rim_stones(R, n, rnd, seed, h=0.06, zone_pool=(ST1, ST2, ST3)):
    parts = []
    for i in range(n):
        a = i / n * math.tau + rnd.uniform(-0.05, 0.05)
        w = R * math.tau / n * 0.56
        parts.append(stone_blob((math.cos(a) * R, math.sin(a) * R, 0.0), (w * rnd.uniform(0.9, 1.1), w * rnd.uniform(0.7, 0.9), h / 0.5), rnd, rnd.choice(zone_pool), flat=0.5, seed=seed))
    return parts

def worn_plate(rnd, seed, R=0.38, zone=ST4):
    """Round flagstone with a chamfered, chipped edge, set in a dark mortar ring."""
    parts = [cylinder(R + 0.035, R + 0.035, 0.04, 28, loc=(0, 0, -0.01), zone=MORTAR)]
    p = cylinder(R * 0.93, R, 0.055, 28, loc=(0, 0, 0.0175), zone=zone, smooth=True)
    bmesh.ops.translate(p, vec=(0, 0, 0.0), verts=p.verts)
    noise_displace(p, 0.007, 9, 2, seed, mask=lambda v: 1.0 if v.co.z > 0.03 else 0.0)
    parts.append(p)
    return parts

def box_holes(parts, n, R, rnd):
    """small dark pits (rendered as dark dirt discs sunk below the surface)."""
    pass

# ----------------------------------------------------------------------------------- door
def door_threshold(seed):
    rnd = random.Random(seed)
    parts = [box((1.0, 1.0, 0.06), loc=(0, 0, -0.01), zone=MORTAR)]
    for i in range(3):
        x0 = -0.5 + i / 3.0
        s = box((1 / 3.0 - 0.025, 0.46, 0.07), bevel=0.016, bsegs=2, loc=(x0 + 1 / 6.0, 0.0, 0.015), zone=rnd.choice([ST1, ST2, ST3]), smooth=True)
        noise_displace(s, 0.006, 11, 2, seed + i, mask=lambda v: 1.0 if v.co.z > 0.03 else 0.0)
        parts.append(s)
    return merge(parts)

def door_leaf(seed):
    """Plank door lying along +X from the hinge at x = 0 (local), spanning 0.84 wide, 0.9 tall, 0.07 thick."""
    rnd = random.Random(seed)
    W, H, T = 0.86, 0.92, 0.07
    parts = []
    n = 6
    pw = W / n
    for i in range(n):
        x = pw * (i + 0.5)
        h = H * rnd.uniform(0.985, 1.0)
        zone = WOOD if rnd.random() < 0.6 else WOOD2
        pl = box((pw - 0.008, T * rnd.uniform(0.9, 1.0), h), bevel=0.006, bsegs=2, loc=(x, 0, 0.5 * h + 0.005), zone=zone, smooth=True)
        noise_displace(pl, 0.005, 14, 2, seed + i * 1.7, mask=lambda v: 1.0 if v.co.y < 0 else 0.0)
        parts.append(pl)
    # iron straps with studs, plus a hinge eye and ring pull
    for z in (0.2, 0.7):
        parts.append(box((W + 0.02, 0.012, 0.075), bevel=0.004, loc=(W / 2, -T / 2 - 0.004, z), zone=IRON, smooth=True))
        parts.append(box((W + 0.02, 0.012, 0.075), bevel=0.004, loc=(W / 2, T / 2 + 0.004, z), zone=IRON, smooth=True))
        for k in range(5):
            parts.append(sphere(0.011, 8, 5, loc=(0.1 + k * 0.17, -T / 2 - 0.012, z), scale=(1, 0.7, 1), zone=IRON))
        parts.append(torus(0.03, 0.007, 14, 6, loc=(-0.0, 0.0, z), rot=(math.pi / 2, 0, 0), zone=IRON))
    parts.append(box((0.07, 0.014, 0.16), bevel=0.005, loc=(W - 0.1, -T / 2 - 0.008, 0.45), zone=IRON, smooth=True))
    parts.append(torus(0.034, 0.007, 16, 6, loc=(W - 0.1, -T / 2 - 0.03, 0.42), rot=(math.pi / 2, 0, 0), zone=IRON))
    parts.append(box((0.03, 0.01, 0.045), loc=(W - 0.1, -T / 2 - 0.012, 0.58), zone=GOLD))
    return merge(parts)

def build_door(out):
    Z = kit_zones()
    clear()
    rig = Rig('kit_door', Z)
    rig.part('base', door_threshold(11), pivot=(0, 0, 0))
    # hinge pivot: cell-centre coords of the old three.js hinge (x -0.42, z -0.38 -> blender y +0.38)
    hp = (-0.42, 0.38, 0.04)
    rig.node('hinge', pivot=hp)
    leaf = door_leaf(21)
    # leaf bm is built with the hinge at its origin, so place it at the pivot directly
    rig.part('leaf', leaf, pivot=hp, parent='hinge', local=True)
    paint(rig, Z, ao_samples=22, ao_dist=0.08, ao_strength=0.7, wash=0.5, edge=0.12)
    print('KIT door tris', tri_count(rig))
    export(rig, os.path.join(out, 'kit_door.glb'), {})

# ----------------------------------------------------------------------------------- stairs
def stair_well(seed):
    rnd = random.Random(seed)
    parts = []
    # board-level base with a square sunk pit; descending concentric steps ringed by a stone collar
    parts.append(box((1.0, 1.0, 0.05), loc=(0, 0, -0.04), zone=MORTAR))
    # descending square rings (outer, inner, top height), then the dark well
    rings = [(0.72, 0.60, 0.035, ST1), (0.60, 0.48, 0.012, ST2), (0.48, 0.36, -0.011, ST3), (0.36, 0.24, -0.034, ST4)]
    for (o, i_, z, zone) in rings:
        t = (o - i_) / 2
        for (cx, cy, sx, sy) in [(0, -(o - t) / 2, o, t), (0, (o - t) / 2, o, t), (-(o - t) / 2, 0, t, o - 2 * t), ((o - t) / 2, 0, t, o - 2 * t)]:
            parts.append(box((sx, sy, 0.05), bevel=0.006, bsegs=2, loc=(cx, cy, z - 0.025), zone=zone, smooth=True))
    parts.append(box((0.26, 0.26, 0.02), loc=(0, 0, -0.055), zone=MORTAR))
    # collar: 12 stone blocks around the opening
    for i in range(4):
        for j in range(3):
            along = -0.42 + j * 0.42 + rnd.uniform(-0.02, 0.02)
            if i == 0: c, sz = (along, -0.43), (0.36, 0.14)
            elif i == 1: c, sz = (along, 0.43), (0.36, 0.14)
            elif i == 2: c, sz = (-0.43, along), (0.14, 0.36)
            else: c, sz = (0.43, along), (0.14, 0.36)
            b = box((sz[0] * rnd.uniform(0.95, 1.05), sz[1], 0.1), bevel=0.014, bsegs=2, loc=(c[0], c[1], 0.0), zone=rnd.choice([ST1, ST2, ST3]), smooth=True)
            noise_displace(b, 0.008, 10, 2, seed + i * 5 + j, mask=lambda v: 1.0 if v.co.z > 0.03 else 0.0)
            parts.append(b)
    for k in range(5):
        parts.append(sphere(rnd.uniform(0.03, 0.05), 8, 5, loc=(rnd.uniform(-0.42, 0.42), rnd.choice([-0.45, 0.45]), 0.045), scale=(1, 1, 0.4), zone=rnd.choice([MOSS, MOSS2])))
    return merge(parts)

def build_stairs(out):
    export_single('kit_stairs', lambda: stair_well(31), out, ao=24, ao_dist=0.12)

# ----------------------------------------------------------------------------------- traps
def trap_base(rnd, seed, zone=ST4, R=0.37):
    return worn_plate(rnd, seed, R=R, zone=zone)

def holes(rnd, pts, r=0.032):
    out = []
    for (x, y) in pts:
        out.append(cylinder(r, r * 0.9, 0.01, 12, loc=(x, y, 0.047), zone=DIRT))
        out.append(torus(r + 0.004, 0.005, 12, 5, loc=(x, y, 0.047), zone=IRON))
    return out

def trap_0():   # trapdoor: plank hatch with iron ring, slightly ajar over a black gap
    rnd = random.Random(1)
    parts = [box((0.8, 0.8, 0.05), loc=(0, 0, -0.01), zone=MORTAR)]
    parts.append(box((0.72, 0.72, 0.02), loc=(0, 0, 0.0), zone=DIRT))
    for i in range(5):
        x = -0.29 + i * 0.145
        pl = box((0.135, 0.68, 0.035), bevel=0.006, loc=(x, 0.0, 0.03), zone=WOOD if i % 2 else WOOD2, smooth=True)
        noise_displace(pl, 0.004, 14, 2, 3 + i, mask=lambda v: 1.0 if v.co.z > 0.03 else 0.0)
        parts.append(pl)
    for y in (-0.22, 0.22):
        parts.append(box((0.74, 0.06, 0.012), bevel=0.004, loc=(0, y, 0.052), zone=IRON, smooth=True))
    parts.append(torus(0.05, 0.009, 16, 6, loc=(0.0, -0.05, 0.065), rot=(0.3, 0, 0), zone=IRON))
    parts.append(box((0.82, 0.07, 0.012), loc=(0, 0.4, 0.04), zone=IRON))
    return merge(parts)

def trap_1():   # arrow trap: slab with three arrow slits and projecting arrow heads
    rnd = random.Random(2)
    parts = trap_base(rnd, 2)
    pts = [(-0.18, -0.12), (0.18, -0.12), (0.0, 0.16)]
    parts += holes(rnd, pts, 0.04)
    for (x, y) in pts:
        parts.append(cylinder(0.006, 0.006, 0.18, 6, loc=(x, y, 0.11), rot=(0.25, 0, 0), zone=WOOD))
        parts.append(cone(0.022, 0.07, 5, loc=(x, y, 0.21), rot=(0.25, 0, 0), zone=IRON))
    parts.append(box((0.55, 0.05, 0.012), loc=(0, -0.3, 0.05), zone=RUST))
    return merge(parts)

def trap_2():   # sleeping gas: bronze grate venting green gas
    rnd = random.Random(3)
    parts = trap_base(rnd, 3)
    parts.append(cylinder(0.24, 0.24, 0.012, 24, loc=(0, 0, 0.05), zone=GLOW_G))
    for i in range(-3, 4):
        parts.append(box((0.5, 0.025, 0.02), bevel=0.004, loc=(0, i * 0.06, 0.062), zone=GOLD if abs(i) % 2 == 0 else RUST, smooth=True))
    parts.append(torus(0.26, 0.018, 24, 6, loc=(0, 0, 0.06), zone=GOLD))
    for (x, y) in [(0.1, 0.1), (-0.08, -0.12), (0.0, 0.2)]:
        parts.append(sphere(0.045, 8, 6, loc=(x, y, 0.14), scale=(1, 1, 0.8), zone=GLOW_G))
    return merge(parts)

def trap_3():   # bear trap: open iron jaws with teeth around a trigger plate
    rnd = random.Random(4)
    parts = [cylinder(0.3, 0.3, 0.02, 18, loc=(0, 0, 0.01), zone=DIRT)]
    for side in (-1, 1):
        # a semicircular jaw lying open on each side of the trigger plate
        arc = [V((math.cos(a) * 0.27, side * math.sin(a) * 0.27, 0.045)) for a in [i / 12 * math.pi for i in range(13)]]
        parts.append(sweep(arc, [0.024] * len(arc), 6, zone=IRON, caps=True))
        for k in range(10):
            a = (k + 0.5) / 10 * math.pi
            parts.append(cone(0.024, 0.11, 4, loc=(math.cos(a) * 0.27, side * math.sin(a) * 0.27, 0.1), zone=IRON))
    parts.append(cylinder(0.07, 0.07, 0.02, 12, loc=(0, 0, 0.04), zone=RUST))
    parts.append(torus(0.05, 0.008, 12, 5, loc=(0, 0.28, 0.05), rot=(math.pi / 2, 0, 0), zone=IRON))
    parts.append(sweep([V((0, 0.27, 0.05)), V((0.1, 0.4, 0.04)), V((0.2, 0.42, 0.03)), V((0.28, 0.36, 0.03))], [0.008] * 4, 5, zone=IRON))
    return merge(parts)

def trap_4():   # teleport: inlaid glowing violet spiral
    rnd = random.Random(5)
    parts = trap_base(rnd, 5, zone=ST2)
    pts = []
    n = 40
    for i in range(n):
        a = i / n * 4.2 * math.pi
        r = 0.04 + i / n * 0.26
        pts.append(V((math.cos(a) * r, math.sin(a) * r, 0.058)))
    parts.append(sweep(pts, [0.013] * n, 6, zone=GLOW_P))
    parts.append(torus(0.33, 0.012, 30, 6, loc=(0, 0, 0.055), zone=GLOW_P))
    for i in range(8):
        a = i / 8 * math.tau
        parts.append(box((0.03, 0.03, 0.015), loc=(math.cos(a) * 0.33, math.sin(a) * 0.33, 0.064), rot=(0, 0, a), zone=GLOW_P))
    return merge(parts)

def trap_5():   # dart trap: slab with five tiny holes and dart tips
    rnd = random.Random(6)
    parts = trap_base(rnd, 6)
    pts = [(-0.2, 0.1), (0.0, 0.18), (0.2, 0.1), (-0.12, -0.14), (0.12, -0.14)]
    parts += holes(rnd, pts, 0.026)
    for (x, y) in pts:
        parts.append(cylinder(0.005, 0.005, 0.12, 6, loc=(x, y, 0.11), rot=(0.18, 0, 0), zone=WOOD2))
        parts.append(cone(0.012, 0.045, 5, loc=(x, y, 0.19), rot=(0.18, 0, 0), zone=IRON))
        parts.append(cone(0.016, 0.03, 4, loc=(x, y - 0.012, 0.075), rot=(0.18 + math.pi, 0, 0), zone=CLOTH))
    return merge(parts)

def trap_6():   # rust trap: stained slab with a nozzle and a drip
    rnd = random.Random(7)
    parts = trap_base(rnd, 7)
    for i in range(7):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0.0, 0.25)
        parts.append(cylinder(rnd.uniform(0.05, 0.1), rnd.uniform(0.05, 0.1), 0.006, 10, loc=(math.cos(a) * r, math.sin(a) * r, 0.052), zone=RUST))
    parts.append(cylinder(0.04, 0.03, 0.09, 12, loc=(0, 0, 0.1), zone=IRON))
    parts.append(torus(0.045, 0.012, 14, 6, loc=(0, 0, 0.15), zone=RUST))
    parts.append(sphere(0.035, 10, 8, loc=(0, 0, 0.065), scale=(1, 1, 1.3), zone=GLASS))
    parts.append(cylinder(0.11, 0.11, 0.005, 16, loc=(0, 0, 0.055), zone=GLASS))
    return merge(parts)

def trap_7():   # mystery: ring of runes around a floating orb socket
    rnd = random.Random(8)
    parts = trap_base(rnd, 8, zone=ST3)
    parts.append(torus(0.28, 0.012, 28, 6, loc=(0, 0, 0.058), zone=GLOW_P))
    parts.append(torus(0.18, 0.01, 22, 6, loc=(0, 0, 0.058), zone=GLOW_O))
    for i in range(6):
        a = i / 6 * math.tau
        parts.append(box((0.045, 0.012, 0.012), loc=(math.cos(a) * 0.23, math.sin(a) * 0.23, 0.06), rot=(0, 0, a + 0.4), zone=GLOW_P))
    parts.append(sweep([V((0, 0.07, 0.06)), V((0.05, 0.07, 0.06)), V((0.06, 0.02, 0.06)), V((0.0, -0.02, 0.06)), V((0.0, -0.06, 0.06))], [0.01] * 5, 5, zone=GLOW_O))
    parts.append(sphere(0.02, 8, 6, loc=(0.0, -0.1, 0.06), zone=GLOW_O))
    return merge(parts)

TRAPS = [trap_0, trap_1, trap_2, trap_3, trap_4, trap_5, trap_6, trap_7]

def build_traps(out):
    for i, fn in enumerate(TRAPS):
        export_single(f'kit_trap{i}', fn, out, ao=14, ao_dist=0.08)

# ----------------------------------------------------------------------------------- sconce
def sconce():
    rnd = random.Random(41)
    parts = []
    # wall plate + iron arm + cup + wooden torch.  Wall at y = 0, room towards -Y; torch head at (0, -0.14, 0.36)
    parts.append(box((0.12, 0.03, 0.26), bevel=0.006, loc=(0, 0.0, 0.0), zone=IRON, smooth=True))
    for z in (-0.1, 0.1):
        parts.append(sphere(0.012, 8, 5, loc=(0, -0.018, z), zone=IRON))
    arm = taper([V((0, -0.01, -0.02)), V((0, -0.08, 0.03)), V((0, -0.13, 0.08))], 0.016, 0.012, sides=6, steps=6, zone=IRON)
    parts.append(arm)
    parts.append(cylinder(0.05, 0.034, 0.07, 12, loc=(0, -0.14, 0.12), zone=IRON))
    parts.append(torus(0.047, 0.008, 12, 5, loc=(0, -0.14, 0.155), zone=IRON))
    stick = cylinder(0.022, 0.028, 0.26, 10, loc=(0, -0.14, 0.26), zone=WOOD, smooth=True)
    noise_displace(stick, 0.004, 14, 2, 9)
    parts.append(stick)
    parts.append(cylinder(0.034, 0.03, 0.05, 10, loc=(0, -0.14, 0.40), zone=WOOD2))
    return merge(parts)

def build_sconce(out):
    export_single('kit_sconce', sconce, out, ao=14, ao_dist=0.06)

# ----------------------------------------------------------------------------------- floor dressing
def d_bones():
    rnd = random.Random(51)
    parts = []
    def bone(p0, p1, r):
        s = sweep([V(p0), V(p1)], [r, r], 6, zone=BONE)
        for p in (p0, p1):
            for off in (-1, 1):
                d = (V(p1) - V(p0)).normalized()
                n = V((-d.y, d.x, 0))
                parts.append(sphere(r * 1.5, 8, 5, loc=V(p) + n * r * 0.9 * off, zone=BONE))
        parts.append(s)
    bone((-0.2, -0.1, 0.02), (0.1, -0.2, 0.02), 0.014)
    bone((-0.1, 0.1, 0.02), (0.2, 0.18, 0.02), 0.012)
    bone((0.0, 0.0, 0.02), (0.18, -0.06, 0.02), 0.011)
    # skull
    parts.append(sphere(0.07, 14, 10, loc=(-0.12, 0.08, 0.07), scale=(1, 1.1, 0.9), zone=BONE))
    parts.append(box((0.07, 0.06, 0.04), bevel=0.01, loc=(-0.12, 0.0, 0.045), zone=BONE, smooth=True))
    for sx in (-1, 1):
        parts.append(sphere(0.02, 8, 6, loc=(-0.12 + sx * 0.03, 0.025, 0.08), zone=DIRT))
    # ribs
    for k in range(4):
        pts = [V((0.12 + k * 0.03, -0.12, 0.02)), V((0.12 + k * 0.03, -0.15, 0.08)), V((0.12 + k * 0.03, -0.1, 0.1))]
        parts.append(sweep(bezier(pts, 4), [0.006] * (len(bezier(pts, 4))), 5, zone=BONE))
    return merge(parts)

def d_rubble():
    rnd = random.Random(52)
    parts = []
    for i in range(12):
        s = rnd.uniform(0.04, 0.12)
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0.0, 0.3)
        b = sphere(1.0, 7, 5, loc=(math.cos(a) * r, math.sin(a) * r, s * 0.4), scale=(s, s * rnd.uniform(0.7, 1.2), s * 0.7), zone=rnd.choice([ST1, ST2, ST3, ST4]))
        noise_displace(b, 0.02, 9, 2, i * 3.3)
        parts.append(b)
    for i in range(4):
        parts.append(sphere(rnd.uniform(0.03, 0.05), 8, 5, loc=(rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 0.012), scale=(1, 1, 0.4), zone=DIRT))
    return merge(parts)

def d_mushrooms():
    rnd = random.Random(53)
    parts = []
    for i in range(7):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0.0, 0.16)
        x, y = math.cos(a) * r, math.sin(a) * r
        h = rnd.uniform(0.07, 0.16); cr = rnd.uniform(0.04, 0.085)
        parts.append(taper([V((x, y, 0)), V((x + rnd.uniform(-0.02, 0.02), y, h * 0.5)), V((x, y, h))], 0.012, 0.008, sides=6, steps=3, zone=BONE))
        cap = sphere(cr, 12, 7, loc=(x, y, h), scale=(1, 1, 0.55), zone=GLOW_G if i % 3 == 0 else CLOTH)
        for v in cap.verts:
            if v.co.z < h - 0.005:
                v.co.z = h - 0.005
        parts.append(cap)
    return merge(parts)

def d_pottery():
    rnd = random.Random(54)
    parts = []
    # broken urn: wedge shards and a toppled half-pot
    pot = sphere(0.1, 14, 10, loc=(-0.06, 0.04, 0.09), scale=(1, 1, 0.9), zone=RUST)
    for v in list(pot.verts):
        if v.co.x > -0.02 and v.co.z > 0.07:
            v.co.x = -0.02 + (v.co.x + 0.02) * 0.2
            v.co.z = 0.07 + (v.co.z - 0.07) * 0.2
    parts.append(pot)
    for i in range(7):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0.1, 0.3)
        parts.append(box((rnd.uniform(0.03, 0.07), rnd.uniform(0.03, 0.05), 0.012), bevel=0.003, loc=(math.cos(a) * r, math.sin(a) * r, 0.01), rot=(rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), rnd.uniform(0, 3)), zone=RUST, smooth=True))
    parts.append(sphere(0.04, 8, 6, loc=(0.2, -0.18, 0.04), scale=(1, 1, 0.4), zone=GOLD))
    for i in range(3):
        parts.append(cylinder(0.018, 0.018, 0.006, 10, loc=(0.1 + i * 0.05, -0.2 + i * 0.02, 0.006), zone=GOLD))
    return merge(parts)

def d_cobweb():
    """Corner cobweb: radial threads and arcs in the x/y plane, drooping at the corner."""
    parts = []
    c = V((0.5, 0.5, 0.3))
    spokes = []
    for i in range(6):
        a = math.pi + i / 5 * math.pi / 2
        spokes.append(a)
        parts.append(sweep([c, c + V((math.cos(a) * 0.46, math.sin(a) * 0.46, -0.16))], [0.0025, 0.0015], 4, zone=BONE, caps=False))
    for k in range(1, 5):
        r = k * 0.1
        pts = [c + V((math.cos(a) * r, math.sin(a) * r, -r * 0.36 - 0.01 * math.sin(a * 5))) for a in [math.pi + t / 10 * math.pi / 2 for t in range(11)]]
        parts.append(sweep(pts, [0.002] * len(pts), 4, zone=BONE, caps=False))
    return merge(parts)

def d_crate():
    rnd = random.Random(55)
    parts = []
    parts.append(box((0.3, 0.3, 0.3), bevel=0.012, loc=(-0.1, 0.05, 0.15), rot=(0, 0, 0.3), zone=WOOD, smooth=True))
    for z in (0.04, 0.26):
        parts.append(box((0.32, 0.32, 0.03), bevel=0.006, loc=(-0.1, 0.05, z), rot=(0, 0, 0.3), zone=WOOD2, smooth=True))
    for sx in (-0.13, 0.13):
        parts.append(box((0.03, 0.32, 0.31), bevel=0.006, loc=(-0.1 + sx * math.cos(0.3), 0.05 + sx * math.sin(0.3), 0.15), rot=(0, 0, 0.3), zone=WOOD2, smooth=True))
    parts.append(cylinder(0.11, 0.1, 0.24, 14, loc=(0.2, -0.12, 0.12), zone=WOOD, smooth=True))
    for z in (0.05, 0.19):
        parts.append(torus(0.108, 0.008, 18, 5, loc=(0.2, -0.12, z), zone=IRON))
    return merge(parts)

DECOR = {'bones': d_bones, 'rubble': d_rubble, 'mushrooms': d_mushrooms, 'pottery': d_pottery, 'cobweb': d_cobweb, 'crate': d_crate}

def build_decor(out):
    for name, fn in DECOR.items():
        export_single(f'kit_d_{name}', fn, out, ao=16, ao_dist=0.07)

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'raw')
    all_ = {'door': build_door, 'stairs': build_stairs, 'traps': build_traps, 'sconce': build_sconce, 'decor': build_decor}
    what = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(all_)
    for w in what:
        all_[w](out)
