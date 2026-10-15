import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chars import *

def build(out):
    clear()
    Z = zones(skin=0xe6b48f, cloth=0x2d5f9e, cloth2=0x4a3322, cape=0x9a2b22, metal=0xb9bfcb, hair=0x5a3418)
    rig = Rig('hero', Z)
    def left_item(r, hw, pname):
        r.part('torch', w_torch(hw), pivot=hw, parent=pname)
        r.part('flame', flame_bm(*hw), pivot=(hw[0], hw[1] - 0.052, hw[2] + 0.34), parent=pname)
        r.node('torchTip', pivot=(hw[0], hw[1] - 0.056, hw[2] + 0.46), parent=pname)
    P = dict(fat=1.0, hood=True, hood_zone=CAPE, cape=True, armor=True, rings=True, weapon=lambda hw: w_mace(rig, hw), left_item=left_item,
             backpack=True, bracers='leather', hair='short', ears='round', skirt_zone=CLOTH2, helm=None, nose=1.0)
    humanoid(rig, P)
    paint(rig, Z)
    print('TRIS', tri_count(rig))
    export(rig, out, dict(kind='hero'))

if __name__ == '__main__':
    build(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'raw', 'hero.glb'))
