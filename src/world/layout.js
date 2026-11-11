// The city plan, as data. Units are metres. +x is east, +z is south (so north is -z).
// Real distances are shrunk roughly 5-8x so the city is walkable in a few minutes.
// Display names for locations live in content/locations.json, keyed by id.

export const WORLD = { minX: -295, maxX: 485, minZ: -264, maxZ: 356 };   // extent of the drawn ground
export const WALK = { minX: -188.5, maxX: 425, minZ: -204, maxZ: 292 };    // how far the player may wander
export const MAPVIEW = { minX: -235, maxX: 420, minZ: -200, maxZ: 300 }; // area shown on the map
export const SEA_X = -190;          // everything west of this is water
export const UPPER_Y = 14;          // height of the upper (state agora) terrace

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x, z, cx, cz, rx, rz, h) => {
  const dx = (x - cx) / rx, dz = (z - cz) / rz;
  return h * Math.exp(-(dx * dx + dz * dz));
};

// Flat areas cut into the natural ground: squares, building platforms, the temple plain.
// x0,z0,x1,z1 = rectangle; y = height; m = blend margin; surface = paving colour key (or null).
export const PADS = [
  { id: 'quay',        x0: -190, z0: -45, x1: -168, z1: 45,  y: 1,       m: 6,  surface: 'stone' },
  { id: 'theatrePlaza',x0: -46,  z0: -22, x1: -22,  z1: 22,  y: 1,       m: 8,  surface: 'stone' },
  { id: 'orchestra',   x0: -22,  z0: -42, x1: -10,  z1: 42,  y: 1,       m: 4,  surface: null },
  { id: 'agora',       x0: -138, z0: 28,  x1: -44,  z1: 122, y: 1,       m: 6,  surface: 'stone' },
  { id: 'triodos',     x0: -72,  z0: 124, x1: -18,  z1: 156, y: 1,       m: 6,  surface: 'stone' },
  { id: 'scrollSquare',x0: -112, z0: 134, x1: -84,  z1: 160, y: 1,       m: 5,  surface: 'stone' },
  { id: 'tyrannus',    x0: -20,  z0: 58,  x1: 8,    z1: 84,  y: 1.5,     m: 5,  surface: null },
  { id: 'stateAgora',  x0: 100,  z0: 136, x1: 204,  z1: 204, y: UPPER_Y, m: 8,  surface: 'stone' },
  { id: 'civic',       x0: 100,  z0: 108, x1: 196,  z1: 136, y: UPPER_Y, m: 6,  surface: 'dirt' },
  { id: 'terrace1',    x0: 14,   z0: 171, x1: 62,   z1: 186, y: 8,       m: 5,  surface: null },
  { id: 'terrace2',    x0: 14,   z0: 195, x1: 62,   z1: 207, y: 12.5,    m: 3,  surface: null },
  { id: 'temple',      x0: 262,  z0: -168, x1: 396, z1: -96, y: 1.5,     m: 14, surface: 'dirt' },
  // raised platforms (the blend margin acts as the steps)
  { id: 'artemisionBase', x0: 286, z0: -151, x1: 374, z1: -113, y: 3.3,  m: 4,  surface: 'marble' },
  { id: 'agoraTempleBase', x0: 146, z0: 174, x1: 158, z1: 178, y: UPPER_Y + 1.2, m: 2, surface: 'marble' },
];

// The Great Theatre: semicircular seating facing west, cut into the hill.
export const THEATRE = { cx: -10, cz: 0, r0: 13, r1: 41, rowDepth: 2, rowRise: 1.0, baseY: 1 };

function naturalHeight(x, z) {
  // valley ramp up Curetes Street to the upper terrace (south half of the map only)
  let h = UPPER_Y * smooth(-15, 95, x) * smooth(50, 105, z);
  // Panayirdag: twin-peaked hill behind the theatre
  h += bump(x, z, 95, -15, 72, 62, 44);
  h += bump(x, z, 205, 30, 58, 62, 38);
  // Bulbuldag: long ridge along the south
  h += 52 * Math.exp(-(((z - 275) / 50) ** 2)) * smooth(-230, -150, x);
  // ground level and the harbour basin
  h += 1 - 4 * smooth(SEA_X + 4, SEA_X - 10, x);
  return h;
}

