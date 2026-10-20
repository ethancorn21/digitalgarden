/* The parade: a strip of pixel sprites for the foot of a page (Ethan 2026-10-17: "a 32 bit animated footer of a couple
   of wacky characters from different eras moving along the bottom, doing an action ... like shooting a dragon or
   something dumb"; then "a better cast would be: alien, robot, philosopher, hacker").
   One gag, looped. An alien, a tin wind-up robot, a philosopher and a hacker walk in from the left; a dragon lands in
   their way. The alien's ray gun: the dragon drinks the beam and puffs smoke. The robot's spring-loaded fist arcs over
   the alien and bonks its snout; it blinks. The philosopher asks if it is real; it wonders. The hacker types
   `rm -rf dragon`, and it comes apart into its own pixels. They cheer and walk off to the right.
   Drawing: every sprite is built here at one art pixel per pixel. Heads and bodies are letter grids, limbs and props are
   brush strokes, the dragon is shaded, dithered volumes; each part gets its own line of the page's ink, so an arm reads
   over a chest. The strip is drawn at art resolution and scaled up by a whole number of device pixels, so every art
   pixel lands as a crisp square. The scene is a pure function of loop time (at(t)), so a test can hold any moment.
   Standalone: no imports. createParade(host, { paused, autoplay }) puts the strip in host, sized to its width. */
const root = document.documentElement;
let RM = false;
try { RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
const cssv = (k) => getComputedStyle(root).getPropertyValue(k).trim();
const knob = (k, d) => { const v = parseFloat(cssv(k)); return isFinite(v) ? v : d; };
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

const D2R = Math.PI / 180;
/* ------------------------------------------------------------------ palette: one letter per colour, each a token */
const PAL = { k: '--px-ink', w: '--px-white', W: '--px-white-2', v: '--px-grey', g: '--px-steel', G: '--px-steel-2', s: '--px-skin', S: '--px-skin-2',
  n: '--px-leather', N: '--px-leather-2', y: '--px-gold', Y: '--px-gold-2', r: '--px-red', R: '--px-red-2', o: '--px-fire', O: '--px-fire-hot',
  x: '--px-denim', X: '--px-denim-2', h: '--px-hoodie', H: '--px-hoodie-2', p: '--px-phosphor', q: '--px-glass', c: '--px-magic',
  a: '--px-alien', A: '--px-alien-2', u: '--px-suit', U: '--px-suit-2', z: '--px-tin', Z: '--px-tin-2',
  f: '--px-dragon-hi', d: '--px-dragon', D: '--px-dragon-2', e: '--px-dragon-3', l: '--px-belly', L: '--px-belly-2', m: '--px-wing', M: '--px-wing-2' };
const LET = Object.keys(PAL), IDX = {}; LET.forEach((k, i) => { IDX[k] = i + 1; });

/* ------------------------------------------------------------------ frames: 64 x 64 art px, the feet's centre at (32, 60) */
const FW = 64, FH = 64, AX = 32, GY = 60;
const grid = () => new Uint8Array(FW * FH);
const at = (g, x, y) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : g[y * FW + x]);
function put(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < FW && y < FH) g[y * FW + x] = typeof c === 'string' ? IDX[c] : c; }
/* a part is drawn on its own, then laid on the frame inside a line of ink */
function lay(frame, draw, outline = true) {
  const p = grid(); draw(p);
  if (outline) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (!p[y * FW + x] && (at(p, x - 1, y) || at(p, x + 1, y) || at(p, x, y - 1) || at(p, x, y + 1))) frame[y * FW + x] = IDX.k;
  for (let i = 0; i < p.length; i++) if (p[i]) frame[i] = p[i];
}
function art(g, rows, x0, y0) { rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(g, x0 + x, y0 + y, r[x]); }); }
function stroke(g, x0, y0, x1, y1, w, c) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1, o = (w - 1) / 2;
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(g, Math.round(x - o) + a, Math.round(y - o) + b, c); }
}
/* angles: 0 = straight down, 90 = forward (right), 180 = straight up, -90 = back */
const dir = (a, len) => [Math.sin(a * D2R) * len, Math.cos(a * D2R) * len];
/* an arm from the shoulder: upper arm, forearm, a 2 x 2 hand; returns the hand */
function arm(g, x, y, [a1, a2], sl, hand, l1 = 4, l2 = 4) {
  const [ux, uy] = dir(a1, l1), [fx, fy] = dir(a2, l2), ex = x + ux, ey = y + uy, hx = ex + fx, hy = ey + fy;
  stroke(g, x, y, ex, ey, 2, sl); stroke(g, ex, ey, hx, hy, 2, sl);
  const [qx, qy] = dir(a2, 1.5); stroke(g, hx + qx, hy + qy, hx + qx, hy + qy, 2, hand);
  return [Math.round(hx + qx), Math.round(hy + qy)];
}
/* shaded volumes for the dragon: light from the upper left and in front, ordered dither between the tones */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
function tone(g, x, y, l, ramp) {
  const v = (1 - clamp((l + .15) / 1.05)) * (ramp.length - 1), i = Math.floor(v);
  put(g, x, y, ramp[Math.min(ramp.length - 1, v - i > BAYER[(y & 3) * 4 + (x & 3)] ? i + 1 : i)]);
}
function vol(g, cx, cy, rx, ry, ramp, keep) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, r2 = nx * nx + ny * ny;
    if (r2 > 1 || (keep && !keep(x, y))) continue;
    tone(g, x, y, -.5 * nx - .62 * ny + .6 * Math.sqrt(1 - r2), ramp);
  }
}
/* a tube along a path, its radius running r0 to r1: shaded across its own width */
function tube(g, pts, r0, r1, ramp) {
  const P = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 8; k++) P.push([lerp(pts[i][0], pts[i + 1][0], k / 8), lerp(pts[i][1], pts[i + 1][1], k / 8)]);
  P.push(pts[pts.length - 1]);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; P.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  for (let y = Math.floor(y0 - r0 - 1); y <= y1 + r0 + 1; y++) for (let x = Math.floor(x0 - r0 - 1); x <= x1 + r0 + 1; x++) {
    let best = 1e9, bi = 0; P.forEach(([px, py], i) => { const d = (x + .5 - px) ** 2 + (y + .5 - py) ** 2; if (d < best) { best = d; bi = i; } });
    const r = lerp(r0, r1, bi / (P.length - 1)), d = Math.sqrt(best); if (d > r) continue;
    const nx = (x + .5 - P[bi][0]) / r, ny = (y + .5 - P[bi][1]) / r;
    tone(g, x, y, -.5 * nx - .62 * ny + .6 * Math.sqrt(Math.max(0, 1 - d * d / (r * r))), ramp);
  }
}
function poly(g, pts, c) {
  let y0 = 1e9, y1 = -1e9; pts.forEach((p) => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= y + .5 && by > y + .5) || (by <= y + .5 && ay > y + .5)) xs.push(ax + (y + .5 - ay) / (by - ay) * (bx - ax)); }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) put(g, x, y, typeof c === 'function' ? c(x, y) : c);
  }
}

/* ------------------------------------------------------------------ the party: heads and bodies as grids, facing right */
const ALIEN = [
  '....yy....yy....',
  '.....A....A.....',
  '......A...A.....',
  '....aaaaaaaaa...',
  '...aaaaaaaaaaa..',
  '..Aaaaaaaaaaaaa.',
  '..Aaaaaaaaaaaaa.',
  '..Aaaaaawkkaakk.',
  '..AAaaakkkkaakk.',
  '...Aaaaakkkaak..',
  '...AAaaaaaaaaa..',
  '....AAaaaaaAa...',
  '.....AAaaaaa....',
  '......uuuuu.....',
  '.....uuuuuuu....',
  '....uuuuuuuuu...',
  '....Uuuuuyuuu...',
  '....Uuuuuuuuu...',
  '....UyyyyyyyU...',
  '....UUuuuuuUU...'];
const ROBOT = [
  '.......r........',
  '.......Z........',
  '...zzzzzzzzzz...',
  '...zwzzzzzzzZ...',
  '...zkkkkkkkkZ...',
  '...zkkkkckkcZ...',
  '...zkkkkkkkkZ...',
  '...zzzzzzzzzZ...',
  '...zzzGzGzGzZ...',
  '...ZZZZZZZZZZ...',
  '......GGGG......',
  '..zzzzzzzzzzzz..',
  '..zwzzzzzzzzzZ..',
  '..zzzrzyzczzzZ..',
  '..zzzzzzzzzzzZ..',
  '..zzzGGGGGGzzZ..',
  '..zzzzzzzzzzzZ..',
  '..ZzzzzzzzzzZZ..',
  '..ZZZZZZZZZZZZ..'];
const PHILO = [
  '.....sssss......',
  '....sswssss.....',
  '...vssssssss....',
  '...vSsssskss....',
  '...vvsssssssss..',
  '...gvvvvvvvss...',
  '...gvvvvvvvvv...',
  '....gvvvvvvvv...',
  '.....gvvvvvvg...',
  '......gvvvvg....',
  '....wwwwwwwwW...',
  '...wWwwwwwwwwW..',
  '...wwWwwwwwwwW..',
  '...wwwRwwwwwww..',
  '...wwwwRwwwwww..',
  '...WwwwwrRwwww..',
  '...WwwwwwrRwww..',
  '...WWwwwwwrRww..',
  '..WWwwwwwwwrRw..',
  '..WWwwwwwwwwrw..',
  '..WWWwwwwWwwww..',
  '..WWWwwwwwWwww..',
  '..WWWWWWWWWWWW..'];
const HACKER = [
  '.....hhhhh......',
  '...hhhhhhhhh....',
  '..hhhhhhhhhhh...',
  '..hHhhhhhhhhhh..',
  '.hhHhhhhHHHHHh..',
  '.hhHhhhHSsssssh.',
  '.hhHhhhHSkpkskk.',
  '.hhHhhhHSskksss.',
  '.hhHhhhHSsssss..',
  '.hhhHhhhHSsSs...',
  '..hhhHhhhHSs....',
  '...HhhhhhhhH....',
  '..hhhhhhhhhhh...',
  '.hhHhhhhwhwhh...',
  '.hhHhhhhwhwhh...',
  '.hhHhhhhhhhhh...',
  '.hhhhhhhhhhhh...',
  '.hHhhhhhhhhhh...',
  '.HHHHHHHHHHHH...',
  '..xxxxxxxxxx....'];
