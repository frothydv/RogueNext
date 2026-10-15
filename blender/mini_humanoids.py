"""Hero and humanoid monsters: hobgoblin, orc, troll, yeti, zombie, vampire, medusa, nymph, leprechaun."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chars import *

ACC1, ACC2, ACC3 = 18, 19, 20

def ext(z, *extra):
    z = list(z)
    for e in extra:
        z.append(e)
    return z

def finish(rig, Z, out, name, props=None, ao=20):
    paint(rig, Z, ao_samples=ao)
    print('MODEL', name, 'tris', tri_count(rig))
    export(rig, os.path.join(out, name + '.glb'), props or {})

def shield(color_zone=WOOD, r=0.13):
    def extra(side, fat, arm_len):
        if side != 'L':
            return bmesh.new()
        c = (0.0, -0.075, -arm_len * 0.55)
        parts = [cylinder(r, r, 0.03, 24, loc=c, rot=(math.pi / 2, 0, 0), zone=color_zone),
                 torus(r, 0.014, 28, 6, loc=c, rot=(math.pi / 2, 0, 0), zone=METAL),
                 sphere(0.035, 12, 8, loc=(c[0], c[1] - 0.025, c[2]), zone=METAL)]
        for i in range(6):
            a = i / 6 * math.tau
            parts.append(sphere(0.012, 6, 4, loc=(c[0] + math.cos(a) * r * 0.75, c[1] - 0.02, c[2] + math.sin(a) * r * 0.75), zone=METAL))
        return merge(parts)
    return extra

def torch_item(rig):
    def left_item(r, hw, pname):
        r.part('torch', w_torch(hw), pivot=hw, parent=pname)
        r.part('flame', flame_bm(*hw), pivot=(hw[0], hw[1] - 0.052, hw[2] + 0.34), parent=pname)
        r.node('torchTip', pivot=(hw[0], hw[1] - 0.056, hw[2] + 0.46), parent=pname)
    return left_item

def build_hero(out):
    clear()
    Z = zones(skin=0xdca47f, cloth=0x2d5f9e, cloth2=0x4a3322, cape=0x9a2b22, metal=0xb9bfcb, hair=0x5a3418)
    rig = Rig('hero', Z)
    P = dict(fat=1.0, hood=True, hood_zone=CAPE, cape=True, armor=True, rings=True, weapon=lambda hw: w_mace(rig, hw), left_item=torch_item(rig),
             backpack=True, bracers='leather', hair='short', ears='round', nose=0.9)
    humanoid(rig, P)
    finish(rig, Z, out, 'hero', dict(kind='hero', scale=1.3))

def build_H(out):   # hobgoblin
    clear()
    Z = zones(skin=0xcc6a3a, cloth=0x6b4a2a, cloth2=0x4a2a1a, hair=0x2a1a10, bone=0xe8dcc0, glow=dict(color=0xffe040, emit=0xffd030, emit_strength=2.5))
    rig = Rig('H', Z)
    P = dict(fat=1.18, belly=1.1, ears='pointy', nose=1.5, brow=1.5, jaw=1.2, fangs=True, glow_eyes=True, weapon=lambda hw: w_club(hw),
             shirt=False, skirt=True, skirt_zone=CLOTH2, boots=False, bare_legs=True, toe_claws=True, belt=True, hair=None, claws=False,
             bracers='leather', arm=1.1)
    humanoid(rig, P)
    finish(rig, Z, out, 'H', dict(scale=1.35))

def build_O(out):   # orc
    clear()
    Z = zones(skin=0x6f9a4a, cloth=0x5a4a30, cloth2=0x3a2a18, metal=0x8e949e, bone=0xefe6c8, hair=0x1e1a14, glow=dict(color=0xff4020, emit=0xff3010, emit_strength=2.5))
    rig = Rig('O', Z)
    P = dict(fat=1.28, ears='pointy', nose=1.2, brow=1.6, jaw=1.3, tusks=True, glow_eyes=True, helm=True, armor=True, rings=True,
             weapon=lambda hw: w_axe(hw, big=True), arm_extra=shield(WOOD), shirt=True, skirt=True, skirt_zone=LEATHER, bracers='metal', arm=1.05,
             boots=True, boot_zone=BOOT)
    humanoid(rig, P)
    finish(rig, Z, out, 'O', dict(scale=1.35))

def build_T(out):   # troll
    clear()
    Z = zones(skin=0x5f8a4c, cloth=0x6a5a3a, cloth2=0x3a2e1e, bone=0xe8dcc0, hair=0x2e3a22, glow=dict(color=0xffd020, emit=0xffc010, emit_strength=2.5), skin2=0x4a7040)
    rig = Rig('T', Z)
    P = dict(fat=1.65, height=1.0, belly=1.2, hunch=0.28, headScale=0.9, ears='big', nose=2.0, nose_tint=True, brow=1.8, jaw=1.5, tusks=True, glow_eyes=True,
             weapon=lambda hw: w_club(hw), shirt=False, skirt=True, skirt_zone=CLOTH2, boots=False, bare_legs=True, toe_claws=True, arm=1.25, leg=0.85,
             bracers=None, hair='spiky', mouth_w=1.3)
    humanoid(rig, P)
    finish(rig, Z, out, 'T', dict(scale=1.5))

def build_Y(out):   # yeti
    clear()
    Z = zones(skin=0xe9eff3, cloth=0xe9eff3, cloth2=0xdde6ee, skin2=0x7ec0dc, hair=0xe0e8f0, bone=0xf2efe4, claw=0xcfd6dc, boot=0xdde6ee, glow=dict(color=0x9fe8ff, emit=0x60c8ff, emit_strength=1.5))
    Z[SKIN]['var'] = 0.1; Z[CLOTH]['var'] = 0.1; Z[CLOTH]['rough'] = 0.9; Z[SKIN]['rough'] = 0.9
    rig = Rig('Y', Z)
    P = dict(fat=1.55, belly=1.15, hunch=0.22, ears='round', nose=1.2, nose_tint=True, brow=1.5, jaw=1.4, tusks=True, shirt=True, skirt=False, belt=False,
             boots=True, boot_zone=CLOTH, toe_claws=True, claws=True, arm=1.3, leg=0.9, hair='short', mouth_w=1.3, legs_zone=CLOTH, sleeve=CLOTH, long_sleeves=True,
             eye=1.1, headScale=0.95)
    humanoid(rig, P)
    # fur relief on every part
    for ob in rig.parts.values():
        if ob.type == 'MESH':
            bm = bmesh.new(); bm.from_mesh(ob.data)
            noise_displace(bm, 0.012, 34, 2, 3.0)
            bm.to_mesh(ob.data); bm.free()
    finish(rig, Z, out, 'Y', dict(scale=1.45))

def build_Z(out):   # zombie
    clear()
    Z = zones(skin=0x8aa078, cloth=0x6a5a3c, cloth2=0x3e3a2a, hair=0x2a2a20, glow=dict(color=0xe8e060, emit=0xd8d040, emit_strength=1.6), skin2=0x6a8060, bone=0xd8d0b0)
    rig = Rig('Z', Z)
    P = dict(fat=1.0, hunch=0.14, ears='round', nose=0.8, brow=1.0, jaw=1.1, teeth=True, glow_eyes=True, shirt=True, skirt=False, belt=True, bare_legs=False,
             boots=False, legs_zone=CLOTH2, weapon=None, sleeve=CLOTH, long_sleeves=False, hair='short', mouth_w=1.2, toe_claws=False)
    humanoid(rig, P)
    for n in ('armL', 'armR'):
        rig.parts[n].rotation_euler[0] = -1.28
    bpy.context.view_layer.update()
    finish(rig, Z, out, 'Z', dict(scale=1.3))

def build_V(out):   # vampire
    clear()
    Z = zones(skin=0xe8e2ea, cloth=0x1a1620, cloth2=0x120f18, cape=0x7a0e1e, hair=0x0e0e14, metal=0xc8b070, glow=dict(color=0xff2020, emit=0xff1010, emit_strength=2.5), boot=0x0e0c12, leather=0x2a1a1a)
    rig = Rig('V', Z)
    def torso_extra(r, fat, hip, zc, zs, zn):
        # waistcoat front + frilled collar
        return merge([box((0.1, 0.02, 0.17), bevel=0.006, loc=(0, -0.09, zc + 0.03), zone=CAPE), torus(0.07, 0.016, 16, 6, loc=(0, -0.01, zn - 0.01), zone=CAPE)])
    P = dict(fat=0.92, ears='pointy', nose=1.2, brow=1.0, jaw=0.9, fangs=True, glow_eyes=True, cape=True, collar=True, hair='short', skirt=True, skirt_zone=CLOTH,
             belt=False, boots=True, boot_zone=BOOT, torso_extra=torso_extra, bracers=None, weapon=None, leg=1.05, arm=1.05, sleeve=CLOTH, glove_zone=SKIN)
    humanoid(rig, P)
    finish(rig, Z, out, 'V', dict(scale=1.35))

def build_M(out):   # medusa
    clear()
    Z = zones(skin=0x8fbf6a, cloth=0x2a6a4a, cloth2=0x1a4a34, cape=0x1d4a34, hair=0x3f9a45, gold=0xe0b040, glow=dict(color=0xfff030, emit=0xffee20, emit_strength=2.5), claw=0xd8d0b0)
    Z[CLOTH2]['color'] = 0x2d7a58
    rig = Rig('M', Z)
    def torso_extra(r, fat, hip, zc, zs, zn):
        gown = cylinder(0.11, 0.2, hip - 0.0, 20, loc=(0, 0, (hip) / 2), scale=(1, 0.85, 1), zone=CLOTH2, cap=False)
        noise_displace(gown, 0.006, 14, 2, 2)
        neck = torus(0.062, 0.012, 16, 6, loc=(0, -0.01, zn - 0.012), zone=GOLD)
        gem = sphere(0.016, 8, 6, loc=(0, -0.07, zn - 0.04), zone=GLOW)
        return merge([gown, neck, gem])
    P = dict(fat=0.9, height=1.0, ears='pointy', nose=0.9, glow_eyes=True, hair='snakes', cape=True, skirt=False, belt=True, boots=False, bare_legs=True,
             legs_zone=SKIN, torso_extra=torso_extra, weapon=None, sleeve=SKIN, shirt=True, long_sleeves=False, mouth_w=1.0, fangs=True, claws=True, bracers='metal')
    humanoid(rig, P)
    finish(rig, Z, out, 'M', dict(scale=1.35))

def build_N(out):   # nymph
    clear()
    Z = zones(skin=0xf0d4c4, cloth=0x3fa08a, cloth2=0x2a7a68, cape=0x56c0a0, hair=0x2a8a78, gold=0xe8c860, glow=dict(color=0x40d0ff, emit=0x30c0ff, emit_strength=2.0))
    rig = Rig('N', Z)
    def torso_extra(r, fat, hip, zc, zs, zn):
        parts = []
        for i in range(9):
            a = i / 9 * math.tau
            parts.append(cone(0.04, 0.17, 6, loc=(math.cos(a) * 0.11, math.sin(a) * 0.09, hip - 0.02), rot=(math.sin(a) * 0.35, -math.cos(a) * 0.35, 0), scale=(1, 1, 1), zone=CLOTH2))
        parts.append(taper([V((0.1, -0.05, zs - 0.05)), V((0.12, -0.1, zs - 0.1)), V((0.1, -0.12, zs - 0.15))], 0.012, 0.004, sides=6, steps=3, zone=CLOTH2))
        return merge(parts)
    P = dict(fat=0.82, height=1.0, ears='pointy', nose=0.7, eye=1.15, glow_eyes=True, hair='long', cape=True, skirt=True, skirt_zone=CLOTH2, belt=True,
             boots=False, bare_legs=True, legs_zone=SKIN, torso_extra=torso_extra, weapon=None, sleeve=SKIN, shirt=True, long_sleeves=False, leg=1.1, arm=1.0, brow=0.6, jaw=0.8)
    humanoid(rig, P)
    finish(rig, Z, out, 'N', dict(scale=1.3))

def build_L(out):   # leprechaun
    clear()
    Z = zones(skin=0xe4aa84, cloth=0x2f9a3f, cloth2=0x1d6a2c, hair=0xd0561e, gold=0xf0c040, boot=0x1a1410, leather=0x6a4a2a, metal=0xc8a030, glow=dict(color=0xffffff, emit=0xffffff, emit_strength=0.2))
    rig = Rig('L', Z)
    def hat(zn):
        r = 0.125 * 1.15
        hz = zn - 0.02 + 0.075 + r * 0.9
        return merge([cylinder(r * 1.35, r * 1.35, 0.025, 22, loc=(0, 0.01, hz + r * 0.62), zone=CLOTH),
                      cylinder(r * 0.82, r * 0.88, 0.17, 20, loc=(0, 0.01, hz + r * 0.62 + 0.095), zone=CLOTH),
                      cylinder(r * 0.9, r * 0.9, 0.035, 20, loc=(0, 0.01, hz + r * 0.62 + 0.04), zone=CLOTH2),
                      box((0.07, 0.014, 0.06), bevel=0.006, loc=(0, -r * 0.88, hz + r * 0.62 + 0.04), zone=GOLD)])
    def sack(side, fat, arm_len):
        if side != 'L':
            return bmesh.new()
        c = (0.0, -0.06, -arm_len - 0.1)
        return merge([sphere(0.085, 14, 10, loc=c, scale=(1, 1, 1.1), zone=LEATHER), cone(0.04, 0.07, 8, loc=(c[0], c[1], c[2] + 0.09), zone=LEATHER),
                      sphere(0.02, 6, 4, loc=(c[0] + 0.03, c[1] - 0.075, c[2] + 0.04), zone=GOLD), sphere(0.018, 6, 4, loc=(c[0] - 0.02, c[1] - 0.08, c[2] - 0.03), zone=GOLD)])
    P = dict(fat=1.0, height=0.7, headScale=1.15, ears='pointy', nose=1.7, nose_tint=True, brow=0.9, hat=hat, beard=True, hair=None, skirt=True, skirt_zone=CLOTH2,
             belt=True, boots=True, boot_zone=BOOT, weapon=None, arm_extra=sack, leg=0.8, arm=0.85, sleeve=CLOTH, mouth_w=1.2, eye=1.0, teeth=False)
    P['beard'] = True
    humanoid(rig, P)
    finish(rig, Z, out, 'L', dict(scale=0.95))

BUILDERS = {'hero': build_hero, 'H': build_H, 'O': build_O, 'T': build_T, 'Y': build_Y, 'Z': build_Z, 'V': build_V, 'M': build_M, 'N': build_N, 'L': build_L}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'raw')
    args = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else list(BUILDERS)
    for k in args or list(BUILDERS):
        BUILDERS[k](out)
