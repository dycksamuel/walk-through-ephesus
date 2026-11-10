// The city plan, as data. Units are metres. +x is east, +z is south (so north is -z).
// Real distances are shrunk roughly 5-8x so the city is walkable in a few minutes.
// Display names for locations live in content/locations.json, keyed by id.

export const WORLD = { minX: -235, maxX: 420, minZ: -200, maxZ: 300 };
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
  { id: 'orchestra',   x0: -22,  z0: -40, x1: 2,    z1: 40,  y: 1,       m: 4,  surface: null },
  { id: 'agora',       x0: -138, z0: 28,  x1: -44,  z1: 122, y: 1,       m: 6,  surface: 'stone' },
  { id: 'triodos',     x0: -72,  z0: 124, x1: -18,  z1: 156, y: 1,       m: 6,  surface: 'stone' },
  { id: 'scrollSquare',x0: -112, z0: 134, x1: -84,  z1: 160, y: 1,       m: 5,  surface: 'stone' },
  { id: 'tyrannus',    x0: -20,  z0: 58,  x1: 8,    z1: 84,  y: 1.5,     m: 5,  surface: null },
  { id: 'stateAgora',  x0: 100,  z0: 136, x1: 204,  z1: 204, y: UPPER_Y, m: 8,  surface: 'stone' },
  { id: 'civic',       x0: 100,  z0: 108, x1: 196,  z1: 136, y: UPPER_Y, m: 6,  surface: 'dirt' },
  { id: 'terrace1',    x0: 14,   z0: 172, x1: 62,   z1: 186, y: 9,       m: 3,  surface: null },
  { id: 'terrace2',    x0: 14,   z0: 188, x1: 62,   z1: 202, y: 13,      m: 3,  surface: null },
  { id: 'temple',      x0: 262,  z0: -168, x1: 396, z1: -96, y: 1.5,     m: 14, surface: 'dirt' },
  // raised platforms (the blend margin acts as the steps)
  { id: 'artemisionBase', x0: 281, z0: -156, x1: 379, z1: -108, y: 3.3,  m: 4,  surface: 'marble' },
  { id: 'agoraTempleBase', x0: 142, z0: 170, x1: 162, z1: 182, y: UPPER_Y + 1.2, m: 2, surface: 'marble' },
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

function padWeight(p, x, z) {
  const dx = Math.max(p.x0 - x, 0, x - p.x1);
  const dz = Math.max(p.z0 - z, 0, z - p.z1);
  const d = Math.hypot(dx, dz);
  return 1 - smooth(0, p.m, d);
}

// The ground surface (what the terrain mesh shows). Under the theatre seating it is a smooth
// bowl cut into the hill, so the hillside never pokes up through the seats.
export function groundAt(x, z) {
  let h = naturalHeight(x, z);
  const t = THEATRE, dx = x - t.cx, r = Math.hypot(dx, z - t.cz);
  const tw = (1 - smooth(t.r1, t.r1 + 16, r)) * smooth(-12, -2, dx);
  if (tw > 0) {
    const bowl = t.baseY + Math.max(0, Math.min(r, t.r1) - t.r0) / t.rowDepth * t.rowRise - 0.3;
    h += (bowl - h) * tw;
  }
  for (const p of PADS) {
    const w = padWeight(p, x, z);
    if (w > 0) h += (p.y - h) * w;
  }
  return h;
}

// Height of whatever the player is standing on: the ground, or a row of theatre seats.
export function heightAt(x, z) {
  const t = THEATRE, dx = x - t.cx, r = Math.hypot(dx, z - t.cz);
  if (dx > -2 && r >= t.r0 && r <= t.r1) {
    const rows = Math.round((t.r1 - t.r0) / t.rowDepth);
    const row = Math.min(Math.floor((r - t.r0) / t.rowDepth) + 1, rows);
    return t.baseY + row * t.rowRise;
  }
  return groundAt(x, z);
}