/* hip: the torso's last row, where the legs (or, under a robe, the feet) begin; sh: the near shoulder; hd: hand colours */
const RIG = {
  alien: { art: ALIEN, hip: [8, 19], sh: [8, 14], legs: { len: 5, c: 'uU', b: 'zZ', bh: 2 }, sl: 'uU', hd: 'aA', reach: 3 },
  robot: { art: ROBOT, hip: [8, 18], sh: [7, 12], legs: { len: 7, c: 'zZ', b: 'GG', bh: 2 }, sl: 'zZ', hd: 'GG' },
  philo: { art: PHILO, hip: [8, 22], sh: [7, 11], legs: { len: 2, robe: true, b: 'nN' }, sl: 'sS', hd: 'sS' },
  hacker: { art: HACKER, hip: [7, 19], sh: [6, 13], legs: { len: 8, c: 'xX', b: 'wW', bh: 2 }, sl: 'hH', hd: 'sS' }
};
/* legs: two strokes with a boot at each foot; a walk is a phase 0..1 (feet swing, the body bobs as they pass) */
function legs(f, R, P, hipY) {
  const L = R.legs, s = P.run ? 4 : P.tip ? 2 : 3, up = P.run || P.tip ? 3 : 2, foot = GY + (P.jy || 0);   /* tip: a tiptoe, short and high */
  for (const far of [1, 0]) {
    const u = 2 * Math.PI * ((P.ph ?? 0) + (far ? .5 : 0));
    const off = P.ph == null ? (far ? -1 : 1) : Math.round(s * Math.cos(u)), lift = P.ph == null ? 0 : Math.round(up * Math.max(0, -Math.sin(u)));
    const fx = AX + off, fy = foot - lift, boot = L.b[far];
    lay(f, (g) => {
      if (L.robe) { stroke(g, fx - 1, fy - 1, fx + 2, fy - 1, 1, boot); stroke(g, fx - 1, fy, fx + 2, fy, 1, boot); return; }
      stroke(g, AX + (far ? -1 : 1), hipY + 1, fx, fy - 2, 3, L.c[far]);
      for (let y = fy - L.bh; y <= fy; y++) for (let x = 0; x < FW; x++) if (g[y * FW + x]) g[y * FW + x] = IDX[boot];
      stroke(g, fx - 1, fy - 1, fx + 2, fy - 1, 1, boot); stroke(g, fx - 1, fy, fx + 2, fy, 1, boot);
    });
  }
}
/* a person: far arm, legs, body, then the near arm and whatever it holds; meta keeps points the scene needs (a muzzle) */
function person(who, P) {
  const R = RIG[who], f = grid(), meta = {}, n = R.reach || 4;
  const bob = P.ph == null ? 0 : Math.abs(Math.cos(2 * Math.PI * P.ph)) < .5 ? -1 : 0;
  const hipY = GY - R.legs.len + (P.jy || 0) + bob, ox = AX - R.hip[0], oy = hipY - R.hip[1], sx = ox + R.sh[0], sy = oy + R.sh[1];
  meta.head = oy;
  if (P.far) lay(f, (g) => { arm(g, sx - 2, sy, P.far, R.sl[1], R.hd[1], n, n); });
  legs(f, R, P, hipY);
  if (BACK[who]) BACK[who](f, P, ox, oy);
  lay(f, (g) => art(g, R.art, ox, oy));
  HOLD[who](f, P, sx, sy, ox, oy, hipY, meta, n);
  return { f, meta };
}
/* the philosopher's beard grown on by n rows: down from the chin over the robe to the ground, then along it in front of him */
function beard(g, n, ox, oy) {
  const down = Math.min(n, 14);
  for (let j = 0; j < down; j++) {
    const w = j < 3 ? 4 : j < 8 ? 3 : 2, x0 = ox + 7 + (j < 3 ? 0 : 1) + (j > 9 && (j & 2) ? 1 : 0);
    for (let x = x0; x < x0 + w; x++) put(g, x, oy + 10 + j, x === x0 ? 'g' : 'v');
  }
  for (let j = 0; j < n - 14; j++) put(g, ox + 10 + j, oy + 24, 'v');
}
function laptop(g, x, y, P, meta) {
  /* the base flat in the hands; the lid up at its far end, its screen cheated round toward us so the code shows */
  stroke(g, x - 2, y, x + 12, y, 1, 'g'); stroke(g, x - 1, y + 1, x + 12, y + 1, 1, 'G');
  for (let yy = y - 8; yy <= y - 1; yy++) for (let xx = x + 5; xx <= x + 12; xx++) put(g, xx, yy, yy === y - 8 || xx === x + 5 || xx === x + 12 ? 'G' : 'q');
  /* code: three indented lines; they change with the typing, and the whole screen lights up in the cheer */
  if (P.cheer) for (let yy = y - 7; yy <= y - 2; yy++) for (let xx = x + 6; xx <= x + 11; xx++) put(g, xx, yy, 'p');
  else (P.flick ? [[0, 4], [2, 3], [2, 4]] : [[0, 3], [2, 4], [0, 5]]).forEach(([i0, n], i) => { for (let k = 0; k < n; k++) put(g, x + 6 + i0 + k, y - 6 + i * 2, 'p'); });
  meta.screen = [x + 8, y - 4];
}
/* behind the body: the robot's wind-up key, turning (P.key: face on, then edge on) */
const BACK = {
  robot(f, P, ox, oy) {
    lay(f, (g) => {
      const y = oy + 14; put(g, ox + 1, y, 'Y'); put(g, ox + 2, y, 'Y');
      if (P.key) { stroke(g, ox, y - 3, ox, y + 3, 1, 'Y'); return; }
      for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = ox - 2; xx <= ox; xx++) if (yy !== y - 2 && yy !== y + 2 || xx === ox) put(g, xx, yy, xx === ox - 1 && yy !== y ? 'Y' : 'y');
    });
  }
};
const HOLD = {
  alien(f, P, sx, sy, ox, oy, hipY, meta, n) {
    if (!P.gun) lay(f, (g) => { stroke(g, ox + 4, hipY - 2, ox + 6, hipY - 2, 1, 'z'); put(g, ox + 7, hipY - 2, 'c'); });   /* holstered on the belt */
    lay(f, (g) => {
      const [hx, hy] = arm(g, sx, sy, P.near || [10, 0], 'u', 'a', n, n);
      if (!P.gun) return;
      /* the ray gun: a grip, a round body with a red fin, a barrel, and a glass ring at the end */
      put(g, hx - 1, hy, 'G'); put(g, hx - 1, hy + 1, 'G');
      stroke(g, hx, hy - 1, hx + 3, hy - 1, 1, 'z'); stroke(g, hx + 1, hy - 2, hx + 2, hy - 2, 1, 'z'); put(g, hx, hy - 2, 'r'); put(g, hx + 1, hy, 'Z');
      stroke(g, hx + 4, hy - 1, hx + 5, hy - 1, 1, 'Z'); put(g, hx + 6, hy - 2, 'c'); put(g, hx + 6, hy - 1, 'w'); put(g, hx + 6, hy, 'c');
      meta.muzzle = [hx + 7, hy - 1];
    });
  },
  robot(f, P, sx, sy, ox, oy, hipY, meta, n) {
    if (!P.off && (P.bulb ?? P.key)) put(f, ox + 7, oy, 'O');   /* the antenna bulb: with the key, unless the script says (P.bulb) */
    if (P.off || P.lowbat) { put(f, ox + 8, oy + 5, 'k'); put(f, ox + 11, oy + 5, 'k'); }   /* powered down: the eyes out */
    if (P.lowbat) { stroke(f, ox + 5, oy + 4, ox + 10, oy + 4, 1, 'r'); stroke(f, ox + 5, oy + 6, ox + 10, oy + 6, 1, 'r'); put(f, ox + 5, oy + 5, 'r'); put(f, ox + 10, oy + 5, 'r'); put(f, ox + 11, oy + 5, 'r'); put(f, ox + 6, oy + 5, 'r'); }   /* an empty battery on the visor */
    lay(f, (g) => { meta.hand = arm(g, sx, sy, P.near || [10, 0], 'z', P.launch ? 'Z' : 'G', n, n); });   /* launched: an empty cuff */
  },
  philo(f, P, sx, sy, ox, oy, hipY, meta, n) {
    if (P.beard) lay(f, (g) => beard(g, P.beard, ox, oy));
    lay(f, (g) => {
      const [hx, hy] = arm(g, sx, sy, P.near || [25, 95], 's', 's', n, n);
      if (P.finger) { put(g, hx, hy - 2, 's'); put(g, hx, hy - 3, 's'); return; }
      if (P.cheer) return;
      /* the scroll, rolled, in his hand */
      stroke(g, hx - 1, hy - 1, hx + 3, hy - 1, 1, 'w'); stroke(g, hx - 1, hy, hx + 3, hy, 1, 'W'); put(g, hx + 4, hy - 1, 'y'); put(g, hx + 4, hy, 'Y'); put(g, hx - 2, hy - 1, 'y'); put(g, hx - 2, hy, 'Y');
    });
  },
  hacker(f, P, sx, sy, ox, oy, hipY, meta, n) {
    lay(f, (g) => laptop(g, sx + 2, sy + 6, P, meta));
    lay(f, (g) => { arm(g, sx, sy, P.near || [15, 75], 'h', 's', n, n); });
  }
};

/* ------------------------------------------------------------------ the dragon: a chubby one, facing left */
const DR = ['f', 'd', 'D', 'e'], BELLY = ['l', 'l', 'L'];
const WINGS = [
  [[22, 1], [30, 0], [37, 5]],     /* up */
  [[16, 6], [29, 3], [40, 9]],     /* level */
  [[17, 15], [29, 19], [40, 18]],  /* down */
  [[20, 9], [28, 6], [36, 10]]     /* folded, at rest */
];
function dragon(P) {
  const f = grid(), ox = AX - 23, oy = GY - 33 + (P.jy || 0), X = (x) => ox + x, Y = (y) => oy + y;
  const tuck = P.fly ? 2 : 0;
  /* tail, curling up behind, with a spade at the tip */
  lay(f, (g) => {
    tube(g, [[X(32), Y(26)], [X(39), Y(29)], [X(44), Y(24)], [X(44), Y(17)]], 3.4, 1.2, DR);
    poly(g, [[X(44), Y(10)], [X(47), Y(16)], [X(44), Y(15)], [X(41), Y(16)]], 'D');
  });
  /* far legs */
  lay(f, (g) => { vol(g, X(30), Y(30 - tuck), 3, 3, ['D', 'e']); stroke(g, X(28), Y(32 - tuck), X(32), Y(32 - tuck), 1, 'e'); });
  /* body and belly plates, spikes along the back */
  lay(f, (g) => {
    vol(g, X(25), Y(21), 10.5, 9, DR);
    const inBody = (x, y) => ((x + .5 - X(25)) / 10.5) ** 2 + ((y + .5 - Y(21)) / 9) ** 2 <= 1;
    vol(g, X(20), Y(24), 6.5, 7, BELLY, (x, y) => inBody(x, y));
    for (let y = Y(19); y <= Y(30); y += 3) for (let x = X(13); x <= X(27); x++) if (inBody(x, y) && ((x + .5 - X(20)) / 6.5) ** 2 + ((y + .5 - Y(24)) / 7) ** 2 <= 1) put(g, x, y, 'L');
    [[24, 12], [29, 13], [33, 16]].forEach(([x, y]) => { put(g, X(x), Y(y - 1), 'l'); put(g, X(x), Y(y - 2), 'l'); put(g, X(x + 1), Y(y - 1), 'L'); });
  });
  /* neck and head; the jaw drops for a roar or a mouthful */
  lay(f, (g) => {
    tube(g, [[X(21), Y(17)], [X(16), Y(14)], [X(12), Y(12)]], 4.2, 4, DR);
    /* horns, swept back */
    poly(g, [[X(12), Y(6)], [X(15), Y(6)], [X(19), Y(0)]], (x, y) => (x + y) & 1 ? 'l' : 'L');
    poly(g, [[X(8), Y(5)], [X(11), Y(5)], [X(13), Y(0)]], 'L');
    const open = P.mouth || 0, puff = P.puff ? 1 : 0;
    vol(g, X(10), Y(11), 7 + puff, 6 + puff, DR);
    vol(g, X(4.5), Y(12), 4.8, 3.3, DR, open ? (x, y) => y < Y(13) : null);
    if (open) {
      const drop = open === 2 ? 4 : 3;
      poly(g, [[X(1), Y(13)], [X(9), Y(13)], [X(9), Y(13 + drop)], [X(2), Y(13 + drop)]], 'R');
      poly(g, [[X(1), Y(13 + drop)], [X(10), Y(13 + drop - 1)], [X(10), Y(15 + drop)], [X(2), Y(15 + drop)]], (x, y) => (y === Y(14 + drop) ? 'D' : 'd'));
      put(g, X(2), Y(13), 'w'); put(g, X(5), Y(13), 'w'); put(g, X(3), Y(12 + drop), 'w'); put(g, X(7), Y(12 + drop), 'w');
      if (open === 2) { put(g, X(4), Y(14), 'o'); put(g, X(5), Y(15), 'O'); put(g, X(6), Y(14), 'o'); }
    } else {
      stroke(g, X(1), Y(13), X(8), Y(13), 1, 'e'); put(g, X(9), Y(12), 'e'); put(g, X(3), Y(14), 'w');
    }
    put(g, X(1), Y(10), 'e');   /* nostril */
    /* the eye: big, looking ahead; a line when it blinks */
    if (P.blink) { stroke(g, X(7), Y(9), X(9), Y(9), 1, 'e'); }
    else { put(g, X(7), Y(8), 'w'); put(g, X(8), Y(8), 'w'); put(g, X(8), Y(9), 'w'); put(g, X(7), Y(9), 'k'); put(g, X(9), Y(8), 'w'); put(g, X(9), Y(9), 'w'); }
    stroke(g, X(6), Y(7), X(10), Y(6), 1, 'e');   /* brow */
  });
  /* the near wing: bones from the shoulder to three tips, membrane scalloped between them */
  lay(f, (g) => {
    const s = [X(24), Y(14)], tips = WINGS[P.wing ?? 3].map(([x, y]) => [X(x), Y(y)]);
    const root2 = [X(32), Y(16)], scal = (a, b) => [lerp(a[0], b[0], .5) + (s[0] - lerp(a[0], b[0], .5)) * .3, lerp(a[1], b[1], .5) + (s[1] - lerp(a[1], b[1], .5)) * .3];
    poly(g, [s, tips[0], scal(tips[0], tips[1]), tips[1], scal(tips[1], tips[2]), tips[2], root2], (x, y) => (y < s[1] - 4 ? 'm' : ((x + y) & 1) && y < s[1] ? 'm' : 'M'));
    tips.forEach((t) => stroke(g, s[0], s[1], t[0], t[1], 1, 'D'));
    put(g, s[0], s[1], 'd'); put(g, s[0] + 1, s[1], 'd');
  });
  /* near legs: a haunch and a front foot, claws forward */
  lay(f, (g) => { vol(g, X(31), Y(26 - tuck), 4.6, 4.6, DR); stroke(g, X(28), Y(32 - tuck), X(33), Y(32 - tuck), 1, 'D'); put(g, X(27), Y(32 - tuck), 'w'); put(g, X(29), Y(32 - tuck), 'w'); });
  lay(f, (g) => { vol(g, X(18), Y(29 - tuck), 2.6, 3, DR); stroke(g, X(16), Y(32 - tuck), X(20), Y(32 - tuck), 1, 'D'); put(g, X(15), Y(32 - tuck), 'w'); put(g, X(17), Y(32 - tuck), 'w'); });
  return { f, meta: { mouth: [X(0), Y(14)], nose: [X(1), Y(10)], head: Y(0) } };
}
/* the dragon sleeping off a big meal on its hoard: on its back, the belly up and round, its paws flopped over in the
   air, the tongue out of the corner of its mouth, wings flat under it; the head on the left, as it stands (P.eye: one
   eye open; P.breath: the belly risen) */
