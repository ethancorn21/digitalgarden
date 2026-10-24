// book/strips/strips.js: the footer. A long old print across the whole bottom of the page, cut to the screen's width
// around one modern thing in it, which is the only thing that moves. Made on the "Garden footer" canvas
// (https://claude.ai/artifact/EEGuko4RpVG1A1yvPTFqAP); this is lab/strips.js from ~/code/projects/artifacts/garden-footer
// cut down to the three strips in use, and tools/strips.py there bakes the prints. Each print comes as cell lightness
// (after halftone.py's sharpening) much wider than any screen; each frame runs its curve over the part on screen, draws
// the thing's cells over it, and one WebGL pass draws an ink dot per cell whose area is the tone there, as the hero's
// dots. Things are drawn in strip CSS px, x from the strip's left edge.

const PITCH = 3.3
const INK = [28, 27, 25] // --ink, #1c1b19

const b64u8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const noise1 = (t, seed) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash1(i + seed * 1013) * (1 - u) + hash1(i + 1 + seed * 1013) * u }
const segDist = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}
const easeIO = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// the dot screen: a tone per cell (0 paper, 255 ink) in g.buf, drawn as one dot per cell. Without WebGL the 2D canvas
// draws the same dots, too slowly to animate, so the strip then holds one frame.
function Screen(cv) {
  const g = { buf: new Uint8Array(0), cols: 0, rows: 0, p: PITCH, W: 0, H: 0, dpr: 1, gl: false }
  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    g.W = cv.clientWidth; g.H = cv.clientHeight
    cv.width = Math.round(g.W * dpr); cv.height = Math.round(g.H * dpr)
    g.cols = Math.ceil(g.W / g.p); g.rows = Math.ceil(g.H / g.p)
    g.buf = new Uint8Array(g.cols * g.rows)
    g.dpr = cv.width / (g.W || 1)
  }
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) {
    const c = cv.getContext('2d')
    g.size = fit
    g.draw = () => {
      if (!c) return
      const { p, cols, rows, buf } = g
      c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0)
      c.clearRect(0, 0, g.W, g.H)
      c.fillStyle = `rgb(${INK})`
      c.beginPath()
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const t = buf[j * cols + i] / 255
          if (t < 0.04) continue
          const r = Math.sqrt(t / Math.PI) * p, x = (i + 0.5) * p, y = (j + 0.5) * p
          c.moveTo(x + r, y); c.arc(x, y, r, 0, 2 * Math.PI)
        }
      c.fill()
    }
    return g
  }
  g.gl = true
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  const pr = gl.createProgram()
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'))
  // each pixel takes the darkest of the dots of its cell and the eight round it (a dark dot spills past its cell)
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `precision highp float;
uniform sampler2D T;uniform vec2 G;uniform float P,H;uniform vec3 K;
void main(){
  vec2 q=vec2(gl_FragCoord.x,H-gl_FragCoord.y)/P;vec2 c0=floor(q);float v=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 c=c0+vec2(float(i),float(j));
    if(c.x<0.||c.y<0.||c.x>=G.x||c.y>=G.y)continue;
    float t=texture2D(T,(c+.5)/G).r;if(t<.04)continue;
    v=max(v,clamp((sqrt(t/3.14159265)-length(q-c-.5))*P+.5,0.,1.));
  }
  gl_FragColor=vec4(K*v,v);
}`))
  gl.linkProgram(pr)
  gl.useProgram(pr)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  const U = (n) => gl.getUniformLocation(pr, n)
  g.size = () => {
    fit()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, g.cols, g.rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, g.buf)
    gl.viewport(0, 0, cv.width, cv.height)
  }
  g.draw = () => {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, g.cols, g.rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, g.buf)
    gl.uniform2f(U('G'), g.cols, g.rows)
    gl.uniform1f(U('P'), g.p * g.dpr)
    gl.uniform1f(U('H'), cv.height)
    gl.uniform3f(U('K'), INK[0] / 255, INK[1] / 255, INK[2] / 255)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  return g
}

