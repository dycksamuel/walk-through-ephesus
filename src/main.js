// Starts the game: loads the text files, builds the city, then runs the walk-around loop.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld, resolveCollisions } from './world/build.js';
import { heightAt, onSeats, PLACES, START } from './world/layout.js';
import { createControls } from './controls.js';
import { createMap } from './ui/map.js';
import { loadSave, writeSave } from './storage.js';

const $ = (id) => document.getElementById(id);
const EYE = 1.65, WALK = 8, JOG = 14, SKY = 0xcfe0ea;
const params = new URLSearchParams(location.search);

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function boot() {
  const [text, names] = await Promise.all([loadJSON('content/ui.json'), loadJSON('content/locations.json')]);
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touchDevice) document.body.classList.add('touch');

  // ----- words on the page come from content/ui.json -----
  document.title = text.title;
  $('title').textContent = text.title;
  $('subtitle').textContent = text.subtitle;
  $('intro').textContent = text.intro;
  $('how').textContent = touchDevice ? text.howTouch : text.howKeys;
  $('phaseNote').textContent = text.phaseNote;
  $('startBtn').textContent = text.loading;
  $('mapTitle').textContent = text.mapTitle;
  $('mapNote').textContent = text.mapNote;
  $('mapClose').textContent = text.mapClose;
  $('mapBtn').setAttribute('aria-label', text.mapOpen);

  // ----- 3D setup -----
  const canvas = $('view');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  } catch (e) {
    $('intro').textContent = text.errorNoWebGL; $('startBtn').hidden = true; return;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 140, 640);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 900);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9c8f78, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-0.5, 1, 0.35); scene.add(sun);

  const world = buildWorld(scene);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 78 : 66;     // a wider view on upright phones
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ----- the player -----
  const save = loadSave();
  const player = { x: START.x, z: START.z, y: 0, face: START.face, pitch: 0 };
  if (save.pos && Number.isFinite(save.pos.x) && Number.isFinite(save.pos.z)) {
    player.x = save.pos.x; player.z = save.pos.z; player.face = Number.isFinite(save.pos.face) ? save.pos.face : 0;
  }
  resolveCollisions(world.colliders, player, 0.5);
  player.y = heightAt(player.x, player.z);

  const controls = createControls(canvas, $('stick'));
  controls.enabled = false;

  // ----- map and compass -----
  const map = createMap({ miniCanvas: $('miniMap'), bigCanvas: $('bigMap'), names, text });
  const compassEl = $('compass');
  const marks = text.compass.map((label, i) => {
    const s = document.createElement('span'); s.textContent = label;
    if (i % 2) s.className = 'minor';
    compassEl.appendChild(s); return { el: s, deg: i * 45 };
  });
  function drawCompass() {
    for (const m of marks) {
      let d = ((m.deg - player.face + 540) % 360) - 180;        // -180..180, 0 = straight ahead
      m.el.style.display = Math.abs(d) > 100 ? 'none' : '';
      m.el.style.left = (50 + d / 100 * 50) + '%';
    }
  }

  let panelOpen = true;   // the start screen
  const openMap = () => {
    map.layoutBig(); $('mapLegend').innerHTML = map.legendHTML(); map.drawBig(player);
    $('mapPanel').hidden = false; panelOpen = true; controls.enabled = false;
    $('mapPanel').scrollTop = 0; $('mapSheet').scrollTop = 0; $('mapClose').focus();
  };
  const closeMap = () => { $('mapPanel').hidden = true; panelOpen = false; controls.enabled = true; canvas.focus(); };
  $('mapBtn').addEventListener('click', openMap);
  $('mapClose').addEventListener('click', closeMap);
  $('mapPanel').addEventListener('click', (e) => { if (e.target === $('mapPanel')) closeMap(); });
  window.addEventListener('keydown', (e) => {
    if ($('startPanel').hidden === false) return;
    if (e.repeat) return;
    if (e.code === 'KeyM') ($('mapPanel').hidden ? openMap() : closeMap());
    if (e.code === 'Escape' && !$('mapPanel').hidden) closeMap();
  });
  window.addEventListener('resize', () => { map.layoutMini(); if (!$('mapPanel').hidden) { map.layoutBig(); map.drawBig(player); } });

  // ----- "you are at..." banner -----
  let currentPlace = null, placeTimer = 0;
  function updatePlace() {
    let best = null, bestD = Infinity;
    for (const p of PLACES) {
      const d = Math.hypot(player.x - p.x, player.z - p.z) / p.r;
      if (d < 1 && p.r < bestD) { best = p; bestD = p.r; }     // the smallest area you are inside wins
    }
    const id = best ? best.id : null;
    if (id === currentPlace) return;
    currentPlace = id;
    const el = $('place');
    if (!best) { el.classList.remove('show'); return; }
    el.textContent = (names[id] && names[id].name) || id;
    el.classList.add('show');
    clearTimeout(placeTimer); placeTimer = setTimeout(() => el.classList.remove('show'), 4000);
  }

  // ----- start button -----
  const startBtn = $('startBtn');
  startBtn.textContent = save.pos ? text.continue : text.start;
  startBtn.disabled = false;
  startBtn.addEventListener('click', () => {
    $('startPanel').hidden = true; $('hud').hidden = false;
    panelOpen = false; controls.enabled = true; canvas.tabIndex = 0; canvas.focus();
    map.layoutMini();
  });

  // ----- main loop -----
  const showFps = params.has('fps');
  $('fps').hidden = !showFps;
  let last = performance.now(), frames = 0, fpsTime = 0, fps = 60, slowFor = 0, saveTimer = 0, eyeY = player.y + EYE;

  function teleport(x, z, face) {
    player.x = x; player.z = z; if (face !== undefined) player.face = face;
    player.pitch = 0; resolveCollisions(world.colliders, player, 0.5);
    player.y = heightAt(player.x, player.z); eyeY = player.y + EYE;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;

    controls.update();
    const look = controls.takeLook();
    const sens = controls.usedTouch ? 0.28 : 0.2;
    player.face = (player.face + look.x * sens + controls.turn * 110 * dt + 720) % 360;
    player.pitch = Math.max(-60, Math.min(60, player.pitch - look.y * sens));

    if (!panelOpen && (controls.moveX || controls.moveY)) {
      const a = player.face * Math.PI / 180, speed = controls.run ? JOG : WALK;
      const fx = Math.sin(a), fz = -Math.cos(a);                // forward
      const rx = Math.cos(a), rz = Math.sin(a);                 // right
      const step = speed * dt;
      // move in small steps so fast walkers can't slip through thin walls
      const n = Math.ceil(step / 0.4);
      let mx = fx * controls.moveY + rx * controls.moveX, mz = fz * controls.moveY + rz * controls.moveX;
      // too steep to climb? (theatre seats are fine: each row is a normal step)
      const ml = Math.hypot(mx, mz) || 1, ax = player.x + mx / ml * 1.5, az = player.z + mz / ml * 1.5;
      if (!onSeats(ax, az) && heightAt(ax, az) - heightAt(player.x, player.z) > 1.7) { mx = 0; mz = 0; }
      for (let i = 0; i < n; i++) {
        player.x += mx * step / n;
        player.z += mz * step / n;
        resolveCollisions(world.colliders, player, 0.5);
      }
    }
    player.y = heightAt(player.x, player.z);
    eyeY += (player.y + EYE - eyeY) * Math.min(1, dt * 10);    // smooth out steps and kerbs
    camera.position.set(player.x, eyeY, player.z);
    camera.rotation.set(player.pitch * Math.PI / 180, -player.face * Math.PI / 180, 0);

    renderer.render(scene, camera);

    if (!$('hud').hidden) { drawCompass(); map.drawMini(player); updatePlace(); }

    // frame-rate watch: if the device struggles, quietly lower the picture sharpness
    frames++; fpsTime += dt;
    if (fpsTime >= 1) {
      fps = frames / fpsTime; frames = 0; fpsTime = 0;
      if (showFps) $('fps').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · x${pixelRatio.toFixed(2)}`;
      slowFor = fps < 27 ? slowFor + 1 : 0;
      if (slowFor >= 3 && pixelRatio > 0.75 && !document.hidden) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); slowFor = 0;
      }
    }
    saveTimer += dt;
    if (saveTimer > 3 && !panelOpen) { saveTimer = 0; savePosition(); }
  }
  function savePosition() {
    if (!$('startPanel').hidden) return;
    const data = loadSave(); data.pos = { x: +player.x.toFixed(1), z: +player.z.toFixed(1), face: Math.round(player.face) };
    writeSave(data);
  }
  // also save when the tab is closed or the phone is locked
  window.addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePosition(); });
  requestAnimationFrame(frame);

  // A small handle for testing and (later) Leader Mode jumps.
  window.ephesus = {
    player, places: PLACES, teleport,
    goTo(id) { const p = PLACES.find((q) => q.id === id); if (p) teleport(p.spawn[0], p.spawn[1], p.face); return !!p; },
    stats: () => ({ fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, colliders: world.colliders.length, pixelRatio }),
  };
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('intro');
  if (el) el.textContent = 'Something went wrong while loading. Please refresh the page. (' + err.message + ')';
});
