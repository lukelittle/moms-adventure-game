/* =====================================================================
   ODYSSEY — Input
   Combines keyboard, an on-screen virtual joystick and touch buttons
   into one simple interface:
     Input.dx, Input.dy   movement direction (-1..1, snapped to 8 dirs)
     Input.pressed(a)     true once when action `a` was just pressed
     Input.held(a)        true while action `a` is held
   Actions: attack, jump, roll, spin, pause
   ===================================================================== */

const Input = (() => {
  const held = {};        // action -> bool
  const fresh = {};       // action -> pressed since last frame
  const keys = {};        // key code -> bool
  const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  let touchMode = false;
  let anyListener = null;

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyJ: 'attack', KeyZ: 'attack', Space: 'attack',
    KeyK: 'jump', KeyX: 'jump',
    KeyL: 'roll', KeyC: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll',
    KeyI: 'spin', KeyV: 'spin',
    Escape: 'pause', KeyP: 'pause', Enter: 'pause',
  };

  function press(a) { if (!held[a]) fresh[a] = true; held[a] = true; if (anyListener) anyListener(a); }
  function release(a) { held[a] = false; }

  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { if (anyListener) anyListener('mute'); return; }
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    keys[e.code] = true;
    if (!e.repeat) press(a);
  });
  window.addEventListener('keyup', e => {
    const a = KEYMAP[e.code];
    if (!a) return;
    keys[e.code] = false;
    // only release if no other key for the same action is still down
    const still = Object.keys(KEYMAP).some(k => KEYMAP[k] === a && keys[k]);
    if (!still) release(a);
  });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in keys) keys[k] = false; });

  /** Hook up the DOM touch controls. Called once the page has loaded. */
  function setupTouch() {
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    const RADIUS = 46;

    const resetStick = () => {
      stick.active = false; stick.id = null; stick.dx = stick.dy = 0;
      base.classList.remove('active');
      base.style.left = ''; base.style.top = '';
      knob.style.transform = 'translate(-50%, -50%)';
    };

    zone.addEventListener('pointerdown', e => {
      e.preventDefault();
      enableTouchMode();
      if (stick.active) return;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      stick.active = true; stick.id = e.pointerId;
      stick.ox = e.clientX; stick.oy = e.clientY;
      base.classList.add('active');
      base.style.left = (e.clientX - r.left) + 'px';
      base.style.top = (e.clientY - r.top) + 'px';
      moveStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => {
      if (!stick.active || e.pointerId !== stick.id) return;
      e.preventDefault();
      moveStick(e.clientX, e.clientY);
    });
    const end = e => { if (e.pointerId === stick.id) resetStick(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);

    function moveStick(x, y) {
      let dx = x - stick.ox, dy = y - stick.oy;
      const len = Math.hypot(dx, dy);
      // let the base follow the thumb if it drags far away
      if (len > RADIUS * 1.6) {
        const k = (len - RADIUS * 1.6) / len;
        stick.ox += dx * k; stick.oy += dy * k;
        const r = zone.getBoundingClientRect();
        base.style.left = (stick.ox - r.left) + 'px';
        base.style.top = (stick.oy - r.top) + 'px';
        dx = x - stick.ox; dy = y - stick.oy;
      }
      const l2 = Math.hypot(dx, dy);
      const cl = Math.min(l2, RADIUS);
      const kx = l2 ? dx / l2 * cl : 0, ky = l2 ? dy / l2 * cl : 0;
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      if (l2 < RADIUS * 0.25) { stick.dx = stick.dy = 0; return; }
      // snap to one of 8 directions
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      stick.dx = Math.round(Math.cos(ang) * 1000) / 1000;
      stick.dy = Math.round(Math.sin(ang) * 1000) / 1000;
    }

    document.querySelectorAll('.tbtn').forEach(btn => {
      const act = btn.dataset.act;
      let pid = null;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        enableTouchMode();
        pid = e.pointerId;
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        btn.classList.add('down');
        if (navigator.vibrate) navigator.vibrate(12);
        press(act);
      });
      const up = e => {
        if (e.pointerId !== pid) return;
        pid = null;
        btn.classList.remove('down');
        release(act);
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    });

    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enableTouchMode();
    window.addEventListener('touchstart', enableTouchMode, { passive: true });
  }

  function enableTouchMode() {
    if (touchMode) return;
    touchMode = true;
    document.body.classList.add('touch');
    window.dispatchEvent(new Event('resize'));
  }

  return {
    setupTouch,
    get touchMode() { return touchMode; },
    get dx() {
      let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x || y) { const l = Math.hypot(x, y); return x / l; }
      return stick.dx;
    },
    get dy() {
      let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x || y) { const l = Math.hypot(x, y); return y / l; }
      return stick.dy;
    },
    pressed(a) { if (fresh[a]) { fresh[a] = false; return true; } return false; },
    held(a) { return !!held[a]; },
    clear() { for (const k in fresh) fresh[k] = false; },
    /** Called on every press (used to start audio and advance menus). */
    onAny(fn) { anyListener = fn; },
    /** Simulate a press from code (used by the dialog box tap). */
    tap(a) { press(a); release(a); },
  };
})();
