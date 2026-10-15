"""Shared helpers for building game-ready models in Blender with Python.

Everything is procedural: shapes are created with bmesh, organic forms use the Skin modifier,
surfaces are sculpted with noise displacement, and the colour is *painted into vertex colours*
(base colour zones + baked ambient occlusion + cavity wash + edge drybrush) so the models carry
hand-painted-miniature detail without needing image textures.  Run through blender -b -P.
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, Euler, noise
from mathutils.bvhtree import BVHTree

# --------------------------------------------------------------------------- colour
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexcol(h):
    return (_lin(((h >> 16) & 255) / 255), _lin(((h >> 8) & 255) / 255), _lin((h & 255) / 255))

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x

# --------------------------------------------------------------------------- scene
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def empty(name, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = 'PLAIN_AXES'
    ob.location = loc
    return link(ob)

def obj_from_bm(name, bm, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    return link(ob)

# --------------------------------------------------------------------------- primitives (return bmesh)
def _xf(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    m = Matrix.Translation(loc) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm

def sphere(r=0.1, seg=20, rings=12, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), zone=0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for f in bm.faces:
        f.smooth = True
        f.material_index = zone
    return _xf(bm, loc, rot, scale)

def cylinder(r1=0.1, r2=None, h=0.2, seg=16, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), cap=True, zone=0, smooth=True):
    """r1 = bottom radius, r2 = top radius (defaults to r1); axis along local Z."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r1, radius2=r1 if r2 is None else r2, depth=h)
    for f in bm.faces:
        f.smooth = smooth
        f.material_index = zone
    return _xf(bm, loc, rot, scale)

def box(size=(0.1, 0.1, 0.1), bevel=0.0, bsegs=2, loc=(0, 0, 0), rot=(0, 0, 0), zone=0, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=bsegs, affect='EDGES', profile=0.5)
    for f in bm.faces:
        f.smooth = smooth
        f.material_index = zone
    return _xf(bm, loc, rot)

def cone(r=0.1, h=0.2, seg=12, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), zone=0):
    return cylinder(r, 0.0001, h, seg, loc, rot, scale, zone=zone)

def torus(R=0.1, r=0.02, seg=24, rseg=8, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), zone=0):
    pts = [Vector((math.cos(a) * R, math.sin(a) * R, 0)) for a in [i / seg * math.tau for i in range(seg)]]
    return sweep(pts + [pts[0]], [r] * (seg + 1), rseg, closed=True, zone=zone, loc=loc, rot=rot, scale=scale)

def sweep(path, radii, sides=8, closed=False, zone=0, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), caps=True):
    """Tube along a polyline with per-point radius (float or (rx, ry)). Parallel-transport frames."""
    path = [Vector(p) for p in path]
    n = len(path)
    T = []
    for i in range(n):
        a = path[max(0, i - 1)]
        b = path[min(n - 1, i + 1)]
        t = (b - a)
        T.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.95 else Vector((1, 0, 0))
    N = [(ref - T[0] * ref.dot(T[0])).normalized()]
    for i in range(1, n):
        q = T[i - 1].rotation_difference(T[i])
        N.append((q @ N[-1]).normalized())
    bm = bmesh.new()
    rings = []
    for i in range(n):
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        B = T[i].cross(N[i])
        ring = []
        for k in range(sides):
            a = k / sides * math.tau
            ring.append(bm.verts.new(path[i] + N[i] * math.cos(a) * rx + B * math.sin(a) * ry))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(sides):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
            f.smooth = True; f.material_index = zone
    if caps and not closed:
        for ring, flip in ((rings[0], True), (rings[-1], False)):
            c = sum((v.co for v in ring), Vector()) / sides
            cv = bm.verts.new(c)
            for k in range(sides):
                vs = (cv, ring[(k + 1) % sides], ring[k]) if flip else (cv, ring[k], ring[(k + 1) % sides])
                f = bm.faces.new(vs); f.smooth = True; f.material_index = zone
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _xf(bm, loc, rot, scale)

def bezier(points, steps=14):
    """Catmull-Rom spline through points -> list of Vectors."""
    pts = [Vector(p) for p in points]
    if len(pts) < 3:
        return pts
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(steps):
            t = s / steps
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out

def taper(path_pts, r0, r1, power=1.0, steps=14, sides=8, zone=0, **kw):
    """Smooth tapered tube (horns, tails, tentacles, snakes)."""
    path = bezier(path_pts, steps)
    n = len(path)
    radii = [r0 + (r1 - r0) * ((i / (n - 1)) ** power) for i in range(n)]
    return sweep(path, radii, sides, zone=zone, **kw)

