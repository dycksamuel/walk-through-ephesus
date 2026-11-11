// Starts the game: loads the text files, builds the city, then runs the walk-around loop.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld, resolveCollisions, sightBlocked } from './world/build.js';
import { heightAt, terrainAt, onSeats, PLACES, PLAQUES, START } from './world/layout.js';
import { createControls } from './controls.js';
import { createMap } from './ui/map.js';
import { loadSave, writeSave } from './storage.js';
import { createPeople } from './people.js';

const $ = (id) => document.getElementById(id);
const EYE = 1.65, WALK = 8, JOG = 14, SKY = 0xd7e3ea;
const params = new URLSearchParams(location.search);

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function boot() {
  const [text, names, talks] = await Promise.all([loadJSON('content/ui.json'), loadJSON('content/locations.json'), loadJSON('content/characters.json')]);
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
  $('cardClose').textContent = text.close;
  $('cardKnownHead').textContent = text.plaqueKnown;
  $('cardImaginedHead').textContent = text.plaqueImagined;
  $('cardBadge').textContent = text.imaginedBadge;

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
  // Buttons that must work even while another finger is holding the joystick.
  // (Phones only send a "click" for the first finger, so we listen for the finger lifting instead.)
  function press(el, fn) {
    let down = false;
    el.addEventListener('pointerdown', () => { down = true; });
    el.addEventListener('pointerup', (e) => { if (down) { down = false; e.preventDefault(); fn(); } });
    el.addEventListener('pointercancel', () => { down = false; });
    el.addEventListener('click', (e) => { if (e.detail === 0) fn(); });   // keyboard activation
  }
  const openMap = () => {
    map.layoutBig(); $('mapLegend').innerHTML = map.legendHTML(); map.drawBig(player);
    $('mapPanel').hidden = false; panelOpen = true; controls.enabled = false;
    $('mapPanel').scrollTop = 0; $('mapSheet').scrollTop = 0; $('mapClose').focus();
  };
  const closeMap = () => { $('mapPanel').hidden = true; panelOpen = false; controls.enabled = true; canvas.focus(); };
  press($('mapBtn'), openMap);
  $('mapClose').addEventListener('click', closeMap);
  $('mapPanel').addEventListener('click', (e) => { if (e.target === $('mapPanel')) closeMap(); });
  window.addEventListener('keydown', (e) => {
    if ($('startPanel').hidden === false) return;
    if (e.repeat) return;
    if (!$('cardPanel').hidden) { if (e.code === 'Escape' || e.code === 'KeyE') closePlaque(); return; }
    if (!$('talkPanel').hidden) {
      if (e.code === 'Escape') closeTalk();
      const n = /^(Digit|Numpad)([1-4])$/.exec(e.code);            // number keys pick a reply
      if (n) { const btn = $('talkChoices').children[+n[2] - 1]; if (btn) btn.click(); }
      return;
    }
    if ((e.code === 'KeyE' || e.code === 'Enter') && near && !panelOpen && (e.target === canvas || e.target === document.body)) { e.preventDefault(); openNear(); return; }
    if (e.code === 'KeyM') ($('mapPanel').hidden ? openMap() : closeMap());
    if (e.code === 'Escape' && !$('mapPanel').hidden) closeMap();
  });
  window.addEventListener('resize', () => { map.layoutMini(); if (!$('mapPanel').hidden) { map.layoutBig(); map.drawBig(player); } });

  // ----- info plaques: glowing markers you can tap, or walk up to and press Read -----
  const readSet = new Set(Array.isArray(save.read) ? save.read : []);
  const markerGeo = new THREE.OctahedronGeometry(0.42);
  const markers = new THREE.InstancedMesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), PLAQUES.length);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.09, 1.2, 5), new THREE.MeshBasicMaterial({ color: 0x5a4a3a }), PLAQUES.length);
  const mtx = new THREE.Matrix4(), UNREAD = new THREE.Color(0xffc531), READ = new THREE.Color(0x4f9fc0);
  PLAQUES.forEach((p, i) => {
    p.y = terrainAt(p.x, p.z);
    posts.setMatrixAt(i, mtx.makeTranslation(p.x, p.y + 0.6, p.z));
    markers.setColorAt(i, readSet.has(p.id) ? READ : UNREAD);
  });
  markers.frustumCulled = false; posts.frustumCulled = false;
  scene.add(markers, posts);
  const spin = new THREE.Matrix4();
  function animateMarkers(t) {
    PLAQUES.forEach((p, i) => {
      spin.makeRotationY(t * 1.2 + i);
      spin.setPosition(p.x, p.y + 1.75 + Math.sin(t * 2 + i) * 0.12, p.z);
      markers.setMatrixAt(i, spin);
    });
    markers.instanceMatrix.needsUpdate = true;
  }

  let cardOpenedAt = 0;
  let near = null;   // the plaque or person close enough to use: { kind, obj }
  let hintShown = !!save.hinted, talkHintShown = !!save.hintedTalk, hintTimer = 0;
  function openPlaque(p) {
    const info = names[p.id] || {};
    $('cardTitle').textContent = info.name || p.id;
    $('cardBadge').hidden = !p.imagined;
    $('cardKnown').textContent = info.known || '';
    $('cardImagined').textContent = info.imagined || '';
    cardOpenedAt = performance.now();
    $('cardPanel').hidden = false; $('cardSheet').scrollTop = 0; $('actionBtn').hidden = true; $('hint').hidden = true;
    panelOpen = true; controls.enabled = false; $('cardClose').focus();
    if (!readSet.has(p.id)) {
      readSet.add(p.id); markers.setColorAt(PLAQUES.indexOf(p), READ); markers.instanceColor.needsUpdate = true;
      const data = loadSave(); data.read = [...readSet]; writeSave(data);
    }
  }
  function closePlaque() { $('cardPanel').hidden = true; panelOpen = false; controls.enabled = true; canvas.focus(); $('actionBtn').hidden = !near; }
  $('cardClose').addEventListener('click', closePlaque);
  // (the short delay stops the same tap that opened the card from also closing it)
  $('cardPanel').addEventListener('click', (e) => { if (e.target === $('cardPanel') && performance.now() - cardOpenedAt > 450) closePlaque(); });
  const openNear = () => { if (!near) return; if (near.kind === 'person') openTalk(near.obj); else openPlaque(near.obj); };
  press($('actionBtn'), openNear);

  // ----- people and conversations -----
  const folk = createPeople(scene, world.colliders);
  const talkedSet = new Set(Array.isArray(save.talked) ? save.talked : []);
  folk.setTalked(talkedSet);
  $('talkClose').textContent = text.close;
  $('talkNoteHead').textContent = text.scriptureNoteHead || '';
  let talking = null;
  function showNode(id) {
    const c = talking, node = c.nodes[id];
    $('talkName').textContent = node.speaker || c.name;
    $('talkText').textContent = node.text;
    const box = $('talkChoices'); box.textContent = '';
    const add = (label, fn, end) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label; if (end) btn.className = 'end';
      btn.addEventListener('click', fn); box.appendChild(btn);
    };
    if (node.end || !node.choices) add(text.goodbye || text.close, closeTalk, true);
    else node.choices.forEach((ch) => add(ch.label, () => showNode(ch.to)));
    $('talkSheet').scrollTop = 0;
    if (box.firstChild) box.firstChild.focus({ preventScroll: true });
  }
  function openTalk(person) {
    const c = talks[person.talk];
    if (!c) return;
    talking = c; cardOpenedAt = performance.now();
    $('talkName').textContent = c.name; $('talkRole').textContent = c.role || ''; $('talkAbout').textContent = c.about || '';
    const quote = !!c.scripture;
    $('talkText').classList.toggle('scripture', quote);
    $('talkRef').hidden = !quote; $('talkNoteHead').hidden = !quote; $('talkNote').hidden = !quote;
    if (quote) {     // Paul: his own words from Scripture, nothing invented
      $('talkText').textContent = '\u201C' + c.scripture.text + '\u201D';
      $('talkRef').textContent = c.scripture.ref + ' (WEB)'; $('talkNote').textContent = c.note || '';
      const box = $('talkChoices'); box.textContent = '';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'end'; btn.textContent = text.close;
      btn.addEventListener('click', closeTalk); box.appendChild(btn);
    } else showNode(c.start);
    $('talkPanel').hidden = false; $('actionBtn').hidden = true; $('hint').hidden = true;
    panelOpen = true; controls.enabled = false;
    if (!talkedSet.has(person.talk)) {
      talkedSet.add(person.talk); folk.setTalked(talkedSet);
      const data = loadSave(); data.talked = [...talkedSet]; writeSave(data);
    }
  }
  function closeTalk() { $('talkPanel').hidden = true; talking = null; panelOpen = false; controls.enabled = true; canvas.focus(); $('actionBtn').hidden = !near; }
  $('talkClose').addEventListener('click', closeTalk);
  $('talkPanel').addEventListener('click', (e) => { if (e.target === $('talkPanel') && performance.now() - cardOpenedAt > 450) closeTalk(); });

  function showHint(msg) {
    $('hint').textContent = msg; $('hint').hidden = false;
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { $('hint').hidden = true; }, 6000);
  }
  function updateNear() {
    // a person within 4.5 m takes priority over a plaque within 6.5 m
    let best = null, bestD = 4.5, kind = 'person';
    for (const p of folk.people) { const d = Math.hypot(player.x - p.x, player.z - p.z); if (d < bestD) { best = p; bestD = d; } }
    if (!best) { bestD = 6.5; kind = 'plaque'; for (const p of PLAQUES) { const d = Math.hypot(player.x - p.x, player.z - p.z); if (d < bestD) { best = p; bestD = d; } } }
    if ((near && near.obj) === best) return;
    near = best ? { kind, obj: best } : null;
    $('actionBtn').hidden = !best || panelOpen;
    if (!best) return;
    $('actionBtn').textContent = kind === 'person' ? text.talk : text.read;
    if (kind === 'plaque' && !hintShown) {
      hintShown = true; showHint((!touchDevice && text.plaqueHintKeys) || text.plaqueHint);
      const data = loadSave(); data.hinted = true; writeSave(data);
    } else if (kind === 'person' && !talkHintShown && text.talkHint) {
      talkHintShown = true; showHint(text.talkHint);
      const data = loadSave(); data.hintedTalk = true; writeSave(data);
    }
  }

  // tapping or clicking a marker in the 3D view opens it, from up to 45 metres away
  const v3 = new THREE.Vector3();
  controls.onTap = (cx, cy) => {
    if (panelOpen) return;
    let best = null, bestPx = Infinity;
    const consider = (kind, obj, yOff, range, size) => {
      const dist = Math.hypot(player.x - obj.x, player.z - obj.z);
      if (dist > range) return;
      v3.set(obj.x, obj.y + yOff, obj.z).project(camera);
      if (v3.z > 1) return;                                     // behind you
      const sx = (v3.x + 1) / 2 * window.innerWidth, sy = (1 - v3.y) / 2 * window.innerHeight;
      const d = Math.hypot(sx - cx, sy - cy);
      // close things look large on screen, so they get a larger touch area
      const reach = Math.max(46, size / Math.max(dist, 0.5) * window.innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)));
      if (d >= reach || d >= bestPx) return;
      if (sightBlocked(world.colliders, player.x, player.z, obj.x, obj.z)) return;   // hidden behind a building
      best = { kind, obj }; bestPx = d;
    };
    for (const p of PLAQUES) consider('plaque', p, 1.75, 45, 0.6);
    for (const p of folk.people) consider('person', p, 1.0, 25, 0.9);
    if (!best) return;
    if (best.kind === 'person') openTalk(best.obj); else openPlaque(best.obj);
  };

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

    world.sky.position.set(player.x, 0, player.z);
    animateMarkers(now / 1000);
    folk.update(player, now / 1000, dt);
    renderer.render(scene, camera);

    if (!$('hud').hidden) { drawCompass(); map.drawMini(player); updatePlace(); if (!panelOpen) updateNear(); }

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
    player, places: PLACES, plaques: PLAQUES, people: folk.people, teleport,
    talkTo: (id) => { const q = folk.people.find((x) => x.id === id); if (q) openTalk(q); return !!q; }, openPlaque: (id) => { const p = PLAQUES.find((q) => q.id === id); if (p) openPlaque(p); return !!p; },
    goTo(id) { const p = PLACES.find((q) => q.id === id); if (p) teleport(p.spawn[0], p.spawn[1], p.face); return !!p; },
    stats: () => ({ fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, colliders: world.colliders.length, pixelRatio }),
  };
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('intro');
  if (el) el.textContent = 'Something went wrong while loading. Please refresh the page. (' + err.message + ')';
});
