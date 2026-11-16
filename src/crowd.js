// Background life: townspeople, animals and gulls. None of them talk; they make the city feel lived in.
// People are drawn as many copies of one simple figure, which is very cheap for a phone to draw.
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './world/build.js';
import { ROUTES, STANDERS, ANIMALS, terrainAt, heightAt } from './world/layout.js';

const TUNICS = [0xe4d3b0, 0xc9b089, 0xb89b6a, 0x8c6a4a, 0x9aa37a, 0x7f9aa8, 0xc98f6a, 0xd9c27a, 0xa87a6a, 0xdcd2c0, 0x8a8f6a, 0xb5a08a];
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// A crowd of simple figures. Each has a tinted body and an untinted head.
export function makeCrowd(scene, count, seed = 1) {
  const body = new Builder(), head = new Builder();
  body.add('col', 0, 0.3, 0, 0.24, 1.0, 0.17, 0, 0xffffff);
  body.box(0, 1.2, 0, 0.46, 0.13, 0.2, 0, 0xffffff);
  for (const sx of [-1, 1]) body.box(sx * 0.27, 0.74, 0, 0.09, 0.56, 0.1, 0, 0xf2f2f2);
  for (const sx of [-1, 1]) head.box(sx * 0.09, 0, 0, 0.1, 0.34, 0.11, 0, 0xb9906c);
  head.add('blob', 0, 1.38, 0, 0.12, 0.14, 0.125, 0, 0xd0a680);
  head.box(0, 1.55, 0.03, 0.26, 0.11, 0.24, 0, 0x3a2e26);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bodies = new THREE.InstancedMesh(body.mesh(mat).geometry, mat, count);
  const heads = new THREE.InstancedMesh(head.mesh(mat).geometry, mat, count);
  bodies.frustumCulled = heads.frustumCulled = false;
  const r = rng(seed), c = new THREE.Color();
  for (let i = 0; i < count; i++) bodies.setColorAt(i, c.set(TUNICS[Math.floor(r() * TUNICS.length)]));
  scene.add(bodies, heads);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    count,
    place(i, x, y, z, faceDeg, scale = 1) {
      q.setFromAxisAngle(up, -faceDeg * Math.PI / 180);
      m.compose(v.set(x, y, z), q, s.set(scale, scale, scale));
      bodies.setMatrixAt(i, m); heads.setMatrixAt(i, m);
    },
    commit() { bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; },
    show(on) { bodies.visible = heads.visible = on; },
  };
}

function animal(b, kind, x, z, faceDeg) {
  const y = terrainAt(x, z), rot = -faceDeg * Math.PI / 180 + Math.PI / 2, cs = Math.cos(rot), sn = Math.sin(rot);
  const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];     // local +x is the animal's nose
  const part = (lx, ly, lz, w, h, d, color) => { const [px, pz] = at(lx, lz); b.box(px, y + ly, pz, w, h, d, rot, color); };
  if (kind === 'donkey') {
    part(0, 0.6, 0, 1.1, 0.5, 0.4, 0x8a7a6a); part(0.65, 0.85, 0, 0.42, 0.34, 0.26, 0x8a7a6a); part(0.6, 1.15, 0.08, 0.08, 0.26, 0.06, 0x6f6156); part(0.6, 1.15, -0.08, 0.08, 0.26, 0.06, 0x6f6156);
    for (const lx of [-0.42, 0.42]) for (const lz of [-0.13, 0.13]) part(lx, 0, lz, 0.1, 0.62, 0.1, 0x6f6156);
    part(0, 1.1, 0, 0.5, 0.3, 0.7, 0xb9906c);          // a pack on its back
  } else if (kind === 'goat') {
    part(0, 0.36, 0, 0.62, 0.3, 0.26, 0xd8cfc0); part(0.38, 0.56, 0, 0.24, 0.22, 0.18, 0xd8cfc0); part(0.4, 0.78, 0, 0.05, 0.14, 0.2, 0x5a5048);
    for (const lx of [-0.22, 0.22]) for (const lz of [-0.08, 0.08]) part(lx, 0, lz, 0.06, 0.38, 0.06, 0x8a7a6a);
  } else if (kind === 'dog') {
    part(0, 0.26, 0, 0.5, 0.2, 0.2, 0xa8875f); part(0.32, 0.36, 0, 0.2, 0.18, 0.16, 0xa8875f); part(-0.3, 0.4, 0, 0.16, 0.05, 0.05, 0xa8875f);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.07, 0.07]) part(lx, 0, lz, 0.05, 0.28, 0.05, 0x8a6f4c);
  } else {   // hen
    part(0, 0.1, 0, 0.24, 0.18, 0.16, 0xc9a070); part(0.13, 0.24, 0, 0.1, 0.12, 0.09, 0xc9a070); part(0.19, 0.3, 0, 0.05, 0.04, 0.03, 0xa63d2f); part(-0.14, 0.2, 0, 0.1, 0.12, 0.04, 0x8a6f4c);
  }
}