// Streets: lists of points, drawn as ribbons that follow the ground.
export const STREETS = [
  { id: 'harborStreet', w: 11, surface: 'stone', pts: [[-168, 0], [-46, 0]] },
  { id: 'marbleStreet', w: 9,  surface: 'stone', pts: [[-34, 20], [-34, 126]] },
  { id: 'curetes',      w: 9,  surface: 'stone', pts: [[-22, 142], [10, 152], [50, 164], [84, 170], [102, 170]] },
  { id: 'scrollLane',   w: 5,  surface: 'dirt',  pts: [[-72, 146], [-84, 146]] },
  { id: 'synagogueLane',w: 5,  surface: 'dirt',  pts: [[-104, -6], [-104, -20]] },
  { id: 'tyrannusLane', w: 5,  surface: 'dirt',  pts: [[-30, 70], [-20, 70]] },
  { id: 'civicLane',    w: 6,  surface: 'dirt',  pts: [[146, 136], [146, 150]] },
  { id: 'gateRoad',     w: 9,  surface: 'stone', pts: [[204, 172], [246, 172]] },
  { id: 'sacredRoad',   w: 8,  surface: 'dirt',  pts: [[246, 172], [282, 150], [304, 100], [310, 30], [306, -40], [286, -84], [262, -110], [252, -132]] },
  { id: 'northRoad',    w: 8,  surface: 'dirt',  pts: [[-40, -22], [-44, -70], [-40, -110]] },
];

// Solid structures. kind decides how each is drawn (see build.js).
// x,z = centre; w = size east-west; d = size north-south; h = height; rot = turn in degrees.
export const STRUCTURES = [
  // --- harbour ---
  { kind: 'warehouse', x: -178, z: -62, w: 20, d: 26, h: 7 },
  { kind: 'warehouse', x: -178, z: 62,  w: 20, d: 26, h: 7 },
  { kind: 'ship', x: -204, z: -18, w: 22, d: 7, h: 3, rot: 80 },
  { kind: 'ship', x: -206, z: 20,  w: 18, d: 6, h: 3, rot: 100 },
  { kind: 'ship', x: -226, z: -70, w: 22, d: 7, h: 3, rot: 30 },

  // --- theatre stage building ---
  { kind: 'hall', id: 'stage', x: -24, z: 0, w: 7, d: 40, h: 9, roof: 'flat', color: 'marble' },

  // --- commercial agora: shop rows around the square, gaps are entrances ---
  { kind: 'shops', x: -91,  z: 32,  w: 86, d: 7, h: 5 },                 // north row
  { kind: 'shops', x: -134, z: 75,  w: 7,  d: 78, h: 5 },                // west row
  { kind: 'shops', x: -48,  z: 50,  w: 7,  d: 36, h: 5 },                // east row (north part)
  { kind: 'site',  x: -48,  z: 96,  w: 7,  d: 40, h: 5 },                // east row (south): hall under construction
  { kind: 'shops', x: -103, z: 118, w: 62, d: 7, h: 5 },                 // south row (west part)
  { kind: 'gate',  id: 'mazaeusGate', x: -58, z: 121, w: 22, d: 5, h: 10 },

  // --- imagined placements ---
  { kind: 'hall', id: 'synagogue', x: -104, z: -30, w: 16, d: 13, h: 6, roof: 'gable', color: 'plaster' },
  { kind: 'hall', id: 'tyrannus',  x: -4,   z: 70,  w: 18, d: 14, h: 7, roof: 'gable', color: 'plaster' },
  { kind: 'hall', id: 'priscilla', x: -122, z: 137, w: 14, d: 10, h: 6, roof: 'flat',  color: 'ochre', open: 'e' },

  // --- Curetes Street monuments (north side) ---
  { kind: 'monument', id: 'heroon',  x: 2,  z: 141, w: 8, d: 5, h: 8 },
  { kind: 'octagon',  id: 'octagon', x: 20, z: 147, w: 7, d: 7, h: 11 },
  { kind: 'monument', id: 'memmius', x: 78, z: 160, w: 7, d: 7, h: 10 },
  { kind: 'monument', id: 'pollio',  x: 96, z: 180, w: 6, d: 4, h: 7 },

  // --- terrace houses (south side of Curetes Street) ---
  { kind: 'house', id: 'terraceHouse', x: 28, z: 179, w: 22, d: 12, h: 6, court: true },
  { kind: 'house', x: 50, z: 179, w: 18, d: 12, h: 6 },
  { kind: 'house', x: 26, z: 195, w: 20, d: 12, h: 6 },
  { kind: 'house', x: 49, z: 195, w: 20, d: 12, h: 6 },

  // --- upper civic area ---
  { kind: 'stoa', id: 'basilica', x: 152, z: 143, w: 100, d: 12, h: 9 },
  { kind: 'hall', id: 'prytaneion', x: 114, z: 121, w: 20, d: 18, h: 8, roof: 'gable', color: 'marble', porch: 's' },
  { kind: 'precinct', id: 'precinct', x: 146, z: 121, w: 26, d: 20, h: 4 },
  { kind: 'hall', id: 'council', x: 178, z: 121, w: 20, d: 18, h: 7, roof: 'gable', color: 'plaster' },
  { kind: 'temple', id: 'agoraTemple', x: 152, z: 176, w: 18, d: 10, h: 8, cols: [6, 4] },
  { kind: 'gate', id: 'magnesianGate', x: 246, z: 172, w: 6, d: 26, h: 11, rot: 0, axis: 'x' },

  // --- outside the walls ---
  { kind: 'temple', id: 'artemision', x: 330, z: -132, w: 96, d: 46, h: 17, cols: [21, 8], double: true, steps: 3 },
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
  { x0: -26,  z0: 28,  x1: -6,   z1: 54 },    // east of the theatre-agora street
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
  [[246, 185], [246, 240], [150, 262], [20, 258], [-110, 250], [-175, 200], [-186, 90]],
  [[246, 159], [262, 110], [258, 40], [230, -40], [150, -90], [40, -122], [-34, -116]],
  [[-46, -116], [-120, -100], [-186, -84]],
];

