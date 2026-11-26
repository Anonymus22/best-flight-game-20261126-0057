// Skylark flight model: throttle, pitch, turn, altitude, speed,
// heading, fuel and damage. Arcade-simple but honest: speed follows
// throttle, the nose follows pitch only while the wings have lift,
// turns bank the plane, and the wind pushes it sideways.

var SkyPlane = (function () {
  function createPlane() {
    return {
      x: SKY.runway.x,
      z: SKY.runway.z + SKY.runway.length / 2 - 40,
      alt: 18,                   // feet above sea level: the runway sits at 18 ft
      heading: 0,                // radians, 0 = north (-z)
      speed: 0,                  // world units per second
      throttle: 0,               // 0..1
      pitch: 0,                  // radians, + = nose up
      bank: 0,                   // radians, + = right
      climb: 0,                  // feet per second
      fuel: SKY.fuelStart,
      damage: 0,
      onGround: true,
      airborne: false,
      highestAlt: 0,           // highest altitude since takeoff; guards the landing check
      grounded: false           // set true the moment wheels touch down
    };
  }

  function update(p, input, wind, dt) {
    // Throttle keys.
    if (input.throttleUp) p.throttle = Math.min(1, p.throttle + SKY.throttleStep * dt);
    if (input.throttleDown) p.throttle = Math.max(0, p.throttle - SKY.throttleStep * dt);

    // Target speed follows the throttle; the plane chases it.
    // On the ground the wheels brake: no throttle means rolling to a stop.
    var targetSpeed = SKY.minSpeed + p.throttle * (SKY.maxSpeed - SKY.minSpeed);
    if (p.onGround) targetSpeed = p.throttle * SKY.maxSpeed;
    p.speed += (targetSpeed - p.speed) * Math.min(1, SKY.drag * dt);

    // Pitch and bank chase the stick, with smoothing.
    var pitchTarget = 0;
    if (input.pitchUp) pitchTarget = SKY.pitchMax;
    if (input.pitchDown) pitchTarget = -SKY.pitchMax * 0.9;
    p.pitch += (pitchTarget - p.pitch) * Math.min(1, 5 * dt);

    var bankTarget = 0;
    if (input.turnLeft) bankTarget = -SKY.bankMax;
    if (input.turnRight) bankTarget = SKY.bankMax;
    // Mouse steering: drag sideways banks the plane.
    if (input.mouseSteer !== 0) bankTarget = input.mouseSteer * SKY.bankMax;
    p.bank += (bankTarget - p.bank) * Math.min(1, 4 * dt);

    // Heading follows the bank: a right bank (positive) turns the nose
    // east of north, so the heading grows; faster planes turn wider.
    var turn = p.bank * SKY.turnRate * Math.min(1, p.speed / 120);
    p.heading += turn * dt;

    // Climb: pitch turns speed into altitude while there is lift.
    // Capped so the Skylark climbs and dives like a bush plane, not a jet.
    var stalled = p.speed < SKY.stallSpeed && !p.onGround;
    var climbTarget = p.pitch * p.speed * SKY.climbRate * 1.6;
    if (climbTarget > 90) climbTarget = 90;
    if (climbTarget < -90) climbTarget = -90;
    if (stalled) climbTarget = -SKY.gravitySink;
    if (p.onGround) {
      climbTarget = 0;
      if (p.speed >= SKY.takeoffSpeed && p.pitch > 0.08) {
        p.onGround = false;
        p.airborne = true;
      }
    }
    p.climb += (climbTarget - p.climb) * Math.min(1, 4 * dt);
    p.alt += p.climb * dt;
    if (p.alt < 0) p.alt = 0;
    if (p.airborne) p.highestAlt = Math.max(p.highestAlt, p.alt);
    // Rolling on the ground, the wheels follow the terrain.
    if (p.onGround) p.alt = Math.max(SkyTerrain.terrainHeight(p.x, p.z), 0);

    // Move over the ground. Wind pushes the plane sideways.
    var sinH = Math.sin(p.heading);
    var cosH = Math.cos(p.heading);
    p.x += sinH * p.speed * dt + wind.x * dt;
    p.z += -cosH * p.speed * dt + wind.z * dt;

    // Keep the plane inside the charted sea.
    var half = SKY.worldSize / 2 - 120;
    if (p.x < -half) p.x = -half;
    if (p.x > half) p.x = half;
    if (p.z < -half) p.z = -half;
    if (p.z > half) p.z = half;

    // Fuel burns with the throttle.
    if (p.fuel > 0) {
      p.fuel -= SKY.fuelBurn * p.throttle * dt;
      if (p.fuel < 0) p.fuel = 0;
    }
    // No fuel: the engine quits and the nose drops.
    if (p.fuel <= 0 && p.throttle > 0) {
      p.throttle = 0;
      if (!p.onGround) p.climb = -SKY.gravitySink;
    }

    p.grounded = false;
  }

  // Called when the wheels touch. Returns 'landed', 'hard' or 'crashed'.
  function touchdown(p, verticalSpeed) {
    p.onGround = true;
    p.alt = Math.max(SkyTerrain.terrainHeight(p.x, p.z), 0);
    p.climb = 0;
    p.pitch = 0;
    p.grounded = true;
    if (verticalSpeed < -55) return 'crashed';
    if (verticalSpeed < -28) return 'hard';
    return 'landed';
  }

  function addDamage(p, amount) {
    p.damage = Math.min(SKY.damageMax, p.damage + amount);
    return p.damage >= SKY.damageMax;
  }

  function resetToRunway(p) {
    var fresh = createPlane();
    for (var k in fresh) p[k] = fresh[k];
  }

  return {
    createPlane: createPlane,
    update: update,
    touchdown: touchdown,
    addDamage: addDamage,
    resetToRunway: resetToRunway
  };
})();
