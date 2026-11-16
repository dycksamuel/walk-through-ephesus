// Turns the city plan (layout.js) into 3D shapes and a list of solid obstacles.
// Everything static is merged into a handful of meshes so phones can draw it quickly.
import * as THREE from '../../vendor/three.module.min.js';
import {
  WORLD, WALK, SEA_X, GRID, PADS, STREETS, STRUCTURES, HOUSE_BLOCKS, WALLS, THEATRE, PROPS, terrainAt, heightAt,
} from './layout.js';

export const PALETTE = {
  grass: 0xb5b075, scrub: 0x8d9a5e, rock: 0xa39a86, sand: 0xd8c9a0,
  stone: 0xcfc6b4, dirt: 0xc2a878, marble: 0xece6d8, plaster: 0xe4d3b0, ochre: 0xd9a55c,
  roof: 0xb5603c, roofDark: 0x9c5236, wood: 0x7a5636, darkWood: 0x4f3a28, wall: 0xb8ad98,
  sail: 0xe9dfc6, water: 0x3f7f9e, seat: 0xd9d2c2, shade: 0x8a7a66, awning: 0xa8473a,
  door: 0x4a3524, window: 0x3a2e26, bronze: 0x8a6a3a, silver: 0xc9ccd2, clay: 0xb9683f,
  cypress: 0x3f5a3a, pine: 0x55703f, olive: 0x7f8f5a, trunk: 0x6b523a, scorch: 0x3a332c,
  blue: 0x3d6f9e, red: 0xa63d2f, gold: 0xd9b24a, cloth1: 0xc9b089, cloth2: 0x8c5a3c, basin: 0x5f9fb5,
  skyTop: 0x6fa3cf, skyLow: 0xd7e3ea,
};
const HOUSE_COLORS = [0xe4d3b0, 0xdcc49a, 0xe9dcc0, 0xd2b88c, 0xe0c9a6, 0xcfb898];
const AWNINGS = [0xa8473a, 0xc9a23f, 0x4f7a8c, 0x8c6a4a, 0xb86a3a, 0x6f8f5a];
const TUNICS = [0xa63d2f, 0x3d6f9e, 0xd9b24a, 0x6f8f5a];

// Small repeatable random-number generator, so the city looks the same on every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const unit = (g) => (g.index ? g.toNonIndexed() : g).getAttribute('position').array;
const UNIT = {
  box: unit(new THREE.BoxGeometry(1, 1, 1)),
  cyl: unit(new THREE.CylinderGeometry(1, 1, 1, 8, 1, false)),
  col: unit(new THREE.CylinderGeometry(0.85, 1, 1, 7, 1, true)),
  cone4: unit(new THREE.CylinderGeometry(0, 1, 1, 4, 1, false)),
  cone8: unit(new THREE.CylinderGeometry(0, 1, 1, 7, 1, false)),
  oct: unit(new THREE.CylinderGeometry(1, 1, 1, 8, 1, false)),
  blob: unit(new THREE.IcosahedronGeometry(1, 0)),
  prism: new Float32Array([
    -.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0,
    .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0,
    -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0,
  ]),
};