// Named places: used for the map, the "you are near" banner, plaques and Leader Mode jumps.
// spawn = where a jump puts you, face = compass direction you look (degrees, 0 = north).
export const PLACES = [
  { id: 'harbor',        x: -176, z: 0,    r: 26, spawn: [-164, 0],   face: 270 },
  { id: 'harborStreet',  x: -105, z: 0,    r: 14, spawn: [-120, 0],   face: 90 },
  { id: 'synagogue',     x: -104, z: -26,  r: 12, spawn: [-104, -14], face: 0,   imagined: true },
  { id: 'theatre',       x: -8,   z: 0,    r: 34, spawn: [-40, 0],    face: 90 },
  { id: 'marbleStreet',  x: -34,  z: 76,   r: 12, spawn: [-34, 40],   face: 180 },
  { id: 'tyrannus',      x: -6,   z: 70,   r: 12, spawn: [-24, 70],   face: 90,  imagined: true },
  { id: 'agora',         x: -91,  z: 75,   r: 40, spawn: [-60, 75],   face: 270 },
  { id: 'silversmiths',  x: -124, z: 60,   r: 10, spawn: [-116, 60],  face: 270 },
  { id: 'priscilla',     x: -118, z: 137,  r: 10, spawn: [-108, 140], face: 270, imagined: true },
  { id: 'mazaeusGate',   x: -58,  z: 122,  r: 8,  spawn: [-58, 132],  face: 0 },
  { id: 'triodos',       x: -42,  z: 142,  r: 14, spawn: [-36, 140],  face: 250 },
  { id: 'scrollSquare',  x: -98,  z: 147,  r: 12, spawn: [-90, 147],  face: 270, imagined: true },
  { id: 'curetes',       x: 40,   z: 160,  r: 20, spawn: [0, 150],    face: 100 },
  { id: 'terraceHouse',  x: 28,   z: 178,  r: 10, spawn: [28, 170],   face: 180 },
  { id: 'stateAgora',    x: 152,  z: 176,  r: 34, spawn: [112, 172],  face: 90 },
  { id: 'basilica',      x: 152,  z: 143,  r: 12, spawn: [152, 154],  face: 0 },
  { id: 'prytaneion',    x: 114,  z: 122,  r: 12, spawn: [128, 132],  face: 300 },
  { id: 'council',       x: 178,  z: 122,  r: 12, spawn: [164, 132],  face: 60,  imagined: true },
  { id: 'magnesianGate', x: 246,  z: 172,  r: 12, spawn: [232, 172],  face: 90 },
  { id: 'sacredRoad',    x: 308,  z: 40,   r: 30, spawn: [300, 110],  face: 0 },
  { id: 'artemision',    x: 300,  z: -132, r: 60, spawn: [250, -112], face: 75 },
];

export const START = { x: -160, z: 0, face: 90 };   // step off the ship, look up the street
