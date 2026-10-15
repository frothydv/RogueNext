"""Character construction kit: a parametric humanoid, weapons, and shared zone palette."""
import math
from mathutils import Vector
import bmesh
from lib import *

# standard colour zones (indices are used by every humanoid)
SKIN, CLOTH, CLOTH2, LEATHER, METAL, GOLD, HAIR, WOOD, EYEW, PUPIL, BONE, BOOT, CAPE, MOUTH, GLOW, FLAME, SKIN2, CLAW = range(18)

def zones(**over):
    z = [
        dict(name='skin', color=0xe3b08a, rough=0.55, wash=1.0, var=0.05),
        dict(name='cloth', color=0x2f5d9a, rough=0.9, var=0.09),
        dict(name='cloth2', color=0x3a2a1a, rough=0.9, var=0.08),
        dict(name='leather', color=0x6b4423, rough=0.7, var=0.08, edge=1.2),
        dict(name='metal', color=0xaeb4c0, rough=0.28, metal=0.85, edge=1.6, var=0.04),
        dict(name='gold', color=0xd9a93c, rough=0.3, metal=0.9, edge=1.5, var=0.03),
        dict(name='hair', color=0x4a2c1a, rough=0.7, var=0.12),
        dict(name='wood', color=0x6e4a2a, rough=0.8, var=0.1, edge=1.0),
        dict(name='eyew', color=0xf4f0e8, rough=0.15, ao=0.4, wash=0.0, edge=0.0, var=0.0),
        dict(name='pupil', color=0x16161c, rough=0.1, ao=0.2, wash=0.0, edge=0.0, var=0.0),
        dict(name='bone', color=0xe8dec0, rough=0.45, edge=1.3),
        dict(name='boot', color=0x3a2616, rough=0.75, edge=1.2),
        dict(name='cape', color=0x9a2a22, rough=0.9, var=0.1),
        dict(name='mouth', color=0x4a1414, rough=0.4, wash=0.0, edge=0.0),
        dict(name='glow', color=0xffd040, rough=0.3, emit=0xffc020, emit_strength=3.0, ao=0.0, wash=0.0, edge=0.0, var=0.0),
        dict(name='flame', color=0xffa030, rough=0.5, emit=0xff8020, emit_strength=4.0, ao=0.0, wash=0.0, edge=0.0, var=0.0),
        dict(name='skin2', color=0xc98a6a, rough=0.5),
        dict(name='claw', color=0xd8cdb0, rough=0.4, edge=1.4),
    ]
    for k, v in over.items():
        idx = {'skin': SKIN, 'cloth': CLOTH, 'cloth2': CLOTH2, 'leather': LEATHER, 'metal': METAL, 'gold': GOLD, 'hair': HAIR, 'wood': WOOD,
               'bone': BONE, 'boot': BOOT, 'cape': CAPE, 'glow': GLOW, 'skin2': SKIN2, 'mouth': MOUTH, 'claw': CLAW, 'eyew': EYEW, 'pupil': PUPIL}[k]
        if isinstance(v, dict):
            z[idx].update(v)
        else:
            z[idx]['color'] = v
    return z

V = Vector

def relief(bm, amp, scale, seed=0.0, zone_filter=None):
    """Noise relief only on faces/verts that belong to the given zone(s)."""
    zs = None if zone_filter is None else (set(zone_filter) if isinstance(zone_filter, (list, tuple, set)) else {zone_filter})
    if zs is None:
        return noise_displace(bm, amp, scale, 2, seed)
    ok = set()
    for f in bm.faces:
        if f.material_index in zs:
            for v in f.verts:
                ok.add(v.index)
    bm.verts.ensure_lookup_table()
    return noise_displace(bm, amp, scale, 2, seed, mask=lambda v: 1.0 if v.index in ok else 0.0)

def shell(bm, thickness=0.01):
    """Give a surface thickness (solidify) so open shells such as hoods and capes are two-sided."""
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thickness)
    return bm