const THINGS = {
  // N, Hollar's London (1647): a tower crane east of Old St Paul's, as tall as its tower. The lattice mast, the jib
  // and its trolley, the A-frame and pendants, a counter-jib with a heavy block of weights, the cab. It works through a
  // loop of lifts, slow and steady as real ones are: slew, run the trolley, lower, pick up or set down a bundle of
  // steel, raise. It mostly works on one side, where the jib is seen long, and now and then swings round.
  crane(T) {
    const x0 = T.x, top = T.top, base = T.base, J = T.jib, C = T.counter, EL = 0.12
    const yj = top + 18                            // the jib's bottom chord
    const deg = Math.PI / 180, drop0 = 8, dropMax = base - yj - 24
    const plan = []
    let th = 12 * deg, r = 0.5, dr = drop0, load = false
    const lifts = [[14, 0.9, 1], [-30, 0.55, 0.92], [26, 0.78, 1], [-16, 0.42, 0.85], [166, 0.72, 0.95], [20, 0.62, 1]]
    for (const [a, rr, dd] of lifts) {
      const tA = a * deg
      plan.push(['slew', th, tA, 3 + Math.abs(tA - th) / (7 * deg)]); th = tA
      plan.push(['trolley', r, rr, 1.5 + Math.abs(rr - r) / 0.08]); r = rr
      const d = dropMax * dd
      plan.push(['hoist', dr, d, 1.5 + Math.abs(d - dr) / 16]); dr = d
      plan.push(['hook', load, (load = !load), 3.5])
      plan.push(['hoist', dr, drop0, 1.5 + Math.abs(dr - drop0) / 16]); dr = drop0
      plan.push(['pause', 0, 0, 1.5])
    }
    let total = 0
    for (const p of plan) { p.push(total); total += p[3] }
    const S = { th: 12 * deg, r: 0.5, drop: drop0, load: false, swing: 0 }
    return {
      // the still frame: the first bundle on the hook, most of the way up
      still: () => plan[4][4] + plan[4][3] * 0.6,
      step(t) {
        const tt = ((t % total) + total) % total
        let th = 12 * deg, r = 0.5, dr = drop0, ld = false, since = 99
        for (const [k, a, b, d, t0] of plan) {
          if (tt < t0) break
          const f = easeIO((tt - t0) / d)
          if (k === 'slew') { th = a + (b - a) * f; since = tt - t0 - d }
          else if (k === 'trolley') r = a + (b - a) * f
          else if (k === 'hoist') dr = a + (b - a) * f
          else if (k === 'hook') ld = tt >= t0 + d * 0.5 ? b : a
        }
        // after a slew the hook swings a little and settles
        S.swing = since < 0 ? 0.8 * Math.sin(tt * 2.2) : 2.2 * Math.exp(-since / 3.5) * Math.sin(since * (2 * Math.PI / 3.6))
        Object.assign(S, { th, r, drop: dr, load: ld })
      },
      box: () => [x0 - Math.max(J, C) - 20, top - 2, x0 + Math.max(J, C) + 20, base + 1],
      draw(R) {
        const c = Math.cos(S.th), s = Math.sin(S.th)
        const Px = (d) => x0 + d * c, Py = (d, dy) => yj + dy + d * s * EL
        const depth = (d) => 6 - 3 * d / J               // the jib truss tapers to its tip
        // slewing ring, then the lattice mast going down into the roofs
        R.box(x0 - 5.5, yj + 1, x0 + 5.5, yj + 5, 0.93)
        for (const sx of [-2.8, 2.8]) { R.box(x0 + sx - 0.75, yj + 5, x0 + sx + 0.75, base - 10, 0.92); R.box(x0 + sx - 0.75, base - 10, x0 + sx + 0.75, base - 4, 0.6) }
        for (let y = yj + 5, k = 0; y < base - 6; y += 6, k++) R.seg(x0 - 2.8 * (k % 2 ? 1 : -1), y, x0 + 2.8 * (k % 2 ? 1 : -1), y + 6, 0.65, 0.72)
        // A-frame and pendants
        R.seg(x0 - 4, yj - 2, x0, top, 0.75, 0.92); R.seg(x0 + 4, yj - 2, x0, top, 0.75, 0.92)
        R.seg(x0, top, Px(0.68 * J), Py(0.68 * J, -depth(0.68 * J)), 0.45, 0.75); R.seg(x0, top, Px(-C), Py(-C, -3), 0.45, 0.75)
        // counter-jib and its block of weights
        R.seg(x0, yj, Px(-C), Py(-C, 0), 0.8, 0.92); R.seg(x0, yj - 4, Px(-C), Py(-C, -3), 0.7, 0.92)
        const w0 = Px(-0.6 * C), w1 = Px(-0.97 * C), wy = Py(-C, 0)
        R.box(Math.min(w0, w1) - 2, wy - 3, Math.max(w0, w1) + 2, wy + 10, 0.95)
        // jib: two chords and a zigzag of braces, and the tip
        R.seg(x0, yj, Px(J), Py(J, 0), 0.75, 0.92); R.seg(x0, yj - depth(0), Px(J), Py(J, -depth(J)), 0.75, 0.92)
        for (let d = 0; d < J; d += 7) {
          const m = d + 3.5, e = Math.min(J, d + 7)
          R.seg(Px(d), Py(d, 0), Px(m), Py(m, -depth(m)), 0.5, 0.72); R.seg(Px(m), Py(m, -depth(m)), Px(e), Py(e, 0), 0.5, 0.72)
        }
        R.seg(Px(J), Py(J, 0), Px(J), Py(J, -depth(J)), 0.6, 0.9)
        // cab on the jib side, its window toward the jib
        const cx = x0 + 6.5 * c, sg = Math.sign(c || 1)
        R.box(cx - 4.5, yj + 1, cx + 4.5, yj + 9, 0.88)
        R.set(sg > 0 ? cx : cx - 4.5, yj + 1, sg > 0 ? cx + 4.5 : cx, yj + 5, 0.35)
        // trolley, ropes, hook and load
        const tx = Px(S.r * J), ty = Py(S.r * J, 0), hx = tx + S.swing, hy = ty + 4 + S.drop
        R.box(tx - 2 - 2.2 * Math.abs(c), ty + 0.6, tx + 2 + 2.2 * Math.abs(c), ty + 4, 0.92)
        R.seg(tx - 1, ty + 4, hx - 1, hy, 0.4, 0.75); R.seg(tx + 1, ty + 4, hx + 1, hy, 0.4, 0.75)
        R.box(hx - 2.3, hy, hx + 2.3, hy + 5, 0.95)
        if (S.load) {
          R.seg(hx, hy + 5, hx - 10, hy + 11, 0.4, 0.7); R.seg(hx, hy + 5, hx + 10, hy + 11, 0.4, 0.7)
          R.box(hx - 13, hy + 11, hx + 13, hy + 15.5, 0.93); R.set(hx - 13, hy + 12.6, hx + 13, hy + 13.8, 0.55)
        }
      },
    }
  },

  // O, Visscher's Amsterdam (1611): parasailing among the anchored ships. A fast modern runabout (dark hull, white
  // topsides, a windscreen, an outboard on the transom) runs a long loop on the open water, its wake dark on the
  // hatched water, and on a long tow line behind it a striped parasail floats over the city with someone hanging under
  // it, legs dangling. The chute follows the boat's path a few seconds late, so it swings across in the turns and sinks
  // a little when the boat slows.
  parasail(T) {
    const W = (2 * Math.PI) / T.period, LAG = T.lag, Rc = T.chute
    const st = { t: 0 }
    const at = (t) => {
      const a = W * t
      return { x: T.x + T.run * Math.sin(a), y: T.y + T.depth * Math.cos(a), vx: T.run * W * Math.cos(a), vz: -T.depth * W * Math.sin(a) }
    }
    return {
      still: () => 0,
      step(t) {
        const b = at(t), c = at(t - LAG), vmax = T.run * W
        const sp = Math.abs(b.vx) / vmax
        Object.assign(st, {
          t, b, dir: b.vx >= 0 ? 1 : -1, fore: Math.max(0.3, Math.abs(b.vx) / Math.hypot(b.vx, b.vz * 3)), sp,
          cx: c.x, cy: T.cy + 12 * (1 - Math.abs(c.vx) / vmax) + 1.5 * Math.sin(t * 0.7),
          tilt: -0.22 * (c.vx / vmax), swing: 0.12 * Math.sin(t * 1.3),
        })
      },
      box: () => [Math.min(st.b.x, st.cx) - 70, T.cy - Rc - 6, Math.max(st.b.x, st.cx) + 70, T.y + 10],
      draw(R) {
        const { b, dir, fore, sp } = st
        const L = T.boat * fore, xs = b.x - dir * L / 2, xb = b.x + dir * L / 2, yw = b.y, q = T.boat / 40
        // the wake: a V of spray opening behind the transom (an engraver's strokes, dark on the hatched water) and a
        // plume of spray thrown up and back, all longer the faster it goes
        const tl = (14 + 70 * sp) * q
        for (const side of [-1, 1]) {
          R.seg(xs - dir * 1, yw + 0.5, xs - dir * tl, yw + side * (2.5 + 5 * sp) * q + 1.5, 0.75, 0.9)
          R.seg(xs - dir * tl * 0.3, yw + side * (1.4 + 2 * sp) * q + 1, xs - dir * tl * 0.8, yw + side * (2.6 + 6 * sp) * q + 2.5, 0.55, 0.65)
        }
        for (let j = 0; j < 12; j++) {
          const f = j / 12, n = noise1(st.t * 4 + j * 2.3, 21), m = noise1(st.t * 3.1 + j * 1.7, 22)
          R.disc(xs - dir * (2 + tl * 0.5 * f), yw - (2 + 9 * sp * Math.sin(Math.PI * Math.min(1, f * 1.3))) * q - 2 * m, 0.8 + 0.5 * n, 0.75 * (1 - f) + 0.15)
        }
        // hull: a dark wedge, deep at the transom and tapering up to a sharp raised bow as it planes
        const fb = 7 * q, bowY = yw - fb - (2.5 + 2.5 * sp) * q
        R.poly([[xs, yw - fb], [xb - dir * L * 0.35, yw - fb - 0.8 * q], [xb + dir * 3 * q, bowY], [xb - dir * L * 0.3, yw + 0.5], [xs, yw + 0.8]], 0.95)
        R.disc(xb - dir * L * 0.15, yw + 0.5, (1.5 + 2 * sp) * q, 0.04)                     // bow wave
        // console and windscreen, the driver behind it
        const wx = b.x + dir * L * 0.1
        R.poly([[wx - dir * 5 * q, yw - fb], [wx + dir * 2.5 * q, yw - fb], [wx - dir * q, yw - fb - 5 * q], [wx - dir * 5 * q, yw - fb - 5 * q]], 0.25)
        R.seg(wx + dir * 2.5 * q, yw - fb, wx - dir * q, yw - fb - 5 * q, 0.6 * q, 0.95); R.seg(wx - dir * q, yw - fb - 5 * q, wx - dir * 5 * q, yw - fb - 5 * q, 0.5 * q, 0.95)
        R.disc(wx - dir * 8 * q, yw - fb - 5.5 * q, 1.6 * q, 0.94); R.seg(wx - dir * 8 * q, yw - fb - 4 * q, wx - dir * 8.5 * q, yw - fb, 1.3 * q, 0.92)
        // the tow post at the stern, and the outboard on the transom
        const post = [xs + dir * 4 * q, yw - fb - 6 * q]
        R.seg(post[0], yw - fb, post[0], post[1], 0.6 * q, 0.92)
        R.box(Math.min(xs, xs - dir * 3.4 * q), yw - fb - 2.5 * q, Math.max(xs, xs - dir * 3.4 * q), yw + 2 * q, 0.95)
        // the chute: a striped dome with a dark hem, tilted with the pull
        const cx = st.cx, cy = st.cy, H = Rc * 0.78, ct = Math.cos(st.tilt), sn = Math.sin(st.tilt)
        R.fn(cx - Rc - 2, cy - Rc - 2, cx + Rc + 2, cy + Rc * 0.5, (x, y) => {
          const dx = x - cx, dy = y - cy, u = dx * ct + dy * sn, v = -dx * sn + dy * ct
          if (v > 0.6 + 1.1 * Math.abs(Math.sin((u / Rc) * Math.PI * 3.5))) return -1           // scalloped hem
          const ex = u / Rc, ey = v / H, e = ex * ex + ey * ey
          if (e > 1 || v > 2.4) return -1
          if (e > 0.82 || v > 0.2) return 0.96                                                // rim and hem
          const m = ex / Math.sqrt(Math.max(0.06, 1 - ey * ey)), g = Math.floor((m + 1) * 3.5)
          return g % 2 ? 0.88 : 0.22                                                          // the gores
        })
        // risers to the harness, the flyer, the tow line down to the boat
        const hx = cx + 1.5 * sn * 20 + st.swing * 8, hy = cy + 24
        for (const f of [-0.92, -0.45, 0.45, 0.92]) {
          const u = f * Rc, px = cx + u * ct, py = cy + u * sn + 1.2
          R.seg(px, py, hx, hy - 1, 0.32, 0.55)
        }
        R.disc(hx, hy + 1.4, 1.5, 0.94)
        R.seg(hx, hy + 2.8, hx + 0.3, hy + 8.4, 1.3, 0.94)
        const lg = 2.2 * Math.sin(st.t * 1.9)
        R.seg(hx + 0.3, hy + 8.4, hx - 1.2 + lg * 0.3, hy + 14, 0.8, 0.9); R.seg(hx + 0.3, hy + 8.4, hx + 1.4 + lg * 0.3, hy + 14, 0.8, 0.9)
        R.seg(hx, hy + 4.5, post[0], post[1], 0.6, 0.85)
      },
    }
  },

  // X, Saftleven's Utrecht (1648): a high-speed line across the fields, the overhead wire on its masts and the rails,
  // always there, and now and then a train, now one way, now the other: a long light body, its windows one by one, a
  // stripe under them, the long nose with its windscreen at each end, a pantograph up on the wire, the bogies under
  // the skirt. Metres: T.s CSS px. Between trains nothing moves, as the line does in the country. A train runs
  // across the part of the line on screen (view, strip px), not the whole print, so a phone waits no longer for one.
  hstrain(T) {
    const s = T.s, y = T.y, NOSE = 13, CAR = 25, N = T.cars, Lm = NOSE * 2 + CAR * (N - 2) + 2 * (CAR - NOSE), Ht = 3.9
    const len = Lm * s, x0 = T.x0, x1 = T.x1
    const st = { t: 0 }
    const wire = y - 5.9 * s, mast = 52 * s
    // the nose profile, height (0..1 of the body) at a distance f (0..1) back from the tip: a long low curve
    const nose = (f) => Math.min(1, 0.18 + 0.82 * Math.sqrt(Math.max(0, f)) * (1 - 0.25 * (1 - f)))
    // the train at t: is it passing, and its left end; one way on even passes, back on odd ones
    const at = (t, [v0, v1]) => {
      const PASS = (v1 - v0 + len + 60) / T.v, CYCLE = PASS + T.gap
      const k = Math.floor(t / CYCLE), u = t - k * CYCLE, d = u * T.v - 30
      return { on: u < PASS, x: k % 2 ? v1 - d : v0 - len + d }
    }
    return {
      // the still frame: the first train in the middle of the screen
      still: ([v0, v1]) => ((v1 - v0 + len) / 2 + 30) / T.v,
      step(t) { st.t = t },
      box: () => [x0, wire - 4, x1, y + 4],
      draw(R, view) {
        // the line: rails on their ballast, the wire and its messenger, masts with their arms
        R.box(x0, y + 0.6, x1, y + 2.2, 0.55)
        R.seg(x0, y + 0.3, x1, y + 0.3, 0.45, 0.95)
        R.seg(x0, wire, x1, wire, 0.32, 0.8)
        R.seg(x0, wire - 1.2 * s, x1, wire - 1.2 * s, 0.25, 0.55)
        for (let mx = x0 + ((T.m0 || 0) % mast); mx < x1; mx += mast) {
          R.seg(mx, y + 1.5, mx, wire - 2.4 * s, 0.6, 0.92)
          R.seg(mx, wire - 2 * s, mx + 2.6 * s, wire - 2 * s, 0.4, 0.88)
        }
        const { on, x: xl } = at(st.t, view)
        if (!on) return
        const xr = xl + len, top = y - (Ht + 1.0) * s, bot = y - 1.0 * s, hb = bot - top
        const X = (m) => xl + m * s
        // the body, shaded light grey like an engraver's: a dark roof line and underframe, the long nose at each end
        const prof = []
        for (let k = 0; k <= 12; k++) { const f = k / 12; prof.push([X(NOSE * f), bot - hb * nose(f)]) }
        const profR = prof.map(([x, yy]) => [xl + xr - x, yy]).reverse()
        const P = [[X(0), bot], ...prof, ...profR, [xr, bot]]
        R.polySet(P, 0.28)
        for (let k = 0; k < prof.length - 1; k++) {
          R.segSet(prof[k][0], prof[k][1], prof[k + 1][0], prof[k + 1][1], 1.3, 0.9)
          R.segSet(profR[k][0], profR[k][1], profR[k + 1][0], profR[k + 1][1], 1.3, 0.9)
        }
        R.segSet(X(NOSE), top, X(Lm - NOSE), top, 1.3, 0.9)
        // the windows, one by one along the cars, and the windscreens over the noses
        const wy0 = top + hb * 0.2, wy1 = top + hb * 0.44
        for (let m = NOSE + 2; m + 1.6 < Lm - NOSE - 1; m += 2.6) R.set(X(m), wy0, X(m + 1.7), wy1, 0.96)
        R.polySet([[X(NOSE * 0.42), top + hb * 0.56], [X(NOSE * 0.95), wy0 - 0.5], [X(NOSE * 0.95), wy1]], 0.97)
        R.polySet([[xr - NOSE * 0.42 * s, top + hb * 0.56], [xr - NOSE * 0.95 * s, wy0 - 0.5], [xr - NOSE * 0.95 * s, wy1]], 0.97)
        // a white band under the windows, nose to nose, and the darker livery stripe in it
        R.set(X(NOSE * 0.35), top + hb * 0.52, X(Lm - NOSE * 0.35), top + hb * 0.66, 0.02)
        R.set(X(NOSE * 0.35), top + hb * 0.57, X(Lm - NOSE * 0.35), top + hb * 0.62, 0.7)
        // the doors at each car's ends, the gaps between the cars
        for (let c = 0; c < N; c++) {
          const c0 = c === 0 ? NOSE + 2 : CAR * c + (CAR - NOSE) - CAR + NOSE, c1 = c0 + (c === 0 || c === N - 1 ? CAR - NOSE - 2 : CAR)
          for (const dm of [c0 + 0.6, c1 - 1.9]) if (dm > NOSE && dm < Lm - NOSE - 1) R.set(X(dm), top + hb * 0.16, X(dm + 1.1), bot - hb * 0.14, 0.75)
        }
        for (let m = NOSE + CAR - NOSE; m < Lm - 2; m += CAR) R.set(X(m) - 0.8, top + 0.8, X(m) + 0.8, bot, 0.95)
        // skirt and bogies
        R.set(X(1), bot - hb * 0.14, X(Lm - 1), bot, 0.93)
        for (let m = 4; m < Lm - 3; m += CAR) for (const w of [0, 2.6]) R.disc(X(m + w), bot + 0.2, 0.55 * s, 0.98)
        // the pantograph, up on the wire, on the second car
        const px = X(NOSE + CAR * 0.6)
        R.seg(px - 1.6 * s, top, px, wire + 0.5, 0.45, 0.92); R.seg(px + 1.6 * s, top, px, wire + 0.5, 0.45, 0.92)
        R.seg(px - 1.2 * s, wire + 0.5, px + 1.2 * s, wire + 0.5, 0.5, 0.92)
      },
    }
  },
}

