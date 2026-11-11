// Turns the city plan (layout.js) into 3D shapes and a list of solid obstacles.
// Everything static is merged into a handful of meshes so phones can draw it quickly.
import * as THREE from '../../vendor/three.module.min.js';
import {
  WORLD, WALK, SEA_X, GRID, PADS, STREETS, STRUCTURES, HOUSE_BLOCKS, WALLS, THEATRE, groundAt, terrainAt, heightAt,
} from './layout.js';

export const PALETTE = {
  grass: 0xb5b075, scrub: 0x8d9a5e, rock: 0xa39a86, sand: 0xd8c9a0,
  stone: 0xcfc6b4, dirt: 0xc2a878, marble: 0xece6d8, plaster: 0xe4d3b0, ochre: 0xd9a55c,
  roof: 0xb5603c, roofDark: 0x9c5236, wood: 0x7a5636, darkWood: 0x4f3a28, wall: 0xb8ad98,
  sail: 0xe9dfc6, water: 0x3f7f9e, seat: 0xd9d2c2, shade: 0x8a7a66, awning: 0xa8473a,
};
const HOUSE_COLORS = [0xe4d3b0, 0xdcc49a, 0xe9dcc0, 0xd2b88c, 0xe0c9a6, 0xcfb898];

// Small repeatable random-number generator, so the city looks the same on every visit.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const unit = (g) => g.toNonIndexed().getAttribute('position').array;
const UNIT = {
  box: unit(new THREE.BoxGeometry(1, 1, 1)),
  cyl: unit(new THREE.CylinderGeometry(1, 1, 1, 8, 1, false)),
  col: unit(new THREE.CylinderGeometry(0.85, 1, 1, 7, 1, true)),
  cone4: unit(new THREE.CylinderGeometry(0, 1, 1, 4, 1, false)),
  cone8: unit(new THREE.CylinderGeometry(0, 1, 1, 8, 1, false)),
  oct: unit(new THREE.CylinderGeometry(1, 1, 1, 8, 1, false)),
  prism: new Float32Array([
    -.5, 0, .5, .5, 0, .5, .5, 1, 0, -.5, 0, .5, .5, 1, 0, -.5, 1, 0,
    .5, 0, -.5, -.5, 0, -.5, -.5, 1, 0, .5, 0, -.5, -.5, 1, 0, .5, 1, 0,
    -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0, .5, 0, .5, .5, 0, -.5, .5, 1, 0,
  ]),
};