def delete_faces_where(bm, fn):
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if fn(f.calc_center_median())], context='FACES')
    return bm

# --------------------------------------------------------------------------------- weapons
def w_mace(rig, hand_world, spiked=True):
    x, y, z = hand_world
    shaft = cylinder(0.014, 0.017, 0.32, 10, loc=(x, y - 0.02, z + 0.06), rot=(-0.25, 0, 0), zone=WOOD)
    # head: ball with flanges
    hc = V((x, y - 0.075, z + 0.2))
    parts = [shaft]
    parts.append(sphere(0.052, 16, 10, loc=hc, zone=METAL))
    for i in range(7):
        a = i / 7 * math.tau
        fl = box((0.012, 0.05, 0.075), bevel=0.003, loc=hc + V((math.cos(a) * 0.05, math.sin(a) * 0.05, 0)), rot=(0, 0, a), zone=METAL)
        parts.append(fl)
    parts.append(cone(0.022, 0.05, 8, loc=hc + V((0, 0, 0.06)), zone=METAL))
    parts.append(torus(0.017, 0.006, 12, 6, loc=(x, y - 0.02, z + 0.07), rot=(-0.25, 0, 0), zone=LEATHER))
    parts.append(sphere(0.02, 10, 6, loc=(x, y + 0.02, z - 0.04), zone=GOLD))
    return merge(parts)

def w_club(hand_world, knobs=True):
    x, y, z = hand_world
    parts = [sweep([V((x, y, z - 0.02)), V((x, y - 0.03, z + 0.18)), V((x, y - 0.07, z + 0.34))], [0.016, 0.03, 0.05], 10, zone=WOOD)]
    if knobs:
        for i in range(10):
            a = i * 2.4
            parts.append(sphere(0.01, 6, 4, loc=V((x + math.cos(a) * 0.045, y - 0.06 - math.sin(a) * 0.04, z + 0.25 + (i % 4) * 0.025)), zone=METAL))
    return merge(parts)

def w_axe(hand_world, big=False):
    x, y, z = hand_world
    s = 1.35 if big else 1.0
    parts = [cylinder(0.014, 0.016, 0.42 * s, 10, loc=(x, y - 0.03, z + 0.1), rot=(-0.2, 0, 0), zone=WOOD)]
    c = V((x + 0.0, y - 0.075, z + 0.27 * s))
    blade = box((0.016, 0.12 * s, 0.1 * s), bevel=0.004, loc=c + V((0, -0.04 * s, 0)), zone=METAL)
    parts.append(blade)
    edge = cone(0.06 * s, 0.05 * s, 4, loc=c + V((0, -0.12 * s, 0)), rot=(-math.pi / 2, math.pi / 4, 0), scale=(1, 0.3, 1), zone=METAL)
    parts.append(edge)
    parts.append(sphere(0.02, 8, 6, loc=c + V((0, 0.04, 0.0)), zone=METAL))
    parts.append(torus(0.017, 0.006, 12, 6, loc=(x, y - 0.025, z + 0.06), rot=(-0.2, 0, 0), zone=LEATHER))
    return merge(parts)

def w_sword(hand_world, length=0.42, width=0.035, curved=False):
    x, y, z = hand_world
    parts = []
    blade = box((0.012, width, length), bevel=0.003, loc=(x, y - 0.02, z + 0.09 + length / 2), zone=METAL)
    parts.append(blade)
    parts.append(cone(width * 0.5, 0.05, 4, loc=(x, y - 0.02, z + 0.09 + length + 0.02), scale=(0.35, 1, 1), zone=METAL))
    parts.append(box((0.03, 0.11, 0.022), bevel=0.006, loc=(x, y - 0.02, z + 0.09), zone=GOLD))
    parts.append(cylinder(0.014, 0.014, 0.1, 10, loc=(x, y - 0.015, z + 0.02), rot=(-0.1, 0, 0), zone=LEATHER))
    parts.append(sphere(0.02, 10, 6, loc=(x, y - 0.01, z - 0.04), zone=GOLD))
    return merge(parts)

