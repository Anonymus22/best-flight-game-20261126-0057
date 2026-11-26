// Kepulauan Cahaya: procedural island terrain for the Skylark.
// Islands are seeded polygons with sandy beaches, green hills and
// palm clusters. The runway sits on the big home island. Rings are
// placed around the islands at staged altitudes. Everything is
// deterministic from a seed, so a screenshot scene replays exactly.

var SkyTerrain = (function () {
  var seed = 20261126;
  var islands = [];
  var hills = [];
  var palms = [];
  var clouds = [];
  var ringSpots = [];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeIsland(rng, cx, cz, radius, points) {
    var pts = [];
    for (var i = 0; i < points; i++) {
      var a = (i / points) * Math.PI * 2;
      var r = radius * (0.72 + rng() * 0.55);
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r * 0.8 });
    }
    return { cx: cx, cz: cz, radius: radius, pts: pts };
  }

  function buildWorld(seedValue) {
    seed = seedValue;
    var rng = mulberry32(seed);
    islands = [];
    hills = [];
    palms = [];
    clouds = [];
    ringSpots = [];

    // Home island with the runway, then a chain of smaller islands.
    islands.push(makeIsland(rng, 0, 900, 720, 14));
    islands.push(makeIsland(rng, -1150, -350, 520, 12));
    islands.push(makeIsland(rng, 1250, -700, 470, 12));
    islands.push(makeIsland(rng, -300, -1500, 430, 11));
    islands.push(makeIsland(rng, 1500, 950, 380, 10));
    islands.push(makeIsland(rng, -1750, 1100, 330, 10));
    islands.push(makeIsland(rng, 600, 1750, 300, 9));
    islands.push(makeIsland(rng, -900, 1900, 260, 9));

    // Hills: soft bumps inside islands, each with a height in feet.
    for (var i = 0; i < islands.length; i++) {
      var isl = islands[i];
      var n = 3 + Math.floor(rng() * 3);
      for (var h = 0; h < n; h++) {
        var ang = rng() * Math.PI * 2;
        var dist = rng() * isl.radius * 0.55;
        hills.push({
          x: isl.cx + Math.cos(ang) * dist,
          z: isl.cz + Math.sin(ang) * dist * 0.8,
          r: 90 + rng() * 150,
          h: 120 + rng() * 260
        });
      }
    }

    // Palm clusters near beaches.
    for (var p = 0; p < 90; p++) {
      var isl2 = islands[Math.floor(rng() * islands.length)];
      var a2 = rng() * Math.PI * 2;
      var d2 = isl2.radius * (0.55 + rng() * 0.35);
      palms.push({
        x: isl2.cx + Math.cos(a2) * d2,
        z: isl2.cz + Math.sin(a2) * d2 * 0.8,
        s: 0.7 + rng() * 0.6
      });
    }

    // Drifting clouds, high above the sea.
    for (var c = 0; c < 26; c++) {
      clouds.push({
        x: (rng() - 0.5) * SKY.worldSize,
        z: (rng() - 0.5) * SKY.worldSize,
        y: 900 + rng() * 500,
        r: 90 + rng() * 160,
        drift: 4 + rng() * 8
      });
    }

    // Ring spots: one ring per sortie step, strung around the islands.
    var ringDefs = [
      { x: -650, z: 300, alt: 260 }, { x: -1150, z: -350, alt: 320 },
      { x: -300, z: -1100, alt: 380 }, { x: 700, z: -950, alt: 300 },
      { x: 1250, z: -700, alt: 360 }, { x: 1500, z: 400, alt: 280 },
      { x: 900, z: 1400, alt: 340 }, { x: 100, z: 1750, alt: 300 },
      { x: -900, z: 1700, alt: 420 }, { x: -1750, z: 1100, alt: 380 },
      { x: -1500, z: 200, alt: 300 }, { x: -500, z: -1600, alt: 460 },
      { x: 300, z: -400, alt: 240 }, { x: 1600, z: -200, alt: 400 },
      { x: 1200, z: 1500, alt: 330 }, { x: -300, z: 600, alt: 260 },
      { x: 500, z: 1000, alt: 290 }, { x: -1100, z: 900, alt: 350 }
    ];
    for (var r = 0; r < ringDefs.length; r++) ringSpots.push(ringDefs[r]);
  }

  function insideIsland(x, z, isl) {
    // Cheap point-in-polygon test for one island.
    var pts = isl.pts;
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, zi = pts[i].z;
      var xj = pts[j].x, zj = pts[j].z;
      var cross = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi);
      if (cross) inside = !inside;
    }
    return inside;
  }

  function terrainHeight(x, z) {
    // The runway strip is graded flat at 18 feet, whatever the hills do.
    var r = SKY.runway;
    if (Math.abs(x - r.x) < r.width / 2 + 24 && Math.abs(z - r.z) < r.length / 2 + 24) return 18;
    // Sea is -40 (below water). Land rises from the beach to the hills.
    var h = -40;
    for (var i = 0; i < islands.length; i++) {
      if (insideIsland(x, z, islands[i])) {
        h = Math.max(h, 18);
        break;
      }
    }
    for (var k = 0; k < hills.length; k++) {
      var hill = hills[k];
      var dx = x - hill.x, dz = z - hill.z;
      var d2 = dx * dx + dz * dz;
      var r2 = hill.r * hill.r;
      if (d2 < r2) {
        var fall = 1 - d2 / r2;
        h = Math.max(h, 18 + hill.h * fall * fall);
      }
    }
    // Clear approach funnels north and south of the runway: a pilot
    // lining up on the strip must not meet a hill on short final.
    var rw = SKY.runway;
    if (Math.abs(x - rw.x) < 260 && Math.abs(z - rw.z) < rw.length / 2 + 520) {
      h = Math.min(h, 40);
    }
    return h;
  }

  function isWater(x, z) {
    return terrainHeight(x, z) < 0;
  }

  function getIslands() { return islands; }
  function getHills() { return hills; }
  function getPalms() { return palms; }
  function getClouds() { return clouds; }
  function getRingSpots() { return ringSpots; }
  function getSeed() { return seed; }

  buildWorld(seed);

  return {
    buildWorld: buildWorld,
    terrainHeight: terrainHeight,
    isWater: isWater,
    getIslands: getIslands,
    getHills: getHills,
    getPalms: getPalms,
    getClouds: getClouds,
    getRingSpots: getRingSpots,
    getSeed: getSeed
  };
})();
