"""Odd ones: venus flytrap, ice monster, xeroc, phantom, wraith."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from creature_kit import *

def mk(name, over, extra):
    clear()
    Z = zx(over, extra)
    return Z, Rig(name, Z)

# -------------------------------------------------------------------------------- F venus flytrap
def build_F(out):
    Z, rig = mk('F', dict(skin=0x2f8a3a, skin2=0x2a6a30, bone=0xf2f0d8, glow=dict(color=0xff4060, emit=0xff3050, emit_strength=0.4)),
                [Zc('inner', 0xc02040, rough=0.35), Zc('rim', 0x8a1a30, rough=0.4), Zc('pot', 0x9a5a34, rough=0.8)])
    stem = taper([V((0, 0, 0.0)), V((0.04, 0.02, 0.25)), V((0.0, 0.0, 0.46)), V((0, -0.02, 0.58))], 0.085, 0.05, sides=12, steps=8, zone=SKIN)
    parts = [stem, cylinder(0.2, 0.17, 0.1, 20, loc=(0, 0, 0.05), zone=20), torus(0.2, 0.025, 24, 6, loc=(0, 0, 0.1), zone=20),
             cylinder(0.19, 0.19, 0.012, 20, loc=(0, 0, 0.098), zone=SKIN2)]
    for i in range(4):
        a = i / 4 * math.tau + 0.4
        parts.append(taper([V((0, 0, 0.12)), V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.3)), V((math.cos(a) * 0.42, math.sin(a) * 0.42, 0.34)), V((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.24))], 0.05, 0.012, sides=8, steps=7, zone=SKIN, scale=(1.0, 1.0, 0.55)))
    rig.part('torso', merge(parts), pivot=(0, 0, 0))
    hinge = V((0, 0.05, 0.62))
    for nm, sgn in (('jawA', 1), ('jawB', -1)):
        bm = sphere(0.24, 28, 16, loc=(0, -0.12, 0.0), scale=(0.95, 1.1, 0.5))   # shell
        for f in bm.faces:
            f.material_index = SKIN
        bm.verts.ensure_lookup_table()
        # keep the upper hemisphere only; flip for the lower jaw
        delete_faces_where(bm, lambda c: c.z < -0.0)
        for f in bm.faces:
            f.smooth = True
        shell(bm, 0.018)
        # inside red, rim teeth
        for f in bm.faces:
            if f.normal.z < -0.2 or f.calc_center_median().z < 0.03:
                f.material_index = 18
        teeth = []
        for i in range(11):
            a = math.pi * (0.08 + i / 10 * 0.84)
            x = math.cos(a) * 0.228
            y = -0.12 - math.sin(a) * 0.255
            teeth.append(cone(0.016, 0.1, 5, loc=(x, y, 0.0), rot=(0, 0, 0), zone=BONE))
        bm2 = merge([bm] + teeth)
        ridge_displace(bm2, 0.006, 22, 2.0, mask=lambda v: 1.0 if v.co.z > 0.04 else 0.0)
        if sgn > 0:      # jawA is the lower jaw: mirror the shell below the hinge plane
            bmesh.ops.transform(bm2, matrix=Matrix.Diagonal((1, 1, -1, 1)), verts=bm2.verts)
            bmesh.ops.reverse_faces(bm2, faces=list(bm2.faces))
        bmesh.ops.translate(bm2, vec=(0, 0.05 - 0.144, 0.62), verts=bm2.verts)
        rig.part(nm, bm2, pivot=tuple(hinge))
    finish(rig, Z, out, 'F', dict(scale=1.3, flytrap=True))

# -------------------------------------------------------------------------------- I ice monster
def build_I(out):
    ice = dict(rough=0.08, alpha=0.86)
    Z, rig = mk('I', dict(skin=dict(color=0x9fe4ff, **ice), cloth=dict(color=0x6cc8f0, **ice), cloth2=dict(color=0xc8f2ff, **ice), glow=dict(color=0xe8ffff, emit=0x80d8ff, emit_strength=2.2)),
                [Zc('core', 0x40c0ff, rough=0.2, emit=0x30b0ff, emit_strength=1.6)])
    def crystal(base, tip, r=0.06, sides=6, zone=SKIN, lean=(0, 0, 0)):
        return taper([V(base), (V(base) + V(tip)) * 0.5 + V(lean), V(base) + V(tip)], r, r * 0.04, power=0.6, sides=sides, steps=3, zone=zone)
    parts = []
    rnd = random.Random(11)
    # chest cluster
    parts.append(sphere(0.2, 12, 8, loc=(0, 0, 0.55), scale=(1, 0.8, 1.2), zone=CLOTH))
    parts.append(sphere(0.09, 10, 8, loc=(0, -0.1, 0.56), zone=18))
    for i in range(14):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.08, 0.2)
        parts.append(crystal((math.cos(a) * rr, math.sin(a) * rr * 0.8, 0.55 + rnd.uniform(-0.1, 0.12)), (math.cos(a) * 0.12, math.sin(a) * 0.1, rnd.uniform(0.12, 0.28)), r=rnd.uniform(0.035, 0.06), zone=rnd.choice([SKIN, CLOTH, CLOTH2])))
    tb = merge(parts)
    noise_displace(tb, 0.006, 22, 2, 2.0)
    rig.part('torso', tb, pivot=(0, 0, 0.55))
    hp = [sphere(0.12, 10, 8, loc=(0, -0.02, 0.9), scale=(0.9, 0.9, 1.0), zone=SKIN)]
    for i in range(7):
        a = i / 7 * math.tau
        hp.append(crystal((math.cos(a) * 0.07, math.sin(a) * 0.07, 0.98), (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.2), r=0.03, zone=CLOTH2))
    for s in (-1, 1):
        hp.append(sphere(0.026, 8, 6, loc=(s * 0.05, -0.1, 0.92), scale=(1, 0.7, 1), zone=GLOW))
    hp.append(crystal((0, -0.1, 0.87), (0, -0.08, -0.04), r=0.025, zone=CLOTH2))
    rig.part('head', merge(hp), pivot=(0, 0, 0.78), parent='torso')
    for nm, s in (('armL', 1), ('armR', -1)):
        ap = [crystal((0, 0, 0), (s * 0.04, -0.05, -0.18), r=0.07, zone=CLOTH),
              crystal((s * 0.03, -0.04, -0.15), (s * 0.02, -0.14, -0.2), r=0.05, zone=SKIN),
              crystal((0.0, -0.01, -0.04), (s * 0.1, -0.02, 0.07), r=0.04, zone=CLOTH2)]
        for i in range(4):
            ap.append(crystal((s * 0.04 + (i - 1.5) * 0.02, -0.17, -0.19), (0.0, -0.1, -0.07), r=0.016, sides=5, zone=CLOTH2))
        rig.part(nm, merge(ap), pivot=(s * 0.27, 0, 0.7), local=True)
    for nm, s in (('legL', 1), ('legR', -1)):
        lp = [crystal((0, 0, 0), (0, 0, -0.34), r=0.085, zone=CLOTH, sides=6), crystal((0, 0.0, -0.3), (0, -0.1, -0.04), r=0.07, zone=SKIN, sides=6)]
        lb = merge(lp)
        # flip the leg crystal so the wide end is up and the tip faces the floor is fine for a golem
        rig.part(nm, lb, pivot=(s * 0.1, 0, 0.34), local=True)
    finish(rig, Z, out, 'I', dict(scale=1.25, ice=True))

# -------------------------------------------------------------------------------- X xeroc
def build_X(out):
    Z, rig = mk('X', dict(skin=0x7e8ea6, cloth=0x4a586c, cloth2=0x2a3340, metal=0xaab4c4, glow=dict(color=0x40ffd0, emit=0x20ffc0, emit_strength=3.0), bone=0xf4f4ef),
                [Zc('glass', 0x1a2a3a, rough=0.08, metal=0.4), Zc('paper', 0xf4f0e4, rough=0.8), Zc('btn', 0xff6040, rough=0.4, emit=0xff3020, emit_strength=1.5)])
    body = box((0.34, 0.26, 0.4), bevel=0.03, bsegs=3, loc=(0, 0, 0.5), zone=SKIN, smooth=True)
    parts = [body]
    parts.append(box((0.3, 0.02, 0.2), bevel=0.006, loc=(0, -0.135, 0.5), zone=CLOTH2))                 # control panel
    for i in range(6):
        parts.append(cylinder(0.014, 0.014, 0.012, 10, loc=(-0.1 + i * 0.04, -0.15, 0.5 + (i % 2) * 0.04), rot=(math.pi / 2, 0, 0), zone=GLOW if i % 3 == 0 else 20))
    parts.append(box((0.26, 0.012, 0.012), bevel=0.003, loc=(0, -0.15, 0.58), zone=GLOW))
    parts.append(box((0.3, 0.22, 0.012), bevel=0.003, loc=(0, 0.0, 0.705), zone=18))                    # glass platen
    parts.append(box((0.3, 0.1, 0.018), loc=(0, -0.2, 0.36), rot=(0.25, 0, 0), zone=19 + 1 if False else 20 - 1))  # paper tray
    for i in range(3):
        parts.append(box((0.24, 0.16, 0.004), loc=(0.01 * i, -0.22 - 0.01 * i, 0.375 + 0.004 * i), rot=(0.25, 0.04 * i, 0), zone=20 - 1))
    for s in (-1, 1):
        parts.append(sphere(0.03, 10, 8, loc=(s * 0.12, -0.14, 0.62), scale=(1, 0.5, 1), zone=GLOW))        # eyes
        parts.append(box((0.04, 0.3, 0.012), bevel=0.003, loc=(s * 0.1, 0.0, 0.705), zone=METAL))
    tb = merge(parts)
    rig.part('torso', tb, pivot=(0, 0, 0.5))
    lid = [box((0.36, 0.28, 0.035), bevel=0.012, bsegs=2, loc=(0, 0.14, 0.0175), zone=CLOTH, smooth=True),
           box((0.3, 0.22, 0.01), loc=(0, 0.14, -0.0), zone=18), cylinder(0.02, 0.02, 0.38, 12, loc=(0, 0.0, 0.0), rot=(0, math.pi / 2, 0), zone=METAL)]
    rig.part('jaw', merge(lid), pivot=(0, 0.14, 0.715), local=False, parent='torso')
    for nm, s in (('armL', 1), ('armR', -1)):
        ap = [cylinder(0.04, 0.04, 0.22, 12, loc=(0, 0, -0.11), zone=CLOTH), cylinder(0.026, 0.026, 0.18, 10, loc=(0, -0.05, -0.28), rot=(0.4, 0, 0), zone=METAL),
              box((0.09, 0.05, 0.05), bevel=0.01, loc=(0, -0.11, -0.36), zone=CLOTH2)]
        for k in (-1, 1):
            ap.append(box((0.018, 0.07, 0.03), bevel=0.004, loc=(k * 0.035, -0.17, -0.36), zone=METAL))
        rig.part(nm, merge(ap), pivot=(s * 0.23, 0.0, 0.62), local=True)
    for nm, s in (('legL', 1), ('legR', -1)):
        lp = [box((0.1, 0.1, 0.34), bevel=0.012, loc=(0, 0, -0.17), zone=CLOTH, smooth=True), box((0.12, 0.17, 0.05), bevel=0.012, loc=(0, -0.03, -0.34), zone=CLOTH2)]
        rig.part(nm, merge(lp), pivot=(s * 0.1, 0, 0.34), local=True)
    finish(rig, Z, out, 'X', dict(scale=1.3))

# -------------------------------------------------------------------------------- P phantom
def build_P(out):
    gh = dict(rough=0.25, alpha=0.5)
    Z, rig = mk('P', dict(skin=dict(color=0x9ab0d0, **gh), cloth=dict(color=0x7890b8, **gh), cloth2=dict(color=0x5a7098, **gh), glow=dict(color=0x90f0ff, emit=0x60e0ff, emit_strength=2.5)),
                [])
    body = skin([(0, 0.1, 0.05), (0, 0.04, 0.3), (0, 0, 0.55), (0, -0.01, 0.76), (0, -0.02, 0.88)], [(0, 1), (1, 2), (2, 3), (3, 4)],
                [(0.03, 0.03), (0.12, 0.1), (0.2, 0.15), (0.18, 0.14), (0.14, 0.13)], subdiv=2, zone=CLOTH)
    parts = [body]
    parts.append(sphere(0.15, 18, 12, loc=(0, -0.03, 0.98), scale=(0.9, 0.95, 1.1), zone=SKIN))
    for s in (-1, 1):
        parts.append(sphere(0.045, 10, 8, loc=(s * 0.06, -0.15, 1.0), scale=(0.8, 0.5, 1.2), zone=GLOW))
        parts.append(sphere(0.07, 10, 8, loc=(s * 0.06, -0.13, 1.0), scale=(1.1, 0.5, 1.4), zone=PUPIL))
    parts.append(sphere(0.04, 10, 8, loc=(0, -0.15, 0.88), scale=(1.4, 0.5, 1.0), zone=PUPIL))
    for i in range(7):
        a = i / 7 * math.tau
        parts.append(taper([V((math.cos(a) * 0.1, math.sin(a) * 0.08, 0.5)), V((math.cos(a) * 0.14, math.sin(a) * 0.1 + 0.06, 0.2)), V((math.cos(a) * 0.12, math.sin(a) * 0.1 + 0.18, 0.04))], 0.045, 0.004, sides=7, steps=5, zone=CLOTH2))
    tb = merge(parts)
    noise_displace(tb, 0.012, 14, 2, 1.0)
    rig.part('torso', tb, pivot=(0, 0, 0.5))
    for nm, s in (('armL', 1), ('armR', -1)):
        ap = [taper([V((0, 0, 0)), V((s * 0.04, -0.06, -0.1)), V((s * 0.06, -0.15, -0.14)), V((s * 0.05, -0.24, -0.1))], 0.06, 0.012, sides=8, steps=6, zone=CLOTH)]
        for i in range(3):
            ap.append(taper([V((s * 0.05, -0.23, -0.1)), V((s * 0.06 + (i - 1) * 0.03, -0.3, -0.11)), V((s * 0.06 + (i - 1) * 0.045, -0.36, -0.13))], 0.014, 0.003, sides=5, steps=3, zone=SKIN))
        rig.part(nm, merge(ap), pivot=(s * 0.18, 0, 0.78), local=True)
    finish(rig, Z, out, 'P', dict(fly=0.2, ghost=True, scale=1.3))

# -------------------------------------------------------------------------------- W wraith
def build_W(out):
    Z, rig = mk('W', dict(skin=0xc8cdd0, cloth=0x252a3a, cloth2=0x14161e, cape=0x2c3246, bone=0xe0e0d2, glow=dict(color=0x70ffa0, emit=0x50ff90, emit_strength=3.0)),
                [Zc('void', 0x050608, rough=1.0)])
    robe = skin([(0, 0.04, 0.12), (0, 0.02, 0.4), (0, 0, 0.62), (0, -0.01, 0.78)], [(0, 1), (1, 2), (2, 3)], [(0.26, 0.24), (0.2, 0.18), (0.16, 0.15), (0.14, 0.13)], subdiv=2, zone=CLOTH)
    def hem(v):
        return 1.0 if v.co.z < 0.3 else 0.0
    noise_displace(robe, 0.05, 11, 3, 1.0, mask=lambda v: clamp((0.32 - v.co.z) * 4))
    parts = [robe]
    hood = sphere(0.19, 24, 16, loc=(0, 0.02, 0.97), scale=(0.95, 1.1, 1.1), zone=CAPE)
    delete_faces_where(hood, lambda c: c.y < -0.06 and c.z > 0.85 and c.z < 1.08 and abs(c.x) < 0.13)
    shell(hood, 0.016)
    noise_displace(hood, 0.008, 12, 2, 3.0)
    parts.append(hood)
    parts.append(sphere(0.115, 14, 10, loc=(0, 0.0, 0.96), scale=(0.9, 0.8, 1.05), zone=18))
    for s in (-1, 1):
        parts.append(sphere(0.03, 10, 8, loc=(s * 0.05, -0.085, 0.99), scale=(1, 0.6, 1.2), zone=GLOW))
    parts.append(taper([V((0, 0.06, 1.1)), V((0, 0.2, 1.0)), V((0, 0.22, 0.8))], 0.1, 0.02, sides=10, steps=6, zone=CAPE, scale=(1.3, 0.4, 1)))
    rig.part('torso', merge(parts), pivot=(0, 0, 0.5))
    for nm, s in (('armL', 1), ('armR', -1)):
        ap = [taper([V((0, 0, 0)), V((s * 0.05, -0.07, -0.06)), V((s * 0.06, -0.17, -0.1)), V((s * 0.05, -0.24, -0.08))], 0.065, 0.03, sides=10, steps=6, zone=CLOTH)]
        ap.append(sphere(0.032, 8, 6, loc=(s * 0.05, -0.25, -0.08), zone=BONE))
        for i in range(4):
            ap.append(taper([V((s * 0.05 + (i - 1.5) * 0.015, -0.26, -0.08)), V((s * 0.055 + (i - 1.5) * 0.03, -0.34, -0.08 - i * 0.004)), V((s * 0.06 + (i - 1.5) * 0.042, -0.4, -0.1 - i * 0.01))], 0.011, 0.003, sides=5, steps=4, zone=BONE))
        rig.part(nm, merge(ap), pivot=(s * 0.16, 0, 0.74), local=True)
    finish(rig, Z, out, 'W', dict(fly=0.15, scale=1.3))

BUILDERS = {'F': build_F, 'I': build_I, 'X': build_X, 'P': build_P, 'W': build_W}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'raw')
    args = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else []
    for k in (args or list(BUILDERS)):
        try:
            BUILDERS[k](out)
        except Exception:
            import traceback
            print('FAILED', k)
            traceback.print_exc()