def w_dagger(hand_world):
    return w_sword(hand_world, 0.18, 0.028)

def w_staff(hand_world, orb=0x66ddff):
    x, y, z = hand_world
    parts = [cylinder(0.014, 0.018, 0.85, 10, loc=(x, y - 0.01, z + 0.18), zone=WOOD)]
    parts.append(torus(0.04, 0.012, 14, 6, loc=(x, y - 0.01, z + 0.62), rot=(math.pi / 2, 0, 0), zone=WOOD))
    return merge(parts)

def w_claws(hand_world, n=4, length=0.07):
    x, y, z = hand_world
    parts = []
    for i in range(n):
        o = (i - (n - 1) / 2) * 0.022
        parts.append(taper([V((x + o, y - 0.03, z - 0.04)), V((x + o, y - 0.07, z - 0.08)), V((x + o, y - 0.1, z - 0.07))], 0.011, 0.002, sides=6, steps=3, zone=CLAW))
    return merge(parts)

def w_torch(rig_hand_world):
    x, y, z = rig_hand_world
    parts = [cylinder(0.015, 0.02, 0.4, 10, loc=(x, y - 0.03, z + 0.1), rot=(-0.12, 0, 0), zone=WOOD)]
    parts.append(torus(0.025, 0.01, 12, 6, loc=(x, y - 0.045, z + 0.27), rot=(-0.12, 0, 0), zone=LEATHER))
    parts.append(cylinder(0.04, 0.025, 0.07, 12, loc=(x, y - 0.052, z + 0.31), rot=(-0.12, 0, 0), zone=LEATHER))
    return merge(parts)

def flame_bm(x, y, z, scale=1.0):
    pts = [V((x, y - 0.052, z + 0.34)), V((x, y - 0.054, z + 0.37 * 1.0)), V((x + 0.004, y - 0.056, z + 0.42)), V((x - 0.003, y - 0.058, z + 0.47))]
    return taper(pts, 0.04 * scale, 0.002, power=1.4, sides=10, steps=5, zone=FLAME)