function claws(g, x, y, c, dx = 1) { stroke(g, x - 1, y, x + 1, y, 1, c); put(g, x + dx * 2, y, 'w'); put(g, x + dx * 2, y + 1, 'w'); }
function dragonBack(P) {
  const f = grid(), ox = AX - 23, oy = GY - 33, X = (x) => ox + x, Y = (y) => oy + y, DF = ['D', 'e'], b = P.breath ? 1 : 0;
  const inBody = (x, y) => ((x + .5 - X(24)) / 12) ** 2 + ((y + .5 - Y(25)) / 7.5) ** 2 <= 1;
  /* the far wing flat on the ground behind it, the far legs, the tail draped along the ground */
  lay(f, (g) => {
    poly(g, [[X(28), Y(29)], [X(44), Y(26)], [X(48), Y(31)], [X(42), Y(33)], [X(30), Y(33)]], (x, y) => (y < Y(30) || ((x + y) & 1) ? 'm' : 'M'));
    [[44, 26], [48, 31], [42, 33]].forEach(([x, y]) => stroke(g, X(31), Y(31), X(x), Y(y), 1, 'D'));
  });
  lay(f, (g) => { tube(g, [[X(19), Y(18)], [X(18.5), Y(13)], [X(16), Y(12)]], 1.7, 1.3, DF); });
  lay(f, (g) => { tube(g, [[X(27), Y(17)], [X(28), Y(12)], [X(30.5), Y(11.5)]], 1.8, 1.3, DF); });
  lay(f, (g) => {
    tube(g, [[X(34), Y(28)], [X(41), Y(31)], [X(47), Y(30)], [X(50), Y(26)]], 3.2, 1.2, DR);
    poly(g, [[X(50), Y(19)], [X(53), Y(25)], [X(50), Y(24)], [X(47), Y(25)]], 'D');
  });
  /* the body, and the belly risen round over it, plated */
  lay(f, (g) => {
    vol(g, X(24), Y(25), 12, 7.5, DR);
    const cy = 21 - b * .5, ry = 7 + b * .5, inBelly = (x, y) => ((x + .5 - X(23)) / 10) ** 2 + ((y + .5 - Y(cy)) / ry) ** 2 <= 1, keep = (x, y) => y < Y(24) || inBody(x, y);
    vol(g, X(23), Y(cy), 10, ry, BELLY, keep);
    for (let x = X(15); x <= X(31); x += 3) for (let y = Y(cy - ry); y <= Y(27); y++) if (inBelly(x, y) && inBelly(x, y - 1) && keep(x, y)) put(g, x, y, 'L');
  });
  /* the near legs, limp in the air, the paws flopped over */
  lay(f, (g) => { tube(g, [[X(15), Y(21)], [X(14), Y(15)], [X(11), Y(14)]], 2, 1.5, DR); claws(g, X(10), Y(15), 'd', -1); });
  lay(f, (g) => { vol(g, X(32), Y(20), 4, 3.6, DR); tube(g, [[X(32.5), Y(17)], [X(34), Y(12)], [X(37), Y(12)]], 2.1, 1.6, DR); claws(g, X(38), Y(13), 'd', 1); });
  /* neck and head, upside down: the jaw on top, a fang up, the tongue out, the horns along the ground */
  lay(f, (g) => {
    tube(g, [[X(15), Y(26)], [X(9), Y(27.5)]], 4.2, 4, DR);
    poly(g, [[X(6), Y(31)], [X(9), Y(31)], [X(15), Y(33)]], (x, y) => ((x + y) & 1 ? 'l' : 'L'));
    vol(g, X(6.5), Y(27.5), 6, 5, DR);
    vol(g, X(0.5), Y(27), 4.6, 3.2, DR);
    stroke(g, X(-3), Y(27), X(4), Y(27), 1, 'e'); put(g, X(2), Y(26), 'w');
    put(g, X(-4), Y(26), 'r'); put(g, X(-5), Y(25), 'r'); put(g, X(-5), Y(24), 'R');
    put(g, X(-2), Y(29), 'e');
    /* the eye: shut, a smile of a line; open, big and round, looking up at them */
    if (P.eye) { for (let y = 27; y <= 30; y++) for (let x = 4; x <= 7; x++) if ((y === 27 || y === 30) && (x === 4 || x === 7)) continue; else put(g, X(x), Y(y), 'w'); put(g, X(5), Y(28), 'k'); put(g, X(5), Y(29), 'k'); }
    else { put(g, X(4), Y(29), 'e'); put(g, X(5), Y(28), 'e'); put(g, X(6), Y(28), 'e'); put(g, X(7), Y(29), 'e'); }
  });
  /* the near wing, flat on the ground in front */
  lay(f, (g) => { poly(g, [[X(14), Y(31)], [X(25), Y(29.5)], [X(31), Y(33.5)], [X(12), Y(33.5)]], (x, y) => ((x + y) & 1 && y < Y(32) ? 'm' : 'M')); stroke(g, X(18), Y(31), X(30), Y(33), 1, 'D'); });
  return { f, meta: {} };
}
/* ------------------------------------------------------------------ the saucer (the 'ufo' 404): a metal disc, a glass dome,
   an antenna; legs from 0 (tucked up) to 1 (down, the pads on the ground). The rim's lamps are the scene's (meta.lamps). */
function saucer(P) {
  const f = grid(), X = (x) => AX + x, Y = (y) => GY - y, lg = P.legs || 0;
  for (const s of [-1, 1]) lay(f, (g) => {
    const fx = X(s * (14 + 5 * lg)), fy = Y(7 - 7 * lg);
    stroke(g, X(s * 12), Y(9), fx, fy, 1, 'G'); stroke(g, fx - 1, fy, fx + 1, fy, 1, 'Z');
  });
  lay(f, (g) => { vol(g, X(0), Y(10), 16, 3, ['Z', 'G', 'G', 'k']); stroke(g, X(-3), Y(8), X(3), Y(8), 1, 'c'); });
  lay(f, (g) => { vol(g, X(0), Y(13), 27, 4.5, ['w', 'z', 'Z', 'G']); stroke(g, X(-26), Y(13), X(26), Y(13), 1, 'G'); });
  lay(f, (g) => {
    vol(g, X(0), Y(17), 11, 9, ['w', 'c', 'c', 'A'], (x, y) => y < Y(16.5));
    [[-6, 21], [-5, 22], [-4, 23], [-6, 22]].forEach(([x, y]) => put(g, X(x), Y(y), 'w'));
  });
  lay(f, (g) => { stroke(g, X(4), Y(25), X(6), Y(29), 1, 'G'); put(g, X(6), Y(30), 'r'); put(g, X(7), Y(30), 'r'); put(g, X(6), Y(31), 'r'); });
  return { f, meta: { lamps: [-23, -17, -11, -5, 1, 7, 13, 19].map((x) => [X(x), Y(13)]) } };
}

/* ------------------------------------------------------------------ type: 7 rows over the baseline, an 8th for descenders.
   Each glyph is as wide as its rows; speech is set proportionally, a terminal on a 6 px pitch */
const GLYPHS = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  a: '.....|.....|.###.|....#|.####|#...#|.####', b: '#....|#....|####.|#...#|#...#|#...#|####.', c: '....|....|.###|#...|#...|#...|.###',
  d: '....#|....#|.####|#...#|#...#|#...#|.####', e: '.....|.....|.###.|#...#|#####|#....|.###.', f: '..##|.#..|####|.#..|.#..|.#..|.#..',
  g: '.....|.....|.####|#...#|#...#|.####|....#|.###.', h: '#....|#....|####.|#...#|#...#|#...#|#...#', i: '.#.|...|##.|.#.|.#.|.#.|###',
  j: '..#|...|.##|..#|..#|..#|..#|##.', k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '##.|.#.|.#.|.#.|.#.|.#.|###',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', n: '.....|.....|#.##.|##..#|#...#|#...#|#...#', o: '.....|.....|.###.|#...#|#...#|#...#|.###.',
  p: '.....|.....|####.|#...#|#...#|####.|#....|#....', q: '.....|.....|.####|#...#|#...#|.####|....#|....#', r: '....|....|#.##|##..|#...|#...|#...',
  s: '.....|.....|.####|#....|.###.|....#|####.', t: '.#..|.#..|####|.#..|.#..|.#..|..##', u: '.....|.....|#...#|#...#|#...#|#..##|.##.#',
  v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..', w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  y: '.....|.....|#...#|#...#|#...#|.####|....#|.###.', z: '.....|.....|#####|...#.|..#..|.#...|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.', 4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...', 8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  ' ': '...', '.': '.|.|.|.|.|.|#', ',': '..|..|..|..|..|.#|.#|#.', '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.|.|#|.|.|#|.', ';': '..|..|.#|..|..|.#|.#|#.', "'": '#|#', '"': '#.#|#.#', '-': '...|...|...|###', '_': '....|....|....|....|....|....|....|####',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....', '\\': '#....|.#...|.#...|..#..|...#.|...#.|....#', '$': '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  '>': '...|#..|.#.|..#|.#.|#..', '<': '...|..#|.#.|#..|.#.|..#', '(': '..#|.#.|#..|#..|#..|.#.|..#', ')': '#..|.#.|..#|..#|..#|.#.|#..',
  '[': '##|#.|#.|#.|#.|#.|##', ']': '##|.#|.#|.#|.#|.#|##', '~': '.....|.....|.#...|#.#.#|...#.', '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..', '+': '.....|..#..|..#..|#####|..#..|..#..', '=': '.....|.....|#####|.....|#####',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.####', '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '|': '#|#|#|#|#|#|#', '^': '..#..|.#.#.|#...#', '`': '#.|.#'
};
const GL = {}; Object.keys(GLYPHS).forEach((c) => { const rows = GLYPHS[c].split('|'); GL[c] = { w: rows[0].length, rows }; });
const glyph = (c) => GL[c] || GL['?'];
/* curly quotes, dashes and the ellipsis as the face has them */
const plain = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
function measure(s, mono) { if (mono) return Math.max(0, s.length * 6 - 1); let w = -1; for (const c of s) w += glyph(c).w + 1; return Math.max(0, w); }
/* set a line, calling dot(x, y) for each inked pixel; returns its width */
function setLine(s, x, y, mono, dot) {
  let cx = x;
  for (const c of s) {
    const g = glyph(c), o = mono ? (5 - g.w) >> 1 : 0;
    g.rows.forEach((r, ry) => { for (let rx = 0; rx < r.length; rx++) if (r[rx] === '#') dot(cx + o + rx, y + ry); });
    cx += mono ? 6 : g.w + 1;
  }
  return cx - x - 1;
}
/* words into lines no wider than w (a word longer than that is broken); '\n' breaks */
function wrap(s, w, mono) {
  const out = [];
  plain(s).split('\n').forEach((para) => {
    let line = '';
    para.split(/ +/).forEach((word) => {
      while (measure(word, mono) > w && word.length > 1) {
        let k = word.length - 1; while (k > 1 && measure(word.slice(0, k), mono) > w) k--;
        if (line) { out.push(line); line = ''; }
        out.push(word.slice(0, k)); word = word.slice(k);
      }
      const t = line ? line + ' ' + word : word;
      if (line && measure(t, mono) > w) { out.push(line); line = word; } else line = t;
    });
    out.push(line);
  });
  return out;
}


/* the builders, for the review sheet (sheet.html) */
export const SHEET = { person, dragon, dragonBack, saucer, RIG, PAL, LET, FW, FH, AX, GY, GL, setLine, measure, wrap };

/* ------------------------------------------------------------------ the strip */
/* the 404 script's lines (opts.lines or .lines() replaces any of them) */
export const LOST_LINES = {
  alien: 'Wait, I found the pages!',
  robot: 'Technically, we are standing on a page.',
  philo: 'We must wonder if the page ever existed to begin with.',
  cmd: 'git pull origin page',
  out: 'CONFLICT (dragon)'
};

/* the saucer 404's lines, by id (opts.lines or .lines() replaces any of them); UFO_SAY is the order and who says each. A
   hacker's line is a command, and the id with an o after it is what the terminal says back; z1 is the robot's, alone. */
export const UFO_LINES = {
  a1: "'Page not found.' Found by whom?",
  a2: 'By us. We crossed nine galaxies for this page.',
  a3: 'find / -name page', a3o: '0 results in 1 universe',
  a4: 'We must wonder if the page ever existed to begin with.',
  a5: 'Perhaps we should ask Claude.',
  a6: 'On my planet, nothing exists until it is lost.',
  a7: 'If a page 404s in a forest and no one requests it...',
  a8: '...it still gets logged.',
  a9: 'ping universe', a9o: 'Request timed out.',
  a10: 'So the universe is one big broken link.',
  a11: 'And we are merely its anchor text.',
  a12: 'We once lost a whole sun. Nobody noticed for a week.',
  a13: 'claude "where is the page?"', a13o: 'The page was inside you all along.',
  a14: 'Cogito, ergo 404.',
  a15: 'My battery is not found.',
  a16: 'Friends... how long have we been standing here?',
  a17: 'Nine hundred years. Next universe?',
  z1: '...Perhaps I should ask Claude.'
};
export const UFO_SAY = [['a1', 'philo'], ['a2', 'alien'], ['a3', 'hacker'], ['a4', 'philo'], ['a5', 'robot'], ['a6', 'alien'], ['a7', 'philo'], ['a8', 'robot'],
  ['a9', 'hacker'], ['a10', 'alien'], ['a11', 'philo'], ['a12', 'alien'], ['a13', 'hacker'], ['a14', 'philo'], ['a15', 'robot'], ['a16', 'philo'], ['a17', 'alien']];

/* opts: script 'fight' (the footer gag), 'lost' (the dragon 404) or 'ufo' (the saucer 404); lines (for 'lost'); minArt: the fewest art pixels across
   (the scale steps down so the scene fits); paused(): a host can hold the clock; autoplay: false waits for play() */