// a thing given as shapes (capsules, boxes, discs) drawn into a grid of Q x Q samples per cell over its box: the cost
// goes with the shapes' area, not the box's. Overlapping shapes keep the darker ink; the *Set ones overwrite (a window).
function Raster(Q = 4) {
  let buf = new Float32Array(0), u0 = 0, v0 = 0, nu = 0, nv = 0, q = 1
  const R = {}
  R.begin = (box, p, iMin, iMax, jMax) => {
    q = p / Q
    u0 = Math.max(iMin, Math.floor(box[0] / p)) * Q; v0 = Math.max(0, Math.floor(box[1] / p)) * Q
    nu = Math.max(0, (Math.min(iMax, Math.floor(box[2] / p)) + 1) * Q - u0); nv = Math.max(0, (Math.min(jMax, Math.floor(box[3] / p)) + 1) * Q - v0)
    if (buf.length < nu * nv) buf = new Float32Array(nu * nv)
    buf.fill(-1, 0, nu * nv)
    return R
  }
  const each = (x0, y0, x1, y1, f) => {
    const a = Math.max(0, Math.ceil(x0 / q - 0.5) - u0), b = Math.min(nu - 1, Math.floor(x1 / q - 0.5) - u0)
    const c = Math.max(0, Math.ceil(y0 / q - 0.5) - v0), d = Math.min(nv - 1, Math.floor(y1 / q - 0.5) - v0)
    for (let v = c; v <= d; v++) for (let u = a; u <= b; u++) f(v * nu + u, (u0 + u + 0.5) * q, (v0 + v + 0.5) * q)
  }
  R.seg = (ax, ay, bx, by, w, t) => each(Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w, (k, x, y) => { if (t > buf[k] && segDist(x, y, ax, ay, bx, by) < w) buf[k] = t })
  R.box = (x0, y0, x1, y1, t) => each(x0, y0, x1, y1, (k) => { if (t > buf[k]) buf[k] = t })
  R.set = (x0, y0, x1, y1, t) => each(x0, y0, x1, y1, (k) => { buf[k] = t })
  R.segSet = (ax, ay, bx, by, w, t) => each(Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w, (k, x, y) => { if (segDist(x, y, ax, ay, bx, by) < w) buf[k] = t })
  const inPoly = (P, x, y) => {
    let c = false
    for (let i = 0, j = P.length - 1; i < P.length; j = i++)
      if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c
    return c
  }
  const pbox = (P) => [Math.min(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[0])), Math.max(...P.map((p) => p[1]))]
  R.poly = (P, t) => { const [a, b, c, d] = pbox(P); each(a, b, c, d, (k, x, y) => { if (t > buf[k] && inPoly(P, x, y)) buf[k] = t }) }
  R.polySet = (P, t) => { const [a, b, c, d] = pbox(P); each(a, b, c, d, (k, x, y) => { if (inPoly(P, x, y)) buf[k] = t }) }
  // any shape: f(x, y) gives its ink there or -1 where it is not
  R.fn = (x0, y0, x1, y1, f) => each(x0, y0, x1, y1, (k, x, y) => { const t = f(x, y); if (t >= 0) buf[k] = t })
  R.disc = (cx, cy, r, t) => each(cx - r, cy - r, cx + r, cy + r, (k, x, y) => { if (t > buf[k] && (x - cx) ** 2 + (y - cy) ** 2 < r * r) buf[k] = t })
  // per cell (i, j) of the grid: the sum over its samples, and how much of the cell the thing covers
  R.cells = (fn) => {
    for (let j = 0; j < nv / Q; j++)
      for (let i = 0; i < nu / Q; i++) {
        let sum = 0, hit = 0
        for (let b = 0; b < Q; b++) for (let a = 0; a < Q; a++) { const s = buf[(j * Q + b) * nu + i * Q + a]; if (s >= 0) { sum += s; hit++ } }
        fn(u0 / Q + i, v0 / Q + j, sum, hit / (Q * Q))
      }
  }
  return R
}