const GRID_STEP = 4;   // spacing of the ground grid, in metres

function padWeight(p, x, z) {
  const dx = Math.max(p.x0 - x, 0, x - p.x1);
  const dz = Math.max(p.z0 - z, 0, z - p.z1);
  // stay fully flat for one grid square beyond the edge, so paving never has grass poking into it
  const d = Math.max(0, Math.hypot(dx, dz) - GRID_STEP * 1.05);
  return 1 - smooth(0, p.m, d);
}

// The exact, smooth ground formula. Under the theatre seating it is a bowl cut into the hill.
export function groundAt(x, z) {
  let h = naturalHeight(x, z);
  const t = THEATRE, dx = x - t.cx, r = Math.hypot(dx, z - t.cz);
  const tw = (1 - smooth(t.r1 + 2, t.r1 + 18, r)) * smooth(0, 4, dx);
  if (tw > 0) {
    const bowl = r < t.r0 ? t.baseY : t.baseY + (Math.min(r, t.r1) - t.r0) / t.rowDepth * t.rowRise - 0.8;
    h += (bowl - h) * tw;
  }
  for (const p of PADS) {
    const w = padWeight(p, x, z);
    if (w > 0) h += (p.y - h) * w;
  }
  return h;
}

// The ground as it is actually drawn: heights on a grid, joined by flat triangles.
// The player walks on exactly this surface, so feet and picture always agree.
export const GRID = (() => {
  const nx = Math.ceil((WORLD.maxX - WORLD.minX) / GRID_STEP), nz = Math.ceil((WORLD.maxZ - WORLD.minZ) / GRID_STEP);
  const h = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    h[j * (nx + 1) + i] = groundAt(WORLD.minX + i * GRID_STEP, WORLD.minZ + j * GRID_STEP);
  }
  return { nx, nz, step: GRID_STEP, h };
})();

export function terrainAt(x, z) {
  const g = GRID, n = g.nx + 1;
  let fx = (x - WORLD.minX) / g.step, fz = (z - WORLD.minZ) / g.step;
  fx = Math.max(0, Math.min(g.nx - 1e-4, fx)); fz = Math.max(0, Math.min(g.nz - 1e-4, fz));
  const i = Math.floor(fx), j = Math.floor(fz); fx -= i; fz -= j;
  const a = g.h[j * n + i], d = g.h[j * n + i + 1], b = g.h[(j + 1) * n + i], c = g.h[(j + 1) * n + i + 1];
  return fx + fz <= 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
}

// Is this spot on the theatre seating?
export function onSeats(x, z) {
  const t = THEATRE, dx = x - t.cx, r = Math.hypot(dx, z - t.cz);
  return dx > 0 && r >= t.r0 && r <= t.r1;
}

// Height of whatever the player is standing on: the ground, or a row of theatre seats.
export function heightAt(x, z) {
  if (onSeats(x, z)) {
    const t = THEATRE, r = Math.hypot(x - t.cx, z - t.cz);
    const rows = Math.round((t.r1 - t.r0) / t.rowDepth);
    const row = Math.min(Math.floor((r - t.r0) / t.rowDepth) + 1, rows);
    return t.baseY + row * t.rowRise;
  }
  return terrainAt(x, z);
}

