// The map: a small one in the corner and a big one you open by tapping it.
// Both are drawn from the same city plan the 3D world is built from, so they always match.
import { WORLD, SEA_X, PADS, STREETS, STRUCTURES, HOUSE_BLOCKS, WALLS, PLACES, THEATRE } from '../world/layout.js';

const C = {
  land: '#d9cfa6', sea: '#7fb0c4', street: '#f4eee0', pad: '#ece4cf', block: '#b99f7c',
  key: '#8c5a3c', wall: '#7d7466', you: '#c0392b', text: '#3b2f25',
};

function drawBase(ctx, w, h) {
  const sx = w / (WORLD.maxX - WORLD.minX), sz = h / (WORLD.maxZ - WORLD.minZ);
  const X = (x) => (x - WORLD.minX) * sx, Z = (z) => (z - WORLD.minZ) * sz;
  ctx.fillStyle = C.land; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = C.sea; ctx.fillRect(0, 0, X(SEA_X), h);
  ctx.fillStyle = C.pad;
  for (const p of PADS) if (p.surface) ctx.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * sx, (p.z1 - p.z0) * sz);
  ctx.strokeStyle = C.street; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of STREETS) {
    ctx.lineWidth = Math.max(1.5, s.w * sx);
    ctx.beginPath(); s.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke();
  }
  ctx.fillStyle = C.block;
  for (const b of HOUSE_BLOCKS) ctx.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sx, (b.z1 - b.z0) * sz);
  ctx.fillStyle = C.key;
  for (const s of STRUCTURES) {
    if (s.kind === 'ship') continue;
    ctx.fillRect(X(s.x - s.w / 2), Z(s.z - s.d / 2), Math.max(1.5, s.w * sx), Math.max(1.5, s.d * sz));
  }
  ctx.beginPath(); ctx.arc(X(THEATRE.cx), Z(THEATRE.cz), THEATRE.r1 * sx, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.strokeStyle = C.wall; ctx.lineWidth = Math.max(1, 2.4 * sx);
  for (const chain of WALLS) {
    ctx.beginPath(); chain.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke();
  }
  return { X, Z };
}

function drawYou(ctx, px, pz, faceDeg, size) {
  ctx.save(); ctx.translate(px, pz); ctx.rotate(faceDeg * Math.PI / 180);
  ctx.fillStyle = C.you; ctx.strokeStyle = '#fff'; ctx.lineWidth = size * 0.18;
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.8); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.7, size * 0.8); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}

export function createMap({ miniCanvas, bigCanvas, names, text }) {
  const ratio = (WORLD.maxX - WORLD.minX) / (WORLD.maxZ - WORLD.minZ);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let miniBase = null, bigBase = null, miniT = null, bigT = null;

  function prepare(canvas, cssW) {
    const cssH = cssW / ratio;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    const base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
    const t = drawBase(base.getContext('2d'), base.width, base.height);
    return { base, t };
  }

  function layoutMini() {
    const cssW = Math.min(170, Math.max(118, window.innerWidth * 0.3));
    ({ base: miniBase, t: miniT } = prepare(miniCanvas, cssW));
  }
  function layoutBig() {
    const cssW = Math.min(window.innerWidth - 24, (window.innerHeight - 150) * ratio, 1100);
    ({ base: bigBase, t: bigT } = prepare(bigCanvas, cssW));
    // place names, numbered so they stay readable on a phone
    const ctx = bigBase.getContext('2d'), fs = Math.max(9, 11 * dpr * Math.min(1, cssW / 520));
    ctx.font = `600 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    PLACES.forEach((p, i) => {
      const x = bigT.X(p.x), z = bigT.Z(p.z), r = fs * 0.95;
      ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2);
      ctx.fillStyle = p.imagined ? '#fff6d8' : '#fff'; ctx.fill();
      ctx.strokeStyle = C.text; ctx.lineWidth = dpr; if (p.imagined) ctx.setLineDash([3 * dpr, 2 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.fillText(String(i + 1), x, z + 0.5);
    });
  }

  function legendHTML() {
    return PLACES.map((p, i) => {
      const n = (names[p.id] && names[p.id].name) || p.id;
      return `<li><span class="num${p.imagined ? ' imagined' : ''}">${i + 1}</span>${n}${p.imagined ? ' <em>' + text.imaginedTag + '</em>' : ''}</li>`;
    }).join('');
  }

  layoutMini();
  return {
    layoutMini, layoutBig, legendHTML,
    drawMini(player) {
      const ctx = miniCanvas.getContext('2d');
      ctx.drawImage(miniBase, 0, 0);
      drawYou(ctx, miniT.X(player.x), miniT.Z(player.z), player.face, 6 * dpr);
    },
    drawBig(player) {
      if (!bigBase) layoutBig();
      const ctx = bigCanvas.getContext('2d');
      ctx.drawImage(bigBase, 0, 0);
      drawYou(ctx, bigT.X(player.x), bigT.Z(player.z), player.face, 9 * dpr);
    },
  };
}
