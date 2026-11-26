// Skylark staged screenshot scenes, behind ?shot=.
// Each scene sets up one deterministic mid-action moment so the
// screenshots never depend on lucky timing: cover, play and end.
// Deterministic from ?seed= (default 20261126).

var SkyShots = (function () {
  function placePlaneForShot(game, x, z, alt, heading, speed, throttle) {
    var p = game.plane;
    p.x = x;
    p.z = z;
    p.alt = alt;
    p.heading = heading;
    p.speed = speed;
    p.throttle = throttle;
    p.pitch = 0.06;
    p.bank = 0.12;
    p.climb = 12;
    p.onGround = false;
    p.airborne = true;
    p.fuel = 78;
    p.damage = 0;
  }

  function applyShot(game, shot) {
    game.shotMode = true;
    var spots = SkyTerrain.getRingSpots();
    if (shot === 'cover') {
      // Mid-flight chase view: the next ring dead ahead, the runway
      // visible to the left, full HUD. Ring 16 sits 500 units ahead.
      game.state = 'flying';
      game.score = 350;
      game.sortieIndex = 0;
      game.sortieName = SKY.sorties[0].name;
      game.timeLeft = 72;
      game.ringsTotal = 4;
      game.ringsDone = 0;
      game.activeRing = 0;
      game.totalRingsPlanned = 18;
      game.totalRings = 0;
      var coverSpots = [16, 17, 13, 14];
      game.rings = [];
      for (var i = 0; i < coverSpots.length; i++) {
        var sp = spots[coverSpots[i]];
        game.rings.push({ x: sp.x, y: sp.alt, z: sp.z, done: false });
      }
      // Plane south of ring 16, heading north straight at it.
      placePlaneForShot(game, 500, 1500, 300, 0.02, 150, 0.72);
      game.banner = null;
      return;
    }
    if (shot === 'play') {
      // Low pass over the runway on final approach, gear down low.
      game.state = 'flying';
      game.score = 1240;
      game.sortieIndex = 1;
      game.sortieName = SKY.sorties[1].name;
      game.timeLeft = 41;
      game.ringsTotal = 6;
      game.ringsDone = 6;
      game.activeRing = 6;
      game.totalRingsPlanned = 18;
      game.totalRings = 10;
      game.rings = [];
      for (var j = 0; j < 6; j++) {
        game.rings.push({ x: spots[j].x, y: spots[j].alt, z: spots[j].z, done: true });
      }
      // On final, just south of the runway threshold, low and slow.
      placePlaneForShot(game, 30, 1350, 90, 0.02, 95, 0.45);
      game.plane.pitch = -0.06;
      game.plane.climb = -14;
      game.banner = {
        text: 'ALL RINGS DONE - LAND ON THE RUNWAY',
        sub: 'Throttle down, line up with the strip, touch down gently',
        colour: '#7ee787',
        until: 999
      };
      return;
    }
    if (shot === 'end') {
      // Results screen with stars and the final tally.
      game.state = 'results';
      game.score = 2650;
      game.totalRings = 18;
      game.totalRingsPlanned = 18;
      game.sortiesLanded = 3;
      game.plane.fuel = 31;
      game.plane.damage = 8;
      game.plane.x = SKY.runway.x;
      game.plane.z = SKY.runway.z;
      game.plane.alt = 18;
      game.plane.heading = 0;
      game.plane.speed = 0;
      game.plane.throttle = 0;
      game.plane.onGround = true;
      game.plane.airborne = false;
      game.ringsTotal = 8;
      game.ringsDone = 8;
      game.activeRing = 8;
      game.rings = [];
      return;
    }
    // Unknown shot name: fall back to the cover scene.
    applyShot(game, 'cover');
  }

  return {
    applyShot: applyShot
  };
})();