# --------------------------------------------------------------------------------- humanoid
def head_bm(P, z0=0.0):
    """Face and head, centred around (0,0,z0+0.075) with the front at -Y. P tunes the look."""
    r = 0.125 * P.get('headScale', 1.0)
    hz = z0 + 0.075 + r * 0.9
    parts = []
    jaw = P.get('jaw', 1.0)
    brow = P.get('brow', 1.0)
    skull = sphere(r, 28, 18, loc=(0, 0.004, hz), scale=(1.0, 0.95, 1.04), zone=SKIN)
    parts.append(skull)
    parts.append(sphere(r * 0.72, 22, 14, loc=(0, -r * 0.34, hz - r * 0.5), scale=(1.0 * jaw, 0.9, 0.78), zone=SKIN))        # jaw / chin
    for s in (-1, 1):
        parts.append(sphere(r * 0.2, 12, 8, loc=(s * r * 0.5, -r * 0.66, hz - r * 0.3), zone=SKIN))                        # cheeks
    # nose
    ns = P.get('nose', 1.0)
    parts.append(sphere(r * 0.2 * ns, 12, 8, loc=(0, -r * 0.98, hz - r * 0.14), scale=(0.85, 1.1, 1.0), zone=SKIN2 if P.get('nose_tint') else SKIN))
    parts.append(sphere(r * 0.11 * ns, 8, 6, loc=(0, -r * 1.12, hz - r * 0.2), zone=SKIN2 if P.get('nose_tint') else SKIN))
    # brow ridge
    for s in (-1, 1):
        parts.append(box((r * 0.5, r * 0.14, r * 0.09 * brow), bevel=0.008, bsegs=2, loc=(s * r * 0.38, -r * 0.84, hz + r * 0.3), rot=(0.2, 0, s * -0.15), zone=SKIN, smooth=True))
    # eyes: glossy bead eyes by default, white-and-pupil eyes when P['eye_style'] == 'white'
    eye_r = r * 0.2 * P.get('eye', 1.0)
    glow = P.get('glow_eyes')
    style = P.get('eye_style', 'bead')
    for s in (-1, 1):
        ex, ey, ez = s * r * 0.4, -r * 0.8, hz + r * 0.1
        if glow:
            parts.append(sphere(eye_r * 0.95, 12, 8, loc=(ex, ey, ez), scale=(1.1, 0.8, 0.8), zone=GLOW))
        elif style == 'white':
            parts.append(sphere(eye_r, 14, 10, loc=(ex, ey, ez), zone=EYEW))
            parts.append(sphere(eye_r * 0.55, 10, 8, loc=(ex + s * -eye_r * 0.05, ey - eye_r * 0.7, ez), zone=PUPIL))
        else:
            parts.append(sphere(eye_r * 0.78, 14, 10, loc=(ex, ey - eye_r * 0.1, ez), scale=(0.9, 0.8, 1.1), zone=PUPIL))
    # mouth
    mw = P.get('mouth_w', 1.0)
    parts.append(sphere(r * 0.17, 12, 8, loc=(0, -r * 0.92, hz - r * 0.55), scale=(1.7 * mw, 0.35, 0.28), zone=MOUTH))
    if P.get('teeth'):
        for i in range(-2, 3):
            parts.append(cone(r * 0.025, r * 0.09, 5, loc=(i * r * 0.1 * mw, -r * 0.95, hz - r * 0.47), rot=(math.pi, 0, 0), zone=BONE))
    if P.get('fangs'):
        for s in (-1, 1):
            parts.append(cone(r * 0.045, r * 0.2, 6, loc=(s * r * 0.17, -r * 0.93, hz - r * 0.5), rot=(math.pi, 0, 0), zone=BONE))
    if P.get('tusks'):
        for s in (-1, 1):
            parts.append(taper([V((s * r * 0.24, -r * 0.82, hz - r * 0.5)), V((s * r * 0.3, -r * 0.98, hz - r * 0.35)), V((s * r * 0.26, -r * 1.02, hz - r * 0.05))], r * 0.07, r * 0.01, sides=7, steps=4, zone=BONE))
    # ears
    ear = P.get('ears')
    for s in (-1, 1):
        if ear == 'pointy':
            parts.append(taper([V((s * r * 0.92, 0.01, hz + r * 0.02)), V((s * r * 1.3, 0.02, hz + r * 0.2)), V((s * r * 1.55, 0.02, hz + r * 0.45))], r * 0.16, r * 0.01, sides=7, steps=4, zone=SKIN))
        elif ear == 'round':
            parts.append(sphere(r * 0.17, 10, 8, loc=(s * r * 0.97, 0.02, hz), scale=(0.45, 1, 1.1), zone=SKIN))
        elif ear == 'big':
            parts.append(sphere(r * 0.3, 12, 8, loc=(s * r * 1.05, 0.03, hz + r * 0.05), scale=(0.35, 1, 1.35), zone=SKIN))
    # hair
    hair = P.get('hair')
    if hair == 'short':
        parts.append(sphere(r * 1.05, 24, 14, loc=(0, 0.03, hz + r * 0.12), scale=(1.02, 0.95, 0.95), zone=HAIR))
        delete = None
    elif hair == 'long':
        parts.append(sphere(r * 1.07, 24, 14, loc=(0, 0.03, hz + r * 0.1), scale=(1.03, 1.0, 0.98), zone=HAIR))
        parts.append(taper([V((0, r * 0.7, hz + r * 0.5)), V((0, r * 1.0, hz - r * 0.5)), V((0, r * 0.9, hz - r * 1.7))], r * 0.8, r * 0.3, sides=10, steps=5, zone=HAIR, scale=(1.25, 0.45, 1)))
    elif hair == 'spiky':
        parts.append(sphere(r * 1.0, 20, 12, loc=(0, 0.03, hz + r * 0.1), scale=(1.0, 0.95, 0.9), zone=HAIR))
        for i in range(9):
            a = i / 9 * math.tau
            parts.append(cone(r * 0.13, r * 0.5, 6, loc=(math.cos(a) * r * 0.55, math.sin(a) * r * 0.55 + 0.02, hz + r * 0.85), rot=(math.sin(a) * 0.5, -math.cos(a) * 0.5, 0), zone=HAIR))
    elif hair == 'snakes':
        for i in range(9):
            a = i / 9 * math.tau
            p0 = V((math.cos(a) * r * 0.8, math.sin(a) * r * 0.8 + 0.02, hz + r * 0.5))
            p1 = V((math.cos(a) * r * 1.35, math.sin(a) * r * 1.35 + 0.02, hz + r * 0.95 + 0.02 * (i % 3)))
            p2 = V((math.cos(a + 0.7) * r * 1.6, math.sin(a + 0.7) * r * 1.6, hz + r * 1.45))
            parts.append(taper([p0, p1, p2], r * 0.12, r * 0.07, sides=8, steps=5, zone=GOLD if False else CLOTH2))
            parts.append(sphere(r * 0.12, 10, 8, loc=p2, scale=(1, 1.3, 0.9), zone=CLOTH2))
            parts.append(sphere(r * 0.025, 6, 4, loc=p2 + V((r * 0.05, -r * 0.1, r * 0.03)), zone=GLOW))
    if P.get('beard'):
        parts.append(taper([V((0, -r * 0.75, hz - r * 0.55)), V((0, -r * 0.9, hz - r * 1.0)), V((0, -r * 0.7, hz - r * 1.55))], r * 0.5, r * 0.1, sides=10, steps=5, zone=HAIR, scale=(1.2, 0.6, 1)))
    if P.get('horns'):
        for s in (-1, 1):
            parts.append(taper([V((s * r * 0.5, -r * 0.1, hz + r * 0.85)), V((s * r * 0.9, -r * 0.2, hz + r * 1.35)), V((s * r * 0.7, -r * 0.5, hz + r * 1.9))], r * 0.2, r * 0.015, sides=8, steps=6, zone=BONE))
    bm = merge(parts)
    return bm