export class Builder {
  constructor() { this.pos = []; this.col = []; this.c = new THREE.Color(); }
  // Add a unit shape scaled to (sx,sy,sz), turned by rot (radians), with its base centre at (x,y,z).
  add(shape, x, y, z, sx, sy, sz, rot, color) {
    const src = UNIT[shape], cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    const yOff = shape === 'prism' ? 0 : (shape === 'blob' ? 1 : 0.5);
    this.c.set(color);
    for (let i = 0; i < src.length; i += 3) {
      const px = src[i] * sx, py = (src[i + 1] + yOff) * sy, pz = src[i + 2] * sz;
      this.pos.push(x + px * cs + pz * sn, y + py, z - px * sn + pz * cs);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }
  box(x, y, z, w, h, d, rot, color) { this.add('box', x, y, z, w, h, d, rot, color); }
  quad(a, b, c, d, color) {
    this.c.set(color);
    for (const p of [a, b, c, a, c, d]) { this.pos.push(p[0], p[1], p[2]); this.col.push(this.c.r, this.c.g, this.c.b); }
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

const rad = (deg) => (deg || 0) * Math.PI / 180;
// Which way a side faces: n = north (-z), s = south (+z), e = east (+x), w = west (-x).
const SIDE = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export function buildWorld(scene) {
  const colliders = [];   // solid rectangles: {x, z, hw, hd, rot}
  const solid = (x, z, w, d, rot) => colliders.push({ x, z, hw: w / 2, hd: d / 2, rot: rot || 0 });

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const decalMat = new THREE.MeshLambertMaterial({
    vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  // ---------- sky ----------
  const skyGeo = new THREE.SphereGeometry(850, 20, 10);
  {
    const p = skyGeo.getAttribute('position'), col = new Float32Array(p.count * 3), c = new THREE.Color(), top = new THREE.Color(PALETTE.skyTop);
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, Math.min(1, p.getY(i) / 850 * 1.6));
      c.set(PALETTE.skyLow).lerp(top, Math.pow(t, 0.7));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1; sky.frustumCulled = false;
  scene.add(sky);

  // ---------- terrain ----------
  {
    const { nx, nz, step, h: H } = GRID, n = nx + 1;
    const pos = [], col = [], c = new THREE.Color(), c2 = new THREE.Color(), rand = rng(7);
    const vcol = new Float32Array(n * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * n + i, h = H[k];
      const hx = H[j * n + Math.min(nx, i + 1)] - H[j * n + Math.max(0, i - 1)];
      const hz = H[Math.min(nz, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
      const slope = Math.hypot(hx, hz) / (2 * step);
      c.set(PALETTE.grass);
      if (h > 6) c.lerp(c2.set(PALETTE.scrub), Math.min(1, (h - 6) / 14));
      if (slope > 0.42) c.lerp(c2.set(PALETTE.rock), Math.min(1, (slope - 0.42) * 5));
      if (h < 0.6) c.lerp(c2.set(PALETTE.sand), Math.min(1, (0.6 - h) * 2));
      const v = 0.94 + rand() * 0.12;
      vcol[k * 3] = c.r * v; vcol[k * 3 + 1] = c.g * v; vcol[k * 3 + 2] = c.b * v;
    }
    const put = (i, j) => {
      const k = j * n + i;
      pos.push(WORLD.minX + i * step, H[k], WORLD.minZ + j * step);
      col.push(vcol[k * 3], vcol[k * 3 + 1], vcol[k * 3 + 2]);
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      put(i, j); put(i, j + 1); put(i + 1, j);              // these two triangles match terrainAt()
      put(i, j + 1); put(i + 1, j + 1); put(i + 1, j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, lit));

    // far beyond the walkable area: sea to the west, hazy land everywhere else
    const far = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
    far.rotation.x = -Math.PI / 2; far.position.set(0, -1.2, 0); scene.add(far);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2500, 5000), new THREE.MeshLambertMaterial({ color: PALETTE.water }));
    water.rotation.x = -Math.PI / 2; water.position.set(SEA_X + 8 - 1250, 0, 0);
    scene.add(water);
  }

  // ---------- paving: squares and streets, laid just above the ground ----------
  const decal = new Builder();
  const disc = (cx, cz, r, y, color, n = 20) => {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const P = (a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      decal.quad([cx, y, cz], P(a1), P(a0), [cx, y, cz], color);
    }
  };
  for (const p of PADS) {
    if (!p.surface) continue;
    const y = p.y + 0.06;
    decal.quad([p.x0, y, p.z1], [p.x1, y, p.z1], [p.x1, y, p.z0], [p.x0, y, p.z0], PALETTE[p.surface]);
  }
  STREETS.forEach((s, si) => {
    const color = PALETTE[s.surface], hw = s.w / 2, lift = 0.1 + si * 0.012;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 2));
      const ux = (bx - ax) / len, uz = (bz - az) / len, px = -uz * hw, pz = ux * hw;
      const ext = 0.5 * hw;                           // overlap at corners so bends have no gaps
      const at = (t, side) => {
        const d = -ext + (len + 2 * ext) * t, x = ax + ux * d + px * side, z = az + uz * d + pz * side;
        // take the highest ground close by, so the hillside never pokes up through the paving
        const y = Math.max(terrainAt(x, z), terrainAt(x + 1.2, z), terrainAt(x - 1.2, z), terrainAt(x, z + 1.2), terrainAt(x, z - 1.2));
        return [x, y + lift, z];
      };
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        for (const sd of [-1, -0.5, 0, 0.5]) decal.quad(at(t0, sd), at(t0, sd + 0.5), at(t1, sd + 0.5), at(t1, sd), color);
      }
    }
  });
  for (const s of STRUCTURES) {   // floors inside the buildings you can walk into
    if (s.kind !== 'courtHouse' && s.kind !== 'openHall') continue;
    const y = terrainAt(s.x, s.z) + 0.08, x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, z0 = s.z - s.d / 2, z1 = s.z + s.d / 2;
    decal.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], s.kind === 'courtHouse' ? PALETTE.marble : PALETTE.stone);
  }
  disc(THEATRE.cx, THEATRE.cz, THEATRE.r0, THEATRE.baseY + 0.07, PALETTE.stone, 24);     // the orchestra floor
  disc(-98, 146, 3.2, 1.09, PALETTE.scorch, 12);                                          // where the scrolls burned
  scene.add(decal.mesh(decalMat));

  // ---------- buildings ----------
  const b = new Builder();
  const rand = rng(53);

  const gableRoof = (x, y, z, w, d, rot, color) => {
    // ridge runs along the longer side
    if (w >= d) b.add('prism', x, y, z, w + 0.8, Math.min(d * 0.28, 3), d + 0.8, rot, color);
    else b.add('prism', x, y, z, d + 0.8, Math.min(w * 0.28, 3), w + 0.8, rot + Math.PI / 2, color);
  };
  const column = (x, y, z, r, h, color, base) => {
    if (base) b.box(x, y, z, r * 2.6, r * 0.5, r * 2.6, 0, color);
    b.add('col', x, y, z, r, h, r, 0, color);
    b.box(x, y + h, z, r * 2.5, r * 0.5, r * 2.5, 0, color);
    solid(x, z, r * 1.7, r * 1.7);
  };
  // A flat panel (door, window, sign) on one side of a rectangular building.
  const panel = (x, y, z, w, d, side, along, pw, ph, color) => {
    const [nx, nz] = SIDE[side];
    if (nx) b.box(x + nx * (w / 2 + 0.04), y, z + along, 0.14, ph, pw, 0, color);
    else b.box(x + along, y, z + nz * (d / 2 + 0.04), pw, ph, 0.14, 0, color);
  };
  const doorAndWindows = (x, y, z, w, d, side, h) => {
    const len = SIDE[side][0] ? d : w;
    panel(x, y, z, w, d, side, 0, 1.5, 2.4, PALETTE.door);
    if (len > 9) for (const o of [-len * 0.3, len * 0.3]) panel(x, y + Math.min(2.6, h - 1.6), z, w, d, side, o, 0.8, 0.9, PALETTE.window);
  };
  const tree = (x, z, kind, scale = 1) => {
    const y = terrainAt(x, z) - 0.2;
    if (kind === 'cypress') {
      b.add('cyl', x, y, z, 0.16, 1.2, 0.16, 0, PALETTE.trunk);
      b.add('cone8', x, y + 1, z, 1.0 * scale, 7.5 * scale, 1.0 * scale, 0, PALETTE.cypress);
    } else if (kind === 'pine') {
      b.add('cyl', x, y, z, 0.2, 2.6 * scale, 0.2, 0, PALETTE.trunk);
      b.add('cone8', x, y + 2.2 * scale, z, 2.1 * scale, 3.6 * scale, 2.1 * scale, 0, PALETTE.pine);
    } else {
      b.add('cyl', x, y, z, 0.22, 1.6 * scale, 0.22, 0, PALETTE.trunk);
      b.add('blob', x, y + 1.2 * scale, z, 1.9 * scale, 1.3 * scale, 1.9 * scale, x, PALETTE.olive);
    }
  };
  const jar = (x, y, z, s = 1) => {      // an amphora, simplified
    b.add('cyl', x, y, z, 0.24 * s, 0.75 * s, 0.24 * s, 0, PALETTE.clay);
    b.add('cyl', x, y + 0.75 * s, z, 0.1 * s, 0.25 * s, 0.1 * s, 0, PALETTE.clay);
  };
  const statue = (x, z, tunic) => {      // statues were painted, not bare white
    const y = terrainAt(x, z);
    b.box(x, y, z, 1.3, 1.5, 1.3, 0, PALETTE.marble);
    b.box(x, y + 1.5, z, 0.55, 1.25, 0.36, 0, tunic);
    b.add('cyl', x, y + 2.75, z, 0.17, 0.34, 0.17, 0, 0xd9b48f);
    solid(x, z, 1.3, 1.3);
  };

  // The theatre seating: stacked half-rings, each a little higher and wider.
  {
    const t = THEATRE, rows = Math.round((t.r1 - t.r0) / t.rowDepth), segs = 20;
    for (let r = 0; r < rows; r++) {
      const rin = t.r0 + r * t.rowDepth, rout = rin + t.rowDepth, y = t.baseY + (r + 1) * t.rowRise;
      const aisle = r === 6;   // a walkway half-way up
      for (let k = 0; k < segs; k++) {
        const a0 = -Math.PI / 2 + (k / segs) * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / segs) * Math.PI;
        const P = (rr, a, yy) => [t.cx + Math.cos(a) * rr, yy, t.cz + Math.sin(a) * rr];
        const col = aisle ? PALETTE.stone : ((k % 5 === 0) ? PALETTE.stone : PALETTE.seat);
        b.quad(P(rin, a1, y), P(rout, a1, y), P(rout, a0, y), P(rin, a0, y), col);                       // tread
        b.quad(P(rin, a1, y - t.rowRise), P(rin, a1, y), P(rin, a0, y), P(rin, a0, y - t.rowRise), (r % 2) ? 0xb3a892 : 0xa69b86); // riser
      }
    }
    const topY = t.baseY + rows * t.rowRise;
    for (const s of [-1, 1]) {   // tall end walls beside the two entrance passages
      const z = t.cz + s * (t.r0 + t.r1 + 1.5) / 2, len = t.r1 - t.r0 + 1.5;
      b.box(t.cx - 0.7, t.baseY - 1, z, 1.4, topY - t.baseY + 2.2, len, 0, PALETTE.wall);
      solid(t.cx - 0.7, z, 1.4, len);
    }
    // curved wall around the back of the top row
    const wsegs = 22, wr = t.r1 + 0.7;
    for (let k = 0; k < wsegs; k++) {
      const a = -Math.PI / 2 + ((k + 0.5) / wsegs) * Math.PI, x = t.cx + Math.cos(a) * wr, z = t.cz + Math.sin(a) * wr;
      const len = wr * Math.PI / wsegs + 0.5, lo = Math.min(topY, terrainAt(t.cx + Math.cos(a) * (wr + 3), t.cz + Math.sin(a) * (wr + 3))) - 2;
      b.box(x, lo, z, 1.4, topY + 1.2 - lo, len, -a, PALETTE.wall);
      solid(x, z, 1.4, len, -a);
    }
  }

  for (const s of STRUCTURES) {
    const rot = rad(s.rot), { x, z, w, d, h } = s;
    // sit each structure on the highest ground under it, with a stone footing down to the lowest
    const hs = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => terrainAt(x + i * w / 2, z + j * d / 2));
    const y = s.kind === 'ship' ? 0 : Math.max(...hs), low = Math.min(...hs);
    if (y - low > 0.15 && s.kind !== 'ship' && s.kind !== 'gate') b.box(x, low - 0.4, z, w + 0.4, y - low + 0.4, d + 0.4, rot, PALETTE.stone);
    switch (s.kind) {
      case 'warehouse':
        b.box(x, y, z, w, h, d, rot, PALETTE.plaster); gableRoof(x, y + h, z, w, d, rot, PALETTE.roofDark);
        panel(x, y, z, w, d, 'e', 0, 3, 3.4, PALETTE.door);
        solid(x, z, w, d, rot); break;
      case 'house':
        b.box(x, y, z, w, h, d, rot, HOUSE_COLORS[(x + z) & 3]); gableRoof(x, y + h, z, w, d, rot, PALETTE.roof);
        doorAndWindows(x, y, z, w, d, 'n', h);
        solid(x, z, w, d, rot); break;
      case 'hall': {
        b.box(x, y, z, w, h, d, rot, PALETTE[s.color] || PALETTE.plaster);
        if (s.roof === 'gable') gableRoof(x, y + h, z, w, d, rot, PALETTE.roof);
        else b.box(x, y + h, z, w + 0.6, 0.5, d + 0.6, rot, PALETTE.shade);
        if (s.porch === 's') {
          for (let i = 0; i < 4; i++) column(x - w / 2 + 2 + i * (w - 4) / 3, y, z + d / 2 + 2.5, 0.55, h - 1, PALETTE.marble, true);
          b.box(x, y + h - 0.5, z + d / 2 + 1.6, w - 2, 0.5, 3.4, 0, PALETTE.marble);
        }
        if (s.door) { panel(x, y, z, w, d, s.door, 0, 2, 3, PALETTE.door); for (const o of [-0.32, 0.32]) panel(x, y + h * 0.55, z, w, d, s.door, o * (SIDE[s.door][0] ? d : w), 0.8, 1, PALETTE.window); }
        if (s.bench) { b.box(x + 5, y, z + d / 2 + 0.6, 3, 0.5, 0.7, 0, PALETTE.stone); solid(x + 5, z + d / 2 + 0.6, 3, 0.7); }
        solid(x, z, w, d, rot); break;
      }
      case 'openHall': {   // three walls and a roof; the fourth side is a row of columns you can walk through
        const t = 0.6, [ox, oz] = SIDE[s.open];
        for (const side of ['n', 's', 'e', 'w']) {
          if (side === s.open) continue;
          const [nx, nz] = SIDE[side];
          const wx = x + nx * (w / 2 - t / 2), wz = z + nz * (d / 2 - t / 2), ww = nx ? t : w, wd = nx ? d : t;
          b.box(wx, y, wz, ww, h, wd, 0, PALETTE.plaster); solid(wx, wz, ww, wd);
        }
        b.box(x, y + h, z, w + 1.2, 0.5, d + 1.2, 0, PALETTE.roof);
        const len = ox ? d : w, n = Math.max(2, Math.round(len / 4.5));
        for (let i = 0; i <= n; i++) {
          const o = -len / 2 + 0.6 + i * (len - 1.2) / n;
          column(x + ox * (w / 2 - 0.5) + (ox ? 0 : o), y, z + oz * (d / 2 - 0.5) + (oz ? 0 : o), 0.32, h - 0.3, s.workshop ? PALETTE.wood : PALETTE.marble);
        }
        if (s.benches) {   // rows of benches facing the far wall, where the teacher stands
          for (let r = 0; r < 3; r++) for (const side of [-1, 1]) {
            const bx = x + ox * (w * 0.28 - r * 2.6), bz = z + side * d * 0.22;
            b.box(bx, y, bz, 0.7, 0.5, d * 0.3, 0, PALETTE.wood); solid(bx, bz, 0.7, d * 0.3);
          }
          b.box(x - ox * (w / 2 - 2), y, z, 1.6, 0.25, 3, 0, PALETTE.stone);       // low platform for the speaker
        }
        if (s.workshop) {  // tent-makers' shop: work table, rolls of cloth and leather, an awning out front
          b.box(x - ox * 1.5, y, z - 2, 3.2, 0.85, 1.3, 0, PALETTE.wood); solid(x - ox * 1.5, z - 2, 3.2, 1.3);
          b.box(x - ox * 1.5, y + 0.85, z - 2, 2.6, 0.08, 1.1, 0, PALETTE.cloth1);
          for (let i = 0; i < 4; i++) b.box(x - ox * (w / 2 - 1.3), y + i * 0.42, z + 2.6, 1.1 - i * 0.12, 0.4, 2.6, 0, i % 2 ? PALETTE.cloth1 : PALETTE.cloth2);   // a stack of folded cloth and hides
          solid(x - ox * (w / 2 - 1.3), z + 2.6, 1.1, 2.6);
          b.box(x - ox * (w / 2 - 1), y + 1.4, z - d / 2 + 0.7, 2.6, 2.2, 0.12, 0, PALETTE.cloth2);      // a finished panel hung on the wall
          b.box(x + ox * (w / 2 + 1.4), y + h - 0.9, z, 3, 0.12, d - 1, 0, PALETTE.awning);
          b.box(x - ox * w / 4, y + h + 0.5, z, w / 2, 2.8, d, 0, PALETTE.plaster);                      // living rooms above the back of the shop
          b.box(x - ox * w / 4, y + h + 3.3, z, w / 2 + 0.6, 0.35, d + 0.6, 0, PALETTE.roof);
          b.box(x - ox * 0.04 * w, y + h + 1.4, z, 0.14, 0.9, 0.9, 0, PALETTE.window);
          for (const side of [-1, 1]) b.add('cyl', x + ox * (w / 2 + 2.7), y, z + side * (d / 2 - 0.8), 0.08, h - 0.9, 0.08, 0, PALETTE.wood);
        }
        break;
      }
      case 'courtHouse': {  // a wealthy home: rooms around an open courtyard, entered from the street (north)
        const t = 0.5, wing = 6, back = 3.5, gap = 2.6;
        for (const sx of [-1, 1]) {
          const wx = x + sx * (w / 2 - wing / 2);
          b.box(wx, y, z, wing, h, d, 0, PALETTE.plaster); solid(wx, z, wing, d);
          b.box(wx, y + h, z, wing + 0.5, 0.35, d + 0.5, 0, PALETTE.roof);
          for (const o of [-2.5, 2]) b.box(x + sx * (w / 2 - wing - 0.04), y, z + o, 0.14, 2.3, 1.3, 0, PALETTE.door);    // room doors off the court
          const seg = (w - 2 * wing - gap) / 2, fx = x + sx * (gap / 2 + seg / 2);                                         // street wall, with a doorway
          b.box(fx, y, z - d / 2 + t / 2, seg, h, t, 0, PALETTE.plaster); solid(fx, z - d / 2 + t / 2, seg, t);
        }
        b.box(x, y + 2.7, z - d / 2 + t / 2, gap, h - 2.7, t, 0, PALETTE.plaster);                                         // lintel over the doorway
        const cw = w - 2 * wing, bz = z + d / 2 - back / 2;
        b.box(x, y, bz, cw, h, back, 0, PALETTE.ochre); solid(x, bz, cw, back);
        b.box(x, y + h, bz, cw + 0.5, 0.35, back + 0.5, 0, PALETTE.roof);
        b.box(x, y, z + d / 2 - back - 0.04, 1.6, 2.4, 0.14, 0, PALETTE.door);
        b.box(x, y, z - 0.5, 3, 0.18, 3, 0, PALETTE.basin);                                                               // rain-water pool
        b.box(x, y, z - 0.5, 3.5, 0.12, 3.5, 0, PALETTE.marble);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(x + sx * 2.9, y, z - 0.5 + sz * 2.9, 0.26, 3.4, PALETTE.marble);
        jar(x - 4.4, y, z + 1.2); jar(x - 4.4, y, z + 1.9);
        break;
      }
      case 'stage': {  // the theatre's stage building
        b.box(x, y, z, w, h, d, 0, PALETTE.marble); solid(x, z, w, d);
        b.box(x, y + h, z, w + 0.8, 0.5, d + 0.8, 0, PALETTE.stone);
        b.box(x + w / 2 + 1.3, y, z, 2.6, 1.3, d * 0.8, 0, PALETTE.stone); solid(x + w / 2 + 1.3, z, 2.6, d * 0.8);      // raised stage
        for (const o of [-10, 0, 10]) b.box(x + w / 2 + 0.04, y + 1.3, z + o, 0.14, 3, 2.2, 0, PALETTE.door);             // three stage doors
        for (let i = 0; i < 9; i++) b.box(x - w / 2 - 0.2, y, z - d / 2 + 2 + i * (d - 4) / 8, 0.5, h, 1, 0, PALETTE.stone); // pilasters on the street side
        break;
      }
      case 'shops': {
        b.box(x, y, z, w, h, d, 0, PALETTE.plaster);
        b.box(x, y + h, z, w + 1.2, 0.4, d + 1.2, 0, PALETTE.roof);
        solid(x, z, w, d);
        const side = s.front, [nx, nz] = SIDE[side], long = Math.max(w, d), n = Math.floor(long / 6);
        for (let i = 0; i < n; i++) {       // shop doorways with a little awning each
          const o = -long / 2 + (i + 0.5) * (long / n);
          panel(x, y, z, w, d, side, o, 3, 3.1, PALETTE.window);
        }
        // covered walkway in front of the shops
        const px = x + nx * (w / 2 + 2), pz = z + nz * (d / 2 + 2);
        b.box(px, y + h - 0.9, pz, nx ? 4 : w, 0.3, nz ? 4 : d, 0, PALETTE.roofDark);
        const nc = Math.round(long / 6);
        for (let i = 0; i <= nc; i++) {
          const o = -long / 2 + i * long / nc;
          column(x + nx * (w / 2 + 3.6) + (nx ? 0 : o), y, z + nz * (d / 2 + 3.6) + (nz ? 0 : o), 0.3, h - 1.2, PALETTE.marble);
        }
        break;
      }
      case 'site': {   // a hall under construction: low walls and wooden scaffolding
        b.box(x, y, z, w, h * 0.45, d, 0, PALETTE.stone);
        for (let i = 0; i <= 5; i++) {
          const zz = z - d / 2 + i * d / 5;
          for (const xx of [x - w / 2 - 0.8, x + w / 2 + 0.8]) b.add('cyl', xx, y, zz, 0.12, h + 1, 0.12, 0, PALETTE.wood);
        }
        for (const xx of [x - w / 2 - 0.8, x + w / 2 + 0.8]) {
          b.box(xx, y + h * 0.5, z, 0.9, 0.12, d, 0, PALETTE.wood);
          b.box(xx, y + h, z, 0.9, 0.12, d, 0, PALETTE.wood);
        }
        for (let i = 0; i < 4; i++) b.box(x - w / 2 - 3, y, z - 12 + i * 7, 1.6, 0.8 + (i % 2) * 0.5, 1.1, i, PALETTE.marble);   // cut blocks waiting to be lifted
        solid(x, z, w + 2, d); break;
      }
      case 'gate': {   // four piers with a block across the top; you walk between the piers
        const alongX = s.axis !== 'x', long = alongX ? w : d, thick = alongX ? d : w, pier = long * 0.1;
        for (let i = 0; i < 4; i++) {
          const o = -long / 2 + pier / 2 + i * (long - pier) / 3;
          const px = alongX ? x + o : x, pz = alongX ? z : z + o;
          b.box(px, low - 0.4, pz, alongX ? pier : thick, h * 0.7 + y - low + 0.4, alongX ? thick : pier, 0, PALETTE.marble);
          solid(px, pz, alongX ? pier : thick, alongX ? thick : pier);
        }
        b.box(x, y + h * 0.7, z, w + 0.6, h * 0.3, d + 0.6, 0, PALETTE.marble);
        b.box(x, y + h * 0.78, z, w + 0.8, h * 0.1, d + 0.8, 0, PALETTE.bronze);       // band of bronze lettering
        b.box(x, y + h, z, w + 1.2, 0.4, d + 1.2, 0, PALETTE.stone);
        break;
      }
      case 'monument':
        b.box(x, y, z, w, 1, d, rot, PALETTE.stone);
        b.box(x, y + 1, z, w * 0.8, h - 2.5, d * 0.8, rot, PALETTE.marble);
        gableRoof(x, y + h - 1.5, z, w * 0.8, d * 0.8, rot, PALETTE.marble);
        solid(x, z, w, d, rot); break;
      case 'octagon':
        b.box(x, y, z, w + 1.5, 2.5, d + 1.5, 0, PALETTE.stone);
        b.add('oct', x, y + 2.5, z, w / 2, h - 5.5, d / 2, Math.PI / 8, PALETTE.marble);
        b.add('cone8', x, y + h - 3, z, w / 2 + 0.5, 3, d / 2 + 0.5, Math.PI / 8, PALETTE.marble);
        solid(x, z, w + 1.5, d + 1.5); break;
      case 'stoa': {   // long roofed hall, open to the square on its south side
        const gap = 7, half = (w - gap) / 2;
        for (const sgn of [-1, 1]) {   // back wall in two halves, leaving a way through in the middle
          const wx = x + sgn * (gap / 2 + half / 2);
          b.box(wx, y, z - d / 2 + 0.5, half, h, 1, 0, PALETTE.plaster);
          solid(wx, z - d / 2 + 0.5, half, 1);
        }
        b.box(x, y + h, z, w + 1, 0.6, d + 1, 0, PALETTE.roof);
        const n = Math.round(w / 5);
        for (let i = 0; i <= n; i++) {
          const cx = x - w / 2 + i * w / n;
          if (Math.abs(cx - x) < gap / 2) continue;      // keep the way through clear
          column(cx, y, z + d / 2 - 0.6, 0.5, h - 0.5, PALETTE.marble, true);
          column(cx, y, z, 0.45, h - 0.5, PALETTE.marble);
        }
        break;
      }
      case 'precinct': {   // walled sacred enclosure, entered from the south
        const t = 0.8, open = 5;
        b.box(x, y, z - d / 2, w, h, t, 0, PALETTE.wall); solid(x, z - d / 2, w, t);
        for (const sx of [-1, 1]) {
          b.box(x + sx * w / 2, y, z, t, h, d, 0, PALETTE.wall); solid(x + sx * w / 2, z, t, d);
          const seg = (w - open) / 2, cx = x + sx * (open / 2 + seg / 2);
          b.box(cx, y, z + d / 2, seg, h, t, 0, PALETTE.wall); solid(cx, z + d / 2, seg, t);
        }
        b.box(x, y, z, 4, 1.6, 3, 0, PALETTE.marble); solid(x, z, 4, 3);
        break;
      }
      case 'temple': {
        const [nl, ns] = s.cols, r = Math.max(0.5, Math.min(w / nl, d / ns) * 0.2);
        const steps = s.steps || 2, fx = SIDE[s.front || 'w'][0];
        for (let i = 0; i < steps; i++) {
          const g = (steps - 1 - i) * 1.4;
          b.box(x, y - (steps - i) * 0.55 + 0.05, z, w + 7 + g * 2, 0.55, d + 7 + g * 2, 0, PALETTE.marble);
        }
        const ring = (inset) => {
          const cl = nl - inset * 2, cs = ns - inset * 2, sx = w / (nl - 1), sz = d / (ns - 1);
          for (let i = 0; i < cl; i++) for (let j = 0; j < cs; j++) {
            if (i > 0 && i < cl - 1 && j > 0 && j < cs - 1) continue;
            column(x - w / 2 + (i + inset) * sx, y, z - d / 2 + (j + inset) * sz, r, h, PALETTE.marble, s.grand);
          }
        };
        ring(0); if (s.double) ring(1);
        const cw = w * (s.double ? 0.62 : 0.6), cd = d * (s.double ? 0.42 : 0.5), cx = x - fx * w * 0.04;   // the inner room, set back from the front
        b.box(cx, y, z, cw, h, cd, 0, PALETTE.plaster);
        solid(cx, z, cw, cd);
        b.box(cx + fx * (cw / 2 + 0.05), y, z, 0.16, h * 0.62, cd * 0.34, 0, PALETTE.bronze);                // great bronze doors
        if (s.grand) for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++)                                 // extra columns in the deep front porch
          column(cx + fx * (cw / 2 + 4 + i * 4.6), y, z - cd / 2 + j * cd / 3, r, h, PALETTE.marble, true);
        const top = y + h + r * 0.5, eh = h * 0.09;
        b.box(x, top, z, w + 3, eh, d + 3, 0, PALETTE.marble);
        b.box(x, top + eh * 0.35, z, w + 3.1, eh * 0.4, d + 3.1, 0, s.grand ? PALETTE.blue : PALETTE.red);   // painted band
        const ph = Math.min(d * 0.16, h * 0.4);
        b.add('prism', x, top + eh, z, w + 3.6, ph, d + 3.6, 0, PALETTE.roof);
        for (const e of [-1, 1]) b.add('prism', x + e * (w / 2 + 1.75), top + eh, z, 0.2, ph * 0.94, d + 3.4, 0, PALETTE.marble);   // pale gable ends
        break;
      }
      case 'altar': {  // a horseshoe of walls open to the west, around the altar itself
        const t = 1;
        b.box(x, y, z, w + 2, 0.5, d + 2, 0, PALETTE.marble);
        b.box(x + w / 2, y, z, t, h, d, 0, PALETTE.marble); solid(x + w / 2, z, t, d);
        for (const sz of [-1, 1]) { b.box(x, y, z + sz * d / 2, w, h, t, 0, PALETTE.marble); solid(x, z + sz * d / 2, w, t); }
        b.box(x + 1, y + 0.5, z, 3, 1.4, 7, 0, PALETTE.stone); solid(x + 1, z, 3, 7);
        b.box(x + w / 2, y + h, z, t + 0.4, 0.3, d + 0.4, 0, PALETTE.blue);
        break;
      }
      case 'tomb':
        b.box(x, y, z, w, h * 0.7, d, 0, PALETTE.stone);
        b.add('cone4', x, y + h * 0.7, z, w * 0.75, h * 0.3, d * 0.75, Math.PI / 4, PALETTE.stone);
        solid(x, z, w, d); break;
      case 'ship': {
        const wy = -0.6;
        b.box(x, wy, z, w * 0.7, h, d, rot, PALETTE.wood);
        for (const e of [-1, 1]) {   // narrower bow and stern
          const ex = x + Math.cos(rot) * e * w * 0.42, ez = z - Math.sin(rot) * e * w * 0.42;
          b.box(ex, wy + 0.3, ez, w * 0.16, h + (e > 0 ? 0.9 : 0.2), d * 0.6, rot, PALETTE.wood);
        }
        b.box(x, wy + h, z, w * 0.66, 0.25, d * 0.8, rot, PALETTE.darkWood);
        b.add('cyl', x, wy + h, z, 0.25, w * 0.55, 0.25, 0, PALETTE.darkWood);
        b.box(x, wy + h + w * 0.42, z, 0.5, 0.9, d * 1.7, rot, PALETTE.sail);   // furled sail on its yard
        break;
      }
    }
  }

  // Ordinary housing blocks: packed rows of flat- and tile-roofed houses. Each block is one obstacle.
  for (const blk of HOUSE_BLOCKS) {
    const bw = blk.x1 - blk.x0, bd = blk.z1 - blk.z0;
    const nx = Math.max(1, Math.round(bw / 10)), nz = Math.max(1, Math.round(bd / 10));
    const cw = bw / nx, cd = bd / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const hx = blk.x0 + (i + 0.5) * cw, hz = blk.z0 + (j + 0.5) * cd;
      const base = Math.min(terrainAt(hx - cw / 2, hz - cd / 2), terrainAt(hx + cw / 2, hz + cd / 2), terrainAt(hx, hz)) - 0.3;
      const top = Math.max(terrainAt(hx - cw / 2, hz - cd / 2), terrainAt(hx + cw / 2, hz + cd / 2), terrainAt(hx, hz));
      const hh = 3.6 + Math.floor(rand() * 2) * 2.8 + rand() * 0.8 + (top - base);
      b.box(hx, base, hz, cw, hh, cd, 0, HOUSE_COLORS[Math.floor(rand() * HOUSE_COLORS.length)]);
      if (rand() < 0.6) gableRoof(hx, base + hh, hz, cw, cd, 0, rand() < 0.5 ? PALETTE.roof : PALETTE.roofDark);
      else b.box(hx, base + hh, hz, cw * 0.96, 0.5, cd * 0.96, 0, PALETTE.shade);
      // doors and small high windows on the sides that face a street
      const sides = []; if (i === 0) sides.push('w'); if (i === nx - 1) sides.push('e'); if (j === 0) sides.push('n'); if (j === nz - 1) sides.push('s');
      for (const side of sides) {
        const len = SIDE[side][0] ? cd : cw, gy = top;
        panel(hx, gy, hz, cw, cd, side, -len * 0.2, 1.3, 2.2, PALETTE.door);
        panel(hx, gy + 2.5, hz, cw, cd, side, len * 0.22, 0.7, 0.7, PALETTE.window);
        if (hh - (top - base) > 6) panel(hx, gy + 4.9, hz, cw, cd, side, -len * 0.15, 0.7, 0.8, PALETTE.window);
      }
    }
    solid((blk.x0 + blk.x1) / 2, (blk.z0 + blk.z1) / 2, bw, bd);
  }

  // City wall with towers, following the ridges.
  for (const chain of WALLS) {
    for (let i = 0; i < chain.length - 1; i++) {
      const [ax, az] = chain[i], [bx, bz] = chain[i + 1];
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 9), rot = Math.atan2(-(bz - az), bx - ax);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const lo = Math.min(terrainAt(ax + (bx - ax) * (k / n), az + (bz - az) * (k / n)), terrainAt(ax + (bx - ax) * ((k + 1) / n), az + (bz - az) * ((k + 1) / n)));
        const top = terrainAt(x, z) + 6;
        b.box(x, lo - 0.5, z, len / n + 0.3, top - lo + 0.5, 2.4, rot, PALETTE.wall);
        solid(x, z, len / n + 0.3, 2.4, rot);
      }
      b.box(ax, terrainAt(ax, az) - 1, az, 5, 10, 5, rot, PALETTE.wall); solid(ax, az, 5, 5, rot);
    }
    const [ex, ez] = chain[chain.length - 1];
    b.box(ex, terrainAt(ex, ez) - 1, ez, 5, 10, 5, 0, PALETTE.wall); solid(ex, ez, 5, 5);
  }

  // ---------- scenery ----------
  // market stalls: table, awning on poles, a few goods
  PROPS.stalls.forEach(([x, z, turn], i) => {
    const y = terrainAt(x, z), rot = rad(turn), cs = Math.cos(rot), sn = Math.sin(rot);
    const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    b.box(x, y, z, 3.4, 0.9, 1.5, rot, PALETTE.wood); solid(x, z, 3.4, 1.5, rot);
    b.box(x, y + 2.5, z, 4, 0.1, 2.6, rot, AWNINGS[i % AWNINGS.length]);
    for (const [lx, lz] of [[-1.8, -1.1], [1.8, -1.1], [-1.8, 1.1], [1.8, 1.1]]) { const [px, pz] = at(lx, lz); b.add('cyl', px, y, pz, 0.06, 2.5, 0.06, 0, PALETTE.wood); }
    for (let k = 0; k < 4; k++) {
      const [gx, gz] = at(-1.2 + k * 0.8, 0);
      if ((i + k) % 3 === 0) jar(gx, y + 0.9, gz, 0.7);
      else b.box(gx, y + 0.9, gz, 0.5, 0.25 + ((i + k) % 2) * 0.15, 0.6, rot, [PALETTE.cloth1, PALETTE.red, PALETTE.gold, PALETTE.olive, PALETTE.blue][(i * 2 + k) % 5]);
    }
  });
  // the silversmiths' bench under the west walkway, with little silver shrines on it
  b.box(-128.6, 1, 62, 1, 0.9, 3, 0, PALETTE.darkWood); solid(-128.6, 62, 1, 3);
  for (let k = 0; k < 4; k++) {
    b.box(-128.6, 1.9, 60.9 + k * 0.72, 0.3, 0.36, 0.3, 0, PALETTE.silver);
    b.add('prism', -128.6, 2.26, 60.9 + k * 0.72, 0.34, 0.14, 0.34, Math.PI / 2, PALETTE.silver);
  }
  // harbour: mooring posts, cargo, a wooden crane
  for (let z = -40; z <= 40; z += 10) b.add('cyl', -188.4, 1, z, 0.3, 0.8, 0.3, 0, PALETTE.darkWood);
  for (const [x, z] of [[-183, -12], [-182, -10.6], [-183.6, -10.4], [-181, 26], [-180, 27.2], [-173, -20], [-172, 22]]) {
    b.box(x, 1, z, 1.1, 1, 1.1, x, PALETTE.wood); solid(x, z, 1.1, 1.1, x);
  }
  for (const [x, z] of [[-184, 10], [-183.3, 10.5], [-184.1, 11.1], [-183.4, 11.6], [-174, -8], [-173.4, -8.5]]) jar(x, 1, z, 1.2);
  solid(-183.7, 10.8, 1.6, 2.2); solid(-173.7, -8.25, 1.4, 1);
  b.add('cyl', -186, 1, 30, 0.22, 7, 0.22, 0, PALETTE.darkWood); b.box(-188, 7.6, 30, 6, 0.25, 0.25, 0, PALETTE.darkWood); solid(-186, 30, 0.8, 0.8);
  // the empty lot beside the Triodos: weeds and a few stray blocks
  for (const [x, z, s] of [[-64, 147, 1], [-57, 150, 0.7], [-61, 153, 1.2], [-66, 151, 0.6]]) b.box(x, 1, z, 1.4 * s, 0.6 * s, 1 * s, x, PALETTE.stone);
  // ashes where the scrolls were burned
  b.add('cone8', -98, 1.05, 146, 1.2, 0.5, 1.2, 0, PALETTE.scorch);
  // the soldier's kit, stacked while he is off duty: shield, spear, helmet on a folded mail shirt
  {
    const kx = 162.4, kz = 152.4, ky = terrainAt(kx, kz);
    b.box(kx, ky, kz, 0.9, 0.5, 0.7, 0.3, PALETTE.wood);
    b.box(kx, ky + 0.5, kz, 0.6, 0.14, 0.5, 0.3, 0x8f959c);                 // mail shirt, folded
    b.add('blob', kx, ky + 0.62, kz, 0.17, 0.16, 0.19, 0, PALETTE.bronze);  // helmet
    b.box(kx + 0.75, ky, kz - 0.1, 0.16, 1.15, 0.75, 0.2, 0x7a3b32);        // large shield leaning on the crate
    b.box(kx + 0.84, ky + 0.5, kz - 0.1, 0.05, 0.22, 0.22, 0.2, PALETTE.bronze);
    b.add('cyl', kx - 0.7, ky, kz + 0.2, 0.03, 2.1, 0.03, 0, PALETTE.wood);  // spear
    b.add('cone4', kx - 0.7, ky + 2.1, kz + 0.2, 0.05, 0.28, 0.05, 0, 0x8f959c);
    solid(kx, kz, 1.9, 1);
  }
  // painted statues on plinths
  PROPS.statues.forEach(([x, z], i) => statue(x, z, TUNICS[i % TUNICS.length]));
  // trees: a few placed by hand, the rest scattered on open ground away from streets and squares
  for (const [x, z] of PROPS.cypress) tree(x, z, 'cypress');
  {
    const tr = rng(311), nearStreet = (x, z) => {
      for (const s of STREETS) for (let i = 0; i < s.pts.length - 1; i++) {
        const [ax, az] = s.pts[i], [bx, bz] = s.pts[i + 1], dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(x - ax - dx * t, z - az - dz * t) < s.w / 2 + 4) return true;
      }
      return false;
    };
    let placed = 0;
    for (let n = 0; n < 2600 && placed < 190; n++) {
      const x = WORLD.minX + 30 + tr() * (WORLD.maxX - WORLD.minX - 60), z = WORLD.minZ + 30 + tr() * (WORLD.maxZ - WORLD.minZ - 60);
      const pick = tr(), size = 0.8 + tr() * 0.6;
      if (x < SEA_X + 10 || nearStreet(x, z)) continue;
      if (PADS.some((p) => x > p.x0 - 9 && x < p.x1 + 9 && z > p.z0 - 9 && z < p.z1 + 9)) continue;
      if (Math.hypot(x - THEATRE.cx, z - THEATRE.cz) < THEATRE.r1 + 6) continue;
      const probe = { x, z }; resolveCollisions(colliders, probe, 2.5);
      if (Math.hypot(probe.x - x, probe.z - z) > 0.01) continue;
      const h = terrainAt(x, z), inTown = x > -190 && x < 246 && z > -110 && z < 215 && h < 20;
      if (inTown && pick > 0.25) continue;                 // the town itself is mostly built up
      tree(x, z, h > 16 ? 'pine' : (pick < 0.5 ? 'olive' : (pick < 0.8 ? 'pine' : 'cypress')), size);
      placed++;
    }
  }

  scene.add(b.mesh(lit));
  return { colliders, sky, triangles: (b.pos.length + decal.pos.length) / 9 };
}

