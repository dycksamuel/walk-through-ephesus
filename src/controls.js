// Reads the keyboard, mouse and touch screen and turns them into "move" and "look" amounts.
// Phone: left thumb joystick to walk, drag anywhere else to look.
// Laptop: WASD or arrow keys to walk, Shift to jog, click-and-drag to look.

export function createControls(canvas, stickEl) {
  const state = { turn: 0, moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, usedTouch: false, enabled: true };
  const keys = new Set();
  const knob = stickEl.querySelector('.knob');

  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    keys.add(e.code);
    if (/^Arrow/.test(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // --- look: drag on the 3D view ---
  const look = new Map();   // pointerId -> last position
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.enabled) return;
    if (e.pointerType === 'touch') state.usedTouch = true;
    if (look.size) return;   // one finger looks; extra fingers are ignored
    look.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = look.get(e.pointerId);
    if (!p) return;
    state.lookX += e.clientX - p.x; state.lookY += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
  });
  const endLook = (e) => look.delete(e.pointerId);
  canvas.addEventListener('pointerup', (e) => {
    const p = look.get(e.pointerId);
    // a quick press without dragging counts as a tap on whatever is under the finger
    if (p && state.onTap && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10 && performance.now() - p.t0 < 500) state.onTap(e.clientX, e.clientY);
    endLook(e);
  });
  canvas.addEventListener('pointercancel', endLook);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- move: on-screen joystick ---
  let stickId = null, sx = 0, sy = 0, stickX = 0, stickY = 0;
  const R = 46;
  const setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
  stickEl.addEventListener('pointerdown', (e) => {
    if (!state.enabled) return;
    state.usedTouch = state.usedTouch || e.pointerType === 'touch';
    stickId = e.pointerId;
    const r = stickEl.getBoundingClientRect();
    sx = r.left + r.width / 2; sy = r.top + r.height / 2;
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    moveStick(e); e.preventDefault();
  });
  const moveStick = (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    stickX = dx / R; stickY = -dy / R; setKnob(dx, dy);
  };
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; stickX = stickY = 0; setKnob(0, 0);
  };
  stickEl.addEventListener('pointermove', moveStick);
  stickEl.addEventListener('pointerup', endStick);
  stickEl.addEventListener('pointercancel', endStick);

  state.update = () => {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD')) x += 1;
    if (keys.has('KeyA')) x -= 1;
    // left/right arrows turn rather than sidestep: easier for people new to games
    state.turn = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
    if (!state.enabled) { x = y = 0; state.turn = 0; state.lookX = state.lookY = 0; }
    state.moveX = x || stickX; state.moveY = y || stickY;
    state.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  };
  state.takeLook = () => { const d = { x: state.lookX, y: state.lookY }; state.lookX = state.lookY = 0; return d; };
  return state;
}