// Streets: lists of points, drawn as ribbons that follow the ground.
export const STREETS = [
  { id: 'harborStreet', w: 11, surface: 'stone', pts: [[-168, 0], [-46, 0]] },
  { id: 'marbleStreet', w: 9,  surface: 'stone', pts: [[-34, 20], [-34, 126]] },
  { id: 'curetes',      w: 9,  surface: 'stone', pts: [[-22, 142], [10, 152], [50, 164], [84, 170], [102, 170]] },
  { id: 'scrollLane',   w: 5,  surface: 'dirt',  pts: [[-72, 146], [-84, 146]] },
  { id: 'synagogueLane',w: 5,  surface: 'dirt',  pts: [[-104, -6], [-104, -20]] },
  { id: 'tyrannusLane', w: 5,  surface: 'dirt',  pts: [[-30, 70], [-20, 70]] },
  { id: 'terraceSteps', w: 4,  surface: 'stone', pts: [[28, 160], [28, 172.4]] },
  { id: 'civicLane',    w: 6,  surface: 'dirt',  pts: [[152, 134], [152, 150]] },
  { id: 'gateRoad',     w: 9,  surface: 'stone', pts: [[204, 172], [246, 172]] },
  { id: 'sacredRoad',   w: 8,  surface: 'dirt',  pts: [[246, 172], [282, 150], [304, 100], [310, 30], [306, -40], [286, -84], [262, -110], [252, -132]] },
  { id: 'northRoad',    w: 8,  surface: 'dirt',  pts: [[-40, -22], [-44, -70], [-40, -110]] },
];

// Solid structures. kind decides how each is drawn (see build.js).
// x,z = centre; w = size east-west; d = size north-south; h = height; rot = turn in degrees.
export const STRUCTURES = [
  // --- harbour ---
  { kind: 'warehouse', x: -178, z: -66, w: 20, d: 22, h: 7 },
  { kind: 'hall', id: 'tollOffice', x: -179, z: -36, w: 9, d: 8, h: 4.5, roof: 'gable', color: 'plaster', door: 'e' },
  { kind: 'warehouse', x: -178, z: 62,  w: 20, d: 26, h: 7 },
  { kind: 'ship', x: -204, z: -18, w: 22, d: 7, h: 3, rot: 80 },
  { kind: 'ship', x: -206, z: 20,  w: 18, d: 6, h: 3, rot: 100 },
  { kind: 'ship', x: -226, z: -70, w: 22, d: 7, h: 3, rot: 30 },

  // --- theatre stage building ---
  { kind: 'stage', id: 'stage', x: -24, z: 0, w: 7, d: 40, h: 8 },

  // --- commercial agora: shop rows around the square, gaps are entrances ---
  { kind: 'shops', x: -91,  z: 32,  w: 86, d: 7, h: 5, front: 's' },              // north row
  { kind: 'shops', x: -134, z: 75,  w: 7,  d: 78, h: 5, front: 'e' },             // west row
  { kind: 'shops', x: -48,  z: 50,  w: 7,  d: 36, h: 5, front: 'w' },             // east row (north part)
  { kind: 'site',  x: -48,  z: 96,  w: 7,  d: 40, h: 5 },                // east row (south): hall under construction
  { kind: 'shops', x: -103, z: 118, w: 62, d: 7, h: 5, front: 'n' },              // south row (west part)
  { kind: 'gate',  id: 'mazaeusGate', x: -58, z: 121, w: 22, d: 5, h: 10 },

  // --- imagined placements ---
  { kind: 'hall', id: 'synagogue', x: -104, z: -30, w: 16, d: 13, h: 6, roof: 'gable', color: 'plaster', door: 's', bench: true },
  { kind: 'openHall', id: 'tyrannus',  x: -4,   z: 70,  w: 18, d: 14, h: 6, open: 'w', benches: true },
  { kind: 'openHall', id: 'priscilla', x: -122, z: 141, w: 12, d: 10, h: 4.5, open: 'e', workshop: true },

  // --- Curetes Street monuments (north side) ---
  { kind: 'monument', id: 'heroon',  x: 2,  z: 141, w: 8, d: 5, h: 8 },
  { kind: 'octagon',  id: 'octagon', x: 20, z: 147, w: 7, d: 7, h: 11 },
  { kind: 'monument', id: 'memmius', x: 78, z: 160, w: 7, d: 7, h: 10 },
  { kind: 'monument', id: 'pollio',  x: 96, z: 180, w: 6, d: 4, h: 7 },

  // --- terrace houses (south side of Curetes Street) ---
  { kind: 'courtHouse', id: 'terraceHouse', x: 28, z: 179.5, w: 22, d: 14, h: 5.5 },
  { kind: 'house', x: 52, z: 179, w: 16, d: 12, h: 6 },
  { kind: 'house', x: 26, z: 201, w: 20, d: 11, h: 6 },
  { kind: 'house', x: 49, z: 201, w: 20, d: 11, h: 6 },

  // --- upper civic area ---
  { kind: 'stoa', id: 'basilica', x: 152, z: 143, w: 100, d: 12, h: 9 },
  { kind: 'hall', id: 'prytaneion', x: 114, z: 121, w: 20, d: 18, h: 8, roof: 'gable', color: 'marble', porch: 's', door: 's' },
  { kind: 'precinct', id: 'precinct', x: 146, z: 121, w: 26, d: 20, h: 4 },
  { kind: 'hall', id: 'council', x: 178, z: 121, w: 20, d: 18, h: 7, roof: 'gable', color: 'plaster', door: 's' },
  { kind: 'temple', id: 'agoraTemple', x: 152, z: 176, w: 18, d: 10, h: 8, cols: [6, 4], front: 'e' },
  { kind: 'gate', id: 'magnesianGate', x: 246, z: 172, w: 6, d: 26, h: 11, rot: 0, axis: 'x' },

  // --- outside the walls ---
  { kind: 'temple', id: 'artemision', x: 330, z: -132, w: 96, d: 46, h: 17, cols: [21, 8], double: true, steps: 3, front: 'w', grand: true },
  { kind: 'altar',  id: 'altar', x: 266, z: -132, w: 10, d: 22, h: 4 },
  { kind: 'tomb', x: 296, z: 112, w: 4, d: 4, h: 4 },
  { kind: 'tomb', x: 318, z: 60,  w: 4, d: 5, h: 5 },
  { kind: 'tomb', x: 300, z: 0,   w: 4, d: 4, h: 3.5 },
  { kind: 'tomb', x: 296, z: -62, w: 5, d: 4, h: 4.5 },
];

