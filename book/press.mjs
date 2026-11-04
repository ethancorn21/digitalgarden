/* press.js: the page's type, printed (sketch, 2026-11-04; Ethan: "physical texture ... like newspapers", then "it just
   makes the screen look dirt", then "keep iterating. Be ambitious").

   SVG filters could not do it: Firefox runs no noise, displacement or images in filters on page text, and noise inside
   the letters read as dirt. So the type is set again, letter by letter, at the exact place the browser laid each one
   (a Range per character), into a canvas per block, and inked there in plain JS (the same in every browser):
     - each letter is its own piece of type: a fraction of a pixel off the line, a hair of tilt, and inked a few
       per cent heavier or lighter than its neighbours (one value a letter: no specks)
     - the ink spreads into the paper and wicks along its fibres AT THE EDGES ONLY: a threshold on the blurred letter
       that the fibres move, so an edge feathers and a stroke's middle stays solid; it only ever adds to the letter
       (Cormorant's hairlines are thinner than the spread, and a plain threshold ate them)
     - press: the plate squeezes the ink to each letter's rim, and the paper is pressed in round it (a height from the
       blurred letter, lit from the top left)
   The real text stays under the canvas, transparent, so it can still be selected, searched and read aloud; if anything
   fails it is simply visible again.

   An ES module: run(root, mode, selector), clear(root), state (ms, used: gpu | js). mode: 'press' | 'news'. */