// one strip: the print (data.lum, cell lightness, run through its curve lo / hi / gam) and its thing
function Strip(data) {
  const lum = b64u8(data.lum)
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = 1 - Math.pow(Math.min(1, Math.max(0, (i - data.lo) / (data.hi - data.lo))), data.gam)
  const base = new Float32Array(data.cols * data.rows)
  // the print's two ends fade into the paper over a few cells, for a screen wider than the strip
  const edge = new Float32Array(data.cols)
  for (let i = 0; i < data.cols; i++) edge[i] = easeIO(Math.min(i + 0.5, data.cols - 0.5 - i) / 14)
  const thing = THINGS[data.thing.kind](data.thing)
  const R = Raster(), halo = data.thing.halo
  let cover = new Uint8Array(0), off = 0
  // the strip's first column on screen: the thing at the middle (or data.frac) of the screen, never past an end; a
  // screen wider than the whole strip gets it centred. Returns the part of the strip on screen, in strip px.
  const place = (cols) => {
    off = data.cols <= cols ? -Math.floor((cols - data.cols) / 2)
      : Math.max(0, Math.min(data.cols - cols, Math.round(data.anchor / data.pitch - cols * (data.frac ?? 0.5))))
    return [Math.max(0, off) * data.pitch, Math.min(data.cols, off + cols) * data.pitch]
  }
  const paint = (g) => {
    const { cols, buf, p } = g
    const rows = Math.min(g.rows, data.rows)
    const view = place(cols)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const si = i + off
        if (si < 0 || si >= data.cols) continue
        const k = j * data.cols + si, v = lut[lum[k]] * edge[si]
        base[k] = v
        buf[j * cols + i] = Math.round(v * 255)
      }
    R.begin(thing.box(), p, Math.max(0, off), Math.min(data.cols - 1, off + cols - 1), rows - 1)
    thing.draw(R, view)
    // cells the thing covers take its ink, blended with the print where it covers them only in part; with a halo,
    // the cells touching it (and not under it) go to paper, as an engraver keeps a figure off a busy ground
    const marks = [], hit = []
    if (halo && cover.length < data.cols * rows) cover = new Uint8Array(data.cols * rows)
    R.cells((si, j, sum, f) => {
      if (!f) return
      const k = j * data.cols + si, i = si - off
      if (halo) { cover[k] = 1; hit.push(k) }
      buf[j * cols + i] = Math.round(Math.min(1, (sum * edge[si] + base[k] * 16 * (1 - f)) / 16) * 255)
      if (f >= 0.25) marks.push(si, j)
    })
    if (!halo) return
    for (let n = 0; n < marks.length; n += 2)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const si = marks[n] + di, j = marks[n + 1] + dj, i = si - off
          if (j < 0 || j >= rows || i < 0 || i >= cols || si >= data.cols) continue
          if (!cover[j * data.cols + si]) buf[j * cols + i] = 0
        }
    for (const k of hit) cover[k] = 0
  }
  return { step: (t) => thing.step(t), paint, still: (g) => thing.still(place(g.cols)) }
}