def skin(verts, edges, radii, subdiv=2, roots=(0,), zone=0, loc=(0, 0, 0), smooth_branch=0.6):
    """Organic body from a skeleton: verts [(x,y,z)], edges [(i,j)], radii [(rx,ry)] -> bmesh."""
    me = bpy.data.meshes.new('skin_tmp')
    me.from_pydata([Vector(v) for v in verts], edges, [])
    me.update()
    ob = bpy.data.objects.new('skin_tmp', me)
    link(ob)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('Skin', 'SKIN')
    mod.branch_smoothing = smooth_branch
    mod.use_smooth_shade = True
    if not me.skin_vertices:
        me.skin_vertices.new()
    layer = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        layer[i].radius = (r, r) if not isinstance(r, (tuple, list)) else tuple(r)
    for i in roots:
        layer[i].use_root = True
    if subdiv:
        sm = ob.modifiers.new('Sub', 'SUBSURF')
        sm.levels = subdiv; sm.render_levels = subdiv
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me2 = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bm = bmesh.new()
    bm.from_mesh(me2)
    bpy.data.meshes.remove(me2)
    for f in bm.faces:
        f.smooth = True
        f.material_index = zone
    return _xf(bm, loc)

def subdivide(bm, cuts=1):
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
    return bm

def smooth_subsurf(bm, levels=1):
    """Catmull-Clark smoothing of a bmesh via a temporary object."""
    me = bpy.data.meshes.new('ss_tmp'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('ss_tmp', me); link(ob)
    sm = ob.modifiers.new('S', 'SUBSURF'); sm.levels = levels; sm.render_levels = levels
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    out = bmesh.new(); out.from_mesh(me2); bpy.data.meshes.remove(me2)
    for f in out.faces:
        f.smooth = True
    return out

def merge(bms, name='merged'):
    out = bmesh.new()
    for b in bms:
        me = bpy.data.meshes.new('m_tmp')
        b.to_mesh(me)
        b.free()
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    return out

def noise_displace(bm, amp=0.01, scale=8.0, octaves=2, seed=0.0, mask=None, mode='normal'):
    """Sculpt-like surface relief. mask(vert)->0..1 optional."""
    bm.normal_update()
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in bm.verts:
        m = 1.0 if mask is None else mask(v)
        if m <= 0:
            continue
        p = v.co * scale + off
        d = 0.0
        a = 1.0
        for o in range(octaves):
            d += noise.noise(p * (2 ** o)) * a
            a *= 0.5
        v.co += v.normal * (d * amp * m)
    return bm

def ridge_displace(bm, amp=0.01, scale=6.0, seed=0.0, mask=None):
    """Cellular (scale/plate) relief using Voronoi distance."""
    bm.normal_update()
    off = Vector((seed * 5.3, seed * 2.1, seed * 9.7))
    for v in bm.verts:
        m = 1.0 if mask is None else mask(v)
        if m <= 0:
            continue
        d = noise.voronoi(v.co * scale + off)[0][0]
        v.co += v.normal * ((0.5 - min(d, 1.0)) * amp * m)
    return bm

def zone_where(bm, fn, zone):
    for f in bm.faces:
        if fn(f.calc_center_median(), f):
            f.material_index = zone
    return bm

def set_zone(bm, zone):
    for f in bm.faces:
        f.material_index = zone
    return bm

# --------------------------------------------------------------------------- parts & hierarchy
class Rig:
    """Builds a named hierarchy of mesh parts with pivots, then paints and exports it."""
    def __init__(self, name, zones):
        self.name = name
        self.zones = zones
        self.root = empty(name)
        self.parts = {}
        self.mats = make_materials(name, zones)

    def part(self, name, bm, pivot=(0, 0, 0), parent=None, local=False):
        """bm is in model-space coordinates (or already pivot-local if local=True); the object origin sits at `pivot`."""
        pivot = Vector(pivot)
        if not local:
            bmesh.ops.translate(bm, vec=-pivot, verts=bm.verts)
        ob = obj_from_bm(name, bm)
        ob.location = pivot - (self.parts[parent].matrix_world.translation if parent else Vector())
        ob.parent = self.parts[parent] if parent else self.root
        if parent is None:
            ob.location = pivot
        for m in self.mats:
            ob.data.materials.append(m)
        self.parts[name] = ob
        bpy.context.view_layer.update()
        return ob

    def node(self, name, pivot=(0, 0, 0), parent=None):
        e = empty(name)
        e.parent = self.parts[parent] if parent else self.root
        e.location = Vector(pivot) - (self.parts[parent].matrix_world.translation if parent else Vector())
        self.parts[name] = e
        bpy.context.view_layer.update()
        return e

    def prop(self, **props):
        for k, v in props.items():
            self.root[k] = v

# --------------------------------------------------------------------------- materials & painting
def make_materials(prefix, zones):
    cache = {}
    mats = []
    for z in zones:
        key = (z.get('rough', 0.6), z.get('metal', 0.0), z.get('emit'), z.get('emit_strength', 0.0), z.get('alpha', 1.0))
        if key not in cache:
            m = bpy.data.materials.new(f'{prefix}_{len(cache)}')
            m.use_nodes = True
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
            bsdf.inputs['Roughness'].default_value = key[0]
            bsdf.inputs['Metallic'].default_value = key[1]
            if key[2] is not None:
                bsdf.inputs['Emission Color'].default_value = (*hexcol(key[2]), 1)
                bsdf.inputs['Emission Strength'].default_value = key[3]
            if key[4] < 1.0:
                bsdf.inputs['Alpha'].default_value = key[4]
                m.surface_render_method = 'BLENDED'
            cache[key] = m
        mats.append(cache[key])
    return mats

def paint(rig_or_objs, zones, ao_samples=20, ao_dist=0.22, ao_strength=0.85, wash=0.35, edge=0.30, seed=1):
    """Bake colour zones + AO + cavity wash + edge drybrush into the 'Col' colour attribute."""
    rnd = random.Random(seed)
    objs = [o for o in (rig_or_objs.parts.values() if hasattr(rig_or_objs, 'parts') else rig_or_objs) if o.type == 'MESH']
    bpy.context.view_layer.update()
    # world-space triangle soup for AO
    verts_w, tris = [], []
    for ob in objs:
        mw = ob.matrix_world
        base = len(verts_w)
        verts_w.extend(mw @ v.co for v in ob.data.vertices)
        ob.data.calc_loop_triangles()
        tris.extend((base + t.vertices[0], base + t.vertices[1], base + t.vertices[2]) for t in ob.data.loop_triangles)
    bvh = BVHTree.FromPolygons(verts_w, tris, epsilon=1e-6)
    hemi = []
    for i in range(ao_samples):
        u1, u2 = (i + 0.5) / ao_samples, (i * 0.618034) % 1.0
        r = math.sqrt(u1)
        a = u2 * math.tau
        hemi.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u1)))))
    for ob in objs:
        me = ob.data
        mw = ob.matrix_world
        nmat = mw.to_3x3().inverted().transposed()
        bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
        nv = len(bm.verts)
        ao = [1.0] * nv
        cav = [0.0] * nv
        for v in bm.verts:
            p = mw @ v.co
            n = (nmat @ v.normal).normalized()
            t1 = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
            t2 = n.cross(t1)
            org = p + n * 0.004
            hit = 0.0
            for h in hemi:
                d = t1 * h.x + t2 * h.y + n * h.z
                loc, nrm, idx, dist = bvh.ray_cast(org, d, ao_dist)
                if loc is not None:
                    hit += 1.0 - (dist / ao_dist) ** 1.5 * 0.5
            ao[v.index] = 1.0 - hit / ao_samples
            # cavity/convexity from neighbouring edges
            s, c = 0.0, 0
            for e in v.link_edges:
                o = e.other_vert(v)
                dvec = o.co - v.co
                L = dvec.length
                if L > 1e-7:
                    s += v.normal.dot(dvec) / L
                    c += 1
            cav[v.index] = -(s / c) if c else 0.0   # >0 convex edge, <0 concave
        bm.free()
        # build per-loop colours
        if 'Col' in me.color_attributes:
            me.color_attributes.remove(me.color_attributes['Col'])
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        cols = [0.0] * (len(me.loops) * 4)
        for poly in me.polygons:
            z = zones[min(poly.material_index, len(zones) - 1)]
            base = z['color'] if isinstance(z['color'], (tuple, list)) else hexcol(z['color'])
            zwash = z.get('wash', 1.0)
            zedge = z.get('edge', 1.0)
            zvar = z.get('var', 0.07)
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                p = mw @ me.vertices[vi].co
                a = clamp(ao[vi])
                shade = 1.0 - ao_strength * (1.0 - a) ** 1.15 * z.get('ao', 1.0)
                var = 1.0 + zvar * noise.noise(p * z.get('var_scale', 14.0))
                c = [base[0] * var * shade, base[1] * var * shade, base[2] * var * shade]
                cv = cav[vi]
                if cv < 0:                     # cavities get a warm dark wash
                    w = clamp(-cv * 3.0) * wash * zwash
                    c = [c[0] * (1 - w * 0.55), c[1] * (1 - w * 0.68), c[2] * (1 - w * 0.8)]
                else:                          # drybrushed edges
                    e = clamp(cv * 3.2) * edge * zedge * (0.4 + 0.6 * a)
                    c = [c[0] + (1 - c[0]) * e * 0.5, c[1] + (1 - c[1]) * e * 0.5, c[2] + (1 - c[2]) * e * 0.5]
                k = li * 4
                cols[k], cols[k + 1], cols[k + 2], cols[k + 3] = c[0], c[1], c[2], 1.0
        attr.data.foreach_set('color', cols)
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = list(me.color_attributes).index(attr)

# --------------------------------------------------------------------------- export
def export(rig_or_root, path, props=None):
    root = rig_or_root.root if hasattr(rig_or_root, 'root') else rig_or_root
    if props:
        for k, v in props.items():
            root[k] = v
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children:
            sel(c)
    sel(root)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
              export_extras=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
              export_animations=False, export_texcoords=False, export_normals=True)
    for extra in ({'export_vertex_color': 'ACTIVE'}, {'export_active_vertex_color_when_no_material': True}):
        kw.update(extra)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export option problem:', e)
        for k in ('export_active_vertex_color_when_no_material', 'export_vertex_color'):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)
    print('EXPORTED', path)

def tri_count(rig):
    t = 0
    for o in rig.parts.values():
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            t += len(o.data.loop_triangles)
    return t
