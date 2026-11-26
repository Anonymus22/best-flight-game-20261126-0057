// Skylark renderer: a chase view behind the plane over Kepulauan Cahaya.
// A small perspective projector turns world points into screen points;
// islands, runway, rings, clouds and the Skylark are drawn in that
// space, far to near, so the scene reads at a glance.

var SkyRender = (function () {
  var FEET_PER_UNIT = 3;   // world units are ~3 feet, so altitudes read right
  var particles = [];
  var floaters = [];

  function project(p, cam) {
    var rx = p.x - cam.x;
    var ry = p.y - cam.y;
    var rz = p.z - cam.z;
    var cx = rx * cam.rX + rz * cam.rZ;
    var cy = rx * cam.uX + ry * cam.uY + rz * cam.uZ;
    var cz = rx * cam.fX + ry * cam.fY + rz * cam.fZ;
    if (cz < 6) return null;
    var s = SKY.camFov / cz;
    return { x: SKY.canvasWidth / 2 + cx * s, y: SKY.horizonY - cy * s, s: s, depth: cz };
  }

  function makeCamera(p) {
    var sinH = Math.sin(p.heading);
    var cosH = Math.cos(p.heading);
    var altW = p.alt / FEET_PER_UNIT;
    var cx = p.x - sinH * SKY.camDistance;
    var cz = p.z + cosH * SKY.camDistance;
    var cy = altW + SKY.camHeight;
    // Look slightly ahead and a touch down, at the plane's own height.
    var lookX = p.x + sinH * 260;
    var lookZ = p.z - cosH * 260;
    var lookY = altW + 6;
    var fx = lookX - cx, fy = lookY - cy, fz = lookZ - cz;
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx /= fl; fy /= fl; fz /= fl;
    // Right = forward cross world-up, normalised: (-fz, 0, fx).
    var rX = -fz, rZ = fx;
    var rLen = Math.sqrt(rX * rX + rZ * rZ) || 1;
    rX /= rLen; rZ /= rLen;
    // Up = right cross forward.
    var uX = -rZ * fy;
    var uY = rZ * fx - rX * fz;
    var uZ = rX * fy;
    return {
      x: cx, y: cy, z: cz,
      fX: fx, fY: fy, fZ: fz,
      rX: rX, rZ: rZ,
      uX: uX, uY: uY, uZ: uZ
    };
  }

  function drawSky(ctx, time) {
    var g = ctx.createLinearGradient(0, 0, 0, SKY.horizonY + 40);
    g.addColorStop(0, SKY.colours.skyTop);
    g.addColorStop(0.55, SKY.colours.skyMid);
    g.addColorStop(1, SKY.colours.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SKY.canvasWidth, SKY.horizonY + 40);
    // Sun, upper right.
    var sx = SKY.canvasWidth - 190, sy = 92;
    var sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 90);
    sg.addColorStop(0, 'rgba(255, 244, 190, 0.95)');
    sg.addColorStop(0.35, 'rgba(255, 220, 120, 0.55)');
    sg.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 100, sy - 100, 200, 200);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSea(ctx) {
    var g = ctx.createLinearGradient(0, SKY.horizonY, 0, SKY.canvasHeight);
    g.addColorStop(0, SKY.colours.seaShallow);
    g.addColorStop(1, SKY.colours.seaDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, SKY.horizonY, SKY.canvasWidth, SKY.canvasHeight - SKY.horizonY);
    // Sun glitter on the water.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 14; i++) {
      var y = SKY.horizonY + 30 + i * 26;
      var w = 40 + (i % 3) * 30;
      ctx.beginPath();
      ctx.moveTo(SKY.canvasWidth / 2 - w, y);
      ctx.lineTo(SKY.canvasWidth / 2 + w, y);
      ctx.stroke();
    }
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function drawIslands(ctx, cam) {
    var islands = SkyTerrain.getIslands();
    for (var i = 0; i < islands.length; i++) {
      var isl = islands[i];
      // Beach: the island polygon grown a little, sandy.
      var beach = [];
      var grass = [];
      var ok = true;
      for (var k = 0; k < isl.pts.length; k++) {
        var pt = isl.pts[k];
        var bx = isl.cx + (pt.x - isl.cx) * 1.09;
        var bz = isl.cz + (pt.z - isl.cz) * 1.09;
        var bp = project({ x: bx, y: 0, z: bz }, cam);
        var gp = project({ x: pt.x, y: 0, z: pt.z }, cam);
        if (!bp || !gp) { ok = false; break; }
        beach.push(bp);
        grass.push(gp);
      }
      if (!ok) continue;
      ctx.fillStyle = SKY.colours.sand;
      polyPath(ctx, beach);
      ctx.fill();
      ctx.fillStyle = SKY.colours.grass;
      polyPath(ctx, grass);
      ctx.fill();
    }
    // Hills: shaded green mounds, drawn after the flat islands.
    var hills = SkyTerrain.getHills();
    for (var h = 0; h < hills.length; h++) {
      var hill = hills[h];
      var hp = project({ x: hill.x, y: hill.h / FEET_PER_UNIT * 0.5, z: hill.z }, cam);
      if (!hp) continue;
      var rw = hill.r * hp.s;
      var rh = rw * 0.42;
      var hg = ctx.createLinearGradient(0, hp.y - rh, 0, hp.y + rh);
      hg.addColorStop(0, SKY.colours.hill);
      hg.addColorStop(1, SKY.colours.forest);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(hp.x, hp.y, rw, rh, 0, Math.PI, 0);
      ctx.fill();
    }
    // Palms: tiny dark-green tufts near the beaches.
    var palms = SkyTerrain.getPalms();
    ctx.fillStyle = SKY.colours.forest;
    for (var q = 0; q < palms.length; q++) {
      var palm = palms[q];
      var pp = project({ x: palm.x, y: 2, z: palm.z }, cam);
      if (!pp || pp.s < 0.4) continue;
      var ps = Math.max(2, 5 * pp.s * palm.s);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, ps, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRunway(ctx, cam) {
    var r = SKY.runway;
    var halfL = r.length / 2, halfW = r.width / 2;
    var corners = [
      { x: r.x - halfW, z: r.z - halfL },
      { x: r.x + halfW, z: r.z - halfL },
      { x: r.x + halfW, z: r.z + halfL },
      { x: r.x - halfW, z: r.z + halfL }
    ];
    var pts = [];
    for (var i = 0; i < 4; i++) {
      var pr = project({ x: corners[i].x, y: 1, z: corners[i].z }, cam);
      if (!pr) return;
      pts.push(pr);
    }
    ctx.fillStyle = SKY.colours.runway;
    polyPath(ctx, pts);
    ctx.fill();
    // Centre dashes, projected one by one.
    ctx.fillStyle = SKY.colours.runwayMark;
    for (var d = -halfL + 40; d < halfL - 20; d += 70) {
      var a = project({ x: r.x - 3, y: 1.5, z: r.z + d }, cam);
      var b = project({ x: r.x + 3, y: 1.5, z: r.z + d + 34 }, cam);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + (b.x - a.x) * 0.02, b.y + 4);
      ctx.lineTo(a.x + (b.x - a.x) * 0.02, a.y + 4);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold bars at both ends.
    ctx.fillStyle = SKY.colours.runwayMark;
    var t1 = project({ x: r.x - halfW + 6, y: 1.5, z: r.z - halfL + 14 }, cam);
    var t2 = project({ x: r.x + halfW - 6, y: 1.5, z: r.z - halfL + 26 }, cam);
    if (t1 && t2) ctx.fillRect(t1.x, t1.y, t2.x - t1.x, 5);
  }

  function drawRings(ctx, cam, rings, activeIndex) {
    for (var i = 0; i < rings.length; i++) {
      var ring = rings[i];
      if (ring.done) continue;
      var centre = project({ x: ring.x, y: ring.y / FEET_PER_UNIT, z: ring.z }, cam);
      if (!centre) continue;
      var rad = SKY.ringRadius * centre.s;
      if (rad < 4) continue;
      var isNext = (i === activeIndex);
      var col = isNext ? SKY.colours.ringGold : 'rgba(255, 255, 255, 0.75)';
      var glow = isNext ? 'rgba(255, 201, 60, 0.35)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = Math.max(3, rad * 0.09);
      ctx.strokeStyle = glow;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, rad * 1.25, rad, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, rad, rad * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext) {
        // Number tag above the next ring.
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(8, 24, 40, 0.8)';
        var label = 'RING ' + (i + 1);
        var w = ctx.measureText(label).width + 18;
        ctx.fillRect(centre.x - w / 2, centre.y - rad - 34, w, 26);
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(label, centre.x, centre.y - rad - 14);
      }
    }
  }

  function drawClouds(ctx, cam, time) {
    var clouds = SkyTerrain.getClouds();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var driftX = c.x + ((time * c.drift) % 600) - 300;
      var cp = project({ x: driftX, y: c.y / FEET_PER_UNIT, z: c.z }, cam);
      if (!cp) continue;
      var r = c.r * cp.s;
      if (r < 6) continue;
      ctx.beginPath();
      ctx.ellipse(cp.x, cp.y, r, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cp.x - r * 0.5, cp.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cp.x + r * 0.5, cp.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlaneShadow(ctx, cam, p) {
    var groundY = SkyTerrain.terrainHeight(p.x, p.z) / FEET_PER_UNIT;
    var sp = project({ x: p.x, y: groundY + 1, z: p.z }, cam);
    if (!sp) return;
    var r = 46 * sp.s;
    if (r < 2) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The Skylark, drawn big from behind and above, banking with the turn.
  function drawPlane(ctx, p, time) {
    var cx = SKY.canvasWidth / 2;
    var cy = 500;
    var bank = p.bank;
    var pitchTilt = -p.pitch * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank * 0.9 + pitchTilt * 0.3);
    var scale = 1.0;
    ctx.scale(scale, scale);
    // Soft shadow under the sprite for depth.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(6, 26, 150, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings: wide, cream with red tips.
    ctx.fillStyle = SKY.colours.planeBody;
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.lineTo(-30, -14);
    ctx.lineTo(30, -14);
    ctx.lineTo(150, 6);
    ctx.lineTo(140, 22);
    ctx.lineTo(28, 16);
    ctx.lineTo(-28, 16);
    ctx.lineTo(-140, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9c2a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = SKY.colours.planeTrim;
    ctx.fillRect(-150, 4, 26, 18);
    ctx.fillRect(124, 4, 26, 18);
    // Fuselage: nose away from the camera, tail toward it.
    ctx.fillStyle = SKY.colours.planeBody;
    ctx.beginPath();
    ctx.moveTo(-22, -118);
    ctx.quadraticCurveTo(0, -132, 22, -118);
    ctx.lineTo(26, 52);
    ctx.quadraticCurveTo(0, 66, -26, 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9c2a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Red cheatline along the fuselage.
    ctx.fillStyle = SKY.colours.planeTrim;
    ctx.fillRect(-24, -40, 48, 10);
    // Canopy glass.
    ctx.fillStyle = SKY.colours.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -72, 15, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-4, -80, 5, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = SKY.colours.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-52, 44);
    ctx.lineTo(0, 30);
    ctx.lineTo(52, 44);
    ctx.lineTo(48, 58);
    ctx.lineTo(0, 48);
    ctx.lineTo(-48, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SKY.colours.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-12, 52);
    ctx.lineTo(0, 18);
    ctx.lineTo(12, 52);
    ctx.closePath();
    ctx.fill();
    // Registration on the tail.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKY', 0, 62);
    // Propeller blur at the nose: two faint arcs, seen edge-on from behind.
    var spin = (time * 40) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -118, 30, 6, spin * 0.15, 0, Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -118, 30, 6, spin * 0.15, Math.PI, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
  }

  function spawnBurst(x, y, z, colour) {
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = 30 + Math.random() * 70;
      particles.push({
        x: x, y: y, z: z,
        vx: Math.cos(a) * v, vy: (Math.random() - 0.3) * v, vz: Math.sin(a) * v,
        life: 0.9, colour: colour
      });
    }
  }

  function addFloater(text, x, y, z, colour) {
    floaters.push({ text: text, x: x, y: y, z: z, life: 1.4, colour: colour || '#ffd34d' });
  }

  function drawParticles(ctx, cam, dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var pt = particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      var sp = project({ x: pt.x, y: pt.y / FEET_PER_UNIT, z: pt.z }, cam);
      if (!sp) continue;
      ctx.globalAlpha = Math.min(1, pt.life * 1.5);
      ctx.fillStyle = pt.colour;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(2, 5 * sp.s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var j = floaters.length - 1; j >= 0; j--) {
      var f = floaters[j];
      f.life -= dt;
      if (f.life <= 0) { floaters.splice(j, 1); continue; }
      var fp = project({ x: f.x, y: (f.y + (1.4 - f.life) * 40) / FEET_PER_UNIT, z: f.z }, cam);
      if (!fp) continue;
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.colour;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, fp.x, fp.y);
      ctx.fillText(f.text, fp.x, fp.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(ctx, p, rings, activeIndex, time, dt) {
    var cam = makeCamera(p);
    drawSky(ctx, time);
    drawSea(ctx);
    drawIslands(ctx, cam);
    drawRunway(ctx, cam);
    drawClouds(ctx, cam, time);
    drawRings(ctx, cam, rings, activeIndex);
    drawPlaneShadow(ctx, cam, p);
    drawParticles(ctx, cam, dt);
    return cam;
  }

  return {
    makeCamera: makeCamera,
    project: project,
    drawWorld: drawWorld,
    drawPlane: drawPlane,
    spawnBurst: spawnBurst,
    addFloater: addFloater
  };
})();
