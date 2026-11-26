// Skylark main loop: title -> flying -> landed/crashed -> results.
// Owns the canvas, the clock, the game state object and the frame
// pipeline: input -> flight model -> missions -> render -> HUD.
// Also owns the ?autotest=1 scripted flight used by the playtest.

var SkyMain = (function () {
  var canvas = null;
  var ctx = null;
  var game = null;
  var lastTime = 0;
  var elapsed = 0;
  var autotest = null;

  function newGame() {
    return {
      state: 'title',
      score: 0,
      sortieIndex: 0,
      sortieName: '',
      timeLeft: 0,
      rings: [],
      ringsTotal: 0,
      ringsDone: 0,
      activeRing: 0,
      totalRings: 0,
      totalRingsPlanned: 0,
      sortiesLanded: 0,
      sortieDamageStart: 0,
      wind: { x: 0, z: 0 },
      plane: SkyPlane.createPlane(),
      banner: null,
      betweenTimer: 0,
      crashTitle: '',
      crashText: '',
      seed: 20261126
    };
  }

  function params() {
    var out = {};
    var q = window.location.search.replace(/^\?/, '');
    if (!q) return out;
    var pairs = q.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (kv.length === 2) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    }
    return out;
  }

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    canvas.width = SKY.canvasWidth;
    canvas.height = SKY.canvasHeight;
    game = newGame();
    SkyInput.attach(canvas);
    var p = params();
    var seed = parseInt(p.seed || '20261126', 10);
    if (!isNaN(seed)) {
      game.seed = seed;
      SkyTerrain.buildWorld(seed);
    }
    game.totalRingsPlanned = SKY.sorties[0].rings + SKY.sorties[1].rings + SKY.sorties[2].rings;
    if (p.shot) {
      SkyShots.applyShot(game, p.shot);
    } else if (p.autotest) {
      startAutotest();
    }
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function startAutotest() {
    autotest = {
      log: [],
      phase: 'takeoff',
      sortie: 0,
      landStage: 1,
      t: 0,
      passed: true,
      done: false
    };
    game.state = 'flying';
    SkyMissions.startSortie(game, 0);
    game.state = 'flying';
    autotest.log.push('AUTOTEST start sortie 1');
  }

  function autotestStep(dt) {
    if (!autotest || autotest.done) return;
    var p = game.plane;
    autotest.t += dt;
    // A fresh sortie starts the script over at takeoff.
    if (game.sortieIndex !== autotest.sortie) {
      autotest.sortie = game.sortieIndex;
      autotest.phase = 'takeoff';
      autotest.landStage = 1;
      autotest.log.push('AUTOTEST start sortie ' + (game.sortieIndex + 1));
    }
    // All rings flown: switch to the landing phase, whatever the
    // current target pointer says (it is past the end of the list now).
    if (autotest.phase === 'rings' && game.ringsDone >= game.ringsTotal) {
      autotest.phase = 'land';
      autotest.log.push('AUTOTEST rings ok score=' + game.score);
    }
    var input = SkyInput.state;
    var target = null;
    if (game.activeRing < game.rings.length) {
      target = game.rings[game.activeRing];
    }
    if (autotest.phase === 'takeoff') {
      SkyInput.setTestInput({ ShiftLeft: true, ArrowUp: true });
      if (p.alt > 120) {
        autotest.phase = 'rings';
        autotest.log.push('AUTOTEST takeoff ok alt=' + Math.round(p.alt));
      }
    } else if (autotest.phase === 'rings' && target) {
      // Steer toward the ring: bank in proportion to the heading error
      // and ease off the throttle when close, so the turn stays tight.
      var dx = target.x - p.x;
      var dz = target.z - p.z;
      var wantHeading = Math.atan2(dx, -dz);
      var diff = wantHeading - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      SkyInput.setTestSteer(Math.max(-1, Math.min(1, diff * 1.6)));
      var keys = {};
      var distToRing = Math.sqrt(dx * dx + dz * dz);
      if (distToRing > 600 && p.throttle < 0.9) keys['ShiftLeft'] = true;
      if (distToRing < 350 && p.throttle > 0.45) keys['ControlLeft'] = true;
      var altDiff = target.y - p.alt;
      if (altDiff > 40) keys['ArrowUp'] = true;
      if (altDiff < -40) keys['ArrowDown'] = true;
      // Safety floor: never dive when low over the sea.
      if (p.alt < 120) {
        keys['ArrowUp'] = true;
        delete keys['ArrowDown'];
      }
      // Terrain clearance: climb over any hill ahead of the nose.
      var aheadX = p.x + Math.sin(p.heading) * 160;
      var aheadZ = p.z - Math.cos(p.heading) * 160;
      var groundAhead = SkyTerrain.terrainHeight(aheadX, aheadZ);
      if (p.alt < groundAhead + 80) {
        keys['ArrowUp'] = true;
        delete keys['ArrowDown'];
      }
      SkyInput.setTestInput(keys);
      if (game.ringsDone >= game.ringsTotal) {
        autotest.phase = 'land';
        autotest.log.push('AUTOTEST rings ok score=' + game.score);
      }
    } else if (autotest.phase === 'land') {
      // Straight-in landing: if the plane is already lined up with the
      // runway and flying toward it, skip the turn to the fix - the fix
      // detour costs a 180 degree turn and leaves no room to re-centre.
      if (autotest.landStage === 1) {
        var aligned = false;
        var dhN = Math.PI - p.heading;
        while (dhN > Math.PI) dhN -= Math.PI * 2;
        while (dhN < -Math.PI) dhN += Math.PI * 2;
        var dhS = 0 - p.heading;
        while (dhS > Math.PI) dhS -= Math.PI * 2;
        while (dhS < -Math.PI) dhS += Math.PI * 2;
        if (autotest.fromNorth) {
          aligned = Math.abs(dhN) < 0.6 &&
            Math.abs(p.x) < 260 && p.z < 590;
        } else {
          aligned = Math.abs(dhS) < 0.6 &&
            Math.abs(p.x) < 260 && p.z > 1210;
        }
        if (aligned) autotest.landStage = 2;
      }
      // Steer back to the runway and descend gently. Two stages:
      // first line up on the runway axis at the north fix, then fly
      // down the strip itself, so the final approach is straight.
      var r = SKY.runway;
      var distRunway = Math.sqrt((r.x - p.x) * (r.x - p.x) + (r.z - p.z) * (r.z - p.z));
      // Aim past the far threshold in the direction of travel, so the
      // plane flies down the strip instead of turning back at its centre.
      var fromNorth = p.z < r.z;
      // The fix: a point on the runway axis well beyond the near
      // threshold, kept inside the charted sea. Reaching it switches
      // the approach from lining up to flying down the strip.
      var fixZ = fromNorth ? r.z - r.length / 2 - 1200 : r.z + r.length / 2 + 1200;
      fixZ = Math.max(-1900, Math.min(1900, fixZ));
      var distFix = Math.sqrt((r.x - p.x) * (r.x - p.x) + (fixZ - p.z) * (fixZ - p.z));
      if (autotest.landStage === 1 && distFix < 350) autotest.landStage = 2;
      // On final, chase a point on the centreline just ahead of the
      // plane instead of the far end of the strip: a distant aim gives
      // a tiny heading error and almost no lateral correction, while a
      // near point banks the plane hard toward the centreline.
      var aimX = r.x;
      var aimZ = fixZ;
      if (autotest.landStage === 2) {
        aimZ = fromNorth ? p.z + 300 : p.z - 300;
      }
      var dx2 = aimX - p.x;
      var dz2 = aimZ - p.z;
      // Wind correction, on final only: the wind pushes the ground
      // track sideways, so aim upwind of the point by the drift
      // expected on the way there. Lining up at the fix needs no
      // such precision, and a moving aim there only bends the turn.
      if (autotest.landStage === 2) {
        var distAim = Math.sqrt(dx2 * dx2 + dz2 * dz2);
        var timeToAim = distAim / Math.max(60, p.speed);
        dx2 -= game.wind.x * timeToAim;
        dz2 -= game.wind.z * timeToAim;
      }
      var want2 = Math.atan2(dx2, -dz2);
      var diff2 = want2 - p.heading;
      while (diff2 > Math.PI) diff2 -= Math.PI * 2;
      while (diff2 < -Math.PI) diff2 += Math.PI * 2;
      SkyInput.setTestSteer(Math.max(-1, Math.min(1, diff2 * 1.6)));
      var keys2 = {};
      // Descent profile, anchored on a touchdown point on the strip
      // (not the runway centre, which the plane flies past): come down
      // to wheels height as that point draws near, and bleed speed off
      // on final so the touchdown is slow enough to count.
      var tdZ = fromNorth ? 1000 : 800;
      var distTd = Math.sqrt((r.x - p.x) * (r.x - p.x) + (tdZ - p.z) * (tdZ - p.z));
      var wantAlt = Math.max(18, Math.min(320, distTd * 0.30));
      // Speed schedule: the whole landing is flown at approach speed,
      // so the plane can track the centreline and get down in time.
      // Lining up at the fix is flown a touch faster to get there.
      var thrTarget = autotest.landStage === 1 ? 0.45 : 0.35;
      if (p.throttle < thrTarget - 0.05) keys2['ShiftLeft'] = true;
      if (p.throttle > thrTarget + 0.05) keys2['ControlLeft'] = true;
      if (p.alt < wantAlt - 8) keys2['ArrowUp'] = true;
      if (p.alt > wantAlt + 8) keys2['ArrowDown'] = true;
      // On short final, keep descending to the strip: the deadband
      // above would otherwise level the plane off just above it.
      if (distTd < 250 && p.alt > 25) keys2['ArrowDown'] = true;
      if (distTd < 60) keys2['ArrowDown'] = true;
      // Terrain clearance on the way home, but not on short final:
      // the runway strip itself is flat ground.
      if (distRunway > 400) {
        var aheadX2 = p.x + Math.sin(p.heading) * 160;
        var aheadZ2 = p.z - Math.cos(p.heading) * 160;
        var groundAhead2 = SkyTerrain.terrainHeight(aheadX2, aheadZ2);
        if (p.alt < groundAhead2 + 80) {
          keys2['ArrowUp'] = true;
          delete keys2['ArrowDown'];
        }
      }
      SkyInput.setTestInput(keys2);
      if (game.state === 'results') {
        if (game.sortiesLanded === 3) {
          autotest.log.push('AUTOTEST landing ok state=' + game.state + ' score=' + game.score);
          finishAutotest(true, 'happy path complete, score=' + game.score);
        } else {
          finishAutotest(false, 'flight ended early, sorties landed=' + game.sortiesLanded);
        }
        return;
      }
    }
    if (game.state === 'crashed') {
      autotest.log.push('AUTOTEST crash: ' + game.crashTitle);
      finishAutotest(false, 'crashed during ' + autotest.phase);
      return;
    }
    if (autotest.t > 300) {
      finishAutotest(false, 'timeout in phase ' + autotest.phase);
    }
  }

  function finishAutotest(passed, note) {
    autotest.done = true;
    autotest.passed = passed;
    autotest.log.push('AUTOTEST ' + (passed ? 'PASS' : 'FAIL') + ' - ' + note);
    for (var i = 0; i < autotest.log.length; i++) console.log(autotest.log[i]);
    document.title = 'AUTOTEST ' + (passed ? 'PASS' : 'FAIL') + ' - ' + note;
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;
    step(dt);
    requestAnimationFrame(frame);
  }

  function step(dt) {
    // Global keys.
    if (SkyInput.wasPressed('KeyM')) {
      var muted = SkyAudio.toggleMute();
      game.banner = { text: muted ? 'SOUND OFF' : 'SOUND ON', sub: '', colour: '#ffffff', until: 1.2 };
    }
    if (SkyInput.wasPressed('KeyR')) {
      if (game.state === 'results' || game.state === 'crashed' || game.state === 'title') {
        restart();
      }
    }
    if (SkyInput.wasPressed('Enter')) {
      if (game.state === 'title') {
        SkyAudio.startEngine();
        SkyAudio.click();
        SkyMissions.startSortie(game, 0);
      }
    }
    if (game.banner && game.banner.until !== undefined) {
      game.banner.until -= dt;
      if (game.banner.until <= 0) game.banner = null;
    }

    if (game.state === 'flying' && !game.shotMode) {
      SkyPlane.update(game.plane, SkyInput.state, game.wind, dt);
      SkyMissions.update(game, dt);
      autotestStep(dt);
    } else if (game.state === 'between') {
      game.betweenTimer -= dt;
      SkyPlane.update(game.plane, { throttleUp: false, throttleDown: true, pitchUp: false, pitchDown: false, turnLeft: false, turnRight: false, mouseSteer: 0 }, game.wind, dt);
      if (game.betweenTimer <= 0) {
        SkyMissions.startSortie(game, game.sortieIndex + 1);
      }
    } else if (game.state === 'title') {
      // Idle orbit on the title screen: the plane sits on the runway.
      game.plane.throttle = 0;
    }

    // Engine sound follows the throttle while flying.
    SkyAudio.setEngine(game.plane.throttle, game.plane.speed, game.state === 'flying');

    // Draw.
    ctx.clearRect(0, 0, SKY.canvasWidth, SKY.canvasHeight);
    var rings = (game.state === 'title') ? demoRings() : game.rings;
    var active = (game.state === 'title') ? 0 : game.activeRing;
    SkyRender.drawWorld(ctx, game.plane, rings, active, elapsed, dt);
    SkyRender.drawPlane(ctx, game.plane, elapsed);
    SkyHud.drawHud(ctx, game);
  }

  function demoRings() {
    var spots = SkyTerrain.getRingSpots();
    var out = [];
    for (var i = 0; i < 4; i++) {
      out.push({ x: spots[i].x, y: spots[i].alt, z: spots[i].z, done: false });
    }
    return out;
  }

  function restart() {
    var keepSeed = game.seed;
    game = newGame();
    game.seed = keepSeed;
    SkyTerrain.buildWorld(keepSeed);
    game.totalRingsPlanned = SKY.sorties[0].rings + SKY.sorties[1].rings + SKY.sorties[2].rings;
    SkyAudio.click();
  }

  function getGame() { return game; }
  function getAutotest() { return autotest; }

  return {
    init: init,
    getGame: getGame,
    getAutotest: getAutotest
  };
})();

window.addEventListener('load', function () { SkyMain.init(); });
