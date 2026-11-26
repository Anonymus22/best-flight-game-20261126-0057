// Skylark missions: sorties, rings, scoring, landings and endings.
// A sortie is a ring run plus a landing. Three sorties make a flight.
// The mission module owns the rules; main.js owns the frame loop.

var SkyMissions = (function () {
  function startSortie(game, index) {
    var def = SKY.sorties[index];
    game.sortieIndex = index;
    game.sortieName = def.name;
    game.timeLeft = def.timeLimit;
    game.ringsTotal = def.rings;
    game.ringsDone = 0;
    game.activeRing = 0;
    game.sortieDamageStart = game.plane.damage;
    // Wind blows across the islands, stronger on later sorties.
    var windAngle = 0.6 + index * 0.5;
    game.wind = {
      x: Math.sin(windAngle) * def.wind,
      z: Math.cos(windAngle) * def.wind
    };
    // Rings for this sortie: the first N spots, in order.
    var spots = SkyTerrain.getRingSpots();
    game.rings = [];
    for (var i = 0; i < def.rings; i++) {
      game.rings.push({
        x: spots[i].x,
        y: spots[i].alt,
        z: spots[i].z,
        done: false
      });
    }
    SkyPlane.resetToRunway(game.plane);
    game.plane.fuel = def.fuel;
    game.state = 'flying';
    game.banner = {
      text: def.name,
      sub: 'Fly the rings in order, then land on the runway - ' + def.rings + ' rings, ' + def.timeLimit + ' seconds',
      colour: '#ffd34d',
      until: 3.2
    };
  }

  function ringDistance(p, ring) {
    var dx = p.x - ring.x;
    var dy = p.alt - ring.y;
    var dz = p.z - ring.z;
    return Math.sqrt(dx * dx + dy * dy * 0.25 + dz * dz);
  }

  function checkRings(game) {
    if (game.activeRing >= game.rings.length) return;
    var ring = game.rings[game.activeRing];
    var p = game.plane;
    if (!p.airborne) return;
    var d = ringDistance(p, ring);
    if (d < SKY.ringRadius) {
      ring.done = true;
      game.ringsDone++;
      game.activeRing++;
      var clean = Math.abs(p.alt - ring.y) < 45;
      var pts = SKY.scoreRing + (clean ? SKY.scoreRingAltitudeBonus : 0);
      game.score += pts;
      p.fuel = Math.min(100, p.fuel + SKY.fuelRingBonus);
      SkyAudio.ringChime();
      SkyRender.spawnBurst(ring.x, ring.y, ring.z, '#ffc93c');
      SkyRender.addFloater('+' + pts + '  RING ' + game.ringsDone, ring.x, ring.y, ring.z, '#ffd34d');
      if (game.activeRing >= game.rings.length) {
        game.banner = {
          text: 'ALL RINGS DONE - LAND ON THE RUNWAY',
          sub: 'Throttle down, line up with the strip, touch down gently',
          colour: '#7ee787',
          until: 4
        };
      }
    }
  }

  function onRunway(p) {
    var r = SKY.runway;
    var dx = Math.abs(p.x - r.x);
    var dz = Math.abs(p.z - r.z);
    return dx < r.width / 2 + 10 && dz < r.length / 2 + 10;
  }

  function checkLanding(game) {
    var p = game.plane;
    if (!p.airborne) return null;
    // Wheels touch the ground at this frame.
    var vSpeed = p.climb;
    var ground = SkyTerrain.terrainHeight(p.x, p.z);
    if (ground < 0) {
      // Ditching in the sea at speed is a crash.
      return 'sea';
    }
    if (!onRunway(p)) {
      // Off-runway landing on rough ground: survivable only if gentle.
      if (vSpeed < -28 || p.speed > 150) return 'rough';
      return 'rough-soft';
    }
    var result = SkyPlane.touchdown(p, vSpeed);
    return result;
  }

  function finishSortie(game, landing) {
    var p = game.plane;
    var soft = landing === 'landed';
    var pts = SKY.scoreLanding + (soft ? SKY.scoreLandingSoftBonus : 0);
    pts += Math.round(game.timeLeft) * SKY.scoreTimeBonusPerSecond;
    if (p.damage <= game.sortieDamageStart) pts += SKY.scorePerfectSortie;
    game.score += pts;
    game.sortiesLanded++;
    SkyAudio.thud();
    game.banner = {
      text: soft ? 'SORTIE COMPLETE - BEAUTIFUL LANDING' : 'SORTIE COMPLETE - ROUGH BUT DOWN',
      sub: '+' + pts + ' points - fuel topped up for the next sortie',
      colour: '#7ee787',
      until: 4
    };
    if (game.sortieIndex + 1 < SKY.sorties.length) {
      game.state = 'between';
      game.betweenTimer = 4;
    } else {
      game.state = 'results';
      SkyAudio.fanfare();
    }
  }

  function crash(game, title, text) {
    game.state = 'crashed';
    game.crashTitle = title;
    game.crashText = text;
    SkyAudio.crash();
  }

  function update(game, dt) {
    var p = game.plane;
    if (game.state !== 'flying') return;

    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      crash(game, 'OUT OF TIME', 'The sortie clock ran out over the islands. The Skylark is down.');
      return;
    }
    if (p.fuel <= 0 && p.onGround && !p.airborne) {
      crash(game, 'OUT OF FUEL', 'The tanks ran dry on the ground. The Skylark never made it home.');
      return;
    }

    checkRings(game);

    // Ground contact: wheels touch when altitude reaches the terrain
    // (sea level over water). highestAlt guards the liftoff frame.
    var groundHere = SkyTerrain.terrainHeight(p.x, p.z);
    var contactAlt = Math.max(groundHere, 0) + 0.5;
    if (p.alt <= contactAlt && p.airborne && p.highestAlt > 60) {
      var landing = checkLanding(game);
      if (landing === 'sea') {
        crash(game, 'DITCHED IN THE SEA', 'The Skylark went down in the water. Ring the bell for the rescue boat.');
        return;
      }
      if (landing === 'rough') {
        var destroyed = SkyPlane.addDamage(p, SKY.damageRoughLanding);
        if (destroyed) {
          crash(game, 'CRASHED ON THE HILLS', 'A hard hit on rough ground broke the Skylark apart.');
          return;
        }
        p.alt = Math.max(SkyTerrain.terrainHeight(p.x, p.z), 0);
        p.onGround = true;
        p.airborne = false;
        p.climb = 0;
        game.banner = { text: 'OFF-RUNWAY LANDING - THE PLANE IS HURT', sub: 'Taxi back is impossible: this sortie is over', colour: '#ff6b5e', until: 3 };
        game.state = 'results';
        return;
      }
      if (landing === 'rough-soft') {
        SkyPlane.addDamage(p, SKY.damageHardLanding);
        p.alt = Math.max(SkyTerrain.terrainHeight(p.x, p.z), 0);
        p.onGround = true;
        p.airborne = false;
        p.climb = 0;
        game.banner = { text: 'ROUGH FIELD LANDING', sub: 'The Skylark is down in the grass - sortie over', colour: '#ffb454', until: 3 };
        game.state = 'results';
        return;
      }
      if (landing === 'crashed') {
        crash(game, 'CRASHED ON LANDING', 'Too fast, too steep. The runway is not forgiving.');
        return;
      }
      if (landing === 'hard') {
        SkyPlane.addDamage(p, SKY.damageHardLanding);
        SkyAudio.thud();
        game.banner = { text: 'HARD LANDING - ' + SKY.damageHardLanding + '% DAMAGE', sub: 'The Skylark held together. Sortie complete.', colour: '#ffb454', until: 3 };
        finishSortie(game, 'hard');
        return;
      }
      if (landing === 'landed') {
        finishSortie(game, 'landed');
        return;
      }
    }

    // Terrain strike while flying low over a hill.
    if (p.airborne) {
      var ground = SkyTerrain.terrainHeight(p.x, p.z);
      if (p.alt < ground) {
        crash(game, 'FLEW INTO THE HILLS', 'The Skylark clipped a hilltop at ' + Math.round(p.alt) + ' feet.');
        return;
      }
    }

    // Damage from earlier hard landings can end the flight.
    if (p.damage >= SKY.damageMax) {
      crash(game, 'AIRFRAME FAILURE', 'Too much damage. The Skylark gave up in the air.');
    }
  }

  return {
    startSortie: startSortie,
    update: update,
    onRunway: onRunway,
    finishSortie: finishSortie,
    crash: crash
  };
})();