// Draw a strip into a canvas and run it. The clock only runs while the strip is on screen and the tab is showing, so
// the thing starts its loop when the reader first gets there. Under reduced motion, or without WebGL, the canvas holds
// the thing's still frame; o.t (seconds) holds that moment instead.
export function mountStrip(cv, data, o = {}) {
  const g = Screen(cv), s = Strip(data)
  g.p = data.pitch || PITCH
  const fixed = o.t != null || !g.gl || matchMedia('(prefers-reduced-motion: reduce)').matches
  let t = 0, last = 0, raf = 0, seen = false
  const frame = (at) => { s.step(at); g.buf.fill(0); s.paint(g); g.draw() }
  const tick = (now) => {
    if (last) t += Math.min(0.1, (now - last) / 1000)
    last = now
    frame(t)
    raf = requestAnimationFrame(tick)
  }
  const run = () => {
    const go = !fixed && seen && !document.hidden
    if (go && !raf) { last = 0; raf = requestAnimationFrame(tick) }
    if (!go && raf) { cancelAnimationFrame(raf); raf = 0 }
  }
  new ResizeObserver(() => { g.size(); frame(fixed ? o.t ?? s.still(g) : t) }).observe(cv)
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; run() }).observe(cv)
  document.addEventListener('visibilitychange', run)
}