// Blocks of ordinary houses and shops, filled in automatically. gap = lanes between houses.
export const HOUSE_BLOCKS = [
  { x0: -164, z0: -44, x1: -116, z1: -10 },   // north of Harbor Street
  { x0: -90,  z0: -50, x1: -52,  z1: -10 },
  { x0: -164, z0: 8,   x1: -52,  z1: 24 },    // between Harbor Street and the agora
  { x0: -28,  z0: 46,  x1: -10,  z1: 56 },    // east of the theatre-agora street
  { x0: -26,  z0: 90,  x1: -2,   z1: 128 },
  { x0: -164, z0: 126, x1: -134, z1: 160 },   // south-west quarter
  { x0: -70,  z0: 160, x1: 8,    z1: 184 },   // below Bulbuldag
  { x0: 30,   z0: 134, x1: 72,   z1: 148 },   // north side of upper Curetes
  { x0: 66,   z0: 178, x1: 92,   z1: 204 },
  { x0: 206,  z0: 186, x1: 238,  z1: 204 },   // by the Magnesian Gate
  { x0: 206,  z0: 138, x1: 238,  z1: 160 },
];

// City wall: a chain of points. Gaps are left where roads pass through.
export const WALLS = [
  [[246, 185], [246, 240], [150, 262], [20, 258], [-110, 250], [-172, 200], [-182, 90]],
  [[246, 159], [262, 110], [258, 40], [230, -40], [150, -90], [40, -122], [-34, -116]],
  [[-46, -116], [-120, -100], [-182, -84]],
];