class Builder {
  constructor() { this.pos = []; this.col = []; this.c = new THREE.Color(); }
  // Add a unit shape scaled to (sx,sy,sz), turned by rot (radians), with its base centre at (x,y,z).
  add(shape, x, y, z, sx, sy, sz, rot, color, centered) {
    const src = UNIT[shape], cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    const yOff = (shape === 'prism' || centered) ? 0 : 0.5;
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

export function buildWorld(scene) {
  const colliders = [];   // solid rectangles: {x, z, hw, hd, rot}
  const solid = (x, z, w, d, rot) => colliders.push({ x, z, hw: w / 2, hd: d / 2, rot: rot || 0 });

  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const decalMat = new THREE.MeshLambertMaterial({
    vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

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
        return [x, terrainAt(x, z) + lift, z];
      };
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        decal.quad(at(t0, -1), at(t0, 0), at(t1, 0), at(t1, -1), color);
        decal.quad(at(t0, 0), at(t0, 1), at(t1, 1), at(t1, 0), color);
      }
    }
  });
  {   // the theatre's round orchestra floor
    const t = THEATRE, y = t.baseY + 0.07, n = 24;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const P = (a) => [t.cx + Math.cos(a) * t.r0, y, t.cz + Math.sin(a) * t.r0];
      decal.quad([t.cx, y, t.cz], P(a1), P(a0), [t.cx, y, t.cz], PALETTE.stone);
    }
  }
  scene.add(decal.mesh(decalMat));

  // ---------- buildings ----------
  const b = new Builder();
  const rand = rng(53);

  const gableRoof = (x, y, z, w, d, rot, color) => {
    // ridge runs along the longer side
    if (w >= d) b.add('prism', x, y, z, w + 0.8, Math.min(d * 0.28, 3), d + 0.8, rot, color);
    else b.add('prism', x, y, z, d + 0.8, Math.min(w * 0.28, 3), w + 0.8, rot + Math.PI / 2, color);
  };
  const column = (x, y, z, r, h, color) => {
    b.add('col', x, y, z, r, h, r, 0, color);
    b.box(x, y + h, z, r * 2.5, r * 0.5, r * 2.5, 0, color);
    solid(x, z, r * 1.7, r * 1.7);
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
        b.quad(P(rin, a1, y - t.rowRise), P(rin, a1, y), P(rin, a0, y), P(rin, a0, y - t.rowRise), PALETTE.shade); // riser
      }
    }
    // end walls where the seating meets the entrance passages
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
        b.box(x, y, z, w, h, d, rot, PALETTE.plaster); gableRoof(x, y + h, z, w, d, rot, PALETTE.roofDark); solid(x, z, w, d, rot); break;
      case 'house':
        b.box(x, y, z, w, h, d, rot, HOUSE_COLORS[(x + z) & 3]); gableRoof(x, y + h, z, w, d, rot, PALETTE.roof); solid(x, z, w, d, rot); break;
      case 'hall': {
        b.box(x, y, z, w, h, d, rot, PALETTE[s.color] || PALETTE.plaster);
        if (s.roof === 'gable') gableRoof(x, y + h, z, w, d, rot, PALETTE.roof);
        else b.box(x, y + h, z, w + 0.6, 0.5, d + 0.6, rot, PALETTE.shade);
        if (s.porch === 's') for (let i = 0; i < 4; i++) column(x - w / 2 + 2 + i * (w - 4) / 3, y, z + d / 2 + 2.5, 0.55, h - 1, PALETTE.marble);
        solid(x, z, w, d, rot); break;
      }
      case 'shops': {
        b.box(x, y, z, w, h, d, 0, PALETTE.plaster);
        b.box(x, y + h, z, w + 1.6, 0.4, d + 1.6, 0, PALETTE.roof);
        // dark doorways hint at the row of shop fronts
        const long = Math.max(w, d), n = Math.floor(long / 6);
        for (let i = 0; i < n; i++) {
          const o = -long / 2 + (i + 0.5) * (long / n);
          if (w >= d) { b.box(x + o, y, z, 3, 3.2, d + 0.2, 0, PALETTE.darkWood); }
          else { b.box(x, y, z + o, w + 0.2, 3.2, 3, 0, PALETTE.darkWood); }
        }
        solid(x, z, w, d); break;
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
          const wx = x + sgn * (gap / 2 + half / 2) - 6 * 0;
          b.box(wx, y, z - d / 2 + 0.5, half, h, 1, 0, PALETTE.plaster);
          solid(wx, z - d / 2 + 0.5, half, 1);
        }
        b.box(x, y + h, z, w + 1, 0.6, d + 1, 0, PALETTE.roof);
        const n = Math.round(w / 5);
        for (let i = 0; i <= n; i++) {
          const cx = x - w / 2 + i * w / n;
          if (Math.abs(cx - x) < gap / 2) continue;      // keep the way through clear
          column(cx, y, z + d / 2 - 0.6, 0.5, h - 0.5, PALETTE.marble);
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
        const steps = s.steps || 2;
        for (let i = 0; i < steps; i++) {
          const g = (steps - 1 - i) * 1.4;
          b.box(x, y - (steps - i) * 0.55 + 0.05, z, w + 4 + g * 2, 0.55, d + 4 + g * 2, 0, PALETTE.marble);
        }
        const ring = (inset) => {
          const cl = nl - inset * 2, cs = ns - inset * 2, sx = w / (nl - 1), sz = d / (ns - 1);
          for (let i = 0; i < cl; i++) for (let j = 0; j < cs; j++) {
            if (i > 0 && i < cl - 1 && j > 0 && j < cs - 1) continue;
            column(x - w / 2 + (i + inset) * sx, y, z - d / 2 + (j + inset) * sz, r, h, PALETTE.marble);
          }
        };
        ring(0); if (s.double) ring(1);
        const cw = w * (s.double ? 0.62 : 0.6), cd = d * (s.double ? 0.42 : 0.5);   // the inner room
        b.box(x + w * 0.04, y, z, cw, h, cd, 0, PALETTE.plaster);
        solid(x + w * 0.04, z, cw, cd);
        b.box(x, y + h + r * 0.5, z, w + 3, h * 0.09, d + 3, 0, PALETTE.marble);
        b.add('prism', x, y + h + r * 0.5 + h * 0.09, z, w + 3.6, Math.min(d * 0.16, h * 0.4), d + 3.6, 0, PALETTE.roof);
        break;
      }
      case 'altar':
        b.box(x, y, z, w, 1.2, d, 0, PALETTE.marble);
        b.box(x + w * 0.3, y + 1.2, z, w * 0.3, h - 1.2, d * 0.9, 0, PALETTE.marble);
        solid(x, z, w, d); break;
      case 'tomb':
        b.box(x, y, z, w, h * 0.7, d, 0, PALETTE.stone);
        b.add('cone4', x, y + h * 0.7, z, w * 0.75, h * 0.3, d * 0.75, Math.PI / 4, PALETTE.stone);
        solid(x, z, w, d); break;
      case 'ship': {
        const wy = -0.6;
        b.box(x, wy, z, w, h, d, rot, PALETTE.wood);
        b.box(x, wy + h, z, w * 0.9, 0.3, d * 0.8, rot, PALETTE.darkWood);
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
      const hh = 3.6 + Math.floor(rand() * 2) * 2.8 + rand() * 0.8 + (terrainAt(hx, hz) - base);
      b.box(hx, base, hz, cw, hh, cd, 0, HOUSE_COLORS[Math.floor(rand() * HOUSE_COLORS.length)]);
      if (rand() < 0.6) gableRoof(hx, base + hh, hz, cw, cd, 0, rand() < 0.5 ? PALETTE.roof : PALETTE.roofDark);
      else b.box(hx, base + hh, hz, cw * 0.96, 0.5, cd * 0.96, 0, PALETTE.shade);
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

  const buildings = b.mesh(lit);
  scene.add(buildings);
  return { colliders, triangles: (b.pos.length + decal.pos.length) / 9 };
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
