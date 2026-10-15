"""Building blocks for animals and monsters: quadruped bodies, heads, wings, tails, serpents."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chars import *

ACC1, ACC2, ACC3, ACC4 = 18, 19, 20, 21

def zx(over=None, extra=()):
    z = zones(**(over or {}))
    for e in extra:
        z.append(e)
    return z

def Zc(name, color, **kw):
    d = dict(name=name, color=color, rough=0.6)
    d.update(kw)
    return d

def finish(rig, Z, out, name, props=None, ao=18):
    paint(rig, Z, ao_samples=ao)
    print('MODEL', name, 'tris', tri_count(rig))
    export(rig, os.path.join(out, name + '.glb'), props or {})

def apply_to_all(rig, fn):
    for ob in rig.parts.values():
        if ob.type == 'MESH':
            bm = bmesh.new(); bm.from_mesh(ob.data)
            fn(bm, ob)
            bm.to_mesh(ob.data); bm.free()
            ob.data.update()

def underside_zone(bm, zone, thresh=-0.35):
    for f in bm.faces:
        if f.normal.z < thresh:
            f.material_index = zone
    return bm

# --------------------------------------------------------------------------------- legs
def leg_bm(legH, girth=1.0, fwd=0.02, hind=False, foot='hoof', zone=SKIN, foot_zone=BONE, claws=False, splay=0.0):
    """Local-coordinate leg hanging from the origin down to z = -legH."""
    k = 1.0 if not hind else -1.0
    pts = [(0, 0, 0), (0, fwd * k * 0.5 + (0.03 if hind else 0), -legH * 0.5), (0, fwd * -0.5 * k * 0.0, -legH + 0.045)]
    lg = skin(pts, [(0, 1), (1, 2)], [(0.07 * girth, 0.07 * girth), (0.048 * girth, 0.05 * girth), (0.036 * girth, 0.04 * girth)], subdiv=2, zone=zone)
    parts = [lg]
    if foot == 'hoof':
        parts.append(cylinder(0.04 * girth, 0.045 * girth, 0.05, 12, loc=(0, 0, -legH + 0.03), zone=foot_zone))
    elif foot == 'paw':
        parts.append(sphere(0.052 * girth, 12, 8, loc=(0, -0.02, -legH + 0.03), scale=(1, 1.35, 0.7), zone=zone))
        for i in (-1, 0, 1):
            parts.append(sphere(0.016 * girth, 6, 4, loc=(i * 0.026 * girth + 0, -0.07, -legH + 0.03), zone=zone))
            if claws:
                parts.append(cone(0.01 * girth, 0.04, 6, loc=(i * 0.026 * girth, -0.095, -legH + 0.026), rot=(-math.pi / 2 - 0.3, 0, 0), zone=CLAW))
    elif foot == 'talon':
        parts.append(sphere(0.045 * girth, 10, 8, loc=(0, -0.02, -legH + 0.03), scale=(1, 1.3, 0.6), zone=zone))
        for i in (-1, 0, 1):
            parts.append(taper([V((i * 0.02, -0.04, -legH + 0.035)), V((i * 0.03 + i * splay, -0.1, -legH + 0.03)), V((i * 0.03 + i * splay, -0.13, -legH + 0.01))], 0.014 * girth, 0.004, sides=6, steps=3, zone=CLAW))
    return merge(parts)

def quad(rig, P):
    """Four-legged body (horse / cat / dog / dragon) with neck. Returns dict of key coordinates."""
    L = P.get('len', 0.5)
    legH = P.get('legH', 0.3)
    g = P.get('girth', 1.0)
    hz = legH + P.get('bodyZ', 0.1)
    up = P.get('neckUp', 1.0)
    nl = P.get('neckLen', 1.0)
    zb = P.get('body_zone', SKIN)
    verts = [(0, L * 0.58, hz - 0.005), (0, 0.0, hz + 0.01), (0, -L * 0.52, hz + 0.03),
             (0, -L * (0.52 + 0.2 * nl), hz + 0.03 + 0.08 * up), (0, -L * (0.52 + 0.4 * nl), hz + 0.03 + 0.22 * up), (0, -L * (0.52 + 0.55 * nl), hz + 0.03 + 0.34 * up)]
    rad = [(0.125 * g, 0.115 * g), (0.14 * g, 0.125 * g), (0.15 * g, 0.14 * g), (0.1 * g, 0.1 * g), (0.078 * g, 0.082 * g), (0.066 * g, 0.07 * g)]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
    if P.get('hump'):
        verts.append((0, -L * 0.3, hz + 0.16)); rad.append((0.06, 0.06)); edges.append((1, len(verts) - 1)) if False else None
    body = skin(verts, edges, rad, subdiv=2, zone=zb)
    parts = [body]
    if P.get('belly_zone') is not None:
        underside_zone(body, P['belly_zone'])
    tb = merge(parts)
    if P.get('fur'):
        noise_displace(tb, P['fur'], 40, 2, 4.0)
    if P.get('scales'):
        ridge_displace(tb, P['scales'], P.get('scale_freq', 38), 2.0)
    rig.part('torso', tb, pivot=(0, 0, hz))
    lx = 0.085 * g + P.get('stance', 0.0)
    ly = L * P.get('legY', 0.52)
    for nm, sx, sy, hind in (('legFL', 1, -1, False), ('legFR', -1, -1, False), ('legBL', 1, 1, True), ('legBR', -1, 1, True)):
        lb = leg_bm(legH, g * (1.1 if hind else 1.0), hind=hind, foot=P.get('foot', 'hoof'), zone=P.get('leg_zone', zb), foot_zone=P.get('foot_zone', BONE),
                    claws=P.get('claws', False), fwd=P.get('legFwd', 0.02))
        if P.get('fur'):
            noise_displace(lb, P['fur'] * 0.8, 40, 2, 5.0)
        if P.get('scales'):
            ridge_displace(lb, P['scales'], P.get('scale_freq', 38), 3.0)
        rig.part(nm, lb, pivot=(sx * lx, sy * ly, hz - 0.04), local=True)
    return dict(hz=hz, L=L, legH=legH, neck_top=Vector((0, -L * (0.52 + 0.55 * nl), hz + 0.03 + 0.34 * up)),
                neck_dir=Vector((0, -0.45, 0.35)).normalized(), rump=Vector((0, L * 0.6, hz + 0.01)), chest=Vector((0, -L * 0.52, hz + 0.03)))

def tail(rig, name, start, pts, r0, r1, zone=SKIN, sides=8, spikes=0, spike_zone=BONE, parent='torso', tuft=None):
    path = [Vector(start)] + [Vector(start) + Vector(p) for p in pts]
    bm = taper(path, r0, r1, power=0.9, steps=8, sides=sides, zone=zone)
    parts = [bm]
    if spikes:
        bez = bezier(path, 4)
        for i in range(spikes):
            t = (i + 1) / (spikes + 1)
            p = bez[int(t * (len(bez) - 1))]
            parts.append(cone(0.03 * (1 - t * 0.5), 0.09 * (1 - t * 0.5), 6, loc=p + V((0, 0, 0.04)), zone=spike_zone))
    if tuft:
        e = path[-1]
        parts.append(sphere(tuft, 12, 8, loc=e + V((0, 0.03, -0.01)), scale=(0.7, 1.4, 0.8), zone=SKIN2))
    b = merge(parts)
    rig.part(name, b, pivot=start, parent=parent)
    return b

# --------------------------------------------------------------------------------- heads
def eyes_pair(parts, c, r, spread, zone_glow=True, zone=None, fwd=-1.0):
    for s in (-1, 1):
        parts.append(sphere(r, 10, 8, loc=(c.x + s * spread, c.y + fwd * r * 0.2, c.z), scale=(1.0, 0.8, 1.0), zone=GLOW if zone_glow else (PUPIL if zone is None else zone)))

def head_horse(pos, scale=1.0, zone=SKIN, mane=None, horn=None, nostril=PUPIL, ears=True):
    x, y, z = pos
    s = scale
    parts = [sphere(0.08 * s, 18, 12, loc=(x, y - 0.03 * s, z), scale=(0.9, 1.2, 1.0), zone=zone),
             sphere(0.06 * s, 16, 10, loc=(x, y - 0.14 * s, z - 0.045 * s), scale=(0.85, 1.7, 0.85), zone=zone)]
    parts.append(sphere(0.052 * s, 12, 8, loc=(x, y - 0.235 * s, z - 0.06 * s), scale=(0.85, 1.0, 0.8), zone=zone))
    for sx in (-1, 1):
        parts.append(sphere(0.013 * s, 6, 4, loc=(x + sx * 0.026 * s, y - 0.275 * s, z - 0.05 * s), zone=nostril))
        parts.append(sphere(0.016 * s, 8, 6, loc=(x + sx * 0.063 * s, y - 0.065 * s, z + 0.035 * s), scale=(0.7, 1, 1), zone=PUPIL))
        if ears:
            parts.append(cone(0.022 * s, 0.07 * s, 6, loc=(x + sx * 0.04 * s, y + 0.02 * s, z + 0.1 * s), rot=(0.1, sx * 0.25, 0), zone=zone))
    if horn:
        parts.append(taper([V((x, y - 0.07 * s, z + 0.07 * s)), V((x, y - 0.13 * s, z + 0.19 * s)), V((x, y - 0.21 * s, z + 0.3 * s))], 0.022 * s, 0.003, sides=8, steps=5, zone=horn))
    return merge(parts)

def head_eagle(pos, scale=1.0, zone=SKIN, beak=GOLD, glow=False):
    x, y, z = pos
    s = scale
    parts = [sphere(0.075 * s, 16, 12, loc=(x, y, z), scale=(0.95, 1.1, 1.0), zone=zone)]
    parts.append(taper([V((x, y - 0.05 * s, z + 0.01 * s)), V((x, y - 0.12 * s, z - 0.005 * s)), V((x, y - 0.165 * s, z - 0.05 * s))], 0.042 * s, 0.006, sides=8, steps=4, zone=beak, scale=(1, 0.8, 1.15)))
    parts.append(taper([V((x, y - 0.05 * s, z - 0.025 * s)), V((x, y - 0.11 * s, z - 0.035 * s)), V((x, y - 0.14 * s, z - 0.04 * s))], 0.025 * s, 0.004, sides=6, steps=3, zone=beak))
    for sx in (-1, 1):
        parts.append(sphere(0.02 * s, 10, 8, loc=(x + sx * 0.052 * s, y - 0.04 * s, z + 0.02 * s), zone=GLOW if glow else PUPIL))
        parts.append(torus(0.024 * s, 0.006, 14, 5, loc=(x + sx * 0.056 * s, y - 0.035 * s, z + 0.02 * s), rot=(0, math.pi / 2, 0), zone=beak))
    for i in range(5):
        a = (i - 2) * 0.35
        parts.append(taper([V((x, y + 0.03 * s, z + 0.05 * s)), V((x + math.sin(a) * 0.04 * s, y + 0.08 * s, z + 0.1 * s)), V((x + math.sin(a) * 0.07 * s, y + 0.12 * s, z + 0.09 * s))], 0.018 * s, 0.003, sides=5, steps=3, zone=zone))
    return merge(parts)

def head_cat(pos, scale=1.0, zone=SKIN, mane=None):
    x, y, z = pos
    s = scale
    parts = [sphere(0.085 * s, 18, 12, loc=(x, y, z), scale=(1.0, 1.0, 0.95), zone=zone),
             sphere(0.05 * s, 14, 10, loc=(x, y - 0.075 * s, z - 0.035 * s), scale=(1.1, 1.0, 0.8), zone=zone),
             sphere(0.02 * s, 8, 6, loc=(x, y - 0.12 * s, z - 0.01 * s), scale=(1.3, 0.8, 0.9), zone=PUPIL)]
    for sx in (-1, 1):
        parts.append(cone(0.03 * s, 0.05 * s, 8, loc=(x + sx * 0.06 * s, y + 0.01 * s, z + 0.085 * s), zone=zone))
        parts.append(sphere(0.016 * s, 8, 6, loc=(x + sx * 0.045 * s, y - 0.07 * s, z + 0.03 * s), zone=GLOW))
        parts.append(cone(0.007 * s, 0.035 * s, 5, loc=(x + sx * 0.02 * s, y - 0.1 * s, z - 0.075 * s), rot=(math.pi, 0, 0), zone=BONE))
    if mane is not None:
        for i in range(16):
            a = i / 16 * math.tau
            parts.append(taper([V((x + math.cos(a) * 0.06 * s, y + 0.04 * s, z + math.sin(a) * 0.06 * s)), V((x + math.cos(a) * 0.12 * s, y + 0.07 * s, z + math.sin(a) * 0.12 * s)), V((x + math.cos(a) * 0.16 * s, y + 0.11 * s, z + math.sin(a) * 0.16 * s - 0.01))], 0.03 * s, 0.006, sides=5, steps=3, zone=mane))
    return merge(parts)

def head_dragon(pos, scale=1.0, zone=SKIN, belly=SKIN2, horn=BONE, glow=GLOW, jaw_part=False):
    """Returns (upper_bm, jaw_bm). Skull points forward along -Y."""
    x, y, z = pos
    s = scale
    up = [sphere(0.1 * s, 20, 14, loc=(x, y, z), scale=(1.0, 1.15, 0.9), zone=zone),
          sphere(0.07 * s, 16, 10, loc=(x, y - 0.15 * s, z - 0.015 * s), scale=(0.9, 1.7, 0.7), zone=zone),
          sphere(0.05 * s, 12, 8, loc=(x, y - 0.27 * s, z - 0.03 * s), scale=(0.85, 1.3, 0.7), zone=zone)]
    for sx in (-1, 1):
        up.append(sphere(0.022 * s, 10, 8, loc=(x + sx * 0.075 * s, y - 0.06 * s, z + 0.05 * s), scale=(0.8, 1.2, 1.0), zone=glow))
        up.append(sphere(0.045 * s, 10, 8, loc=(x + sx * 0.065 * s, y - 0.05 * s, z + 0.06 * s), scale=(0.9, 1.2, 0.6), zone=zone))   # brow
        up.append(taper([V((x + sx * 0.05 * s, y + 0.04 * s, z + 0.07 * s)), V((x + sx * 0.12 * s, y + 0.12 * s, z + 0.14 * s)), V((x + sx * 0.14 * s, y + 0.21 * s, z + 0.12 * s))], 0.04 * s, 0.004, sides=7, steps=6, zone=horn))
        up.append(taper([V((x + sx * 0.08 * s, y + 0.02 * s, z + 0.0)), V((x + sx * 0.15 * s, y + 0.05 * s, z + 0.02 * s)), V((x + sx * 0.2 * s, y + 0.09 * s, z + 0.01 * s))], 0.025 * s, 0.004, sides=6, steps=4, zone=horn))
        up.append(sphere(0.011 * s, 6, 4, loc=(x + sx * 0.02 * s, y - 0.32 * s, z - 0.02 * s), zone=PUPIL))
        for i in range(4):
            up.append(cone(0.007 * s, 0.035 * s, 5, loc=(x + sx * 0.04 * s, y - 0.12 * s - i * 0.045 * s, z - 0.06 * s), rot=(math.pi, 0, 0), zone=BONE))
    for i in range(5):
        up.append(cone(0.012 * s, 0.05 * s, 6, loc=(x, y + 0.08 * s + i * 0.0, z + 0.1 * s - i * 0.02 * s), rot=(-0.6, 0, 0), zone=horn)) if False else None
    jaw = [sphere(0.065 * s, 14, 10, loc=(x, y - 0.12 * s, z - 0.09 * s), scale=(0.8, 1.9, 0.5), zone=belly),
           sphere(0.04 * s, 12, 8, loc=(x, y - 0.25 * s, z - 0.085 * s), scale=(0.8, 1.2, 0.5), zone=belly)]
    for sx in (-1, 1):
        for i in range(4):
            jaw.append(cone(0.007 * s, 0.035 * s, 5, loc=(x + sx * 0.035 * s, y - 0.1 * s - i * 0.045 * s, z - 0.065 * s), zone=BONE))
    jaw.append(sphere(0.03 * s, 10, 6, loc=(x, y - 0.14 * s, z - 0.075 * s), scale=(0.8, 1.8, 0.35), zone=MOUTH))
    return merge(up), merge(jaw)

# --------------------------------------------------------------------------------- wings
def wing_membrane(origin, tips, zone, thick=0.006):
    """Triangle-fan membrane from `origin` (shoulder) through successive finger tip points, plus a trailing-edge sag."""
    bm = bmesh.new()
    o = bm.verts.new(origin)
    vs = [bm.verts.new(t) for t in tips]
    for i in range(len(vs) - 1):
        f = bm.faces.new((o, vs[i], vs[i + 1]))
        f.smooth = True; f.material_index = zone
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=2, use_grid_fill=True)
    # slack between the fingers
    for v in bm.verts:
        d = (v.co - Vector(origin)).length
        v.co.z -= 0.04 * math.sin(d * 9) * 0.3
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    for f in bm.faces:
        f.material_index = zone
        f.smooth = True
    return bm

def bat_wing(rig, name, side, shoulder, span, zone_bone, zone_mem, parent='torso', droop=0.0, fingers=4, thick_arm=0.02):
    """Bat/dragon wing: arm bone + radial fingers + membrane, built in model space around shoulder."""
    sx = side
    sh = Vector(shoulder)
    elbow = sh + V((sx * span * 0.35, 0.02, 0.1 * span))
    wrist = sh + V((sx * span * 0.62, -0.03, 0.2 * span))
    parts = [taper([sh, elbow, wrist], thick_arm, thick_arm * 0.6, sides=8, steps=6, zone=zone_bone)]
    tips = []
    for i in range(fingers):
        t = i / (fingers - 1)
        tip = wrist + V((sx * span * (0.5 - 0.18 * t), (0.12 + t * 0.55) * span * 0.55, -span * (0.05 + 0.5 * t) + droop * span))
        parts.append(taper([wrist, wrist.lerp(tip, 0.5) + V((0, 0, 0.02 * span)), tip], thick_arm * 0.5, thick_arm * 0.12, sides=6, steps=5, zone=zone_bone))
        tips.append(tip)
    parts.append(sphere(thick_arm * 1.2, 8, 6, loc=wrist, zone=zone_bone))
    parts.append(cone(thick_arm * 0.6, 0.05 * span, 6, loc=wrist + V((sx * 0.02, -0.03, 0.03)), rot=(0.5, 0, sx * 0.5), zone=CLAW))
    parts.append(wing_membrane(tuple(sh + V((0, 0.12 * span, -0.14 * span))), [tuple(wrist)] + [tuple(t) for t in tips] + [tuple(sh + V((0, 0.14 * span, -0.18 * span)))], zone_mem, 0.005))
    b = merge(parts)
    rig.part(name, b, pivot=shoulder, parent=parent)
    return b

def leaf(base, tip, width, up, zone, curl=0.02, thick=0.006):
    """A flat, slightly curled feather blade from base to tip."""
    base, tip = Vector(base), Vector(tip)
    d = tip - base
    L = d.length
    dirv = d / L
    side = dirv.cross(up).normalized()
    us = [0.0, 0.12, 0.35, 0.6, 0.85, 1.0]
    ws = [0.18, 0.5, 0.5, 0.46, 0.28, 0.0]
    bm = bmesh.new()
    left, right = [], []
    for u, w in zip(us, ws):
        c = base + dirv * (L * u) + up * (curl * math.sin(u * math.pi))
        left.append(bm.verts.new(c + side * (width * w)))
        right.append(bm.verts.new(c - side * (width * w)))
    for i in range(len(us) - 1):
        if us[i + 1] >= 1.0:
            f = bm.faces.new((left[i], right[i], right[i + 1]))
        else:
            f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        f.smooth = True; f.material_index = zone
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
    for f in bm.faces:
        f.material_index = zone; f.smooth = True
    return bm

def feather_wing(rig, name, side, shoulder, span, zone_main, zone_tip, parent='torso', n=9):
    sx = side
    sh = Vector(shoulder)
    up = V((0, 0, 1))
    elbow = sh + V((sx * span * 0.38, 0.01 * span, 0.04 * span))
    wrist = sh + V((sx * span * 0.7, 0.05 * span, 0.05 * span))
    parts = [taper([sh, elbow, wrist], 0.026, 0.014, sides=8, steps=5, zone=zone_main)]
    # coverts then secondaries then primaries
    for i in range(7):
        t = i / 6
        base = sh.lerp(wrist, 0.1 + 0.8 * t) + V((0, 0.02 * span, 0.012))
        tip = base + V((sx * 0.05 * span, 0.34 * span * (1 - 0.35 * t) + 0.04 * span, -0.012 * span))
        parts.append(leaf(base, tip, 0.1 * span, up, zone_main, curl=0.01 * span))
    for i in range(n):
        t = i / (n - 1)
        base = wrist + V((sx * 0.015 * span, 0.02 * span, 0.01))
        ang = t * 1.0
        tip = wrist + V((sx * span * (0.34 - 0.3 * t), span * (0.1 + 0.55 * t), -0.02 * span - 0.03 * span * t))
        parts.append(leaf(base, tip, 0.095 * span, up, zone_tip if t > 0.3 else zone_main, curl=0.015 * span))
    for i in range(6):
        t = i / 5
        base = sh.lerp(wrist, 0.05 + 0.9 * t)
        tip = base + V((sx * 0.02 * span, 0.5 * span * (0.8 + 0.25 * t) - 0.1 * span * (1 - t), -0.02 * span))
        parts.append(leaf(base + V((0, 0.03 * span, -0.01)), tip, 0.12 * span, up, zone_main if i < 4 else zone_tip, curl=0.012 * span))
    b = merge(parts)
    rig.part(name, b, pivot=shoulder, parent=parent)
    return b

# --------------------------------------------------------------------------------- serpents
def coil(radius=0.3, turns=2.2, rise=0.08, r0=0.07, r1=0.035, zone=SKIN, belly_zone=None, steps=80, sides=10, head_end=True):
    pts, radii = [], []
    n = steps
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        rr = radius * (1.0 - 0.45 * t)
        z = r0 + rise * t * turns + 0.0
        pts.append(V((math.cos(a) * rr, math.sin(a) * rr, z + (0.06 * math.sin(t * 30) * 0.0))))
        radii.append((r0 + (r1 - r0) * t * 0.0 + (0.0), ) if False else (r0 * (1 - t * 0.0) * (0.75 + 0.35 * (1 - t)) , r0 * (0.75 + 0.35 * (1 - t)) * 0.9))
    bm = sweep(pts, radii, sides, zone=zone)
    return bm, pts