// Push a walker (a circle of radius r) out of any solid rectangle it overlaps.
export function resolveCollisions(colliders, pos, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      if (Math.abs(dx) > c.hw + c.hd + r || Math.abs(dz) > c.hw + c.hd + r) continue;
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;           // into the rectangle's own frame
      const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
      let ox = lx - qx, oz = lz - qz;
      const dist = Math.hypot(ox, oz);
      if (dist >= r) continue;
      if (dist > 1e-6) { const push = (r - dist) / dist; ox *= push; oz *= push; }
      else {   // centre is inside: leave by the nearest side
        const ex = c.hw - Math.abs(lx), ez = c.hd - Math.abs(lz);
        if (ex < ez) { ox = (lx < 0 ? -1 : 1) * (ex + r); oz = 0; } else { oz = (lz < 0 ? -1 : 1) * (ez + r); ox = 0; }
      }
      pos.x += ox * cs + oz * sn; pos.z += -ox * sn + oz * cs;        // back to world frame
    }
  }
  pos.x = Math.max(WALK.minX, Math.min(WALK.maxX, pos.x));
  pos.z = Math.max(WALK.minZ, Math.min(WALK.maxZ, pos.z));
  return pos;
}

export { heightAt };

// Can you see from a to b, or is a building in the way? (Small things like posts and stalls don't count.)
export function sightBlocked(colliders, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 0.5);
  for (let i = 2; i < n - 1; i++) {
    const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
    for (const c of colliders) {
      if (c.hw < 1.2 && c.hd < 1.2) continue;
      const dx = x - c.x, dz = z - c.z;
      if (Math.abs(dx) > c.hw + c.hd || Math.abs(dz) > c.hw + c.hd) continue;
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      if (Math.abs(dx * cs - dz * sn) < c.hw && Math.abs(dx * sn + dz * cs) < c.hd) return true;
    }
  }
  return false;
}