export function createAmbient(scene) {
  const r = rng(77);
  // ----- walkers: back and forth along the streets -----
  const walkers = [];
  ROUTES.forEach((pts, ri) => {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push({ a: pts[i], b: pts[i + 1], len, at: total }); total += len; }
    const n = Math.max(2, Math.round(total / 38));
    for (let k = 0; k < n; k++) walkers.push({ segs, total, d: r() * total, dir: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.7, side: (r() - 0.5) * 3.4, phase: r() * 6, size: 0.92 + r() * 0.14 });
  });
  const crowd = makeCrowd(scene, walkers.length + STANDERS.length, 5);
  STANDERS.forEach(([x, z, face], i) => crowd.place(walkers.length + i, x, terrainAt(x, z), z, face, 0.94 + (i % 4) * 0.03));

  // ----- animals (they stay put) -----
  const ab = new Builder();
  for (const [kind, x, z, face] of ANIMALS) animal(ab, kind, x, z, face);
  scene.add(ab.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ----- gulls wheeling over the harbour -----
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -1.1, 0.18, 0, 0, 0, -0.25, 0, 0, -0.25, 1.1, 0.18, 0, 0, 0, 0.25], 3));
  wing.computeVertexNormals();
  const gulls = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xf4f4f0, side: THREE.DoubleSide }), 7);
  gulls.frustumCulled = false; scene.add(gulls);
  const gm = new THREE.Matrix4(), gq = new THREE.Quaternion(), ge = new THREE.Euler(), gv = new THREE.Vector3(), gs = new THREE.Vector3(1, 1, 1);

  function update(t, dt, playerNear) {
    walkers.forEach((w, i) => {
      w.d += w.dir * w.speed * dt;
      if (w.d > w.total) { w.d = w.total; w.dir = -1; } else if (w.d < 0) { w.d = 0; w.dir = 1; }
      let seg = w.segs[0]; for (const s of w.segs) if (w.d >= s.at) seg = s;
      const f = Math.min(1, (w.d - seg.at) / seg.len), ux = (seg.b[0] - seg.a[0]) / seg.len, uz = (seg.b[1] - seg.a[1]) / seg.len;
      const x = seg.a[0] + (seg.b[0] - seg.a[0]) * f - uz * w.side, z = seg.a[1] + (seg.b[1] - seg.a[1]) * f + ux * w.side;
      const face = Math.atan2(ux * w.dir, -uz * w.dir) * 180 / Math.PI;
      crowd.place(i, x, terrainAt(x, z) + Math.abs(Math.sin(t * 7 * w.speed + w.phase)) * 0.04, z, face, w.size);
    });
    crowd.commit();
    for (let i = 0; i < 7; i++) {
      const a = t * (0.25 + i * 0.03) + i * 2.1, rad = 26 + i * 7;
      gv.set(-196 + Math.cos(a) * rad, 16 + i * 2.2 + Math.sin(t * 0.7 + i) * 2, (i % 2 ? 26 : -22) + Math.sin(a) * rad);
      ge.set(0, -a, Math.sin(t * 5 + i) * 0.25); gq.setFromEuler(ge);
      gm.compose(gv, gq, gs); gulls.setMatrixAt(i, gm);
    }
    gulls.instanceMatrix.needsUpdate = true;
  }
  return { update, show(on) { crowd.show(on); }, walkerCount: walkers.length };
}