// Named places: used for the map, the "you are near" banner, plaques and Leader Mode jumps.
// spawn = where a jump puts you, face = compass direction you look (degrees, 0 = north).
export const PLACES = [
  { id: 'harbor',        x: -176, z: 0,    r: 26, spawn: [-164, 0],   face: 270 },
  { id: 'harborStreet',  x: -105, z: 0,    r: 14, spawn: [-120, 0],   face: 90 },
  { id: 'synagogue',     x: -104, z: -26,  r: 12, spawn: [-104, -14], face: 0,   imagined: true },
  { id: 'theatre',       x: -8,   z: 0,    r: 34, spawn: [-12, 0],    face: 90 },
  { id: 'marbleStreet',  x: -34,  z: 76,   r: 12, spawn: [-34, 40],   face: 180 },
  { id: 'tyrannus',      x: -6,   z: 70,   r: 12, spawn: [-24, 70],   face: 90,  imagined: true },
  { id: 'agora',         x: -91,  z: 75,   r: 40, spawn: [-60, 75],   face: 270 },
  { id: 'silversmiths',  x: -124, z: 60,   r: 10, spawn: [-116, 60],  face: 270 },
  { id: 'priscilla',     x: -118, z: 141,  r: 10, spawn: [-106, 143.5], face: 270, imagined: true },
  { id: 'mazaeusGate',   x: -58,  z: 122,  r: 8,  spawn: [-58, 132],  face: 0 },
  { id: 'triodos',       x: -42,  z: 142,  r: 14, spawn: [-36, 140],  face: 250 },
  { id: 'scrollSquare',  x: -98,  z: 147,  r: 12, spawn: [-90, 147],  face: 270, imagined: true },
  { id: 'curetes',       x: 40,   z: 160,  r: 20, spawn: [0, 150],    face: 100 },
  { id: 'terraceHouse',  x: 28,   z: 178,  r: 10, spawn: [28, 166],   face: 180 },
  { id: 'stateAgora',    x: 152,  z: 176,  r: 34, spawn: [112, 172],  face: 90 },
  { id: 'basilica',      x: 152,  z: 143,  r: 12, spawn: [152, 154],  face: 0 },
  { id: 'prytaneion',    x: 114,  z: 122,  r: 12, spawn: [126, 133],  face: 315 },
  { id: 'council',       x: 178,  z: 122,  r: 12, spawn: [166, 133],  face: 45,  imagined: true },
  { id: 'magnesianGate', x: 246,  z: 172,  r: 12, spawn: [232, 172],  face: 90 },
  { id: 'sacredRoad',    x: 308,  z: 40,   r: 30, spawn: [299, 122],  face: 5 },
  { id: 'artemision',    x: 300,  z: -132, r: 60, spawn: [250, -112], face: 75 },
];

export const START = { x: -160, z: 0, face: 90 };   // step off the ship, look up the street

// Info plaques: a glowing marker stands at each of these spots. Text is in content/locations.json.
export const PLAQUES = [
  { id: 'harbor', x: -171, z: 8 }, { id: 'tollOffice', x: -171, z: -32 }, { id: 'harborStreet', x: -122, z: 4 },
  { id: 'synagogue', x: -99, z: -20, imagined: true }, { id: 'theatre', x: -37, z: -10 }, { id: 'marbleStreet', x: -30, z: 40 },
  { id: 'tyrannus', x: -22, z: 62, imagined: true }, { id: 'agora', x: -72, z: 72 }, { id: 'neronianHall', x: -56, z: 98 },
  { id: 'silversmiths', x: -124, z: 66 }, { id: 'priscilla', x: -113, z: 147, imagined: true }, { id: 'mazaeusGate', x: -62, z: 128 },
  { id: 'triodos', x: -38, z: 134 }, { id: 'librarySite', x: -60, z: 142 }, { id: 'scrollSquare', x: -94, z: 153, imagined: true },
  { id: 'heroon', x: 2, z: 146.5 }, { id: 'octagon', x: 21, z: 154 }, { id: 'curetes', x: 46, z: 158 },
  { id: 'terraceHouse', x: 36, z: 166 }, { id: 'memmius', x: 76, z: 166 }, { id: 'pollio', x: 97, z: 175 },
  { id: 'stateAgora', x: 118, z: 184 }, { id: 'agoraTemple', x: 138, z: 189 }, { id: 'basilica', x: 136, z: 152 },
  { id: 'prytaneion', x: 124, z: 133.5 }, { id: 'precinct', x: 141, z: 133.5 }, { id: 'council', x: 172, z: 133.5, imagined: true },
  { id: 'magnesianGate', x: 239, z: 164 }, { id: 'cityWalls', x: 241, z: 181 }, { id: 'sacredRoad', x: 284, z: 142 },
  { id: 'tombs', x: 292.5, z: 110 }, { id: 'artemisAltar', x: 257, z: -119 }, { id: 'artemision', x: 277, z: -116 },
];

