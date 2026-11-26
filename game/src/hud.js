// Skylark HUD: instruments that look flown rather than drawn.
// Canvas-drawn so every screenshot carries them: a top status bar
// (score, sortie, rings, timer, fuel), bottom instruments (altimeter,
// speed, compass heading), a minimap, and message banners.

var SkyHud = (function () {
  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = SKY.colours.hudBack;
    ctx.strokeStyle = SKY.colours.hudEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function label(ctx, text, x, y, size, colour) {
    ctx.font = 'bold ' + size + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = colour || SKY.colours.hudText;
    ctx.fillText(text, x, y);
  }

  function drawTopBar(ctx, game) {
    var W = SKY.canvasWidth;
    panel(ctx, 12, 10, W - 24, 52);
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = SKY.colours.hudText;
    ctx.fillText('SKYLARK', 28, 34);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('KEPULAUAN CAHAYA', 28, 52);

    // Score, centre-left.
    ctx.textAlign = 'center';
    label(ctx, 'SCORE', 300, 28, 13, '#9fb8cc');
    label(ctx, String(game.score), 300, 50, 24, '#ffffff');

    // Sortie and rings.
    label(ctx, game.sortieName, 520, 28, 13, '#9fb8cc');
    var ringText = 'RINGS ' + game.ringsDone + ' / ' + game.ringsTotal;
    label(ctx, ringText, 520, 50, 22, '#ffd34d');

    // Timer, centre-right. Turns red under 20 seconds.
    var t = Math.max(0, Math.ceil(game.timeLeft));
    var tCol = t <= 20 ? SKY.colours.hudBad : '#ffffff';
    label(ctx, 'TIME', 740, 28, 13, '#9fb8cc');
    label(ctx, Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2), 740, 50, 24, tCol);

    // Fuel gauge, right side.
    label(ctx, 'FUEL', 900, 26, 13, '#9fb8cc');
    var fw = 190, fh = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(830, 32, fw, fh);
    var fuelFrac = Math.max(0, game.plane.fuel / 100);
    var fuelCol = fuelFrac > 0.4 ? SKY.colours.hudGood : (fuelFrac > 0.18 ? SKY.colours.hudWarn : SKY.colours.hudBad);
    ctx.fillStyle = fuelCol;
    ctx.fillRect(830, 32, fw * fuelFrac, fh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(830, 32, fw, fh);
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(Math.round(game.plane.fuel) + '%', 1028, 47);

    // Damage bar under the fuel, with its label to the left of the bar.
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb8cc';
    ctx.fillText('DAMAGE', 822, 59);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(830, 54, fw, 5);
    ctx.fillStyle = SKY.colours.hudBad;
    ctx.fillRect(830, 54, fw * (game.plane.damage / 100), 5);
  }

  function drawAltimeter(ctx, p) {
    var cx = 92, cy = 628, r = 62;
    panel(ctx, cx - r - 12, cy - r - 12, r * 2 + 24, r * 2 + 24);
    ctx.fillStyle = '#0d2033';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d7a90';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Tick marks every 100 ft, labelled every 500.
    for (var a = 0; a <= 1000; a += 100) {
      var ang = -Math.PI * 0.75 + (a / 1000) * Math.PI * 1.5;
      var x1 = cx + Math.cos(ang) * (r - 8);
      var y1 = cy + Math.sin(ang) * (r - 8);
      var x2 = cx + Math.cos(ang) * (r - 16);
      var y2 = cy + Math.sin(ang) * (r - 16);
      ctx.strokeStyle = '#c8d8e4';
      ctx.lineWidth = a % 500 === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    var needle = -Math.PI * 0.75 + (Math.min(1000, p.alt) / 1000) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needle) * (r - 18), cy + Math.sin(needle) * (r - 18));
    ctx.stroke();
    label(ctx, 'ALTITUDE', cx, cy - r - 18, 12, '#9fb8cc');
    label(ctx, Math.round(p.alt) + ' ft', cx, cy + 8, 20, '#ffffff');
    label(ctx, p.climb >= 0 ? '+' + Math.round(p.climb) : String(Math.round(p.climb)), cx, cy + 30, 13, p.climb >= 0 ? '#7ee787' : '#ff6b5e');
  }

  function drawSpeedometer(ctx, p) {
    var cx = 250, cy = 628, r = 62;
    panel(ctx, cx - r - 12, cy - r - 12, r * 2 + 24, r * 2 + 24);
    ctx.fillStyle = '#0d2033';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d7a90';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (var s = 0; s <= 240; s += 20) {
      var ang = -Math.PI * 0.75 + (s / 240) * Math.PI * 1.5;
      var x1 = cx + Math.cos(ang) * (r - 8);
      var y1 = cy + Math.sin(ang) * (r - 8);
      var x2 = cx + Math.cos(ang) * (r - 16);
      var y2 = cy + Math.sin(ang) * (r - 16);
      ctx.strokeStyle = '#c8d8e4';
      ctx.lineWidth = s % 60 === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    var knots = Math.round(p.speed * 0.9);
    var needle = -Math.PI * 0.75 + (Math.min(240, knots) / 240) * Math.PI * 1.5;
    ctx.strokeStyle = '#7ee787';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needle) * (r - 18), cy + Math.sin(needle) * (r - 18));
    ctx.stroke();
    label(ctx, 'SPEED', cx, cy - r - 18, 12, '#9fb8cc');
    label(ctx, String(knots), cx, cy + 8, 26, '#ffffff');
    label(ctx, 'KNOTS', cx, cy + 30, 12, '#9fb8cc');
    // Throttle bar under the dial.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(cx - 50, cy + 42, 100, 8);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(cx - 50, cy + 42, 100 * p.throttle, 8);
    label(ctx, 'THR ' + Math.round(p.throttle * 100) + '%', cx, cy + 66, 11, '#c8d8e4');
  }

  function headingName(deg) {
    var names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round(deg / 45) % 8];
  }

  function drawCompass(ctx, p) {
    var W = SKY.canvasWidth;
    var cx = W / 2, cy = 668, w = 420, h = 44;
    panel(ctx, cx - w / 2, cy - h / 2 - 8, w, h + 16);
    var deg = ((p.heading * 180 / Math.PI) % 360 + 360) % 360;
    // Strip: headings scroll under a fixed centre lubber line.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2 + 8, cy - h / 2, w - 16, h);
    ctx.clip();
    for (var d = -180; d <= 180; d += 15) {
      var rel = ((d - deg + 540) % 360) - 180;
      var x = cx + rel * 2.2;
      if (x < cx - w / 2 || x > cx + w / 2) continue;
      var major = d % 45 === 0;
      ctx.strokeStyle = major ? '#ffffff' : '#7d97a8';
      ctx.lineWidth = major ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x, cy + 14);
      ctx.lineTo(x, cy + (major ? -6 : 4));
      ctx.stroke();
      if (major) label(ctx, headingName(((d % 360) + 360) % 360), x, cy - 10, 13, '#ffd34d');
    }
    ctx.restore();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2 - 6);
    ctx.lineTo(cx - 7, cy - h / 2 - 16);
    ctx.lineTo(cx + 7, cy - h / 2 - 16);
    ctx.closePath();
    ctx.fill();
    label(ctx, 'HEADING ' + Math.round(deg) + ' deg ' + headingName(deg), cx, cy + h / 2 + 6, 13, '#ffffff');
  }

  function drawMinimap(ctx, game) {
    var mx = SKY.canvasWidth - 218, my = 78, mw = 200, mh = 200;
    panel(ctx, mx - 6, my - 6, mw + 12, mh + 12);
    var scale = mw / SKY.worldSize;
    var toMap = function (x, z) {
      return { x: mx + (x + SKY.worldSize / 2) * scale, y: my + (z + SKY.worldSize / 2) * scale };
    };
    // Sea.
    ctx.fillStyle = '#0e5f8a';
    ctx.fillRect(mx, my, mw, mh);
    // Islands.
    ctx.fillStyle = '#5da24a';
    var islands = SkyTerrain.getIslands();
    for (var i = 0; i < islands.length; i++) {
      ctx.beginPath();
      var pts = islands[i].pts;
      for (var k = 0; k < pts.length; k++) {
        var mp = toMap(pts[k].x, pts[k].z);
        if (k === 0) ctx.moveTo(mp.x, mp.y); else ctx.lineTo(mp.x, mp.y);
      }
      ctx.closePath();
      ctx.fill();
    }
    // Runway.
    var r = SKY.runway;
    var rp = toMap(r.x, r.z);
    ctx.fillStyle = '#3c3f45';
    ctx.fillRect(rp.x - 3, rp.y - 14, 6, 28);
    // Rings: gold for the next, white for the rest.
    for (var j = 0; j < game.rings.length; j++) {
      var ring = game.rings[j];
      var cp = toMap(ring.x, ring.z);
      ctx.strokeStyle = ring.done ? '#7ee787' : (j === game.activeRing ? '#ffc93c' : '#ffffff');
      ctx.lineWidth = j === game.activeRing ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, ring.done ? 3 : 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Plane arrow, rotated by heading.
    var pp = toMap(game.plane.x, game.plane.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(game.plane.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(8, 24, 40, 0.78)';
    ctx.fillRect(mx + mw / 2 - 30, my + mh + 8, 60, 18);
    label(ctx, 'CHART', mx + mw / 2, my + mh + 22, 11, '#ffffff');
  }

  function drawBanner(ctx, text, sub, colour) {
    var W = SKY.canvasWidth;
    ctx.fillStyle = 'rgba(8, 24, 40, 0.82)';
    ctx.fillRect(0, 150, W, 86);
    ctx.strokeStyle = colour || '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(W, 150);
    ctx.moveTo(0, 236);
    ctx.lineTo(W, 236);
    ctx.stroke();
    label(ctx, text, W / 2, 196, 34, colour || '#ffffff');
    if (sub) label(ctx, sub, W / 2, 224, 16, '#c8d8e4');
  }

  function drawHud(ctx, game) {
    drawTopBar(ctx, game);
    drawAltimeter(ctx, game.plane);
    drawSpeedometer(ctx, game.plane);
    drawCompass(ctx, game.plane);
    drawMinimap(ctx, game);
    if (game.banner) drawBanner(ctx, game.banner.text, game.banner.sub, game.banner.colour);
    if (game.state === 'title') drawTitle(ctx, game);
    if (game.state === 'results') drawResults(ctx, game);
    if (game.state === 'crashed') drawCrash(ctx, game);
  }

  function drawTitle(ctx, game) {
    var W = SKY.canvasWidth, H = SKY.canvasHeight;
    ctx.fillStyle = 'rgba(6, 20, 36, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SKYLARK', W / 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('A BUSH-PLANE RUN OVER KEPULAUAN CAHAYA', W / 2, 190);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#d7e8f2';
    var lines = [
      'Fly through the golden rings in order, then land back on the runway',
      'before your fuel runs out. Three sorties, each harder than the last.',
      '',
      'ARROWS / W A S D  steer and climb    SHIFT  throttle up    CTRL  throttle down',
      'MOUSE  drag sideways to steer    M  mute    R  restart    ENTER  take off',
      '',
      'Land gently on the runway to finish a sortie. Hard landings hurt.',
      'Rings pay +100 points and +14 fuel. A clean sortie pays a bonus.'
    ];
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, 250 + i * 30);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESS ENTER TO TAKE OFF', W / 2, 250 + lines.length * 30 + 20);
  }

  function drawResults(ctx, game) {
    var W = SKY.canvasWidth, H = SKY.canvasHeight;
    ctx.fillStyle = 'rgba(6, 20, 36, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('FLIGHT COMPLETE', W / 2, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('FINAL SCORE  ' + game.score, W / 2, 190);
    // Stars.
    var stars = 0;
    for (var s = 0; s < 3; s++) if (game.score >= SKY.starThresholds[s]) stars++;
    ctx.font = '64px sans-serif';
    var starLine = '';
    for (var k = 0; k < 3; k++) starLine += (k < stars ? '\u2605' : '\u2606') + ' ';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(starLine, W / 2, 270);
    var grade = stars === 3 ? 'ACE PILOT' : stars === 2 ? 'SEASONED BUSH PILOT' : stars === 1 ? 'LICENSED FLYER' : 'STUDENT PILOT';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#7ee787';
    ctx.fillText(grade, W / 2, 320);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#d7e8f2';
    var rows = [
      'Rings flown: ' + game.totalRings + ' of ' + game.totalRingsPlanned,
      'Sorties landed: ' + game.sortiesLanded + ' of 3',
      'Damage taken: ' + Math.round(game.plane.damage) + '%',
      'Fuel left: ' + Math.round(game.plane.fuel) + '%'
    ];
    for (var i = 0; i < rows.length; i++) ctx.fillText(rows[i], W / 2, 370 + i * 30);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESS R TO FLY AGAIN', W / 2, 540);
  }

  function drawCrash(ctx, game) {
    var W = SKY.canvasWidth, H = SKY.canvasHeight;
    ctx.fillStyle = 'rgba(40, 6, 6, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(game.crashTitle || 'CRASHED', W / 2, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText(game.crashText || 'The Skylark is down. The islands will wait.', W / 2, 310);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SCORE ' + game.score + '   -   PRESS R TO FLY AGAIN', W / 2, 370);
  }

  return {
    drawHud: drawHud,
    drawBanner: drawBanner,
    headingName: headingName
  };
})();