// The crowd in the riot scene. It can be arranged three ways: gathered at the workshops,
// streaming up the street, or packed into the theatre.
export function createRiotCrowd(scene) {
  const N = 230, crowd = makeCrowd(scene, N, 19), r = rng(4242), spots = [];
  for (let i = 0; i < N; i++) {
    // theatre: packed in the orchestra and on the lowest rows of seats, facing the stage (west)
    let x, z;
    if (i < 110) { const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 11.8; x = -10 + Math.cos(a) * rad; z = Math.sin(a) * rad; if (x < -18) x = -18 + r() * 3; }
    else { const a = (r() - 0.5) * Math.PI * 0.9, rad = 13.4 + r() * 6.4; x = -10 + Math.cos(a) * rad; z = Math.sin(a) * rad; }
    const s = { tx: x, tz: z, ty: heightAt(x, z), phase: r() * 6.28, size: 0.9 + r() * 0.18, tface: 270 + (r() - 0.5) * 50, lane: (r() - 0.5) * 15, along: r() };
    if (i > 3 && i < 24) {   // workshop: a knot of craftsmen in front of Demetrius
      const a = (r() - 0.5) * 2.3, rad = 2.2 + r() * 2.6; s.wx = -127.3 + Math.cos(a) * rad + 1.2; s.wz = 62.8 + Math.sin(a) * rad; s.wy = terrainAt(s.wx, s.wz);
    }
    spots.push(s);
  }
  // three friends holding Paul back outside the theatre (used only in that step)
  const friends = [[-42.3, -10.7, 250], [-42.4, -9.1, 290], [-44.7, -10.1, 80]];
  let layout = 'theatre', speaker = false;
  crowd.show(false);
  return {
    show(on) { crowd.show(on); },
    setLayout(name, withSpeaker) { layout = name; speaker = withSpeaker; },
    // energy 0 = standing quietly, 1 = shouting and jostling
    update(t, energy) {
      spots.forEach((s, i) => {
        const hop = Math.max(0, Math.sin(t * (4 + energy * 5) + s.phase)) * 0.16 * energy;
        const sway = Math.sin(t * 2.3 + s.phase) * 0.12 * energy, turn = Math.sin(t * 1.3 + s.phase) * 25 * energy;
        if (layout === 'workshop') {
          if (s.wx === undefined) crowd.place(i, 0, -50, 0, 0, 1);
          else crowd.place(i, s.wx + sway * 0.5, s.wy + hop, s.wz, 270 + turn, s.size);
        } else if (layout === 'rush') {            // hurrying east along Harbor Street toward the theatre
          const x = -96 + ((s.along * 70 + t * 4.5) % 70), z = s.lane * (x > -46 ? 1 : 0.6);
          crowd.place(i, x, terrainAt(x, z) + hop * 0.6, z, 90 + turn * 0.4, s.size);
        } else if (i === 0 && speaker) {           // the one man on the stage, trying to be heard
          crowd.place(i, -18.9, 2.3, 0, 90, 1.05);
        } else if (i >= 1 && i <= 3 && layout === 'theatre' && !speaker && energy < 0.7) {
          const f = friends[i - 1]; crowd.place(i, f[0], terrainAt(f[0], f[1]), f[1], f[2], 1);
        } else {
          crowd.place(i, s.tx + sway, s.ty + hop, s.tz + Math.cos(t * 1.9 + s.phase) * 0.08 * energy, s.tface + turn, s.size);
        }
      });
      crowd.commit();
    },
  };
}
