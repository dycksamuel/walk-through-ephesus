// The story layer: letter fragments to find, the journal, the menu (settings and Leader Mode),
// and the riot scene in the theatre. All wording comes from the files in /content.
import * as THREE from '../vendor/three.module.min.js';
import { FRAGMENTS, EPILOGUE, RIOT_NEEDS, PLACES, terrainAt, heightAt } from './world/layout.js';
import { createRiotCrowd } from './crowd.js';
import { clearSave } from './storage.js';

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

export function createStory(game, content) {
  const { $, text, names, scene, player, audio } = game;
  const { fragments: fragData, riot, about } = content;
  const byId = Object.fromEntries(fragData.fragments.map((f) => [f.id, f]));
  const total = FRAGMENTS.length;

  // ---------- saved state ----------
  const save = game.loadSave();
  const state = {
    found: new Set((Array.isArray(save.found) ? save.found : []).filter((id) => byId[id])),
    riotSeen: !!save.riotSeen, epilogue: !!save.epilogue, invited: !!save.invited,
    leader: !!save.leader || game.params.has('leader'), bigText: !!save.bigText, sound: save.sound !== false,
    introShown: !!save.introShown, scrollHint: !!save.scrollHint,
  };
  function persist() {
    const d = game.loadSave();
    Object.assign(d, { found: [...state.found], riotSeen: state.riotSeen, epilogue: state.epilogue, invited: state.invited,
      leader: state.leader, bigText: state.bigText, sound: state.sound, introShown: state.introShown, scrollHint: state.scrollHint });
    game.writeSave(d);
  }
  // In Leader Mode everything counts as found, but the player's own progress is left untouched underneath.
  const has = (id) => state.leader || state.found.has(id);
  const riotOpen = () => state.leader || state.found.size >= RIOT_NEEDS;
  const epilogueOpen = () => state.leader || state.riotSeen;
  document.body.classList.toggle('bigText', state.bigText);
  audio.setOn(state.sound);

  // ---------- the glowing scrolls ----------
  const spots = [...FRAGMENTS, EPILOGUE].map((f) => ({ ...f, y: heightAt(f.x, f.z) }));
  const scrollGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.62, 8); scrollGeo.rotateZ(Math.PI / 2);
  const scrolls = new THREE.InstancedMesh(scrollGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), spots.length);
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.28, depthWrite: false }), spots.length);
  scrolls.frustumCulled = halos.frustumCulled = false; scene.add(scrolls, halos);
  const m4 = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const visible = (s) => (s.id === 'epilogue' ? epilogueOpen() && !state.epilogue : !state.found.has(s.id));

  // each visible scroll is something the player can walk up to and pick up
  const targets = spots.map((s) => ({ x: s.x, z: s.z, y: s.y, range: 3.6, yOff: 1.15, label: text.pickUp, spot: s, open: () => collect(s) }));
  function refreshTargets() {
    game.extraTargets.length = 0;
    for (const t of targets) if (visible(t.spot)) game.extraTargets.push(t);
    game.refreshNear();
  }

  game.frameHooks.push((t) => {
    spots.forEach((s, i) => {
      if (!visible(s)) { scrolls.setMatrixAt(i, hidden); halos.setMatrixAt(i, hidden); return; }
      const y = s.y + 1.15 + Math.sin(t * 1.8 + i) * 0.1;
      m4.makeRotationY(t * 0.9 + i).setPosition(s.x, y, s.z); scrolls.setMatrixAt(i, m4);
      const p = 1 + Math.sin(t * 3 + i) * 0.12; m4.makeScale(p, p, p).setPosition(s.x, y, s.z); halos.setMatrixAt(i, m4);
    });
    scrolls.instanceMatrix.needsUpdate = true; halos.instanceMatrix.needsUpdate = true;
    if (!state.scrollHint && !game.isLocked()) {
      for (const tg of game.extraTargets) if (Math.hypot(player.x - tg.x, player.z - tg.z) < 9) { state.scrollHint = true; persist(); game.showHint(text.fragmentHint); break; }
    }
  });

  // ---------- small helpers for panels ----------
  let openPanel = null, afterClose = null;
  function show(id) { openPanel = id; $(id).hidden = false; game.lock(); const sh = $(id).querySelector('.sheet'); if (sh) sh.scrollTop = 0; }
  function hide() { if (!openPanel) return; $(openPanel).hidden = true; openPanel = null; game.unlock(); const fn = afterClose; afterClose = null; if (fn) fn(); }
  const countLine = () => text.fragmentCount.replace('{found}', state.found.size).replace('{total}', total);
  function updateButtons() { $('journalBtn').textContent = `${text.journal} ${state.leader ? total : state.found.size}/${total}`; }

  // ---------- picking up a fragment ----------
  function collect(s) {
    const f = s.id === 'epilogue' ? fragData.epilogue : byId[s.id];
    if (s.id === 'epilogue') state.epilogue = true; else state.found.add(s.id);
    persist(); audio.chime(); refreshTargets(); updateButtons();
    $('foundHead').textContent = text.foundHead; $('foundTitle').textContent = f.title; $('foundRef').textContent = f.ref;
    $('foundText').textContent = f.found; $('foundCount').textContent = s.id === 'epilogue' ? '' : countLine();
    $('foundJournal').onclick = () => { const later = afterClose; afterClose = null; hide(); openJournal(f.id); afterClose = later; };
    show('foundPanel');
    // the fifth piece brings news of trouble at the theatre
    if (!state.invited && !state.riotSeen && state.found.size >= RIOT_NEEDS) { state.invited = true; persist(); afterClose = invite; }
  }
  $('foundClose').textContent = text.keepWalking; $('foundJournal').textContent = text.openJournal;
  $('foundClose').addEventListener('click', hide);

  function invite() {
    $('inviteTitle').textContent = riot.title; $('inviteText').textContent = riot.invite;
    show('invitePanel');
  }
  $('inviteGo').textContent = riot.inviteButton; $('inviteLater').textContent = text.keepWalking;
  $('inviteGo').addEventListener('click', () => { hide(); startRiot(); });
  $('inviteLater').addEventListener('click', hide);

  // ---------- journal ----------
  function passage(verses) {
    const box = el('div', 'verses');
    for (const [n, t] of verses) { box.appendChild(el('sup', null, n)); box.appendChild(document.createTextNode(t + ' ')); }
    return box;
  }
  function entryNode(e) {      // one journal page: a fragment, the riot, or an About page
    const box = el('div', 'entry');
    box.appendChild(el('h2', null, e.title));
    if (e.place) box.appendChild(el('p', 'placeLine', e.place));
    if (e.verses) { box.appendChild(el('h3', null, `${text.passage}: ${e.ref}`)); box.appendChild(passage(e.verses)); }
    if (e.why) { box.appendChild(el('h3', null, text.whyHere)); box.appendChild(el('p', null, e.why)); }
    if (e.questions) { box.appendChild(el('h3', null, text.questionsHead)); const ol = el('ol'); e.questions.forEach((q) => ol.appendChild(el('li', null, q))); box.appendChild(ol); }
    if (e.paragraphs) e.paragraphs.forEach((p) => box.appendChild(el('p', null, p)));
    if (e.verses) box.appendChild(el('p', 'small muted', text.webNotice));
    return box;
  }
  function entries() {         // everything the journal can hold, in reading order
    const list = fragData.fragments.map((f) => ({ ...f, open: has(f.id) }));
    list.push({ id: 'riot', ...riot.journal, place: names.theatre && names.theatre.name, open: state.leader || state.riotSeen });
    list.push({ ...fragData.epilogue, open: state.leader || state.epilogue });
    list.push({ id: 'aboutLetter', ...about.letter, open: true, extra: true });
    list.push({ id: 'aboutGame', ...about.game, open: true, extra: true });
    return list;
  }
  function openJournal(id) {
    const body = $('journalBody'); body.textContent = '';
    const list = entries(), e = id && list.find((x) => x.id === id && x.open);
    $('journalBack').hidden = !e;
    if (e) { $('journalTitle').textContent = text.journal; body.appendChild(entryNode(e)); }
    else {
      $('journalTitle').textContent = text.journal;
      body.appendChild(el('p', 'small muted', state.found.size || state.leader ? countLine() : text.journalEmpty));
      const ul = el('ul', 'entryList');
      for (const x of list) {
        const li = el('li'), b = el('button'); b.type = 'button'; b.disabled = !x.open;
        b.appendChild(el('strong', null, x.open ? x.title : text.notFoundYet));
        if (!x.extra) b.appendChild(el('span', null, x.open ? `${x.ref} · ${x.place || ''}` : (x.id === 'riot' || x.id === 'epilogue' ? '' : x.ref)));
        b.addEventListener('click', () => openJournal(x.id));
        li.appendChild(b); ul.appendChild(li);
      }
      body.appendChild(ul);
      const pr = el('button', 'secondary', text.printJournal); pr.type = 'button'; pr.addEventListener('click', printJournal); body.appendChild(pr);
    }
    if (openPanel !== 'journalPanel') show('journalPanel'); else $('journalSheet').scrollTop = 0;
  }
  function printJournal() {
    const area = $('printArea'); area.textContent = '';
    for (const x of entries()) if (x.open) area.appendChild(entryNode(x));
    window.print();
  }
  $('journalClose').textContent = text.close;
  $('journalClose').addEventListener('click', hide);
  $('journalBack').addEventListener('click', () => openJournal());
  game.press($('journalBtn'), () => openJournal());

  // ---------- menu: settings, Leader Mode, About ----------
  function buildMenu() {
    const body = $('menuBody'); body.textContent = '';
    $('menuTitle').textContent = text.menu;
    const row = (label, on, onText, offText, fn) => {
      const r = el('div', 'menuRow'); r.appendChild(el('span', null, label));
      const b = el('button', 'switch', on ? onText : offText); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', () => { fn(!on); buildMenu(); }); r.appendChild(b); body.appendChild(r);
    };
    row(text.sound, state.sound, text.on, text.off, (v) => { state.sound = v; audio.setOn(v); persist(); });
    row(text.largeText, state.bigText, text.on, text.off,
      (v) => { state.bigText = v; document.body.classList.toggle('bigText', v); persist(); });
    row(text.leaderMode, state.leader, text.on, text.off,
      (v) => { state.leader = v; persist(); refreshTargets(); updateButtons(); });
    body.appendChild(el('p', 'small muted', text.leaderNote));
    const stack = el('div', 'stack');
    const btn = (label, cls, fn) => { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); stack.appendChild(b); return b; };
    if (riotOpen()) btn(text.startRiot, 'primary', () => { hide(); startRiot(); });
    else stack.appendChild(el('p', 'small', text.riotLocked.replace('{needed}', RIOT_NEEDS - state.found.size)));
    if (state.leader) {
      body.appendChild(el('h3', null, text.jumpTo));
      const grid = el('div', 'jumpList');
      for (const p of PLACES) {
        const b = el('button', null, (names[p.id] && names[p.id].name) || p.id); b.type = 'button';
        b.addEventListener('click', () => { hide(); game.teleport(p.spawn[0], p.spawn[1], p.face); });
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
    btn(text.about, 'secondary', () => { hide(); openJournal('aboutGame'); });
    btn(text.resetProgress, 'secondary', () => {
      stack.textContent = ''; stack.appendChild(el('p', null, text.resetConfirm));
      btn(text.resetYes, 'primary', () => { clearSave(); window.location.href = window.location.pathname; });
      btn(text.resetNo, 'secondary', buildMenu);
    });
    body.appendChild(stack);
  }
  $('menuBtn').textContent = text.menu; $('menuClose').textContent = text.close;
  $('menuClose').addEventListener('click', hide);
  game.press($('menuBtn'), () => { buildMenu(); show('menuPanel'); });

  // tapping the dimmed area outside a panel closes it; Escape too
  for (const id of ['foundPanel', 'invitePanel', 'journalPanel', 'menuPanel']) {
    let openedAt = 0;
    new MutationObserver(() => { if (!$(id).hidden) openedAt = performance.now(); }).observe($(id), { attributes: true, attributeFilter: ['hidden'] });
    $(id).addEventListener('click', (e) => { if (e.target === $(id) && performance.now() - openedAt > 450) hide(); });
  }
  game.keyHook = (e) => {
    if (riotOn) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); nextStep(); } return true; }
    if (openPanel) { if (e.code === 'Escape') hide(); return true; }
    if (e.code === 'KeyJ' && !game.isLocked()) { openJournal(); return true; }
    return false;
  };

  // ---------- the riot scene (Acts 19:23-41) ----------
  const crowd = createRiotCrowd(scene);
  let riotOn = false, stepIndex = -1, energy = 0, targetEnergy = 0, back = null;
  const paul = game.folk.people.find((p) => p.id === 'paul');
  // where you stand, which way you look, and how worked up the crowd is, for each kind of step
  const STAGING = {
    workshop: { at: [-117, 62.8, 270], energy: [0.15, 0.35, 0.85], layout: 'workshop', pitch: -9 },
    rush: { at: [-40, 15, 285], energy: [0.9], layout: 'rush', pitch: -9 },
    outside: { at: [-49.5, -10, 92], energy: [0.55], layout: 'theatre', paul: true, pitch: -9 },
    confusion: { at: [14, 0, 270], energy: [0.9], layout: 'theatre', pitch: -14 },
    alexander: { at: [14, 0, 270], energy: [0.85], layout: 'theatre', pitch: -14, speaker: true },
    chant: { at: [14, 0, 270], energy: [1], layout: 'theatre', pitch: -14, chant: true },
    clerk: { at: [14, 0, 270], energy: [0.4, 0.2, 0.04], layout: 'theatre', pitch: -14, speaker: true },
  };
  function showStep() {
    const step = riot.steps[stepIndex], st = STAGING[step.scene] || STAGING.confusion;
    // how many steps of this same scene came before this one (the crowd's mood shifts within a scene)
    let k = 0; for (let i = stepIndex - 1; i >= 0 && riot.steps[i].scene === step.scene; i--) k++;
    targetEnergy = st.energy[Math.min(k, st.energy.length - 1)];
    if (k === 0) { game.teleport(st.at[0], st.at[1], st.at[2]); player.pitch = st.pitch || 0; }
    crowd.setLayout(st.layout, !!st.speaker);
    const chanting = !!st.chant || (step.scene === 'workshop' && k === 2) || step.scene === 'alexander';
    audio.chant(chanting);
    $('riotChant').hidden = !chanting; $('riotChant').textContent = riot.chant.text;
    if (paul) {   // outside the theatre, Paul is held back by his friends
      if (st.paul) { paul.mesh.position.set(-43.5, terrainAt(-43.5, -10), -10); paul.mesh.rotation.y = -90 * Math.PI / 180; }
      else paul.mesh.position.set(paul.x, paul.y, paul.z);
    }
    $('riotTitle').textContent = `${riot.title} · ${stepIndex + 1}/${riot.steps.length}`;
    $('riotNarration').textContent = step.narration || ''; $('riotNarration').hidden = !step.narration;
    const v = $('riotVerses'); v.textContent = ''; v.hidden = !step.verses;
    if (step.verses) for (const [n, t] of step.verses) { v.appendChild(el('sup', null, n)); v.appendChild(document.createTextNode(t + ' ')); }
    $('riotRef').textContent = step.ref ? `${step.ref} (WEB)` : ''; $('riotRef').hidden = !step.ref;
    $('riotSheet').scrollTop = 0;
  }
  function nextStep() {
    if (!riotOn) return;
    stepIndex++;
    if (stepIndex < riot.steps.length) { showStep(); return; }
    if (stepIndex === riot.steps.length) {   // the closing words
      targetEnergy = 0; audio.chant(false); $('riotChant').hidden = true;
      $('riotNarration').textContent = riot.closing; $('riotNarration').hidden = false;
      $('riotVerses').hidden = true; $('riotRef').hidden = true; $('riotNext').textContent = text.keepWalking; $('riotSkip').hidden = true;
      return;
    }
    endRiot();
  }
  function startRiot() {
    if (riotOn || !riotOpen()) return;
    riotOn = true; stepIndex = -1; back = { x: player.x, z: player.z, face: player.face };
    document.body.classList.add('riot'); game.setScene(true);
    $('riotNext').textContent = text.next; $('riotSkip').textContent = text.skip; $('riotSkip').hidden = false;
    $('riotBar').hidden = false; crowd.show(true);
    nextStep();
  }
  function endRiot() {
    riotOn = false; energy = targetEnergy = 0; game.riotLevel = 0; audio.chant(false);
    document.body.classList.remove('riot'); $('riotBar').hidden = true; $('riotChant').hidden = true; crowd.show(false);
    if (paul) { paul.mesh.position.set(paul.x, paul.y, paul.z); }
    game.setScene(false); game.teleport(-40, 4, 90);
    const first = !state.riotSeen; state.riotSeen = true; persist(); refreshTargets(); updateButtons();
    if (first && !state.epilogue) game.showHint(text.epilogueInvite);
  }
  $('riotNext').addEventListener('click', nextStep);
  $('riotSkip').addEventListener('click', endRiot);
  game.frameHooks.push((t, dt) => {
    if (!riotOn) return;
    energy += (targetEnergy - energy) * Math.min(1, dt * 1.5);
    game.riotLevel = Math.max(0.05, energy);
    crowd.update(t, energy);
  });

  // ---------- first moments ----------
  game.startHooks.push(() => {
    refreshTargets(); updateButtons();
    if (!state.introShown) { state.introShown = true; persist(); setTimeout(() => game.showHint(text.questIntro, 9000), 1200); }
  });
  updateButtons();

  return {
    state, startRiot, endRiot, nextStep, openJournal, collect: (id) => { const s = spots.find((x) => x.id === id); if (s) collect(s); return !!s; },
    spots, isRiot: () => riotOn, closePanel: hide,
    setLeader(v) { state.leader = v; persist(); refreshTargets(); updateButtons(); },
  };
}
