const gameInput = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, firing: false };
window.gameInput = gameInput;

(function () {
  const left = document.getElementById('left-control');
  const right = document.getElementById('right-control');
  const fireBtn = document.getElementById('fire-btn');
  const MAX = 50; // joystick radius in px

  let moveId = null, moveStart = null;
  let lookId = null, lookLast = null;

  // Left zone: virtual joystick
  left.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    moveId = t.identifier;
    moveStart = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });

  left.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== moveId) continue;
      let dx = t.clientX - moveStart.x, dy = t.clientY - moveStart.y;
      const d = Math.hypot(dx, dy);
      if (d > MAX) { dx = dx / d * MAX; dy = dy / d * MAX; }
      gameInput.moveX = dx / MAX;
      gameInput.moveY = dy / MAX;
    }
    e.preventDefault();
  }, { passive: false });

  const endMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        moveId = null; gameInput.moveX = 0; gameInput.moveY = 0;
      }
    }
  };
  left.addEventListener('touchend', endMove);
  left.addEventListener('touchcancel', endMove);

  // Right zone: look/aim
  right.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookId = t.identifier;
    lookLast = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });

  right.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      gameInput.lookDX += t.clientX - lookLast.x;
      gameInput.lookDY += t.clientY - lookLast.y;
      lookLast = { x: t.clientX, y: t.clientY };
    }
    e.preventDefault();
  }, { passive: false });

  const endLook = (e) => {
    for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
  };
  right.addEventListener('touchend', endLook);
  right.addEventListener('touchcancel', endLook);

  // Fire button
  fireBtn.addEventListener('touchstart', (e) => { gameInput.firing = true; e.preventDefault(); }, { passive: false });
  fireBtn.addEventListener('touchend', () => { gameInput.firing = false; });
  fireBtn.addEventListener('touchcancel', () => { gameInput.firing = false; });

  // Desktop fallback for testing: WASD + drag mouse to look + click to fire
  const keys = {};
  const updateKeys = () => {
    gameInput.moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    gameInput.moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  };
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; updateKeys(); });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; updateKeys(); });

  let dragging = false;
  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) dragging = true; else gameInput.firing = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; gameInput.firing = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    gameInput.lookDX += e.movementX;
    gameInput.lookDY += e.movementY;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
})();