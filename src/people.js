// The people of Ephesus: simple low-poly figures who turn to face you when you come close.
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './world/build.js';
import { PEOPLE, terrainAt } from './world/layout.js';

const SKIN = [0xd9b48f, 0xc99a72, 0xb9855f, 0xe0bf9c];

// Build one figure, standing at the origin and facing north (-z).
function figure(look, i) {
  const b = new Builder(), skin = SKIN[i % SKIN.length], dark = 0x3a2e26;
  if (look.woman) {
    b.add('col', 0, 0.06, 0, 0.27, 1.3, 0.2, 0, look.tunic);                      // long dress
  } else {
    for (const sx of [-1, 1]) {                                                   // legs and sandals
      b.box(sx * 0.09, 0.05, 0, 0.1, 0.5, 0.11, 0, look.soldier ? 0x5a4636 : skin);
      b.box(sx * 0.09, 0, -0.03, 0.11, 0.06, 0.2, 0, dark);
    }
    b.add('col', 0, 0.48, 0, 0.25, 0.9, 0.18, 0, look.tunic);                     // knee-length tunic
  }
  b.box(0, 1.24, 0, 0.48, 0.14, 0.22, 0, look.tunic);                             // shoulders
  for (const sx of [-1, 1]) {                                                     // arms
    b.box(sx * 0.28, 1.08, 0, 0.1, 0.24, 0.12, 0, look.tunic);
    b.box(sx * 0.28, 0.7, -0.02, 0.085, 0.4, 0.09, 0, skin);
  }
  b.box(0, 0.93, 0, 0.5, 0.06, 0.37, 0, look.soldier ? dark : (look.apron || look.tunic));   // belt
  if (look.apron) b.box(0, 0.5, -0.17, 0.36, 0.46, 0.03, 0, look.apron);                     // craftsman's leather apron
  if (look.soldier) {
    b.box(-0.27, 0.55, 0.02, 0.05, 0.5, 0.09, 0, 0x4a3524);                       // sword in its scabbard
    b.box(-0.27, 1.04, 0.02, 0.06, 0.12, 0.06, 0, 0x8a6a3a);
    b.box(0.24, 0.8, -0.06, 0.04, 0.24, 0.05, 0, 0x4a3524);                       // dagger
  }
  if (look.cloak) {
    b.box(0, 0.45, 0.14, 0.52, 0.92, 0.07, 0, look.cloak);                        // cloak down the back
    b.box(-0.18, 0.75, 0, 0.17, 0.64, 0.3, 0, look.cloak);                        // and over one shoulder
  }
  b.add('cyl', 0, 1.36, 0, 0.055, 0.1, 0.055, 0, skin);                           // neck
  b.add('blob', 0, 1.43, 0, 0.125, 0.14, 0.13, 0, skin);                          // head
  if (look.woman) {
    if (look.cloak) { b.box(0, 1.42, 0.06, 0.33, 0.32, 0.22, 0, look.cloak); b.box(0, 1.1, 0.13, 0.4, 0.34, 0.06, 0, look.cloak); }   // veil
    else { b.box(0, 1.5, 0.05, 0.28, 0.22, 0.2, 0, look.hair); b.add('blob', 0, 1.42, 0.15, 0.08, 0.08, 0.08, 0, look.hair); }       // hair tied back
  } else if (look.bald) {
    b.box(0, 1.5, 0.08, 0.27, 0.16, 0.12, 0, look.hair);
  } else {
    b.box(0, 1.6, 0.02, 0.27, 0.12, 0.25, 0, look.hair); b.box(0, 1.48, 0.1, 0.27, 0.16, 0.08, 0, look.hair);
  }
  if (look.beard) b.box(0, 1.41, -0.1, 0.17, 0.12, 0.07, 0, look.hair);
  b.box(-0.05, 1.59, -0.125, 0.03, 0.03, 0.02, 0, dark); b.box(0.05, 1.59, -0.125, 0.03, 0.03, 0.02, 0, dark);   // eyes
  return b;
}

export function createPeople(scene, colliders) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const people = PEOPLE.map((p, i) => {
    const mesh = figure(p.look, i).mesh(mat);
    const y = terrainAt(p.x, p.z) + (p.id === 'paul' ? 0.25 : 0);          // Paul stands on the speaker's platform
    mesh.position.set(p.x, y, p.z);
    const s = p.look.small || 1; mesh.scale.set(s, s, s);
    mesh.rotation.y = -p.face * Math.PI / 180;
    scene.add(mesh);
    colliders.push({ x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0 });
    return { ...p, y, mesh, turn: p.face, height: 1.7 * s };
  });

  // a small pointer floating over each head shows who you can talk to
  const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.26, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), people.length);
  tips.frustumCulled = false; scene.add(tips);
  const m = new THREE.Matrix4(), flip = new THREE.Matrix4().makeRotationX(Math.PI), NEW = new THREE.Color(0xffffff), DONE = new THREE.Color(0x8fb7c9);
  const setTalked = (set) => { people.forEach((p, i) => tips.setColorAt(i, set.has(p.talk) ? DONE : NEW)); tips.instanceColor.needsUpdate = true; };

  function update(player, t, dt) {
    people.forEach((p, i) => {
      const dx = player.x - p.x, dz = player.z - p.z, near = Math.hypot(dx, dz) < 9;
      const want = near ? Math.atan2(dx, -dz) * 180 / Math.PI : p.face;       // turn to face a visitor
      let diff = ((want - p.turn + 540) % 360) - 180;
      p.turn += diff * Math.min(1, dt * 4);
      p.mesh.rotation.y = -p.turn * Math.PI / 180;
      m.copy(flip).setPosition(p.x, p.y + p.height + 0.35 + Math.sin(t * 2.4 + i) * 0.05, p.z);
      tips.setMatrixAt(i, m);
    });
    tips.instanceMatrix.needsUpdate = true;
  }
  return { people, update, setTalked };
}
