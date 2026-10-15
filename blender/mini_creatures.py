"""Animals, beasts and odd monsters."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from creature_kit import *

def mk(name, over, extra):
    clear()
    Z = zx(over, extra)
    return Z, Rig(name, Z)

def stripes(bm, dark, freq=15, phase=0.0, axis='y', light=None):
    for f in bm.faces:
        c = f.calc_center_median()
        v = c.y if axis == 'y' else c.z
        n = noise.noise(c * 7.0) * 0.5
        if int(math.floor(v * freq + n + phase)) % 2 == 0:
            f.material_index = dark
        elif light is not None:
            f.material_index = light

# -------------------------------------------------------------------------------- A aquator
def build_A(out):
    Z, rig = mk('A', dict(skin=dict(color=0x4fb3e6, rough=0.05, alpha=0.8)),
                [Zc('foam', 0xcfeeff, rough=0.1, alpha=0.8), Zc('deep', 0x1f6fb0, rough=0.05, alpha=0.8)])
    Z[GLOW].update(color=0xffffff, emit=0xbfeaff, emit_strength=2.5)
    body = skin([(0, 0, 0.05), (0, 0, 0.24), (0, 0.0, 0.45), (0, -0.02, 0.62)], [(0, 1), (1, 2), (2, 3)],
                [(0.3, 0.28), (0.22, 0.2), (0.17, 0.16), (0.14, 0.135)], subdiv=2, zone=SKIN)
    parts = [body]
    for i in range(6):
        a = i / 6 * math.tau + 0.3
        parts.append(taper([V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.2)), V((math.cos(a) * 0.38, math.sin(a) * 0.38, 0.1)), V((math.cos(a + 0.5) * 0.5, math.sin(a + 0.5) * 0.5, 0.05)), V((math.cos(a + 0.9) * 0.52, math.sin(a + 0.9) * 0.52, 0.12))], 0.07, 0.015, sides=10, steps=6, zone=18))
    for s in (-1, 1):
        parts.append(taper([V((s * 0.14, 0, 0.5)), V((s * 0.3, -0.1, 0.45)), V((s * 0.36, -0.2, 0.36))], 0.055, 0.035, sides=10, steps=5, zone=SKIN))
        parts.append(sphere(0.06, 12, 8, loc=(s * 0.37, -0.22, 0.35), zone=SKIN))
        parts.append(sphere(0.03, 10, 8, loc=(s * 0.06, -0.12, 0.66), scale=(1, 0.8, 1.1), zone=GLOW))
    for i in range(14):
        a = i * 2.3
        parts.append(sphere(0.012 + 0.01 * (i % 3), 6, 4, loc=(math.cos(a) * 0.1, math.sin(a) * 0.1, 0.2 + i * 0.03), zone=18))
    b = merge(parts)
    noise_displace(b, 0.012, 16, 2, 2.0)
    rig.part('torso', b, pivot=(0, 0, 0))
    rig.prop(blob=1, scale=1.25)
    finish(rig, Z, out, 'A', dict(blob=True, scale=1.25))

# -------------------------------------------------------------------------------- B bat
def build_B(out):
    Z, rig = mk('B', dict(skin=0x3a3040, glow=dict(color=0xff3030, emit=0xff2020, emit_strength=2.5)),
                [Zc('wingmem', 0x4a3a5a, rough=0.8, double=True), Zc('ear', 0x6a4a5a)])
    body = skin([(0, 0.05, 0.3), (0, -0.02, 0.34), (0, -0.1, 0.4)], [(0, 1), (1, 2)], [(0.1, 0.12), (0.105, 0.11), (0.08, 0.08)], subdiv=2, zone=SKIN)
    parts = [body]
    parts.append(sphere(0.07, 14, 10, loc=(0, -0.16, 0.44), scale=(1, 1.05, 1), zone=SKIN))
    parts.append(sphere(0.03, 10, 8, loc=(0, -0.215, 0.425), scale=(1.3, 0.8, 0.9), zone=18))
    for s in (-1, 1):
        parts.append(taper([V((s * 0.04, -0.14, 0.49)), V((s * 0.075, -0.13, 0.57)), V((s * 0.085, -0.14, 0.64))], 0.032, 0.006, sides=6, steps=4, zone=SKIN, scale=(1, 0.5, 1)))
        parts.append(sphere(0.014, 8, 6, loc=(s * 0.03, -0.21, 0.46), zone=GLOW))
        parts.append(cone(0.007, 0.03, 5, loc=(s * 0.014, -0.225, 0.4), rot=(math.pi, 0, 0), zone=BONE))
        parts.append(taper([V((s * 0.03, 0.06, 0.26)), V((s * 0.04, 0.05, 0.2)), V((s * 0.03, 0.02, 0.17))], 0.012, 0.006, sides=5, steps=3, zone=SKIN))
    b = merge(parts)
    noise_displace(b, 0.005, 30, 2, 1.0)
    rig.part('torso', b, pivot=(0, 0, 0.3))
    for nm, s in (('wingL', 1), ('wingR', -1)):
        bat_wing(rig, nm, s, (s * 0.06, 0.0, 0.37), 0.55, SKIN, 18, parent='torso', droop=-0.05, fingers=4, thick_arm=0.016)
    finish(rig, Z, out, 'B', dict(fly=0.32, scale=1.1))

# -------------------------------------------------------------------------------- K kestrel
def build_K(out):
    Z, rig = mk('K', dict(skin=0xa56a3c, hair=0x7a4a28, bone=0xe8d8b8, gold=0xe0a830, glow=dict(color=0xffc040, emit=0xffb020, emit_strength=1.0)),
                [Zc('cream', 0xe8d8b8), Zc('dark', 0x3a2a1c), Zc('feather2', 0x8a5230)])
    body = skin([(0, 0.1, 0.32), (0, -0.0, 0.34), (0, -0.08, 0.37)], [(0, 1), (1, 2)], [(0.06, 0.09), (0.08, 0.08), (0.065, 0.06)], subdiv=2, zone=SKIN)
    underside_zone(body, 18, -0.2)
    parts = [body, head_eagle((0, -0.13, 0.42), 0.8, zone=SKIN, beak=0x4a4036 if False else GOLD)]
    for i in range(7):
        a = (i - 3) * 0.14
        parts.append(taper([V((0, 0.14, 0.3)), V((math.sin(a) * 0.06, 0.25, 0.27)), V((math.sin(a) * 0.12, 0.34, 0.25))], 0.028, 0.006, sides=6, steps=4, zone=19))
    for s in (-1, 1):
        parts.append(taper([V((s * 0.03, 0.04, 0.3)), V((s * 0.04, 0.03, 0.24)), V((s * 0.04, 0.0, 0.2))], 0.014, 0.008, sides=6, steps=3, zone=GOLD))
        parts.append(taper([V((s * 0.04, 0.0, 0.2)), V((s * 0.045, -0.04, 0.19)), V((s * 0.05, -0.06, 0.17))], 0.009, 0.003, sides=5, steps=3, zone=CLAW))
    b = merge(parts)
    for f in b.faces:
        c = f.calc_center_median()
        if c.y < -0.1 and f.material_index == SKIN and c.z < 0.4:
            pass
    rig.part('torso', b, pivot=(0, 0, 0.32))
    for nm, s in (('wingL', 1), ('wingR', -1)):
        feather_wing(rig, nm, s, (s * 0.06, 0.0, 0.37), 0.55, SKIN, 19, parent='torso')
    finish(rig, Z, out, 'K', dict(fly=0.36, scale=1.15))

# -------------------------------------------------------------------------------- E emu
def build_E(out):
    Z, rig = mk('E', dict(skin=0x7a6248, hair=0x4a3a2a, bone=0x2e2a28, gold=0x3a3632, glow=dict(color=0xffa020, emit=0xff9010, emit_strength=1.0), skin2=0x6a7a8a, claw=0x2a2622),
                [Zc('neck', 0x6a7a8a), Zc('feather', 0x8a6e52)])
    legH = 0.5
    parts = []
    body = skin([(0, 0.12, 0.62), (0, 0.0, 0.64), (0, -0.1, 0.68)], [(0, 1), (1, 2)], [(0.12, 0.14), (0.15, 0.15), (0.12, 0.1)], subdiv=2, zone=SKIN)
    parts.append(body)
    neck = skin([(0, -0.12, 0.72), (0, -0.2, 0.86), (0, -0.2, 1.0), (0, -0.25, 1.1)], [(0, 1), (1, 2), (2, 3)], [(0.05, 0.05), (0.04, 0.04), (0.035, 0.035), (0.04, 0.04)], subdiv=2, zone=18)
    parts.append(neck)
    for i in range(24):
        a = i * 2.39
        parts.append(taper([V((math.cos(a) * 0.1, 0.1 + math.sin(a) * 0.1, 0.68 + math.sin(a * 1.3) * 0.08)), V((math.cos(a) * 0.15, 0.17 + math.sin(a) * 0.12, 0.66 + math.sin(a * 1.3) * 0.08)), V((math.cos(a) * 0.17, 0.24 + math.sin(a) * 0.1, 0.6 + math.sin(a * 1.3) * 0.08))], 0.025, 0.005, sides=5, steps=3, zone=19))
    tb = merge(parts)
    noise_displace(tb, 0.008, 18, 2, 3.0)
    rig.part('torso', tb, pivot=(0, 0, 0.62))
    hb = [sphere(0.055, 14, 10, loc=(0, -0.27, 1.14), scale=(1, 1.2, 1), zone=18),
          taper([V((0, -0.3, 1.13)), V((0, -0.36, 1.11)), V((0, -0.4, 1.09))], 0.03, 0.01, sides=8, steps=3, zone=BONE, scale=(1, 0.8, 0.8))]
    for s in (-1, 1):
        hb.append(sphere(0.016, 8, 6, loc=(s * 0.04, -0.3, 1.16), zone=GLOW))
        hb.append(sphere(0.008, 6, 4, loc=(s * 0.012, -0.385, 1.11), zone=PUPIL))
    rig.part('head', merge(hb), pivot=(0, -0.25, 1.1), parent='torso')
    for nm, s in (('legL', 1), ('legR', -1)):
        pivot = (s * 0.08, 0.02, 0.58)
        lg = skin([(0, 0, 0), (0, 0.03, -0.18), (0, -0.01, -0.36), (0, -0.02, -0.55)], [(0, 1), (1, 2), (2, 3)], [(0.055, 0.06), (0.032, 0.032), (0.026, 0.026), (0.026, 0.026)], subdiv=2, zone=18)
        lp = [lg]
        for i in (-1, 0, 1):
            lp.append(taper([V((i * 0.03, -0.03, -0.56)), V((i * 0.045, -0.1, -0.575)), V((i * 0.05, -0.15, -0.58))], 0.018, 0.008, sides=6, steps=3, zone=18))
            lp.append(cone(0.012, 0.035, 6, loc=(i * 0.05, -0.17, -0.58), rot=(-math.pi / 2, 0, 0), zone=CLAW))
        lb = merge(lp)
        noise_displace(lb, 0.004, 30, 2, 2.0, mask=lambda v: 1.0)
        rig.part(nm, lb, pivot=pivot, local=True)
    finish(rig, Z, out, 'E', dict(scale=1.0))

# -------------------------------------------------------------------------------- horses & big cats & dragons
def mane_strands(path_pts, count, zone, r0=0.03, length=0.1, spread=0.04, droop=0.05):
    parts = []
    rnd = random.Random(7)
    for i in range(count):
        t = i / (count - 1)
        p = Vector(path_pts[min(len(path_pts) - 1, int(t * (len(path_pts) - 1)))])
        side = rnd.uniform(-1, 1)
        parts.append(taper([p, p + V((side * spread, 0.03, 0.04)), p + V((side * spread * 1.6, 0.07 + length * 0.4, 0.02 - droop)), p + V((side * spread * 2, 0.1 + length, -droop * 2.5))], r0, 0.004, sides=5, steps=4, zone=zone))
    return merge(parts)

def build_horse(out, name, body, mane, horn=None, stripes_on=False, glow_eyes=False, props=None, big=1.0):
    pass

def build_U(out):   # black unicorn
    Z, rig = mk('U', dict(skin=0x25222e, hair=0x7b3cd6, bone=0xf2eeff, claw=0x1a1820, glow=dict(color=0xff4040, emit=0xff3030, emit_strength=2.0)),
                [Zc('horn', 0xf4f0ff, rough=0.2, emit=0xaaa0ff, emit_strength=1.6), Zc('mane2', 0xb070ff, rough=0.5)])
    Z[BONE]['color'] = 0x15131a
    P = dict(len=0.55, legH=0.34, girth=1.0, neckLen=1.0, neckUp=1.1, body_zone=SKIN, foot_zone=BONE)
    info = quad(rig, P)
    nt = info['neck_top']
    hd = head_horse((nt.x, nt.y - 0.03, nt.z + 0.02), 1.15, zone=SKIN, horn=18)
    rig.part('head', hd, pivot=(nt.x, nt.y, nt.z - 0.02), parent='torso')
    # glowing eyes replace dark ones
    mane = mane_strands([(0, nt.y + 0.05 + i * 0.03, nt.z - 0.1 + i * 0.012) for i in range(10)] + [(0, nt.y + 0.3, nt.z - 0.2)], 26, 19, 0.03, 0.12, 0.05, 0.06)
    rig.part('mane', mane, pivot=(0, nt.y, nt.z), parent='torso')
    tail(rig, 'tail', info['rump'] + V((0, 0.02, 0.02)), [(0, 0.1, -0.05), (0, 0.18, -0.2), (0, 0.2, -0.35)], 0.05, 0.02, zone=19, tuft=0.05)
    finish(rig, Z, out, 'U', dict(scale=1.2))

def build_Q(out):   # quagga
    Z, rig = mk('Q', dict(skin=0xdccfb0, hair=0x1c1612, bone=0x2a2018, claw=0x1c1612, glow=dict(color=0xffc040, emit=0xffb020, emit_strength=0.6)),
                [Zc('stripe', 0x1e1812, rough=0.7)])
    P = dict(len=0.5, legH=0.3, girth=0.95, neckLen=0.8, neckUp=0.8, body_zone=SKIN)
    info = quad(rig, P)
    apply_to_all(rig, lambda bm, ob: stripes(bm, 18, 14, axis='y') if ob.name in ('torso',) else (stripes(bm, 18, 22, axis='z') if ob.name.startswith('leg') else None))
    nt = info['neck_top']
    hd = head_horse((nt.x, nt.y - 0.03, nt.z + 0.0), 0.95, zone=SKIN)
    rig.part('head', hd, pivot=(nt.x, nt.y, nt.z - 0.02), parent='torso')
    mane = merge([cone(0.02, 0.07, 6, loc=(0, nt.y + 0.03 + i * 0.03, nt.z - 0.1 + i * 0.012 + 0.05), zone=18) for i in range(9)])
    rig.part('mane', mane, pivot=(0, nt.y, nt.z), parent='torso')
    tail(rig, 'tail', info['rump'], [(0, 0.08, -0.08), (0, 0.12, -0.22)], 0.03, 0.012, zone=18, tuft=0.04)
    apply_to_all(rig, lambda bm, ob: stripes(bm, 18, 18, axis='z') if ob.name == 'head' else None)
    finish(rig, Z, out, 'Q', dict(scale=1.25))

def build_G(out):   # griffin
    Z, rig = mk('G', dict(skin=0xc89a50, hair=0xa87830, bone=0xefe8d8, gold=0xe8b830, claw=0x3a2a18, glow=dict(color=0xffb020, emit=0xff9a10, emit_strength=1.4)),
                [Zc('white', 0xf2ead8), Zc('wing', 0xefe5d0), Zc('wingtip', 0x8a6a3a)])
    P = dict(len=0.58, legH=0.24, girth=1.05, neckLen=0.55, neckUp=0.9, body_zone=SKIN, foot='paw', claws=True, fur=0.006)
    info = quad(rig, P)
    nt = info['neck_top']
    # front half: white eagle head & feathered chest
    hd = head_eagle((nt.x, nt.y - 0.05, nt.z + 0.0), 1.3, zone=18, beak=GOLD, glow=True)
    rig.part('head', hd, pivot=(nt.x, nt.y, nt.z - 0.02), parent='torso')
    tail(rig, 'tail', info['rump'], [(0, 0.12, -0.02), (0, 0.24, -0.1), (0, 0.32, -0.14)], 0.04, 0.02, zone=SKIN, tuft=0.06)
    for nm, s in (('wingL', 1), ('wingR', -1)):
        feather_wing(rig, nm, s, (s * 0.12, -0.05, info['hz'] + 0.13), 0.95, 20, 21, parent='torso', n=10)
    finish(rig, Z, out, 'G', dict(scale=1.2, big=1.2))

def build_D(out):   # dragon
    Z, rig = mk('D', dict(skin=0xb52e22, skin2=0xe2b868, bone=0xf0e6cc, claw=0xe8dcc0, glow=dict(color=0xffcc20, emit=0xffb810, emit_strength=3.0)),
                [Zc('membrane', 0x7a1a16, rough=0.7, double=True), Zc('dark', 0x6a1612), Zc('belly', 0xe2b868)])
    Z[SKIN]['rough'] = 0.45
    P = dict(len=0.74, legH=0.3, girth=1.3, neckLen=1.9, neckUp=1.0, body_zone=SKIN, belly_zone=SKIN2, foot='paw', claws=True, scales=0.011, scale_freq=34, stance=0.03)
    info = quad(rig, P)
    nt = info['neck_top']
    up, jaw = head_dragon((nt.x, nt.y - 0.03, nt.z + 0.02), 1.6, zone=SKIN, belly=SKIN2)
    ridge_displace(up, 0.004, 40, 2.0)
    rig.part('head', up, pivot=(nt.x, nt.y + 0.06, nt.z - 0.02), parent='torso')
    rig.part('jaw', jaw, pivot=(nt.x, nt.y + 0.04, nt.z - 0.1), parent='head')
    tail(rig, 'tail', info['rump'], [(0, 0.2, -0.0), (0.05, 0.42, -0.05), (0.1, 0.62, -0.02), (0.12, 0.8, 0.02)], 0.1, 0.012, zone=SKIN, spikes=7)
    # spine spikes
    sp = []
    hz = info['hz']
    for i in range(12):
        t = i / 11
        y = 0.4 - t * 0.9
        sp.append(cone(0.032 - 0.012 * abs(t - 0.5), 0.11 - 0.04 * abs(t - 0.5) * 1.6, 6, loc=(0, y, hz + 0.145 + (0.06 if t > 0.62 else 0.0) * (t - 0.62) * -1 + 0.01), rot=(0.25, 0, 0), zone=BONE))
    rig.part('spikes', merge(sp), pivot=(0, 0, hz), parent='torso')
    for nm, s in (('wingL', 1), ('wingR', -1)):
        bat_wing(rig, nm, s, (s * 0.1, -0.08, hz + 0.15), 1.4, SKIN, 18, parent='torso', droop=-0.02, fingers=5, thick_arm=0.032)
    finish(rig, Z, out, 'D', dict(scale=1.0, big=1.5), ao=14)

def build_J(out):   # jabberwock
    Z, rig = mk('J', dict(skin=0x64428c, skin2=0xc8b07a, bone=0xf2ead0, claw=0xe8dcc0, glow=dict(color=0xff4040, emit=0xff3030, emit_strength=3.0)),
                [Zc('membrane', 0x3a2450, rough=0.7, double=True), Zc('dark', 0x3a2450)])
    parts = []
    torso = skin([(0, 0.2, 0.52), (0, 0.04, 0.62), (0, -0.1, 0.78), (0, -0.2, 0.96), (0, -0.3, 1.1)], [(0, 1), (1, 2), (2, 3), (3, 4)],
                 [(0.15, 0.17), (0.2, 0.19), (0.19, 0.17), (0.12, 0.11), (0.09, 0.09)], subdiv=2, zone=SKIN)
    underside_zone(torso, SKIN2, -0.1)
    ridge_displace(torso, 0.01, 30, 1.0)
    for i in range(9):
        t = i / 8
        parts.append(cone(0.03, 0.1, 6, loc=(0, 0.26 - t * 0.55, 0.7 + t * 0.38 + 0.12), rot=(0.4 - t * 0.2, 0, 0), zone=BONE))
    rig.part('torso', merge([torso] + parts), pivot=(0, 0.04, 0.62))
    up, jaw = head_dragon((0, -0.36, 1.12), 1.5, zone=SKIN, belly=SKIN2, horn=BONE)
    rig.part('head', up, pivot=(0, -0.3, 1.1), parent='torso')
    rig.part('jaw', jaw, pivot=(0, -0.34, 1.04), parent='head')
    tail(rig, 'tail', V((0, 0.26, 0.5)), [(0, 0.2, -0.1), (0, 0.4, -0.25), (0, 0.55, -0.3)], 0.12, 0.012, zone=SKIN, spikes=5)
    for nm, s in (('legL', 1), ('legR', -1)):
        lg = skin([(0, 0, 0), (0, -0.1, -0.2), (0, 0.04, -0.4), (0, -0.02, -0.5)], [(0, 1), (1, 2), (2, 3)], [(0.115, 0.12), (0.075, 0.08), (0.05, 0.055), (0.05, 0.05)], subdiv=2, zone=SKIN)
        lp = [lg]
        for i in (-1, 0, 1):
            lp.append(taper([V((i * 0.045, -0.04, -0.5)), V((i * 0.05, -0.12, -0.505)), V((i * 0.052, -0.19, -0.49))], 0.028, 0.006, sides=6, steps=3, zone=CLAW))
        lp.append(sphere(0.06, 10, 8, loc=(0, -0.04, -0.49), scale=(1.1, 1.4, 0.6), zone=SKIN))
        lb = merge(lp)
        ridge_displace(lb, 0.007, 30, 2.0)
        rig.part(nm, lb, pivot=(s * 0.14, 0.1, 0.54), local=True)
    for nm, s in (('armL', 1), ('armR', -1)):
        a = skin([(0, 0, 0), (0, -0.1, -0.12), (0, -0.2, -0.2)], [(0, 1), (1, 2)], [(0.065, 0.065), (0.05, 0.05), (0.04, 0.04)], subdiv=2, zone=SKIN)
        ap = [a]
        for i in (-1, 0, 1):
            ap.append(taper([V((i * 0.025, -0.22, -0.2)), V((i * 0.03, -0.3, -0.2)), V((i * 0.03, -0.35, -0.17))], 0.016, 0.003, sides=6, steps=3, zone=CLAW))
        ap.append(sphere(0.045, 10, 8, loc=(0, -0.21, -0.2), zone=SKIN))
        rig.part(nm, merge(ap), pivot=(s * 0.19, -0.08, 0.8), local=True)
    for nm, s in (('wingL', 1), ('wingR', -1)):
        bat_wing(rig, nm, s, (s * 0.15, 0.02, 0.88), 0.7, SKIN, 18, parent='torso', droop=-0.04, fingers=3, thick_arm=0.025)
    finish(rig, Z, out, 'J', dict(scale=1.0, big=1.45), ao=14)

def build_C(out):   # centaur
    Z, rig = mk('C', dict(skin=0xa0693a, skin2=0xdca47f, hair=0x2a1a10, bone=0x2a1c12, cloth=0x6a4a2a, leather=0x5a3a22, wood=0x7a4a22, metal=0xb0b4bc, claw=0x2a1c12, glow=dict(color=0xffd060, emit=0xffc040, emit_strength=0.5)),
                [Zc('torso', 0xdca47f, rough=0.55), Zc('cloth', 0x3a6a9a, rough=0.85)])
    P = dict(len=0.5, legH=0.34, girth=1.0, neckLen=0.4, neckUp=0.5, body_zone=SKIN, foot_zone=BONE, fur=0.004)
    info = quad(rig, P)
    hz = info['hz']
    ch = info['chest']
    # human torso rising from the chest
    base = V((0, ch.y - 0.04, hz + 0.1))
    hum = skin([tuple(base), tuple(base + V((0, -0.02, 0.12))), tuple(base + V((0, -0.03, 0.25))), tuple(base + V((0, -0.03, 0.3)))], [(0, 1), (1, 2), (2, 3)],
               [(0.11, 0.09), (0.12, 0.09), (0.135, 0.1), (0.05, 0.05)], subdiv=2, zone=18)
    parts = [hum]
    for s in (-1, 1):
        parts.append(sphere(0.06, 12, 8, loc=base + V((s * 0.15, -0.03, 0.27)), zone=18))
    parts.append(torus(0.11, 0.015, 18, 6, loc=base + V((0, -0.02, 0.04)), scale=(1, 0.8, 1), zone=LEATHER))
    rig.part('rider', merge(parts), pivot=tuple(base), parent='torso')
    hb = head_bm(dict(headScale=0.95, hair='long', ears='pointy', nose=0.9, brow=1.0, beard=True), z0=base.z + 0.3 - 0.02)
    hb2 = Vector((0, base.y - 0.03, 0))
    bmesh.ops.translate(hb, vec=hb2, verts=hb.verts)
    rig.part('head', hb, pivot=(0, base.y - 0.03, base.z + 0.3), parent='rider')
    for nm, s in (('armL', 1), ('armR', -1)):
        a = skin([(0, 0, 0), (0, -0.04, -0.12), (0, -0.1, -0.22)], [(0, 1), (1, 2)], [(0.05, 0.05), (0.042, 0.042), (0.036, 0.036)], subdiv=2, zone=18)
        ap = [a, sphere(0.045, 10, 8, loc=(0, -0.11, -0.235), zone=18)]
        a_rot = (-0.9, 0, 0)
        rig.part(nm, merge(ap), pivot=(s * 0.16, base.y - 0.05, base.z + 0.27), parent='rider', local=True)
    bow = torus(0.2, 0.012, 24, 6, loc=(0.17, base.y - 0.28, base.z + 0.08), rot=(0, math.pi / 2, 0), scale=(1, 1, 1.0), zone=WOOD)
    delete_faces_where(bow, lambda c: c.y > base.y - 0.28 + 0.1)
    rig.part('bow', bow, pivot=(0.17, base.y - 0.28, base.z + 0.08), parent='rider')
    tail(rig, 'tail', info['rump'], [(0, 0.1, -0.06), (0, 0.16, -0.2), (0, 0.17, -0.34)], 0.045, 0.02, zone=HAIR, tuft=0.05)
    finish(rig, Z, out, 'C', dict(scale=1.2))

# -------------------------------------------------------------------------------- serpents
def serpent(out, name, body_col, belly_col, pattern, rattle=False, big=False):
    Z, rig = mk(name, dict(skin=body_col, skin2=belly_col, bone=0xefe8d0, glow=dict(color=0xffee00, emit=0xffdd00, emit_strength=2.0)),
                [Zc('pattern', pattern, rough=0.5), Zc('tongue', 0xd02030, rough=0.4)])
    pts, radii = [], []
    n = 90
    turns = 2.0
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        rr = (0.3 - 0.1 * t) * (1.0 + 0.04 * math.sin(a * 3))
        z = 0.06 + 0.07 * t * turns + 0.015 * math.sin(a * 2)
        pts.append(V((math.cos(a) * rr, math.sin(a) * rr, z)))
        r = 0.07 * (1.0 - 0.45 * (1 - t) ** 3 * 0.0) * (0.6 + 0.4 * math.sin(min(1, t * 1.4) * math.pi * 0.5))
        radii.append((r if t > 0.04 else 0.02 + r * 0.5, r * 0.88))
    body = sweep(pts, radii, 12, zone=SKIN, caps=True)
    underside_zone(body, SKIN2, -0.2)
    for f in body.faces:
        c = f.calc_center_median()
        if f.material_index == SKIN and int(math.floor(math.atan2(c.y, c.x) * 3 + c.z * 25)) % 3 == 0 and noise.noise(c * 8) > -0.3:
            f.material_index = 18
    ridge_displace(body, 0.004, 55, 1.0)
    head_p = pts[-1]
    hdir = (pts[-1] - pts[-4]).normalized()
    up = V((0, 0, 1))
    hp = []
    base = head_p + hdir * 0.02 + up * 0.0
    side = hdir.cross(up).normalized()
    neck = taper([head_p - hdir * 0.15, head_p + up * 0.09, head_p + hdir * 0.13 + up * 0.17], 0.052, 0.058, sides=10, steps=6, zone=SKIN)
    hp.append(neck)
    hc = head_p + hdir * 0.13 + up * 0.17
    hp.append(sphere(0.06, 14, 10, loc=hc + hdir * 0.04, scale=(1.0, 1.0, 0.7), rot=(0, 0, math.atan2(hdir.y, hdir.x) + math.pi / 2), zone=SKIN))
    hp.append(sphere(0.04, 12, 8, loc=hc + hdir * 0.1 - up * 0.008, scale=(0.9, 1.0, 0.65), rot=(0, 0, math.atan2(hdir.y, hdir.x) + math.pi / 2), zone=SKIN))
    for s in (-1, 1):
        hp.append(sphere(0.016, 8, 6, loc=hc + hdir * 0.05 + side * s * 0.045 + up * 0.025, zone=GLOW))
        hp.append(cone(0.006, 0.04, 5, loc=hc + hdir * 0.1 + side * s * 0.02 - up * 0.03, rot=(math.pi, 0, 0), zone=BONE))
    tg = taper([hc + hdir * 0.13, hc + hdir * 0.2 - up * 0.01, hc + hdir * 0.24 + side * 0.012], 0.006, 0.002, sides=4, steps=3, zone=19)
    hp.append(tg)
    rig.part('torso', body, pivot=(0, 0, 0.05))
    hb = merge(hp)
    ridge_displace(hb, 0.003, 60, 3.0)
    rig.part('head', hb, pivot=tuple(head_p), parent='torso')
    if rattle:
        rp = []
        for i in range(5):
            rp.append(sphere(0.04 - i * 0.004, 12, 8, loc=pts[0] + V((0.03 * i, 0.0, 0.0)) * 1.0 + V((0, -0.0, 0.01)), scale=(1.2, 1.0, 0.9), zone=BONE))
        rig.part('rattle', merge(rp), pivot=tuple(pts[0]), parent='torso')
    finish(rig, Z, out, name, dict(serpent=True, scale=1.3))

def build_S(out):
    serpent(out, 'S', 0x4e9c3c, 0xd8e08a, 0xd0d870)

def build_R(out):
    serpent(out, 'R', 0xb48b50, 0xe8d8a8, 0x4a3320, rattle=True)

BUILDERS = {'A': build_A, 'B': build_B, 'K': build_K, 'E': build_E, 'U': build_U, 'Q': build_Q, 'G': build_G, 'D': build_D, 'J': build_J, 'C': build_C, 'S': build_S, 'R': build_R}

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