// Small scenery, placed by hand. Trees elsewhere are scattered automatically.
export const PROPS = {
  stalls: [   // market stalls in the commercial agora: [x, z, turn in degrees]
    [-108, 56, 0], [-96, 56, 0], [-84, 56, 0], [-72, 56, 0], [-108, 92, 180], [-96, 92, 180], [-84, 92, 180], [-72, 92, 180],
    [-116, 74, 90], [-66, 82, 270],
  ],
  statues: [[112, 160], [128, 160], [176, 160], [192, 160], [112, 196], [192, 196], [-40, -16], [-40, 16]],
  cypress: [[292, 116], [300, 116], [322, 64], [296, 4], [304, -4], [292, -66], [252, -100], [258, -160], [246, -150], [-110, -20], [100, 106], [196, 106], [-66, 152], [8, 138]],
};

// The people you can talk to. talk = which conversation in content/characters.json they open.
// face = compass direction they look when no one is near. look = how they are dressed.
export const PEOPLE = [
  { id: 'demetrius', talk: 'demetrius', x: -127.3, z: 62.8, face: 90, look: { tunic: 0x8c5a3c, hair: 0x3a2e26, beard: true, apron: 0x5a4636 } },
  { id: 'priscilla', talk: 'priscillaAquila', x: -120.4, z: 143.2, face: 90, look: { woman: true, tunic: 0x6f8f8a, cloak: 0xd9c9a0, hair: 0x4a3524 } },
  { id: 'aquila', talk: 'priscillaAquila', x: -120.8, z: 139.2, face: 90, look: { tunic: 0xb89b6a, hair: 0x2e2620, beard: true, apron: 0x6b523a } },
  { id: 'theodotus', talk: 'theodotus', x: -102, z: -22.3, face: 180, look: { tunic: 0xe9dcc0, cloak: 0x5a6f8c, hair: 0xb8b0a4, beard: true } },
  { id: 'metrodorus', talk: 'metrodorus', x: -11.4, z: 74.6, face: 90, look: { tunic: 0xd9c9a0, hair: 0x5a4028, small: 0.94 } },
  { id: 'paul', talk: 'paul', x: 3, z: 70, face: 270, look: { tunic: 0xcdbd9a, cloak: 0x7a5a48, hair: 0x4a4038, beard: true, bald: true } },
  { id: 'ammia', talk: 'ammia', x: 266, z: -106, face: 100, look: { woman: true, tunic: 0xc97f5a, cloak: 0xe9dcc0, hair: 0x2e2620 } },
  { id: 'zosimus', talk: 'zosimus', x: -95.5, z: 148.6, face: 300, look: { tunic: 0x6a5a6f, cloak: 0x4a4038, hair: 0x2e2620, beard: true } },
  { id: 'valens', talk: 'valens', x: 160.6, z: 152.2, face: 180, look: { tunic: 0xd8cfb8, cloak: 0x6b5a48, hair: 0x4a3524, soldier: true } },
  { id: 'menander', talk: 'menander', x: 26.4, z: 174.8, face: 0, look: { tunic: 0xece6d8, cloak: 0x8a3d3d, hair: 0x5a5048, beard: true } },
  { id: 'charite', talk: 'charite', x: 30.4, z: 175, face: 0, look: { woman: true, tunic: 0xd9b24a, hair: 0x3a2e26, small: 0.9 } },
  { id: 'eirene', talk: 'eirene', x: 31.8, z: 180, face: 300, look: { woman: true, tunic: 0x9a8f7a, hair: 0x2e2620 } },
];