def humanoid(rig, P):
    """Builds torso, head, arms, legs (with pivots and rig names) and clothing for a biped."""
    fat = P.get('fat', 1.0)
    H = P.get('height', 1.0)
    hunch = P.get('hunch', 0.0)
    leg_len = 0.31 * P.get('leg', 1.0)
    hip = leg_len + 0.03
    zc = hip + 0.12          # chest
    zs = hip + 0.27          # shoulders
    zn = hip + 0.33          # neck base
    # ------------------------------------------------ torso
    sk = P.get('skin_zone', SKIN)
    torso_sk = skin([(0, 0, hip - 0.02), (0, 0, hip + 0.1), (0, 0, zc + 0.08), (0, 0, zn)], [(0, 1), (1, 2), (2, 3)],
                    [(0.115 * fat, 0.088 * fat), (0.12 * fat, 0.092 * fat), (0.14 * fat, 0.105 * fat), (0.055, 0.055)], subdiv=2, zone=CLOTH if P.get('shirt', True) else sk)
    parts = [torso_sk]
    for s in (-1, 1):
        parts.append(sphere(0.062 * fat, 14, 10, loc=(s * 0.145 * fat, 0, zs), zone=CLOTH if P.get('shirt', True) else sk))
    if P.get('belly'):
        parts.append(sphere(0.12 * fat * P['belly'], 18, 12, loc=(0, -0.045, hip + 0.1), scale=(1, 0.9, 0.9), zone=CLOTH if P.get('shirt', True) else sk))
    if P.get('skirt', True):
        parts.append(cylinder(0.118 * fat, 0.15 * fat, 0.15, 18, loc=(0, 0, hip - 0.02), scale=(1, 0.8, 1), zone=P.get('skirt_zone', CLOTH2), cap=False))
    if P.get('belt', True):
        parts.append(torus(0.115 * fat, 0.016, 20, 6, loc=(0, 0, hip + 0.06), scale=(1, 0.8, 1), zone=LEATHER))
        parts.append(box((0.04, 0.012, 0.035), bevel=0.004, loc=(0, -0.095 * fat, hip + 0.06), zone=GOLD))
        parts.append(box((0.05, 0.03, 0.05), bevel=0.008, loc=(0.1 * fat, -0.07, hip + 0.03), zone=LEATHER))   # pouch
    if P.get('armor'):
        ch = sphere(0.125 * fat, 24, 16, loc=(0, -0.03 * fat, zc + 0.04), scale=(1.06, 0.55, 0.95), zone=METAL)
        if P.get('rings'):
            ridge_displace(ch, 0.0045, 70, seed=3)
        parts.append(ch)
        for k in range(3):                                    # overlapping lames over the belly
            parts.append(box((0.205 * fat, 0.1 * fat, 0.03), bevel=0.01, bsegs=2, loc=(0, -0.012 * fat, hip + 0.09 - k * 0.032), rot=(0.12, 0, 0), zone=METAL, smooth=True))
        for s_ in (-1, 1):
            parts.append(sphere(0.07 * fat, 18, 12, loc=(s_ * 0.16 * fat, 0, zs + 0.012), scale=(1.1, 1.0, 0.7), zone=METAL))
        if P.get('gorget', True):
            parts.append(torus(0.062, 0.02, 18, 6, loc=(0, -0.012, zn - 0.012), zone=METAL))
    if P.get('collar'):
        parts.append(cylinder(0.07, 0.16, 0.12, 14, loc=(0, 0.04, zn + 0.01), rot=(-0.4, 0, 0), zone=CAPE, cap=False))
    if P.get('backpack'):
        parts.append(box((0.17, 0.09, 0.2), bevel=0.02, loc=(0, 0.11 * fat, zc + 0.02), zone=LEATHER, smooth=True))
        parts.append(cylinder(0.04, 0.04, 0.2, 12, loc=(0, 0.13 * fat, zc + 0.15), rot=(0, math.pi / 2, 0), zone=CLOTH2))
        parts.append(box((0.04, 0.012, 0.05), bevel=0.004, loc=(0, 0.16 * fat, zc + 0.02), zone=GOLD))
    if P.get('torso_extra'):
        parts.append(P['torso_extra'](rig, fat, hip, zc, zs, zn))
    tb = merge(parts)
    relief(tb, 0.004, 22, seed=1, zone_filter=(CLOTH, CLOTH2, sk))
    if hunch:
        tilt_x(tb, hunch, pivot_z=hip)
    rig.part('torso', tb, pivot=(0, 0, hip))
    # ------------------------------------------------ head
    hb = head_bm(P, z0=zn - 0.02)
    if P.get('helm'):
        r = 0.125 * P.get('headScale', 1.0)
        hz = zn - 0.02 + 0.075 + r * 0.9
        helm = [sphere(r * 1.12, 24, 12, loc=(0, 0.01, hz + r * 0.15), scale=(1.0, 1.0, 0.85), zone=METAL)]
        helm.append(torus(r * 1.08, 0.012, 22, 6, loc=(0, 0.01, hz + r * 0.1), zone=GOLD if P.get('helm') == 'gold' else METAL))
        helm.append(box((0.022, 0.03, r * 0.9), bevel=0.006, loc=(0, -r * 1.05, hz - r * 0.05), zone=METAL))   # nasal
        if P.get('crest'):
            helm.append(box((0.02, r * 1.6, 0.06), bevel=0.008, loc=(0, 0, hz + r * 1.05), zone=CAPE))
        hb = merge([hb] + helm)
    if P.get('hood'):
        r = 0.125 * P.get('headScale', 1.0)
        hz = zn - 0.02 + 0.075 + r * 0.9
        hd = sphere(r * 1.32, 28, 18, loc=(0, 0.05, hz + r * 0.1), scale=(1.0, 1.08, 1.0), zone=P.get('hood_zone', CLOTH))
        delete_faces_where(hd, lambda c: c.y < -r * 0.35 and c.z > hz - r * 1.0 and abs(c.x) < r * 1.05)
        shell(hd, 0.014)
        relief(hd, 0.006, 16, seed=4)
        # peak
        pk = cone(r * 0.6, r * 0.5, 12, loc=(0, r * 0.7, hz + r * 1.25), rot=(-1.1, 0, 0), zone=P.get('hood_zone', CLOTH))
        hb = merge([hb, hd, pk])
    if P.get('crown'):
        r = 0.125
        hz = zn - 0.02 + 0.075 + r * 0.9
        hb = merge([hb, cylinder(r * 0.95, r * 1.0, 0.045, 18, loc=(0, 0.01, hz + r * 0.82), zone=GOLD)])
    if P.get('hat'):
        hb = merge([hb, P['hat'](zn)])
    relief(hb, 0.0025, 30, seed=2, zone_filter=(SKIN, SKIN2))
    if hunch:
        tilt_x(hb, hunch * 1.4, pivot_z=zn)
    rig.part('head', hb, pivot=(0, 0.0, zn), parent='torso')
    # ------------------------------------------------ arms
    arm_len = 0.27 * P.get('arm', 1.0)
    for side, s in (('L', 1), ('R', -1)):
        # note: model +x is the character's left in Blender front view; names follow game usage
        sx = s * (0.148 * fat + 0.02)
        arm_pts = [(0, 0, 0), (0, -0.012, -arm_len * 0.5), (0, -0.03, -arm_len)]
        sleeve = P.get('sleeve', CLOTH)
        up = skin(arm_pts, [(0, 1), (1, 2)], [(0.062 * fat, 0.062 * fat), (0.056 * fat, 0.056 * fat), (0.044 * fat, 0.044 * fat)], subdiv=2, zone=sk)
        ap = [up]
        # sleeve covers the upper half
        zone_where(up, lambda c, f: c.z > -arm_len * (0.55 if P.get('long_sleeves', True) else 0.3), sleeve)
        # hand: fist
        hy = -0.03
        ap.append(sphere(0.056 * fat, 14, 10, loc=(0, hy - 0.002, -arm_len - 0.035), scale=(1.0, 1.05, 1.0), zone=P.get('glove_zone', sk)))
        for i in range(4):
            ap.append(sphere(0.017 * fat, 8, 6, loc=((i - 1.5) * 0.02, hy - 0.04, -arm_len - 0.035), zone=P.get('glove_zone', sk)))
        ap.append(sphere(0.02 * fat, 8, 6, loc=(s * -0.035, hy - 0.025, -arm_len - 0.01), zone=P.get('glove_zone', sk)))
        if P.get('claws') and side == 'R':
            ap.append(w_claws((0, hy, -arm_len - 0.02), 4))
        if P.get('bracers'):
            ap.append(cylinder(0.042 * fat, 0.04 * fat, 0.07, 14, loc=(0, -0.026, -arm_len + 0.045), zone=METAL if P.get('bracers') == 'metal' else LEATHER))
        if P.get('arm_extra'):
            ap.append(P['arm_extra'](side, fat, arm_len))
        ab = merge(ap)
        relief(ab, 0.003, 26, seed=5 + s, zone_filter=(sleeve, sk))
        pivot = (sx, 0, zs)
        pname = 'arm' + side
        rig.part(pname, ab, pivot=pivot, local=True)
        hand_world = (sx, hy - 0.03, zs - arm_len - 0.03)
        rig.node('hand' if side == 'R' else 'torchHand', pivot=hand_world, parent=pname)
        # weapon / torch live as part of the arm hierarchy
        if side == 'R':
            wp = P.get('weapon')
            if wp:
                wbm = wp(hand_world)
                rig.part('weapon', wbm, pivot=hand_world, parent=pname)
        else:
            tf = P.get('left_item')
            if tf:
                tf(rig, hand_world, pname)
    # ------------------------------------------------ legs
    for side, s in (('L', 1), ('R', -1)):
        lx = s * 0.075 * fat
        pants = P.get('legs_zone', CLOTH2)
        bare = P.get('bare_legs', False)
        lg = skin([(0, 0, 0), (0, -0.012, -leg_len * 0.5), (0, -0.01, -leg_len + 0.04)], [(0, 1), (1, 2)],
                  [(0.074 * fat, 0.074 * fat), (0.062 * fat, 0.062 * fat), (0.054 * fat, 0.054 * fat)], subdiv=2, zone=sk if bare else pants)
        lp = [lg]
        bz = P.get('boot_zone', BOOT)
        if P.get('boots', True):
            lp.append(cylinder(0.053 * fat, 0.062 * fat, leg_len * 0.42, 14, loc=(0, -0.008, -leg_len + leg_len * 0.21), zone=bz))
            lp.append(cylinder(0.068 * fat, 0.062 * fat, 0.03, 14, loc=(0, -0.008, -leg_len + leg_len * 0.42), zone=bz))
        foot = sphere(0.056 * fat, 14, 10, loc=(0, -0.045, -leg_len + 0.03), scale=(1.0, 1.55, 0.62), zone=bz if P.get('boots', True) else sk)
        lp.append(foot)
        if P.get('toe_claws'):
            for i in range(3):
                lp.append(cone(0.012, 0.04, 6, loc=((i - 1) * 0.025, -0.115, -leg_len + 0.03), rot=(-math.pi / 2, 0, 0), zone=CLAW))
        if P.get('leg_extra'):
            lp.append(P['leg_extra'](side, fat, leg_len))
        lb = merge(lp)
        relief(lb, 0.003, 24, seed=7 + s, zone_filter=(pants, sk))
        rig.part('leg' + side, lb, pivot=(lx, 0, hip), local=True)
    # ------------------------------------------------ cape
    if P.get('cape'):
        w, h = 0.2 * fat, (zs + 0.02) - 0.12
        cols, rows = 10, 10
        cb = bmesh.new()
        grid = []
        for j in range(rows + 1):
            row = []
            for i in range(cols + 1):
                u = i / cols - 0.5
                v = j / rows
                x = u * (w * 2.0 + v * 0.14)
                ang = u * 1.5
                y = 0.095 * fat + math.sin(ang * 1.2) * 0.0 + (1 - math.cos(ang)) * 0.06 + v * 0.05 + math.sin(i * 1.7 + 0.7) * 0.012 * v
                z = zs + 0.02 - v * h
                row.append(cb.verts.new((x, y, z)))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                f = cb.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                f.smooth = True
                f.material_index = CAPE
        bmesh.ops.recalc_face_normals(cb, faces=list(cb.faces))
        shell(cb, 0.012)
        relief(cb, 0.003, 18, seed=9)
        rig.part('cape', cb, pivot=(0, 0.09, zs + 0.02), parent='torso')
    return rig

def tilt_x(bm, angle, pivot_z=0.0):
    m = Matrix.Translation((0, 0, pivot_z)) @ Matrix.Rotation(angle, 4, "X") @ Matrix.Translation((0, 0, -pivot_z))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
