// Skylark input: keyboard (arrows / WASD, throttle, mute, restart)
// and mouse (drag sideways to steer, click buttons on menus).
// One shared state object; the flight model reads it every frame.

var SkyInput = (function () {
  var keys = {};
  var state = {
    pitchUp: false,
    pitchDown: false,
    turnLeft: false,
    turnRight: false,
    throttleUp: false,
    throttleDown: false,
    mouseSteer: 0
  };
  var dragStartX = null;
  var dragSteer = 0;
  var pressed = {};   // edge-triggered keys, consumed by main.js

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    refresh();
  }

  function onKeyUp(e) {
    keys[e.code] = false;
    refresh();
  }

  function refresh() {
    state.pitchUp = !!(keys['ArrowUp'] || keys['KeyW']);
    state.pitchDown = !!(keys['ArrowDown'] || keys['KeyS']);
    state.turnLeft = !!(keys['ArrowLeft'] || keys['KeyA']);
    state.turnRight = !!(keys['ArrowRight'] || keys['KeyD']);
    state.throttleUp = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
    state.throttleDown = !!(keys['ControlLeft'] || keys['ControlRight']);
    state.mouseSteer = dragSteer;
  }

  function wasPressed(code) {
    if (pressed[code]) {
      pressed[code] = false;
      return true;
    }
    return false;
  }

  function clearPressed() {
    for (var k in pressed) pressed[k] = false;
  }

  function onMouseDown(e) {
    dragStartX = e.clientX;
    dragSteer = 0;
    refresh();
  }

  function onMouseMove(e) {
    if (dragStartX === null) return;
    var dx = e.clientX - dragStartX;
    dragSteer = Math.max(-1, Math.min(1, dx / 160));
    refresh();
  }

  function onMouseUp() {
    dragStartX = null;
    dragSteer = 0;
    refresh();
  }

  function attach(canvas) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    // First interaction wakes the audio engine (browsers require it).
    var wake = function () { SkyAudio.startEngine(); };
    window.addEventListener('keydown', wake, { once: true });
    canvas.addEventListener('mousedown', wake, { once: true });
  }

  // Scripted input for the autotest harness: the patch is the whole
  // key state for this frame, so stale keys never stick.
  function setTestInput(patch) {
    for (var k in keys) keys[k] = false;
    for (var k in patch) keys[k] = patch[k];
    refresh();
  }

  // Scripted proportional steering for the autotest harness:
  // -1 is full left bank, +1 full right bank.
  function setTestSteer(value) {
    dragSteer = Math.max(-1, Math.min(1, value));
    refresh();
  }

  return {
    state: state,
    attach: attach,
    wasPressed: wasPressed,
    clearPressed: clearPressed,
    setTestInput: setTestInput,
    setTestSteer: setTestSteer
  };
})();