export function createParade(host, opts = {}) {
  const paused = opts.paused || (() => false);
  const SCRIPT = ['lost', 'ufo'].includes(opts.script) ? opts.script : 'fight';
  const cv = document.createElement('canvas'); cv.className = 'parade'; cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const ctx = cv.getContext('2d');
  /* art rows: the tallest of them with a speech bubble over him (the 404's bubbles run to three lines) */
  const AH = SCRIPT === 'fight' ? 54 : 72;
  const L = { aw: 1, k: 1, sc: 1 };
  let LINES = Object.assign({}, SCRIPT === 'ufo' ? UFO_LINES : LOST_LINES, opts.lines || {});
  let MODE = 'color', COL = {}, playing = false, clock = 0, last = 0, hold = -1, seen = false;
  const cache = new Map();

  /* colours: the tokens as drawn; ink = the same sprites in four tones of the page's ink (the screen keeps its green) */
  const probe = document.createElement('canvas').getContext('2d');
  const rgb = (s) => { probe.fillStyle = '#000'; probe.fillStyle = s || '#000'; const h = probe.fillStyle; return h[0] === '#' ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : (h.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
  function retoken() {
    const ink = rgb(cssv('--px-ink')), gnd = rgb(cssv('--px-ground'));
    LET.forEach((k) => {
      let c = rgb(cssv(PAL[k]));
      if (MODE === 'ink' && !'kpq'.includes(k)) {
        const lum = (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255, m = lum < .3 ? 0 : lum < .5 ? .38 : lum < .72 ? .62 : .84;
        c = ink.map((v, i) => Math.round(lerp(v, gnd[i], m)));
      }
      COL[k] = c;
    });
    COL.shadow = ink; cache.clear(); HOARD = null;
  }
  const css = (k, a = 1) => `rgba(${COL[k][0]},${COL[k][1]},${COL[k][2]},${a})`;
  /* a built frame, painted once into its own small canvas and kept */
  function sprite(key, build) {
    let s = cache.get(key); if (s) return s;
    if (cache.size > 900) cache.clear();
    const { f, meta } = build(), c = document.createElement('canvas'); c.width = FW; c.height = FH;
    const x = c.getContext('2d'), im = x.createImageData(FW, FH);
    for (let i = 0; i < f.length; i++) if (f[i]) { const q = COL[LET[f[i] - 1]]; im.data.set([q[0], q[1], q[2], 255], i * 4); }
    x.putImageData(im, 0, 0);
    s = { c, meta, f }; cache.set(key, s); return s;
  }
  const blit = (s, x, y) => ctx.drawImage(s.c, Math.round(x) - AX, Math.round(y) - GY);
  function px(x, y, k, w = 1, h = 1, a = 1) { ctx.fillStyle = css(k, a); ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function seg([x0, y0], [x1, y1], k) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) px(lerp(x0, x1, i / n), lerp(y0, y1, i / n), k); }
  function text(s, x, y, k, mono, a = 1) { ctx.fillStyle = css(k, a); return setLine(plain(s), Math.round(x), Math.round(y), mono, (X, Y) => ctx.fillRect(X, Y, 1, 1)); }
  /* a speech: words into at most three lines, as narrow as that allows (a long one widens to the room it has) */
  const wraps = new Map();
  function fit(s, mono, room) {
    const key = s + '\u0000' + mono + room; let ls = wraps.get(key); if (ls) return ls;
    for (let w = Math.min(118, room); ; w += 12) { ls = wrap(s, Math.min(w, room), mono); if (ls.length <= 3 || w >= room) break; }
    if (wraps.size > 200) wraps.clear();
    wraps.set(key, ls); return ls;
  }
  /* a speech bubble over (cx, by), one or more lines; dark = a terminal's glass and phosphor (set mono); right: the
     bubble keeps left of it (clear of the dragon); cur: 1 = a lit cursor after the last line */
  function bubble(cx, by, s, o = {}) {
    const dark = !!o.dark, mono = !!o.mono, right = Math.min(L.aw - 1, o.right ?? L.aw - 1);
    const ls = Array.isArray(s) ? s.map(plain) : fit(plain(s), mono, Math.max(30, right - 7));
    const tw = Math.max(...ls.map((l) => measure(l, mono))) + (o.cur ? 6 : 0);
    const w = tw + 6, h = 3 + ls.length * 10, x0 = clamp(Math.round(cx - w / 2), 1, Math.max(1, right - w)), y0 = Math.max(0, Math.round(by - h - 3));
    ctx.fillStyle = css('k'); ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
    ctx.fillStyle = dark ? css('q') : css('w'); ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
    const tx = clamp(Math.round(cx), x0 + 3, x0 + w - 5);
    px(tx - 1, y0 + h - 1, dark ? 'q' : 'w', 3, 1); px(tx - 2, y0 + h - 1, 'k'); px(tx + 2, y0 + h - 1, 'k');
    px(tx - 1, y0 + h, 'k'); px(tx + 1, y0 + h, 'k'); px(tx, y0 + h, dark ? 'q' : 'w'); px(tx, y0 + h + 1, 'k');
    ls.forEach((l, i) => text(l, x0 + 3, y0 + 3 + i * 10, dark ? 'p' : 'k', mono));
    if (o.cur === 1) px(x0 + 3 + measure(ls[ls.length - 1], mono) + (ls[ls.length - 1] ? 1 : 0), y0 + 3 + (ls.length - 1) * 10, 'p', 5, 7);
  }
  function shadow(x, w, lift = 0) {
    const k = clamp(1 - lift / 14, .4, 1), hw = Math.round(w * k / 2), y = GYS + 1;
    ctx.fillStyle = `rgba(${COL.shadow[0]},${COL.shadow[1]},${COL.shadow[2]},.16)`;
    ctx.fillRect(Math.round(x) - hw, y, hw * 2, 1); ctx.fillRect(Math.round(x) - hw + 2, y + 1, hw * 2 - 4, 1); ctx.fillRect(Math.round(x) - hw + 2, y - 1, hw * 2 - 4, 1);
  }

  /* ---------------------------------------------------------------- layout: the host's width, whole device pixels per art pixel */
  const GYS = AH - 4;   /* the ground row on the strip */
  function layout() {
    const r = host.getBoundingClientRect(), dpr = Math.min(3, devicePixelRatio || 1), phone = r.width < 700;
    L.k = Math.max(1, Math.round(knob('--parade-px', 1.5) * (phone ? .9 : 1) * dpr));
    if (opts.minArt) L.k = Math.max(1, Math.min(L.k, Math.floor(r.width * dpr / opts.minArt)));
    L.sc = L.k / dpr;
    L.aw = Math.max(1, Math.ceil(r.width / L.sc));
    cv.width = L.aw; cv.height = AH;
    cv.style.width = (L.aw * L.sc) + 'px'; cv.style.height = (AH * L.sc) + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------------------------------------------------------------- the script, in seconds */
  const ORDER = ['alien', 'robot', 'philo', 'hacker'], N = ORDER.length - 1, SP = 24, V = 48, STRIDE = 20;
  const CMD = 'rm -rf dragon', TY = .085;
  /* u: seconds into the gag (after the party halts) */
  const G = { roar: [.15, .95], aim: [1.2, 3.0], charge: [1.45, 1.75], beam: [1.75, 2.35], eat: 2.4,
    beep: [3.5, 4.3], wind: [4.25, 4.5], launch: [4.5, 4.62], bonk: 4.62, back: [4.95, 5.3], twang: [5.3, 5.7],
    philo: [6.0, 6.3, 7.8, 8.1], what: [7.2, 8.3],
    hacker: [8.3, 8.7, 11.7, 12.1], type0: 8.95, enter: 10.45, rm: 10.6, cheer: 12.5, exit: 13.9 };
  function plan() {
    /* the front one's spot and the dragon's, the whole tableau (back of the party to the dragon's tail) centred */
    const f0 = Math.round(L.aw / 2 + (N * SP + 8 - 84) / 2), dx = f0 + 60, tIn = (f0 + 16) / V;
    const tOut = tIn + G.exit, tEnd = tOut + (L.aw + 24 - (f0 - N * SP)) / V + 2.5;
    return { f0, dx, tIn, tOut, tEnd };
  }
  const bump = (u, a, b) => (u < a || u > b ? 0 : Math.sin(Math.PI * (u - a) / (b - a)));
  const ramp = (u, a, b) => clamp((u - a) / (b - a));
  const sm = (x) => x * x * (3 - 2 * x);
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const wq = (x) => Math.round(x * 8) / 8;   /* walk phases on eighths: an eight-frame cycle */

  function render(t) {
    const p = plan(), lt = ((t % p.tEnd) + p.tEnd) % p.tEnd, u = lt - p.tIn;
    ctx.clearRect(0, 0, L.aw, AH);
    const items = [], fx = [], bubbles = [];
    /* --- the party --- */
    ORDER.forEach((who, i) => {
      const home = p.f0 - i * SP, ph0 = i * .37;
      let x = home, P = {}, walking = false;
      if (lt < p.tIn) { x = home - (p.f0 + 16) + V * lt; walking = true; }
      else if (lt >= p.tOut) { x = home + V * (lt - p.tOut); walking = true; }
      if (u >= 0 && lt < p.tOut) {
        /* the dragon roars: everyone jumps back, a mark over each head */
        x -= 3 * sm(ramp(u, .3, .45)) * (1 - sm(ramp(u, 1.1, 1.4)));
        P.jy = -Math.round(3 * bump(u, .3 + i * .04, .62 + i * .04));
        if (u > .3 + i * .05 && u < 1.0) fx.push(['bang', who, i]);
        /* the cheer: two hops, arms up */
        const c0 = G.cheer + i * .06;
        if (u > c0 && u < c0 + .8) { P.jy = -Math.round(4 * Math.abs(Math.sin(Math.PI * (u - c0) / .4))); P.cheer = true; }
      }
      if (walking) P.ph = wq((x / STRIDE + ph0) % 1 + 1) % 1;
      /* --- each one's turn --- */
      if (who === 'alien' && u >= 0) {
        const a = sm(ramp(u, G.aim[0], G.aim[0] + .2)) * (1 - sm(ramp(u, G.aim[1] - .15, G.aim[1])));
        if (a > 0) { P.gun = a > .5; const kick = u > G.beam[0] && u < G.beam[1] && (Math.floor(u * 30) & 1) ? 5 : 0; P.near = [lerp(10, 95, a) + kick, lerp(0, 100, a) + kick]; }
      }
      if (who === 'robot') {
        P.key = Math.floor(lt * 5) & 1;
        if (u >= 0) {
          if (u > G.beep[0] && u < G.beep[1]) bubbles.push({ x, s: 'BEEP BOOP', who });
          if (u > G.wind[0] && u < G.launch[0]) { const w = sm(ramp(u, G.wind[0], G.wind[1])); P.near = [lerp(10, -40, w), lerp(0, -25, w)]; }
          else if (u >= G.launch[0] && u < G.back[1]) { P.near = [95, 100]; P.launch = true; }
          else if (u >= G.back[1] && u < G.twang[1]) P.near = Math.floor((u - G.back[1]) * 24) & 1 ? [100, 120] : [85, 90];   /* the arm twangs */
        }
      }
      if (who === 'philo' && u >= 0) {
        const [a0, a1, b0, b1] = G.philo, st = sm(ramp(u, a0, a1)) * (1 - sm(ramp(u, b0, b1)));
        x += 7 * st; if (st > 0 && st < 1) P.ph = wq((x / STRIDE) % 1);
        if (u > a1 && u < b0) { P.near = [95, 125]; P.finger = true; bubbles.push({ x, s: 'BUT IS IT REAL?', who }); }
      }
      if (who === 'hacker') {
        P.near = [15, 75]; P.far = [30, 80];
        if (u >= 0) {
          const [a0, a1, b0, b1] = G.hacker, st = sm(ramp(u, a0, a1)) * (1 - sm(ramp(u, b0, b1)));
          x += 4 * st; if (st > 0 && st < 1) P.ph = wq((x / STRIDE) % 1);
          if (u > a1 && u < b0) {
            const n = clamp(Math.floor((u - G.type0) / TY) + 1, 0, CMD.length), typing = u > G.type0 && u < G.type0 + CMD.length * TY + .05;
            if (typing) { const k = Math.floor((u - G.type0) / TY) & 1; P.near = [15, 75 + (k ? 10 : -5)]; P.far = [30, 80 + (k ? -5 : 8)]; P.flick = k; }
            if (u > G.enter && u < G.enter + .12) P.near = [30, 110];
            bubbles.push({ x: x + 4, s: '$ ' + CMD.slice(0, n), who, dark: true, cur: u < G.enter ? (Math.floor(u / .26) & 1 || typing ? 1 : 2) : 2 });
          }
        }
      }
      /* the cheer: arms up, out in front so no arm crosses a face; the laptop lights up */
      if (P.cheer) {
        /* the alien and the robot have big heads: a fist pumped out front instead of up */
        if (who === 'hacker') P.far = [120, 160];
        else { P.near = who === 'philo' ? [130, 160] : [100, 150]; P.gun = false; P.launch = false; }
      }
      if ((who === 'alien' || who === 'robot') && !P.near && P.ph != null) P.near = [10 - 22 * Math.cos(2 * Math.PI * P.ph), -4 * Math.cos(2 * Math.PI * P.ph)];
      if (!P.far && !P.cheer && P.ph != null) P.far = [-10 + 20 * Math.cos(2 * Math.PI * P.ph), 0];
      if (!P.far && P.cheer) P.far = [125, 165];
      if (!P.far) P.far = [-6, 0];
      /* poses on a coarse grid, so the frames kept stay few */
      ['near', 'far'].forEach((k) => { if (P[k]) P[k] = P[k].map((a) => Math.round(a / 5) * 5); });
      items.push({ who, x, P, i, fwd: x - home });
    });
    /* --- the dragon --- */
    const DX = p.dx, flyIn = [p.tIn - 2.7, p.tIn - .05];
    let dragonOn = lt > flyIn[0] && (u < G.rm), D = { wing: 3 }, dxx = DX, dyy = 0;
    if (lt > flyIn[0] && lt < flyIn[1]) {
      const k = ramp(lt, flyIn[0], flyIn[1]), e = 1 - (1 - k) ** 2;
      dxx = lerp(L.aw + 30, DX, e); dyy = -Math.round(lerp(18, 0, sm(k)) + 2 * Math.sin(lt * 9) * (1 - k));
      D = { wing: [0, 1, 2, 1][Math.floor(lt / .11) % 4], fly: true };
    } else if (u >= 0) {
      if (u < .25) fx.push(['dust']);
      if (u > G.roar[0] && u < G.roar[1]) D.mouth = 2;
      if (u > G.beam[0] + .05 && u < G.eat) D.mouth = 1;   /* it drinks the beam */
      if (u > G.eat && u < G.eat + .35) D.puff = true;
      if ((u > 3.1 && u < 3.23) || (u > G.bonk + .02 && u < G.bonk + .17) || (u > 7.5 && u < 7.63)) D.blink = true;
      if (u > G.bonk && u < G.bonk + .1) dxx += 1;
      if (u > G.what[0] && u < G.what[1]) bubbles.push({ x: DX - 10, s: '?', y: GYS - 34 });
      if (u < G.roar[0] || u > G.roar[1]) dyy = Math.round(Math.sin(u * 2.2) * .6);
      D.wing = u > G.what[0] && u < G.what[1] ? 0 : 3;
    } else if (lt < flyIn[0]) dragonOn = false;
    /* --- draw: shadows, the dragon, the party back to front, effects, then the bubbles --- */
    if (dragonOn) shadow(dxx + 2, 34, -dyy);
    items.forEach((m) => shadow(m.x, 14, -(m.P.jy || 0)));
    if (dragonOn) blit(sprite('dragon' + JSON.stringify(D), () => dragon(D)), dxx, GYS + dyy);
    if (u >= G.rm && lt < p.tOut) dissolve(DX, u - G.rm);
    const meta = {};
    /* back to front; whoever has stepped out of line for a turn is drawn over the rest */
    items.slice().sort((a, b) => (Math.abs(a.fwd - b.fwd) > .5 ? a.fwd - b.fwd : b.i - a.i)).forEach((m) => {
      const s = sprite(m.who + JSON.stringify(m.P), () => person(m.who, m.P));
      blit(s, m.x, GYS); meta[m.who] = { x: m.x, m: s.meta, P: m.P };
    });
    effects(u, meta, fx, DX);
    bubbles.forEach((b) => bubble(b.x, b.y ?? GYS + meta[b.who].m.head - GY - 2, [b.s], { dark: b.dark, mono: b.dark, cur: b.cur }));
  }
  /* things in the air: the marks, the landing dust, the ray, the spring fist, smoke, the roar's flame */
  function effects(u, meta, fx, DX) {
    const pos = (who, pt) => [meta[who].x + pt[0] - AX, GYS + pt[1] - GY];
    const snout = DX - 23;
    fx.forEach(([k, who, i]) => {
      if (k === 'bang') text('!', meta[who].x, GYS + meta[who].m.head - GY - 9 + (i & 1), 'r');
      if (k === 'dust') { const s = u / .25; for (let j = 0; j < 6; j++) { const d = 6 + s * 10 + j * 2; px(DX - d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); px(DX + 2 + d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); } }
    });
    /* the ray gun: sparks gather at the tip, then a wobbling beam the dragon drinks; a puff of smoke after */
    const am = meta.alien.m.muzzle;
    if (am) {
      const [mx, my] = pos('alien', am), tx = snout + 2, ty = GYS - 18;
      if (u > G.charge[0] && u < G.beam[0]) {
        const r0 = 4 - 3 * ramp(u, G.charge[0], G.beam[0]);
        for (let i = 0; i < 6; i++) { const a = u * 9 + i * 1.05; if (hash(i + Math.floor(u * 14)) > .3) px(mx + Math.cos(a) * (r0 + (i & 1)), my + Math.sin(a) * (r0 + (i & 1)), i & 1 ? 'c' : 'w'); }
      }
      if (u > G.beam[0] && u < G.beam[1]) {
        const ex = lerp(mx, tx, clamp((u - G.beam[0]) / .07));
        for (let x = mx; x <= ex; x++) {
          const y = Math.round(lerp(my, ty, (x - mx) / Math.max(1, tx - mx))), w = Math.sin(x * .9 - u * 50) > 0 ? 1 : -1;
          px(x, y - w, 'c'); px(x, y, 'w'); if (hash(x + Math.floor(u * 30) * 7) > .55) px(x, y + 2 * w, 'c');
        }
        px(mx - 1, my - 2, 'w', 2, 5, .8);
      }
    }
    if (u > G.eat + .35 && u < G.eat + 1.3) {
      for (let i = 0; i < 4; i++) { const a = u - G.eat - .35 - i * .12; if (a < 0 || a > .7) continue; const r = 1 + Math.floor(a * 4); px(snout + 2 - a * 6 + (i & 1) * 2, GYS - 25 - a * 16 - i, a < .35 ? 'v' : 'g', r, r, 1 - a / .7); }
    }
    /* the robot's fist, on a spring that arcs over the alien to the dragon's snout, and back */
    const rb = meta.robot.m.hand;
    if (rb && meta.robot.P.launch) {
      const A = pos('robot', rb), B = [snout + 2, GYS - 25], C = [lerp(A[0], B[0], .45), GYS - 52];
      const k = u < G.bonk ? sm(ramp(u, G.launch[0], G.bonk)) : u < G.back[0] ? 1 : 1 - sm(ramp(u, G.back[0], G.back[1]));
      const q = (s) => [(1 - s) ** 2 * A[0] + 2 * (1 - s) * s * C[0] + s * s * B[0], (1 - s) ** 2 * A[1] + 2 * (1 - s) * s * C[1] + s * s * B[1]];
      const n = Math.max(2, Math.round(k * 28));
      let pr = A;
      for (let i = 1; i <= n; i++) {
        const s = k * i / n, [x, y] = q(s), [x2, y2] = q(s + .01), l = Math.hypot(x2 - x, y2 - y) || 1, o = i === n ? 0 : i & 1 ? 1.6 : -1.6;
        const pt = [x - (y2 - y) / l * o, y + (x2 - x) / l * o]; seg(pr, pt, 'k'); pr = pt;
      }
      const [fx0, fy0] = q(k), X0 = Math.round(fx0) - 3, Y0 = Math.round(fy0) - 3;
      px(X0 + 1, Y0, 'k', 5, 7); px(X0, Y0 + 1, 'k', 7, 5); px(X0 + 1, Y0 + 1, 'z', 5, 5); px(X0 + 1, Y0 + 5, 'Z', 5, 1); px(X0 + 5, Y0 + 1, 'Z', 1, 5);
      px(X0 + 1, Y0 + 1, 'w'); px(X0 + 3, Y0 + 2, 'Z', 1, 2);
      if (u > G.bonk && u < G.bonk + .22) { const [x, y] = B; [[0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, 4], [4, -4], [-4, 4]].forEach(([a, b], i) => px(x + a, y + b, i < 4 ? 'O' : 'y')); }
    }
    /* the roar: a short jet of flame that falls well short of them */
    if (u > G.roar[0] + .08 && u < G.roar[1] + .3) {
      for (let i = 0; i < 46; i++) {
        const s0 = G.roar[0] + .08 + hash(i) * .62, life = .26 + hash(i + 50) * .16, a = u - s0; if (a < 0 || a > life) continue;
        const k = a / life, x = snout - 1 - a * (95 + 50 * hash(i + 9)), y = GYS - 15 + (hash(i + 3) - .5) * 34 * a;
        px(x, y, k < .25 ? 'O' : k < .55 ? 'o' : k < .8 ? 'r' : 'g', k < .5 ? 2 : 1, k < .5 ? 2 : 1);
      }
    }
  }
  /* rm -rf: the dragon comes apart into its own pixels, the head first, and they drift up and off as ink dust */
  let DUST = null;
  function dissolve(DX, a) {
    if (!DUST) {
      const s = sprite('dragon' + JSON.stringify({ wing: 3 }), () => dragon({ wing: 3 }));
      DUST = []; for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const v = s.f[y * FW + x]; if (v) DUST.push([x - AX, y - GY, LET[v - 1], DUST.length]); }
    }
    DUST.forEach(([x, y, k, i]) => {
      const d = .1 + (x + 24) / 50 * .6 + hash(i) * .35, b = a - d;
      if (b < 0) { px(DX + x, GYS + y, k); return; }
      const life = .7 + hash(i + 7) * .8; if (b > life) return;
      const q = b / life; if (hash(i * 3.1 + Math.floor(b * 14)) < q * .9) return;
      px(DX + x + b * (5 + 16 * hash(i + 2)) + Math.sin(b * 6 + i) * 1.2, GYS + y - b * (9 + 22 * hash(i + 4)), q < .3 ? k : 'k');
    });
  }

  /* ================================================================ the 404 (script 'lost'): the missing pages are a
     dragon's hoard, and it is asleep on its back on top of them. The four tiptoe in. The alien scans it; the robot and
     the philosopher have their say; the hacker tries git. Then the robot's spring fist snags a loose page by its corner
     and tugs it free. The dragon opens an eye, rolls onto its feet, and they run. It takes off after them, spitting
     fireballs at their heels, sees them off the left edge, flies home, turns once round and flops back down. */
  const VT = 44, VR = 78, FT = .3, XS = 40, PH = 12, UP = 19;   /* ... the hoard's height; how high it flies */   /* tiptoe and run speeds; a fireball's flight; where the chase stops; the hoard's height */
  const RLAG = [.14, .06, .09, 0], SHOT = [0, 1, 0];   /* who bolts when; whose heels each fireball is for */
  const read = (s) => clamp(1.2 + plain(s).length * .05, 2, 4.6);   /* seconds a line stays up, by its length */
  let PL = null, PLk = '';
  function planLost() {
    const key = L.aw + JSON.stringify(LINES); if (key === PLk) return PL;
    const f0 = Math.round(L.aw / 2 + (N * SP + 8 - 84) / 2), dx = f0 + 60, T = {};
    let t = (f0 + 16) / VT + .4;
    T.scan = [t, t + 2.3]; T.aq = [T.scan[1] - .4, T.scan[1] - .4 + read(LINES.alien)]; t = T.aq[1] + .3;
    T.rq = [t, t + read(LINES.robot)]; t = T.rq[1] + .3;
    T.pstep = [t, t + .3]; T.pq = [t + .35, t + .35 + read(LINES.philo)]; T.pback = [T.pq[1], T.pq[1] + .3]; t = T.pback[1] + .1;
    T.hstep = [t, t + .4]; T.type0 = t + .65; T.enter = T.type0 + plain(LINES.cmd).length * TY + .35; T.out = T.enter + .25;
    T.hback = [T.out + 1.6, T.out + 2]; t = T.hback[1] + .1;
    T.grab = [t, t + .45, t + 1.3, t + 1.65];   /* the fist out; two tugs; the page comes free; the fist home */
    T.eye = T.grab[3] + .6; T.roll = T.eye + .9; T.flee = T.roll + .15; T.lift = T.roll + .5;
    /* a narrow stage runs slower, so the chase lasts long enough for the fireballs */
    const run = Math.max((f0 + 20) / VR, 2.2), vr = (f0 + 20) / run, chase = run + .3;
    T.shots = [.42, .62, .82].map((k) => T.flee + run * k - FT);
    T.hover = T.lift + chase; T.turn = T.hover + .6; T.home = T.turn + (dx - XS) / 120; T.flop = T.home + .6;
    PL = { f0, dx, T, vr, chase, tEnd: T.flop + 2 }; PLk = key; return PL;
  }
  /* where the dragon is at u and how it looks: on its back on the hoard, on its feet, in the air, home again */
  function dragonAt(u, p) {
    const T = p.T, DX = p.dx, bob = Math.round(Math.sin(u * 9) * .8);
    const flap = { wing: [0, 1, 2, 1][Math.floor(u / .11) % 4], fly: true };
    const breath = Math.sin(u * 4.3 + .6 * Math.sin(u * 1.1)) > 0 ? 1 : 0;
    if (u < T.roll) return { x: DX, y: -PH, back: { breath: u < T.grab[1] ? breath : 1, eye: u > T.eye ? 1 : 0 } };   /* it holds its breath at the tug */
    if (u < T.lift) return { x: DX, y: -PH - Math.round(5 * bump(u, T.roll, T.roll + .3)), D: { wing: u > T.roll + .25 ? 0 : 3, mouth: u > T.roll + .25 ? 2 : 0 } };
    if (u < T.hover) {
      const s = u - T.lift, D = Object.assign({}, flap);
      if (T.shots.some((ts) => u > ts - .12 && u < ts + .1)) D.mouth = 2;
      return { x: DX - (DX - XS) * sm(clamp(s / p.chase)), y: -PH - UP * sm(clamp(s / .5)) + bob, D };
    }
    if (u < T.turn) return { x: XS, y: -PH - UP + bob, D: Object.assign({}, flap, u > T.hover + .2 && u < T.hover + .4 ? { mouth: 1 } : {}) };
    if (u < T.home) { const k = sm((u - T.turn) / (T.home - T.turn)); return { x: lerp(XS, DX, k), y: Math.round(lerp(-PH - UP, -PH, k) + bob * (1 - k)), D: flap, flip: true }; }
    /* home: it lands facing the way it came, turns round once, and flops onto its back at the top of a hop */
    if (u < T.flop + .15) return { x: DX, y: -PH - Math.round(4 * bump(u, T.flop, T.flop + .3)), D: { wing: 3 }, flip: u < T.home + .3 };
    return { x: DX, y: -PH - Math.round(4 * bump(u, T.flop, T.flop + .3)), back: { breath: u > T.flop + .6 ? breath : 1 } };
  }
  /* a fire on the ground: three frames of a flame, 7 by 9, flickering; h rows of it show as it dies down */
  const FLAME = [
    ['...r...', '..rr...', '..ror..', '.roor.r', '.rooorr', 'rroOorr', 'roOOOor', 'roOOOor', '.rooor.'],
    ['....r..', '...rr..', '..ror..', 'r.roor.', 'rrooor.', 'rroOorr', 'roOOOor', 'roOOOor', '.rooor.'],
    ['..r....', '..rr.r.', '.rorrr.', '.roor..', 'rrooorr', 'rooOorr', 'roOOOor', 'roOOOor', '.rooor.']
  ];
  function flame(cx, h, n) {
    const F = FLAME[((n % 3) + 3) % 3];
    for (let r = Math.max(0, 9 - h); r < 9; r++) for (let c = 0; c < 7; c++) { const k = F[r][c]; if (k !== '.') px(cx - 3 + c, GYS - 9 + r + 1, k); }
  }
  /* a sheet of paper on end, 5 by 7 inside its outline, three lines of writing */
  function paper(x, y) {
    x = Math.round(x); y = Math.round(y);
    px(x, y, 'k', 7, 9); px(x + 1, y + 1, 'w', 5, 7);
    for (let j = 0; j < 3; j++) px(x + 2, y + 2 + j * 2, 'g', j === 2 ? 2 : 3, 1);
  }
  /* the hoard: a heap of pages, sheet on sheet, ragged at the edges, one sliding off; one stands up with its writing
     showing. The sheets make one white mound, outlined only round the outside; each shows as the shaded line under it.
     Built once per palette into its own canvas, 96 by 24, its middle bottom on the dragon's spot */
  let HOARD = null;
  function hoard() {
    if (HOARD) return HOARD;
    const W = 96, H = 24, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), P = (x, y, k, w = 1, h = 1) => { g.fillStyle = css(k); g.fillRect(Math.round(x), Math.round(y), w, h); };
    const X = (x) => Math.round(48 + x), Y = (y) => Math.round(H - 1 - y);   /* x from the middle, y up from the ground */
    const fill = new Uint8Array(W * H), under = [];
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) fill[y * W + x] = 1; };
    /* a sheet seen edge on, (x0, y0) to (x1, y1): two rows of paper, the lower one in shade */
    const edge = (x0, y0, x1, y1) => {
      const n = Math.abs(x1 - x0), d = Math.sign(x1 - x0) || 1;
      for (let i = 0; i <= n; i++) { const x = X(x0 + d * i), y = Y(y0 + (y1 - y0) * i / n); mark(x, y - 1); mark(x, y); under.push([x, y]); }
    };
    /* a page stuck in the heap on end, poking out of the top behind its tail (drawn first: the heap covers its foot) */
    for (let r = 0; r < 9; r++) { const o = Math.round(3 * r / 8); P(X(19) + o - 1, Y(10 + r), 'k', 9, 1); if (r < 8) P(X(19) + o, Y(10 + r), 'w', 7, 1); }
    [[6, 5], [4, 5], [2, 5]].forEach(([r, w]) => P(X(19) + Math.round(3 * r / 8) + 1, Y(10 + r), 'g', w, 1));
    for (let k = 0; k < 6; k++) {
      const hw = 36 - k * 1.8;
      for (let x = -hw + (hash(k * 7) - .5) * 3, j = 0; x < hw; j++) {
        const len = 9 + Math.floor(hash(k * 13 + j) * 6), dy = Math.round((hash(k * 5 + j * 3) - .5) * 2.4);
        edge(x, 1 + 2 * k, Math.min(x + len, hw + 2), 1 + 2 * k + dy); x += len - 3;
      }
    }
    edge(29, 11, 40, 1);   /* one sliding off the right */
    edge(-22, 13, -11, 13); edge(4, 13, 15, 14);   /* loose on top, under the dragon */
    /* solid from each column's top sheet down to the ground (no gaps inside), outlined round the outside only */
    for (let x = 0; x < W; x++) { let top = -1; for (let y = 0; y < H; y++) if (fill[y * W + x]) { top = y; break; } if (top >= 0) for (let y = top; y < H; y++) fill[y * W + x] = 1; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (fill[y * W + x]) { P(x, y, 'w'); continue; }
      const nb = (a, b) => a >= 0 && b >= 0 && a < W && b < H && fill[b * W + a];
      if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) P(x, y, 'k');
    }
    /* the sheets' edges: a broken line under each, the way a stack of paper looks from the side */
    under.forEach(([x, y], i) => { if (hash(i * .37) > .3 && fill[(y - 1) * W + x] && y + 1 < H && fill[(y + 1) * W + x]) P(x, y, 'W'); });
    /* a sheet standing on end against the right side, leaning, three lines of writing */
    for (let r = 0; r < 9; r++) { const o = Math.round(-2 * r / 8); P(X(36) + o - 1, Y(r), 'k', 9, 1); if (r && r < 8) P(X(36) + o, Y(r), 'w', 7, 1); }
    [[6, 5], [4, 5], [2, 3]].forEach(([r, w]) => P(X(36) + Math.round(-2 * r / 8) + 1, Y(r), 'g', w, 1));
    HOARD = c; return c;
  }
  /* the page the robot goes for, leaning on the heap's left end: x is its left edge */
  function loose(x) { paper(x, GYS - 8); }
  /* the spring arm, out along an arc from A over to B, k of the way; the fist at its end (returns the fist's centre) */
  function spring(A, B, k) {
    const C = [lerp(A[0], B[0], .45), GYS - 68];   /* high enough to clear the alien's antennae */
    const q = (s) => [(1 - s) ** 2 * A[0] + 2 * (1 - s) * s * C[0] + s * s * B[0], (1 - s) ** 2 * A[1] + 2 * (1 - s) * s * C[1] + s * s * B[1]];
    const n = Math.max(2, Math.round(k * 30));
    let pr = A;
    for (let i = 1; i <= n; i++) {
      const s = k * i / n, [x, y] = q(s), [x2, y2] = q(s + .01), l = Math.hypot(x2 - x, y2 - y) || 1, o = i === n ? 0 : i & 1 ? 1.6 : -1.6;
      const pt = [x - (y2 - y) / l * o, y + (x2 - x) / l * o]; seg(pr, pt, 'k'); pr = pt;
    }
    const [fx0, fy0] = q(k), X0 = Math.round(fx0) - 3, Y0 = Math.round(fy0) - 3;
    px(X0 + 1, Y0, 'k', 5, 7); px(X0, Y0 + 1, 'k', 7, 5); px(X0 + 1, Y0 + 1, 'z', 5, 5); px(X0 + 1, Y0 + 5, 'Z', 5, 1); px(X0 + 5, Y0 + 1, 'Z', 1, 5);
    px(X0 + 1, Y0 + 1, 'w'); px(X0 + 3, Y0 + 2, 'Z', 1, 2);
    return [Math.round(fx0), Math.round(fy0)];
  }
  /* dust thrown out both ways from under a landing, b seconds after it */
  function dust(cx, w, b) {
    if (b < 0 || b > .3) return;
    const s = b / .3; for (let j = 0; j < 6; j++) { const d = w / 2 + s * 10 + j * 2; px(cx - d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); px(cx + d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); }
  }
  /* the ground they stand on: a dashed line in the shadows' ink */
  function ground() { ctx.fillStyle = `rgba(${COL.shadow[0]},${COL.shadow[1]},${COL.shadow[2]},.14)`; for (let x = 1; x < L.aw; x += 4) ctx.fillRect(x, GYS + 2, 2, 1); }
  /* a person turned round: the sprite mirrored about its centre column */
  function blitF(s, x, y) { ctx.save(); ctx.translate(Math.round(x) + 1, 0); ctx.scale(-1, 1); ctx.drawImage(s.c, -AX, Math.round(y) - GY); ctx.restore(); }

  function renderLost(t) {
    const p = planLost(), T = p.T, u = ((t % p.tEnd) + p.tEnd) % p.tEnd, DX = p.dx, right = DX - 32, G3 = T.grab;
    ctx.clearRect(0, 0, L.aw, AH);
    ground();
    const items = [], fx = [], bubbles = [];
    const runX = (i, v) => p.f0 - i * SP - p.vr * Math.max(0, v - T.flee - RLAG[i]);
    const shots = T.shots.map((ts, j) => ({ ts, tl: ts + FT, X: Math.round(runX(SHOT[j], ts + FT) + 7) }));
    /* the page's corner, and how far the tugs have drawn it out */
    const tug = u < G3[1] ? 0 : -2 * (u > G3[1] + .15) - 3 * (u > G3[1] + .55), x0 = DX - 45 + tug;
    /* --- the party --- */
    ORDER.forEach((who, i) => {
      const home = p.f0 - i * SP, ph0 = i * .37, r0 = T.flee + RLAG[i], here = u < r0;
      let x = home, P = {};
      if (here) {
        const xin = home - (p.f0 + 16) + VT * u;
        if (xin < home) { x = xin; P.tip = true; P.ph = wq((x / 14 + ph0) % 1 + 1) % 1; }
      } else { x = runX(i, u); P.run = true; P.ph = wq((-x / 28 + ph0) % 1 + 1) % 1; }
      /* the eye opens: a jump and a mark over each */
      const a = T.eye + i * .05; if (u > a && u < a + .8) { fx.push(['bang', who, i]); P.jy = -Math.round(3 * bump(u, a, a + .32)); }
      /* a fireball at someone's heels: whoever it lands by jumps it */
      if (!here) shots.forEach((s) => {
        const tc = Math.max(s.tl, r0 + (home - s.X) / p.vr), over = tc > s.tl + .05, w = over ? .22 : .17;   /* over: running into it, a big jump */
        if (tc - s.tl < .4 && Math.abs(runX(i, tc) - s.X) < 10 && u > tc - w && u < tc + w) P.jy = -Math.round((over ? 10 : 5) * bump(u, tc - w, tc + w));
      });
      if (who === 'alien' && here) {
        const k = sm(ramp(u, T.scan[0], T.scan[0] + .25)) * (1 - sm(ramp(u, T.scan[1] - .25, T.scan[1])));
        if (k > 0) { P.gun = k > .5; P.near = [lerp(10, 90, k), lerp(0, 95, k)]; }
        if (u > T.aq[0] && u < T.aq[1]) bubbles.push({ x, s: LINES.alien, who });
      }
      if (who === 'robot') {
        P.key = Math.floor(u * 5) & 1;
        P.bulb = hash(Math.floor(u * 9)) > .05 ? 1 : 0;   /* a steady lamp; once in a while it drops out */
        if (here && u > T.rq[0] && u < T.rq[1]) bubbles.push({ x, s: LINES.robot, who });
        if (here && u > G3[0] && u < G3[3]) { P.near = [95, 100]; P.launch = true; if (bump(u, G3[1] + .1, G3[1] + .35) + bump(u, G3[1] + .5, G3[1] + .75) > .2) x -= 2; }   /* it leans back on each tug */
        else if (u >= G3[3]) P.near = here ? [100, 145] : [140, 170];   /* the page held up, and held high as it runs */
      }
      if (who === 'philo' && here) {
        const st = sm(ramp(u, T.pstep[0], T.pstep[1])) * (1 - sm(ramp(u, T.pback[0], T.pback[1])));
        x += 7 * st; if (st > 0 && st < 1) P.ph = wq((x / STRIDE) % 1);
        if (u > T.pq[0] && u < T.pq[1]) { P.near = [95, 125]; P.finger = true; bubbles.push({ x, s: LINES.philo, who }); }
      }
      if (who === 'hacker') {
        P.near = [15, 75]; P.far = [30, 80];
        if (here) {
          const st = sm(ramp(u, T.hstep[0], T.hstep[1])) * (1 - sm(ramp(u, T.hback[0], T.hback[1])));
          x += 4 * st; if (st > 0 && st < 1) P.ph = wq((x / STRIDE) % 1);
          if (u > T.hstep[1] && u < T.hback[0]) {
            const cmd = plain(LINES.cmd), n = clamp(Math.floor((u - T.type0) / TY) + 1, 0, cmd.length), typing = u > T.type0 && u < T.type0 + cmd.length * TY + .05;
            if (typing) { const k = Math.floor((u - T.type0) / TY) & 1; P.near = [15, 75 + (k ? 10 : -5)]; P.far = [30, 80 + (k ? -5 : 8)]; P.flick = k; }
            if (u > T.enter && u < T.enter + .12) P.near = [30, 110];
            const room = Math.max(30, right - 7), ls = wrap('$ ' + cmd.slice(0, n), room, true);
            if (u > T.out) ls.push(...wrap(LINES.out, room, true));
            bubbles.push({ x: x + 4, s: ls, who, dark: true, cur: u < T.enter ? (Math.floor(u / .26) & 1 || typing ? 1 : 2) : 2 });
          }
        }
      }
      if ((who === 'alien' || who === 'robot') && !P.near && P.ph != null) P.near = [10 - 22 * Math.cos(2 * Math.PI * P.ph), -4 * Math.cos(2 * Math.PI * P.ph)];
      if (!P.far && P.ph != null) P.far = [-10 + 20 * Math.cos(2 * Math.PI * P.ph), 0];
      if (!P.far) P.far = [-6, 0];
      ['near', 'far'].forEach((k) => { if (P[k]) P[k] = P[k].map((a) => Math.round(a / 5) * 5); });
      items.push({ who, x, P, i, fwd: x - home, flip: !here });
    });
    /* --- draw: the hoard and the dragon, the party back to front, the effects, then the bubbles --- */
    const dg = dragonAt(u, p);
    shadow(DX, 76, 0);
    if (!dg.back && dg.y < -PH) shadow(dg.x + 2, 34, -PH - dg.y);
    items.forEach((m) => { if (m.x > -20 && m.x < L.aw + 20) shadow(m.x, 14, -(m.P.jy || 0)); });
    if (u < G3[2]) loose(x0);
    else if (u > T.flop + .15) loose(lerp(DX - 38, DX - 45, sm(ramp(u, T.flop + .15, T.flop + .45))));   /* the flop squeezes a page out */
    ctx.drawImage(hoard(), DX - 48, GYS - 23);
    if (dg.back) blit(sprite('back' + JSON.stringify(dg.back), () => dragonBack(dg.back)), dg.x, GYS + dg.y);
    else (dg.flip ? blitF : blit)(sprite('dragon' + JSON.stringify(dg.D), () => dragon(dg.D)), dg.x, GYS + dg.y);
    /* the fireballs, out of its mouth and down at someone's heels (behind the party, so they pass behind whoever they fly by) */
    shots.forEach((s) => {
      if (u <= s.ts || u >= s.tl) return;
      const d0 = dragonAt(s.ts, p), S = [d0.x - 22, GYS + d0.y - 18], E = [s.X, GYS - 2];
      const at = (a) => [lerp(S[0], E[0], a), lerp(S[1], E[1], a * a * .7 + a * .3)], a = (u - s.ts) / FT;
      for (let j = 5; j >= 1; j--) { const b = a - j * .06; if (b < 0) continue; const [x, y] = at(b), r = j < 3 ? 2 : 1; px(x - (r >> 1), y - (r >> 1), j < 2 ? 'o' : j < 4 ? 'r' : 'g', r, r, 1 - j * .15); }
      const [x, y] = at(a), X0 = Math.round(x), Y0 = Math.round(y);
      px(X0 - 2, Y0 - 1, 'r', 5, 3); px(X0 - 1, Y0 - 2, 'r', 3, 5); px(X0 - 1, Y0 - 1, 'o', 3, 3); px(X0, Y0 - 1, 'O', 1, 2); px(X0 - 1, Y0, 'O', 2, 1);
    });
    const meta = {};
    items.slice().sort((a, b) => (Math.abs(a.fwd - b.fwd) > .5 ? a.fwd - b.fwd : b.i - a.i)).forEach((m) => {
      const s = sprite(m.who + JSON.stringify(m.P), () => person(m.who, m.P));
      (m.flip ? blitF : blit)(s, m.x, GYS); meta[m.who] = { x: m.x, m: s.meta, P: m.P, flip: m.flip };
    });
    const pos = (who, pt) => { const m = meta[who]; return [m.x + (m.flip ? AX - pt[0] : pt[0] - AX), GYS + pt[1] - GY]; };
    fx.forEach(([k, who, i]) => { if (k === 'bang') text('!', meta[who].x, GYS + meta[who].m.head - GY - 9 + (i & 1), 'r'); });
    /* zzz while it sleeps, over its head (it stops at the tug, and starts again once it has flopped) */
    if (u < G3[1] + .2 || u > T.flop + .8) for (let j = 0; j < 3; j++) { const a = ((u + j * .7) % 2.1) / 2.1; text(j & 1 ? 'Z' : 'z', DX - 22 + a * 8, GYS - PH - 30 - a * 17, 'g', false, Math.min(1, (1 - a) * 2.5)); }
    /* the alien's scanner: a bar of light swept along the dragon, nose to tail and back, fanned from the muzzle */
    const am = meta.alien.m.muzzle;
    if (am && u > T.scan[0] + .3 && u < T.scan[1] - .25) {
      const [mx, my] = pos('alien', am), s = u - T.scan[0] - .3, y0 = GYS - PH - 30, y1 = GYS - 1;
      [.9, .35, .15].forEach((al, j) => {
        const bx = Math.round(lerp(DX - 36, DX + 36, .5 - .5 * Math.cos((s - j * .05) * 3.6)));
        px(bx, y0, 'c', j ? 1 : 2, y1 - y0 + 1, al);
        if (!j) for (let d = 2; d < 40; d += 2) { const k = d / 40; px(lerp(mx, bx, k), lerp(my, y0, k), 'c', 1, 1, .45); px(lerp(mx, bx, k), lerp(my, y1, k), 'c', 1, 1, .45); }
      });
    }
    /* the grab: the robot's fist on its spring, over the alien to the page's corner; two tugs; home with the page */
    const rh = meta.robot.m.hand;
    if (rh && u > G3[0] && u < G3[3]) {
      const k = u < G3[1] ? sm(ramp(u, G3[0], G3[1])) : u < G3[2] ? 1 : 1 - sm(ramp(u, G3[2], G3[3]));
      const [fx0, fy0] = spring(pos('robot', rh), [x0 + 3, GYS - 9], k);
      if (u > G3[2]) paper(fx0 - 3, fy0 + 2);
    } else if (rh && u >= G3[3] && meta.robot.x > -12) { const [hx, hy] = pos('robot', rh); paper(hx - 3, hy - 10); }
    /* the dragon's snarl as it rolls over, and its snort at the edge: smoke out of the nose */
    for (const [a0, n] of [[T.roll + .3, 3], [T.hover + .2, 4]]) {
      const b = u - a0; if (b < 0 || b > .8) continue;
      const nx = dg.x - 22, ny = GYS + dg.y - 23;
      for (let j = 0; j < n; j++) { const c = b - j * .1; if (c < 0 || c > .6) continue; const r = 1 + Math.floor(c * 4); px(nx - c * 8 + (j & 1) * 2, ny - c * 14 - j, c < .3 ? 'v' : 'g', r, r, 1 - c / .6); }
    }
    dust(DX, 40, u - T.roll - .3); dust(DX, 40, u - T.home); dust(DX, 40, u - T.flop - .3);
    /* where each fireball landed: a fire that flickers and dies down, a few sparks, a scorch that fades */
    shots.forEach((s) => {
      const b = u - s.tl; if (b < 0) return;
      if (b < 1.6) px(s.X - 3, GYS + 1, 'G', 7, 1, .7 * (1 - b / 1.6));
      if (b < .6) flame(s.X, Math.round(9 * (b < .22 ? 1 : 1 - (b - .22) / .38)), Math.floor(u / .07));
      if (b < .45) for (let j = 0; j < 7; j++) {
        const c = b - hash(j + s.X) * .15; if (c < 0 || c > .3) continue;
        px(s.X + (hash(j + 2) - .5) * 14 + (hash(j + 4) - .5) * 30 * c, GYS - 4 - c * (40 + hash(j + 6) * 30), c < .15 ? 'O' : 'o');
      }
    });
    bubbles.forEach((b) => bubble(b.x, b.y ?? GYS + meta[b.who].m.head - GY - 2, b.s, { dark: b.dark, mono: b.dark, cur: b.cur, right: b.who ? right : undefined }));
  }

  /* ================================================================ the saucer 404 (script 'ufo'). Ethan 2026-10-17: "Have
     them all come down in a flying saucer, get out and start a long philosophical discourse on what 'page not found' could
     entail for the universe. Go crazy." A saucer zigzags in and beams the four down; it lands, and they settle in to work
     out what the page's absence means. It takes nine hundred years: the sun and moon go round faster and faster, the
     philosopher's beard grows to the floor, a flower comes up, cobwebs, the universe glitches, the robot's battery dies.
     Then they beam back up and leave without the robot; he reboots alone, and the saucer comes back for him (and the
     flower). */
  const VW = 48, VB = 60, HOVER = -30, SPOT = 66, SUNS = 16, SKY0 = 2.3;   /* walk off the beam, back to it; hover; the saucer past the front one; days in the talk */
  const UNLOAD = [3, 2, 1, 0], BOARD = [0, 2, 3];   /* down the beam furthest-walk first; back up it, all but the robot */
  const readU = (s) => clamp(1.2 + plain(s).length * .05, 2, 4.6);
  let PU = null, PUk = '';
  function planUfo() {
    const key = L.aw + JSON.stringify(LINES); if (key === PUk) return PU;
    const f0 = Math.round(L.aw / 2 - 8), sx = f0 + SPOT, T = {}, home = (i) => f0 - i * SP;
    T.arrive = [0, 2.6]; T.beam = [2.8, 3.1];
    T.down = UNLOAD.map((i, j) => T.beam[1] + .2 + j * 1.1);   /* each materialises under it, floats down, walks off */
    T.beamOff = T.down[3] + 1.05; T.land = [T.beamOff + .35, T.beamOff + 1.35];
    let t = Math.max(T.land[1], ...UNLOAD.map((i, j) => T.down[j] + 1 + (sx - home(i)) / VW)) + .5;
    T.d0 = t; T.say = {};
    UFO_SAY.forEach(([id, who]) => {
      const B = { who, id };
      if (who === 'philo') { B.step = [t, t + .3]; B.a = t + .35; B.b = B.a + readU(LINES[id]); B.back = [B.b, B.b + .3]; t = B.back[1] + .3; }
      else if (who === 'hacker') {
        B.step = [t, t + .4]; B.a = t + .4; B.type0 = t + .65; B.enter = B.type0 + plain(LINES[id]).length * TY + .35; B.out = B.enter + .25;
        B.b = B.out + readU(LINES[id + 'o']); B.back = [B.b, B.b + .4]; t = B.back[1] + .3;
      } else { B.a = t; B.b = t + readU(LINES[id]); t = B.b + .35; }
      T.say[id] = B;
    });
    T.d1 = t;
    /* away: the saucer up off its legs, the beam, three of them back up it; the robot, alone; the saucer back for him */
    T.lift = [t + .1, t + 1]; T.beam2 = [t + 1.05, t + 1.35];
    let free = T.beam2[1];
    T.up = BOARD.map((i, j) => { const d = (sx - home(i)) / VB, a = Math.max(t + 1.2 + j * .7 + d, free); free = a + .9; return { i, s: a - d, a }; });
    T.beam2Off = free + .1; T.zoom = [T.beam2Off + .2, T.beam2Off + 1.2];
    T.wake = T.zoom[1] + 1.4; T.z1 = [T.wake + .8, T.wake + .8 + readU(LINES.z1)];
    T.back = [T.z1[1] - .3, T.z1[1] + .7]; T.beam3 = [T.back[1] + .1, T.back[1] + .4]; T.rise = T.beam3[1] + .1;
    T.beam3Off = T.rise + 1; T.zoom2 = [T.beam3Off + .2, T.beam3Off + 1.1];
    /* the sky's clock: still, then faster and faster through the talk, stopped while the sun is missing; SUNS days in all */
    const gone = T.say.a12, n = Math.ceil((T.d1 - T.d0) / .05), w = [], cum = [0];
    for (let j = 0; j <= n; j++) { const v = T.d0 + j * .05; w.push(v > gone.a && v < gone.b ? 0 : (j / n) ** 3); }
    for (let j = 1; j <= n; j++) cum.push(cum[j - 1] + (w[j - 1] + w[j]) / 2);
    const sc = 2 * Math.PI * SUNS / cum[n];
    const sky = (v) => { const x = clamp((v - T.d0) / .05, 0, n), j = Math.min(n - 1, Math.floor(x)); return SKY0 + sc * lerp(cum[j], cum[j + 1], x - j); };
    PU = { f0, sx, T, home, sky, tEnd: T.zoom2[1] + .8 }; PUk = key; return PU;
  }
  /* the saucer at u: in on a zigzag, hovering, landed, up again, off; back for the robot; null while it is away */
  function saucerAt(u, p) {
    const T = p.T, bob = Math.round(Math.sin(u * 3.1)), ac = (k) => k * k * k, rx = p.home(1);
    if (u < T.arrive[1]) { const k = u / T.arrive[1], e = 1 - (1 - k) ** 3; return { x: lerp(-40, p.sx, e) + 10 * Math.sin(k * 11) * (1 - k), y: lerp(-80, HOVER, e) + 6 * Math.sin(k * 17) * (1 - k), legs: 0, fast: k < .75 }; }
    if (u < T.land[0]) return { x: p.sx, y: HOVER + bob, legs: 0 };
    if (u < T.land[1]) { const k = sm((u - T.land[0]) / (T.land[1] - T.land[0])); return { x: p.sx, y: lerp(HOVER, 0, k), legs: clamp((k - .5) * 2) }; }
    if (u < T.lift[0]) return { x: p.sx, y: 0, legs: 1 };
    if (u < T.lift[1]) { const k = sm((u - T.lift[0]) / (T.lift[1] - T.lift[0])); return { x: p.sx, y: lerp(0, HOVER, k), legs: 1 - clamp(k * 2) }; }
    if (u < T.zoom[0]) return { x: p.sx, y: HOVER + bob, legs: 0 };
    if (u < T.zoom[1]) { const k = (u - T.zoom[0]) / (T.zoom[1] - T.zoom[0]); return { x: p.sx + (L.aw + 60 - p.sx) * ac(k), y: HOVER - 70 * ac(k) + 4 * Math.sin(k * 20) * k, legs: 0, fast: k > .25 }; }
    if (u < T.back[0]) return null;
    if (u < T.back[1]) { const k = (u - T.back[0]) / (T.back[1] - T.back[0]), e = 1 - (1 - k) ** 3; return { x: lerp(L.aw + 60, rx, e), y: lerp(-100, HOVER, e), legs: 0, fast: k < .7 }; }
    if (u < T.zoom2[0]) return { x: rx, y: HOVER + bob, legs: 0 };
    if (u < T.zoom2[1]) { const k = (u - T.zoom2[0]) / (T.zoom2[1] - T.zoom2[0]); return { x: rx - (rx + 70) * ac(k), y: HOVER - 70 * ac(k), legs: 0, fast: k > .25 }; }
    return null;
  }
  /* the tractor beam, 0..1 of the way down, and which way its bands run (1 down, -1 up) */
  function beamAt(u, p) {
    const T = p.T;
    for (const [w, off, dir] of [[T.beam, T.beamOff, 1], [T.beam2, T.beam2Off, -1], [T.beam3, T.beam3Off, -1]]) {
      const e = ramp(u, w[0], w[1]) * (1 - ramp(u, off, off + .3)); if (e > 0) return { e, dir };
    }
    return null;
  }
  function drawBeam(sx, sy, b, u) {
    const top = GYS + sy - 7, bot = lerp(top, GYS, b.e), h = bot - top;
    for (let y = Math.ceil(top); y <= bot; y++) {
      const k = (y - top) / Math.max(1, GYS - top), hw = Math.round(3 + 10 * k), band = ((((y - top) - b.dir * u * 30) % 6) + 6) % 6;
      px(sx - hw, y, 'c', hw * 2 + 1, 1, band < 1 ? .3 : .16);
      px(sx - hw, y, 'c', 1, 1, .6); px(sx + hw, y, 'c', 1, 1, .6);
    }
    if (h > 2) px(sx - 3, top, 'w', 7, 1, .8);
  }
  /* where each of them is at u, and how they look: down the beam, walking off, home, back up it */
  function personAt(i, u, p) {
    const T = p.T, d = T.down[UNLOAD.indexOf(i)], hm = p.home(i), dist = p.sx - hm, up = T.up.find((b) => b.i === i);
    if (u < d) return null;
    if (up && u > up.a + .85) return null;
    if (i === 1 && u > T.rise + .85) return null;
    const P = {}, o = { x: hm, lift: 0, a: 1, flip: false, P, float: false, home: false };
    if (u < d + .9) Object.assign(o, { x: p.sx, a: clamp((u - d) / .35), lift: 10 * (1 - sm(ramp(u, d + .35, d + .9))), float: true });
    else if (u < d + 1 + dist / VW) { o.x = p.sx - VW * Math.max(0, u - d - 1); o.flip = true; P.ph = wq((-o.x / STRIDE + i * .37) % 1 + 1) % 1; }
    else if (up && u > up.s) {
      if (u < up.a) { o.x = hm + VB * (u - up.s); P.ph = wq((o.x / STRIDE + i * .37) % 1 + 1) % 1; }
      else Object.assign(o, { x: p.sx, lift: 10 * sm(ramp(u, up.a, up.a + .55)), a: 1 - ramp(u, up.a + .45, up.a + .85), float: true });
    } else if (i === 1 && u > T.rise) Object.assign(o, { lift: 10 * sm(ramp(u, T.rise, T.rise + .55)), a: 1 - ramp(u, T.rise + .45, T.rise + .85), float: true });
    else o.home = true;
    if (o.float && i !== 3) P.near = [140, 170];   /* arms up in the beam (the hacker keeps hold of the laptop) */
    return o;
  }
  /* the flower that comes up by the robot's feet over the centuries: a shoot, leaves, a bud, a flower */
  function flower(x, k, lift, a) {
    if (k < .3) return;
    const st = k < .45 ? 1 : k < .6 ? 2 : k < .75 ? 3 : k < .88 ? 4 : 5, hgt = [0, 1, 3, 5, 7, 7][st], y0 = GYS - lift;
    ctx.globalAlpha = a;
    px(x, y0 - hgt, 'D', 1, hgt + 1);
    if (st === 1) px(x + 1, y0 - 1, 'd');
    if (st >= 2) { px(x - 1, y0 - 2, 'd'); px(x + 1, y0 - 3, 'f'); }
    if (st >= 3) { px(x - 2, y0 - 4, 'd'); px(x + 1, y0 - 5, 'd'); px(x + 2, y0 - 5, 'f'); }
    if (st === 4) px(x, y0 - hgt - 1, 'y', 1, 2);
    if (st === 5) { [[0, -2], [-1, -1], [1, -1], [0, 0], [-2, -1], [2, -1], [0, -3], [-1, 0], [1, 0]].forEach(([a2, b2], j) => px(x + a2, y0 - hgt - 2 + b2, j < 4 ? 'r' : 'R')); px(x, y0 - hgt - 2 - 1, 'O'); }
    ctx.globalAlpha = 1;
  }
  /* a cobweb in a corner: spokes out from c along the given ends, threads across them at two places */
  function web(c, ends) {
    ends.forEach((e) => seg(c, e, 'v'));
    for (const f of [.45, .85]) for (let j = 0; j < ends.length - 1; j++) seg([lerp(c[0], ends[j][0], f), lerp(c[1], ends[j][1], f)], [lerp(c[0], ends[j + 1][0], f), lerp(c[1], ends[j + 1][1], f)], 'v');
  }
  function disc(x, y, r, k, a = 1) { for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) if (dx * dx + dy * dy <= r * r) px(x + dx, y + dy, k, 1, 1, a); }
  /* the sky: a sun and a moon on an arc from the left end of the ground to the right; the talk's centuries spin them round,
     smearing as they go; while the alien tells of the sun they lost, the sun is a dotted gap */
  function skyline(u, p) {
    const T = p.T, f = p.sky(u), spin = (p.sky(u + .03) - f) / .03, cx = L.aw / 2, R = L.aw / 2 - 10, H = GYS - 14;
    const gone = T.say.a12, missing = u > gone.a + .4 && u < gone.b;
    const at = (q) => [cx - R * Math.cos(q), GYS - 8 - H * Math.sin(q)];
    const body = (q, moon, a) => {
      const [x, y] = at(q); if (y > GYS - 9) return;
      disc(x, y, 3.6, 'k', a); disc(x, y, 2.7, moon ? 'v' : 'O', a);
      if (moon) { px(x - 1, y - 1, 'W', 1, 1, a); px(x + 1, y + 1, 'W', 1, 1, a); } else { px(x + 1, y + 1, 'y', 2, 1, a); px(x + 2, y, 'y', 1, 1, a); }
    };
    if (missing) { for (let j = 0; j < 16; j += 2) px(cx + R * .4 + 3.5 * Math.cos(j * Math.PI / 8), 12 + 3.5 * Math.sin(j * Math.PI / 8), 'g'); return; }
    for (const moon of [0, 1]) {
      const q = f + (moon ? Math.PI : 0);
      if (spin > 1.5) for (let j = 5; j >= 1; j--) body(q - j * .012 * spin, moon, .24 - j * .035);   /* a smear behind it when the days fly */
      body(q, moon, 1);
    }
  }
  function glitch(u) {
    const n = Math.floor(u * 24);
    for (let j = 0; j < 7; j++) { const y = Math.floor(hash(n * 7 + j) * AH), h = 1 + Math.floor(hash(n * 3 + j + 50) * 6), dx = Math.round((hash(n * 5 + j + 9) - .5) * 12); ctx.drawImage(cv, 0, y, L.aw, h, dx, y, L.aw, h); }
  }
  function mirror(s, x, y) { ctx.save(); ctx.translate(Math.round(x) + 1, 0); ctx.scale(-1, 1); ctx.drawImage(s.c, -AX, Math.round(y) - GY); ctx.restore(); }
  function puffs(cx, w, b) {
    if (b < 0 || b > .3) return;
    const s = b / .3; for (let j = 0; j < 6; j++) { const d = w / 2 + s * 10 + j * 2; px(cx - d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); px(cx + d, GYS - (j & 1) - s * 2, 'v', 2, 1, 1 - s); }
  }

  function renderUfo(t) {
    const p = planUfo(), T = p.T, u = ((t % p.tEnd) + p.tEnd) % p.tEnd, S = T.say;
    const k = clamp((u - T.d0) / (T.d1 - T.d0));   /* how far through the centuries */
    ctx.clearRect(0, 0, L.aw, AH);
    ctx.fillStyle = `rgba(${COL.shadow[0]},${COL.shadow[1]},${COL.shadow[2]},.14)`; for (let x = 1; x < L.aw; x += 4) ctx.fillRect(x, GYS + 2, 2, 1);
    skyline(u, p);
    const items = [], fx = [], bubbles = [], room = Math.min(150, L.aw - 8);
    const robotOff = u > S.a15.b - .15 && u < T.wake + .7 && !(u > T.wake && hash(Math.floor(u * 14)) > .5);
    ORDER.forEach((who, i) => {
      const o = personAt(i, u, p); if (!o) return;
      const P = o.P;
      if (o.home) {
        if (who === 'philo') {
          P.beard = Math.round(20 * sm(clamp((k - .06) / .86)));
          for (const id of ['a1', 'a4', 'a7', 'a11', 'a14', 'a16']) {
            const B = S[id], st = sm(ramp(u, B.step[0], B.step[1])) * (1 - sm(ramp(u, B.back[0], B.back[1])));
            if (st > 0) { o.x += 7 * st; if (st < 1) P.ph = wq((o.x / STRIDE) % 1); }
            if (u > B.a && u < B.b) { P.near = [95, 125]; P.finger = true; bubbles.push({ x: o.x, s: LINES[id], who, lift: 0 }); }
          }
        }
        if (who === 'alien') for (const id of ['a2', 'a6', 'a10', 'a12', 'a17']) if (u > S[id].a && u < S[id].b) { P.near = [95, 125]; bubbles.push({ x: o.x, s: LINES[id], who, lift: 0 }); }
        if (who === 'robot') {
          P.key = robotOff ? 0 : Math.floor(u * 5) & 1;
          P.bulb = hash(Math.floor(u * 9)) > .05 ? 1 : 0;   /* a steady lamp; once in a while it drops out */
          for (const id of ['a5', 'a8', 'a15']) if (u > S[id].a && u < S[id].b) { P.near = [100, 140]; bubbles.push({ x: o.x, s: LINES[id], who, lift: 0 }); }
          if (u > S.a15.a + .3 && u < S.a15.b - .15 && Math.floor(u * 3.2) & 1) P.lowbat = true;   /* it says so on his visor, blinking */
          if (robotOff) { P.off = true; P.near = [-5, 5]; }
          if (u > T.z1[0] && u < T.z1[1]) bubbles.push({ x: o.x, s: LINES.z1, who, lift: 0 });
        }
        if (who === 'hacker') {
          P.near = [15, 75]; P.far = [30, 80];
          for (const id of ['a3', 'a9', 'a13']) {
            const B = S[id], st = sm(ramp(u, B.step[0], B.step[1])) * (1 - sm(ramp(u, B.back[0], B.back[1])));
            if (st > 0) { o.x += 4 * st; if (st < 1) P.ph = wq((o.x / STRIDE) % 1); }
            if (u > B.step[1] && u < B.back[0]) {
              const cmd = plain(LINES[id]), n = clamp(Math.floor((u - B.type0) / TY) + 1, 0, cmd.length), typing = u > B.type0 && u < B.type0 + cmd.length * TY + .05;
              if (typing) { const q = Math.floor((u - B.type0) / TY) & 1; P.near = [15, 75 + (q ? 10 : -5)]; P.far = [30, 80 + (q ? -5 : 8)]; P.flick = q; }
              if (u > B.enter && u < B.enter + .12) P.near = [30, 110];
              const ls = wrap('$ ' + cmd.slice(0, n), room, true);
              if (u > B.out) ls.push(...wrap(LINES[id + 'o'], room, true));
              bubbles.push({ x: o.x + 4, s: ls, who, dark: true, cur: u < B.enter ? (Math.floor(u / .26) & 1 || typing ? 1 : 2) : 2, lift: 0 });
            }
          }
        }
        /* the universe glitches at the cogito: a mark over each, and a jump */
        const g0 = S.a14.a + .25 + i * .05; if (u > g0 && u < g0 + .75) { fx.push([who, i]); P.jy = -Math.round(3 * bump(u, g0, g0 + .32)); }
      } else if (who === 'philo') P.beard = u > T.d1 ? 20 : 0;
      else if (who === 'robot' && u > T.d1) P.off = robotOff;
      if (who === 'hacker' && !P.near) { P.near = [15, 75]; P.far = [30, 80]; }
      if ((who === 'alien' || who === 'robot') && !P.near && P.ph != null) P.near = [10 - 22 * Math.cos(2 * Math.PI * P.ph), -4 * Math.cos(2 * Math.PI * P.ph)];
      if (!P.far && P.ph != null) P.far = [-10 + 20 * Math.cos(2 * Math.PI * P.ph), 0];
      if (!P.far) P.far = o.float ? [125, 165] : [-6, 0];
      ['near', 'far'].forEach((q) => { if (P[q]) P[q] = P[q].map((a) => Math.round(a / 5) * 5); });
      items.push({ who, i, o, fwd: o.x - p.home(i) });
    });
    /* --- draw: shadows, the flower, the party, the beam, the saucer, then marks, cobwebs and the bubbles --- */
    const sc = saucerAt(u, p), bm = beamAt(u, p);
    if (sc && sc.y > -70) shadow(sc.x, 44, -sc.y);
    items.forEach((m) => { if (m.o.a > .3) shadow(m.o.x, 14, m.o.lift - (m.o.P.jy || 0)); });
    const rb = items.find((m) => m.who === 'robot');
    if (u > T.d0) flower(p.home(1) + 12, u > T.d1 ? 1 : k, rb && rb.o.float ? rb.o.lift : 0, rb ? rb.o.a : 0);
    const meta = {};
    items.slice().sort((a, b) => (Math.abs(a.fwd - b.fwd) > .5 ? a.fwd - b.fwd : b.i - a.i)).forEach((m) => {
      const s = sprite(m.who + JSON.stringify(m.o.P), () => person(m.who, m.o.P));
      ctx.globalAlpha = m.o.a; (m.o.flip ? mirror : blit)(s, m.o.x, GYS - m.o.lift); ctx.globalAlpha = 1;
      meta[m.who] = { x: m.o.x, m: s.meta, lift: m.o.lift };
      /* sparkles while they come and go */
      if (m.o.a > 0 && m.o.a < 1) for (let j = 0; j < 7; j++) { const q = Math.floor(u * 18) + j * 11; px(m.o.x + (hash(q) - .5) * 18, GYS - m.o.lift - 3 - hash(q + 1) * 26, j & 1 ? 'c' : 'w'); }
    });
    if (sc && bm) drawBeam(sc.x, sc.y, bm, u);
    if (sc) {
      if (sc.fast) { const d = saucerAt(u - .04, p); if (d) { const dx = sc.x - d.x, wd = Math.min(18, Math.abs(dx) * 2); for (let j = 0; j < 3; j++) px(dx > 0 ? sc.x - 30 - j * 6 - wd : sc.x + 30 + j * 6, GYS + sc.y - 8 - j * 3, 'v', wd, 1, .7); } }   /* speed lines behind it */
      const ss = sprite('saucer' + Math.round(sc.legs * 4), () => saucer({ legs: Math.round(sc.legs * 4) / 4 }));
      blit(ss, sc.x, GYS + sc.y);
      ss.meta.lamps.forEach(([lx, ly], j) => px(sc.x + lx - AX, GYS + sc.y + ly - GY, hash(j * 7.3 + Math.floor(u * 9)) < .035 ? 'Y' : 'O'));
      /* cobwebs gather on its leg while they talk */
      if (sc.y === 0 && k > .45 && u < T.lift[0]) { const g = clamp((k - .45) / .3); web([sc.x + 13, GYS - 9], [[sc.x + 13 + 9 * g, GYS - 10], [sc.x + 13 + 7 * g, GYS - 9 + 4 * g], [sc.x + 13 + 4 * g, GYS - 9 + 7 * g]]); }
    }
    puffs(p.sx, 46, u - T.land[1]); puffs(p.sx, 46, u - T.lift[0]);
    fx.forEach(([who, i]) => text('!', meta[who].x, GYS + meta[who].m.head - GY - 9 + (i & 1), 'r'));
    /* once the robot is out, a cobweb from his head to his shoulder */
    if (meta.robot) {
      const rx = meta.robot.x, hy = GYS + meta.robot.m.head - GY - meta.robot.lift;
      if (u > S.a16.a && u < T.rise) web([rx + 5, hy + 10], [[rx + 9, hy + 11], [rx + 8, hy + 7], [rx + 5, hy + 5]]);
    }
    bubbles.forEach((b) => bubble(b.x, GYS + meta[b.who].m.head - GY - 2 - meta[b.who].lift, b.s, { dark: b.dark, mono: b.dark, cur: b.cur }));
    if (u > S.a14.a + .1 && u < S.a14.a + .6) glitch(u);
  }

  /* ---------------------------------------------------------------- the loop: runs while the strip is on screen */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    if (MODE === 'off' || !seen) return;
    if (playing && !paused() && hold < 0 && !RM) clock += dt * knob('--parade-speed', 1);
    const t = hold >= 0 ? hold : RM ? SCR.still() : clock;
    if (!playing && hold < 0 && !RM) { ctx.clearRect(0, 0, L.aw, AH); return; }
    SCR.render(t);
  }
  function setMode(m) {
    MODE = ['color', 'ink', 'off'].includes(m) ? m : 'color';
    cv.style.display = MODE === 'off' ? 'none' : '';
    retoken(); DUST = null;
  }
  const SCR = SCRIPT === 'ufo' ? { plan: planUfo, render: renderUfo, still: () => planUfo().T.say.a4.a + 1.2 }
    : SCRIPT === 'lost' ? { plan: planLost, render: renderLost, still: () => planLost().T.aq[0] + 1.2 }
    : { plan, render, still: () => plan().tIn + G.enter - .2 };
  layout(); retoken();
  if (typeof ResizeObserver === 'function') new ResizeObserver(layout).observe(host); else addEventListener('resize', layout);
  if (typeof IntersectionObserver === 'function') new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; if (seen && opts.autoplay !== false && !playing) { playing = true; clock = 0; } }).observe(cv);
  else { seen = true; if (opts.autoplay !== false) playing = true; }
  requestAnimationFrame(frame);
  return {
    /* css px the strip takes */
    reserve: () => (MODE === 'off' ? 0 : AH * L.sc),
    play() { if (!playing) { playing = true; clock = 0; } },
    /* back to an empty strip until play() */
    stop() { playing = false; clock = 0; },
    get playing() { return playing; },
    mode: setMode, retoken() { layout(); retoken(); DUST = null; },
    /* a test can hold any moment of the loop (seconds; -1 lets it run) */
    at(t) { hold = t; },
    /* the 404's lines: any of alien, robot, philo, cmd, out (the timings follow their length) */
    lines(o) { LINES = Object.assign({}, LINES, o); wraps.clear(); },
    plan: () => Object.assign(SCR.plan(), { aw: L.aw, sc: L.sc, k: L.k, script: SCRIPT, G: SCRIPT === 'fight' ? G : undefined })
  };
}