const STYLE = {
    /* jit: px off the line, tilt (rad), ink spread (gain: how far the threshold drops), fibre: how far the fibres move
       it (edges only), feather: the edge's softness, squash: rim vs middle, dent: the impression's depth */
    press: { jx: .14, jy: .22, tilt: .006, dens: .07, gain: .07, fibre: .10, feather: .07, squash: .10, dent: .10 },
    news: { jx: 0, jy: .08, tilt: 0, dens: .035, gain: .05, fibre: .17, feather: .09, squash: 0, dent: 0 },
  };
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (t) => t * t * (3 - 2 * t);
  /* value noise in [-1, 1] on a lattice of the given size (device px), stretched along the fibres (mostly across) */
  function noise(x, y, cell, seed) {
    const gx = x / cell, gy = y / cell, i = Math.floor(gx), j = Math.floor(gy), u = smooth(gx - i), v = smooth(gy - j);
    const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
    return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1;
  }
  const fibre = (x, y, s) => .6 * noise(x * .35, y * 1.6, 2.2 * s, 7) + .4 * noise(x * .5, y * 2.4, .9 * s, 13);
  /* a box blur, three times over (near Gaussian), on a float field in place */
  function blur(f, w, h, r) {
    if (r < 1) return f;
    const t = new Float32Array(f.length), n = 2 * r + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { const o = y * w; let acc = 0;
        for (let x = -r; x <= r; x++) acc += f[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { t[o + x] = acc / n; acc += f[o + Math.min(w - 1, x + r + 1)] - f[o + Math.max(0, x - r)]; } }
      for (let x = 0; x < w; x++) { let acc = 0;
        for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { f[y * w + x] = acc / n; acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    }
    return f;
  }
  const rgb = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [28, 27, 25]; };
  const fontOf = (cs) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

  /* every character of a block, with where the browser put it, its font and colour */
  function glyphs(block) {
    const out = [], walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT), r = document.createRange();
    for (let node; (node = walk.nextNode());) {
      const el = node.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[data-noprint]')) continue;
      const font = fontOf(cs), col = rgb(cs.color), s = node.data;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i]; if (/\s/.test(ch)) continue;
        let k = 1; if (s.charCodeAt(i) >= 0xd800 && s.charCodeAt(i) < 0xdc00) k = 2;   /* (a pair: one glyph) */
        r.setStart(node, i); r.setEnd(node, i + k); const rc = r.getClientRects()[0];
        i += k - 1; if (!rc || !rc.width) continue;
        out.push({ ch: s.substr(i - k + 1, k), font, col, x: rc.left, y: rc.top, w: rc.width, h: rc.height, el });
      }
    }
    return out;
  }

  /* ---- the inking on the GPU (WebGL2): two blur passes (the spread, and the wider blur for the rim and the dent), then
     the ink; one hidden context for every block, copied into each block's canvas. Without WebGL2: the same in JS */
  let GL = null;
  function gl() {
    if (GL !== null) return GL;
    try {
      const cv = document.createElement('canvas'), g = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
      if (!g || !g.getExtension('EXT_color_buffer_float')) return (GL = false);
      const sh = (type, src) => { const o = g.createShader(type); g.shaderSource(o, src); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
      const VS = `#version 300 es
        in vec2 p; out vec2 uv; void main() { uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
      const prog = (fs) => { const o = g.createProgram(); g.attachShader(o, sh(g.VERTEX_SHADER, VS)); g.attachShader(o, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(o);
        if (!g.getProgramParameter(o, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(o)); const u = {}, n = g.getProgramParameter(o, g.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const a = g.getActiveUniform(o, i).name; u[a] = g.getUniformLocation(o, a); } return { o, u }; };
      /* blur along uDir: R = the letter at sigma uS1, G = at sigma uS2 (from the mask's alpha on the first pass, from R/G after) */
      const BLUR = prog(`#version 300 es
        precision highp float; in vec2 uv; out vec4 o; uniform sampler2D uT; uniform vec2 uDir; uniform float uS1, uS2, uFirst;
        void main() { vec2 acc = vec2(0.), wsum = vec2(0.); int n = int(ceil(3. * max(uS1, uS2)));
          for (int k = -24; k <= 24; k++) { if (k < -n || k > n) continue; float x = float(k);
            vec2 w = vec2(exp(-x * x / (2. * uS1 * uS1)), exp(-x * x / (2. * uS2 * uS2)));
            vec4 t = texture(uT, uv + uDir * x); vec2 v = uFirst > .5 ? vec2(t.a) : t.rg; acc += v * w; wsum += w; }
          o = vec4(acc / wsum, 0., 1.); }`);
      /* the ink: q is device px from the top left (as the 2D canvas); the ink spreads out, never in (max with the letter) */
      const INK = prog(`#version 300 es
        precision highp float; in vec2 uv; out vec4 o; uniform sampler2D uM, uB; uniform vec2 uPx; uniform float uDpr;
        uniform float uGain, uFibre, uFeather, uSquash, uDent, uDens; uniform vec3 uCol;
        float hash(int x, int y, int s) { uint h = uint(x) * 374761393u + uint(y) * 668265263u + uint(s) * 2147483647u;
          h = (h ^ (h >> 13)) * 1274126177u; return float(h ^ (h >> 16)) / 4294967296.; }
        float noise(vec2 q, float cell, int seed) { vec2 g = q / cell, i = floor(g), f = g - i; f = f * f * (3. - 2. * f);
          int x = int(i.x), y = int(i.y);
          return mix(mix(hash(x, y, seed), hash(x + 1, y, seed), f.x), mix(hash(x, y + 1, seed), hash(x + 1, y + 1, seed), f.x), f.y) * 2. - 1.; }
        float fibre(vec2 q) { return .6 * noise(q * vec2(.35, 1.6), 2.2 * uDpr, 7) + .4 * noise(q * vec2(.5, 2.4), .9 * uDpr, 13); }
        void main() {
          vec2 q = vec2(gl_FragCoord.x, 1. / uPx.y - gl_FragCoord.y);
          vec4 m = texture(uM, uv); vec2 b = texture(uB, uv).rg; float ink = 0.;
          if (b.r > .02) {
            float t = .5 - uGain + uFibre * fibre(floor(q));
            ink = smoothstep(0., 1., clamp((b.r - t + uFeather) / (2. * uFeather), 0., 1.));
            ink = max(ink, m.a);
            if (uSquash > 0.) ink *= 1. - uSquash * max(0., b.g - .55) / .45;
            ink *= m.a > .1 ? m.r : 1. - uDens * .5;
          }
          float a = ink;
          if (uDent > 0. && ink < .5) {
            float xl = texture(uB, uv - vec2(uPx.x, 0.)).g, xr = texture(uB, uv + vec2(uPx.x, 0.)).g;
            float yu = texture(uB, uv + vec2(0., uPx.y)).g, yd = texture(uB, uv - vec2(0., uPx.y)).g;
            float sh = uDent * ((xr - xl) + (yd - yu)) * .5 * uDpr * 1.6;
            if (sh > 0.) a = max(a, min(.22, sh));
          }
          o = vec4(uCol * a, a); }`);
      const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const tex = () => { const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
        for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v); return t; };
      GL = { cv, g, BLUR, INK, buf, mask: tex(), t1: tex(), t2: tex(), fb: g.createFramebuffer() };
    } catch (e) { GL = false; }
    return GL;
  }
  /* the ink of one block on the GPU, into canvas c (the 2D canvas holding the letters) */
  function inkGL(c, W, H, st, dpr, col, sigS, sigW) {
    const G = gl(); if (!G) return false;
    const { cv, g } = G; cv.width = W; cv.height = H;
    g.bindBuffer(g.ARRAY_BUFFER, G.buf);
    g.bindTexture(g.TEXTURE_2D, G.mask); g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, c);
    for (const t of [G.t1, G.t2]) { g.bindTexture(g.TEXTURE_2D, t); g.texImage2D(g.TEXTURE_2D, 0, g.RG16F, W, H, 0, g.RG, g.HALF_FLOAT, null); }
    const pass = (P, target, setup) => { g.useProgram(P.o); const loc = g.getAttribLocation(P.o, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      g.bindFramebuffer(g.FRAMEBUFFER, target ? G.fb : null); if (target) g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, target, 0);
      g.viewport(0, 0, W, H); setup(P.u); g.drawArrays(g.TRIANGLE_STRIP, 0, 4); };
    const blurPass = (src, dst, dir, first) => pass(G.BLUR, dst, (u) => { g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, src); g.uniform1i(u.uT, 0);
      g.uniform2f(u.uDir, dir[0] / W, dir[1] / H); g.uniform1f(u.uS1, sigS); g.uniform1f(u.uS2, sigW); g.uniform1f(u.uFirst, first ? 1 : 0); });
    blurPass(G.mask, G.t1, [1, 0], true); blurPass(G.t1, G.t2, [0, 1], false);
    pass(G.INK, null, (u) => { g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, G.mask); g.uniform1i(u.uM, 0);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, G.t2); g.uniform1i(u.uB, 1);
      g.uniform2f(u.uPx, 1 / W, 1 / H); g.uniform1f(u.uDpr, dpr); g.uniform3f(u.uCol, col[0] / 255, col[1] / 255, col[2] / 255);
      for (const k of ['gain', 'fibre', 'feather', 'squash', 'dent', 'dens']) g.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], st[k]); });
    const g2 = c.getContext('2d'); g2.clearRect(0, 0, W, H); g2.drawImage(cv, 0, 0);
    return true;
  }

  const PAD = 3;   /* css px round a block, for the spread, the halo and the dent */
  function print(block, mode) {
    const box = block.getBoundingClientRect();
    /* (the spread is a fixed half px, so it thickens small type more: the gain scales with the type, full at 32 px) */
    const all = glyphs(block); if (!all.length) return null;
    /* one ink a colour: a block can mix them (the markdown marks are muted inside a title or a paragraph) */
    const groups = new Map();
    for (const q of all) { const k = q.col.join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    if (groups.size > 1) {
      let out = null;
      for (const gs of groups.values()) { const c = printGroup(block, gs, st0Of(mode), box); if (!c) continue;
        if (!out) out = c; else out.getContext('2d').drawImage(c, 0, 0); }
      return out ? finish(out, box) : null;
    }
    return printGroup(block, all, st0Of(mode), box, true);
  }
  function st0Of(mode) { return STYLE[mode]; }
  function printGroup(block, gs, st0, box, own) {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const fs = parseFloat(getComputedStyle(block).fontSize) || 20, st = { ...st0, gain: st0.gain * Math.min(1, fs / 32) };
    const W = Math.ceil((box.width + 2 * PAD) * dpr), H = Math.ceil((box.height + 2 * PAD) * dpr);
    if (W * H > 12e6) return null;
    /* the letters: coverage in A, each letter's ink (its density) in R */
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const ascent = new Map();
    let n = 0;
    for (const q of gs) {
      if (!ascent.has(q.font)) { g.font = q.font; const m = g.measureText('Hg'); ascent.set(q.font, [m.fontBoundingBoxAscent, m.fontBoundingBoxDescent]); }
      const [a, d] = ascent.get(q.font), base = q.y + (q.h - (a + d)) / 2 + a;   /* the content box is ascent + descent, centred */
      const k = n++ * 3, jx = (hash(k, 1, 3) - .5) * 2 * st.jx, jy = (hash(k, 2, 3) - .5) * 2 * st.jy, tl = (hash(k, 3, 3) - .5) * 2 * st.tilt;
      const dens = 1 - st.dens * hash(k, 4, 3);
      const x = (q.x - box.left + PAD + jx) * dpr, y = (base - box.top + PAD + jy) * dpr;
      g.setTransform(dpr, 0, 0, dpr, x, y); if (tl) g.rotate(tl);
      g.font = q.font; g.fillStyle = `rgb(${Math.round(dens * 255)},0,0)`; g.fillText(q.ch, 0, 0);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    /* the blurs' sigmas: three box passes of radius r are a Gaussian of sigma sqrt(r(r+1)) (the JS path's) */
    const rS = Math.max(1, Math.round(.35 * dpr)), rW = Math.max(1, Math.round(.9 * dpr));
    if (state.gpu !== false && inkGL(c, W, H, st, dpr, gs[0].col, Math.sqrt(rS * (rS + 1)), Math.sqrt(rW * (rW + 1)))) { state.used = 'gpu'; return own ? finish(c, box) : c; }
    state.used = 'js';
    const im = g.getImageData(0, 0, W, H), px = im.data, N = W * H;
    const cov = new Float32Array(N), den = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = px[i * 4 + 3] / 255; cov[i] = a; den[i] = a ? px[i * 4] / 255 : 1; }   /* (getImageData is not premultiplied) */
    /* spread: the letter blurred by about half a css px; the threshold drops by the gain and the fibres move it */
    const sp = blur(Float32Array.from(cov), W, H, rS);
    const wide = st.squash || st.dent ? blur(Float32Array.from(cov), W, H, rW) : null;
    const col = gs[0].col, out = g.createImageData(W, H), o = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, b = sp[i];
      let ink = 0;
      if (b > .02) {
        /* (a stroke's middle is past any threshold the fibres make: solid, and no noise to work out) */
        if (b > .5 - st.gain + st.fibre + st.feather) ink = 1;
        else { const t = .5 - st.gain + st.fibre * fibre(x, y, dpr);
          ink = Math.min(1, Math.max(0, (b - t + st.feather) / (2 * st.feather))); ink = ink * ink * (3 - 2 * ink); }
        ink = Math.max(ink, cov[i]);   /* ink spreads out, never in: a hairline thinner than the spread stays */
        if (st.squash && wide) ink *= 1 - st.squash * Math.max(0, wide[i] - .55) / .45;   /* the middle thinner, the rim full */
        /* (each letter's own ink: from the nearest covered pixel; the blur keeps it the letter's) */
        ink *= den[i] < 1 && cov[i] > .1 ? den[i] : 1 - st.dens * .5;
      }
      let a = ink, r = col[0], gg = col[1], bb = col[2];
      if (st.dent && wide && ink < .5) {
        /* the impression: the paper pressed in round the letter, its slope lit from the top left */
        const xl = wide[i - 1] ?? 0, xr = wide[i + 1] ?? 0, yu = wide[i - W] ?? 0, yd = wide[i + W] ?? 0;
        const slope = ((xr - xl) + (yd - yu)) * .5;   /* > 0: the side facing away from the light */
        const sh = st.dent * slope * dpr * 1.6;
        if (sh > 0) a = Math.max(a, Math.min(.22, sh));
      }
      o[i * 4] = r; o[i * 4 + 1] = gg; o[i * 4 + 2] = bb; o[i * 4 + 3] = Math.round(a * 255);
    }
    g.putImageData(out, 0, 0);
    return own ? finish(c, box) : c;
  }
  function finish(c, box) {
    c.className = 'press-ink'; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = `position:absolute;left:${-PAD}px;top:${-PAD}px;width:${box.width + 2 * PAD}px;height:${box.height + 2 * PAD}px;pointer-events:none`;
    return c;
  }

  function clear(root) {
    root.querySelectorAll('.press-ink').forEach((c) => c.remove());
    root.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
  }
  /* the blocks: each paragraph, heading, list item set on its own canvas, the ones on screen first. A block keeps its
     old print until the new one is ready (no flash back to the browser's text), and a newer run stops an older one */
  let gen = 0;
  function run(root, mode, sel = 'h1,h2,h3,p,li,.meta') {
    const my = ++gen;
    if (!STYLE[mode]) return clear(root);
    let blocks = [...root.querySelectorAll(sel)].filter((b) => b.textContent.trim());
    blocks = blocks.filter((b) => !blocks.some((o) => o !== b && o.contains(b)));   /* (the outermost: no letter set twice) */
    /* a block whose text was rewritten since (its canvas went with it): show its text again until it is set */
    root.querySelectorAll('.pressed').forEach((b) => { if (!b.querySelector(':scope > .press-ink')) b.classList.remove('pressed'); });
    const keep = new Set(blocks);
    root.querySelectorAll('.pressed').forEach((b) => { if (!keep.has(b)) { b.querySelectorAll(':scope > .press-ink').forEach((c) => c.remove()); b.classList.remove('pressed'); } });
    const t0 = performance.now();
    blocks.sort((a, b) => Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top));
    let k = 0;
    const step = () => {
      if (my !== gen) return;
      const until = performance.now() + 12;
      while (k < blocks.length && performance.now() < until) {
        const b = blocks[k++];
        let c = null;
        try {
          b.classList.remove('pressed'); b.querySelectorAll(':scope > .press-ink').forEach((o) => { o.style.visibility = 'hidden'; });   /* (measured as the browser sets it) */
          c = print(b, mode);
        } catch (e) { c = null; }
        b.querySelectorAll(':scope > .press-ink').forEach((o) => o.remove());
        if (c) { if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.append(c); b.classList.add('pressed'); }
      }
      if (k < blocks.length) requestAnimationFrame(step); else state.ms = Math.round(performance.now() - t0);
    };
    step();
  }
export const state = { ms: undefined, used: undefined, gpu: undefined };   /* (gpu false: the JS path) */
export { run, clear, STYLE };
