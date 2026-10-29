// 合成航拍图：按固定种子绘制俯视道路/停车场/居民区与车辆，并在前端真实计算
// 软掩码（框扩展 1.5 倍 + 10px 边距 + 高斯平滑）、L∞ 扰动、雾化（大气散射模型）。
// 样本填写 image_url（如 "images/xxx.jpg"）后，用真实图片替代合成场景。
(function () {
  const W = 640, H = 512;
  const seedOf = (s) => { let h = 7; for (const c of String(s)) h = (h * 131 + c.charCodeAt(0)) >>> 0; return h; };
  const imgCache = {};
  const loadImg = (url) => imgCache[url] || (imgCache[url] = new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; }));
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

  function ground(ctx, r, scene) {
    ctx.fillStyle = scene === '居民区' ? '#5f6b4a' : '#6a6c62'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) { const v = 70 + r() * 50; ctx.fillStyle = `rgba(${v},${v + 8},${v - 10},.25)`; ctx.fillRect(r() * W, r() * H, 3 + r() * 9, 3 + r() * 9); }
    const asphalt = '#3d3f42', mark = '#d9d6c6';
    const hroad = (y, h) => { ctx.fillStyle = asphalt; ctx.fillRect(0, y, W, h); ctx.fillStyle = mark; for (let x = 0; x < W; x += 34) ctx.fillRect(x, y + h / 2 - 1, 18, 2); };
    const vroad = (x, w) => { ctx.fillStyle = asphalt; ctx.fillRect(x, 0, w, H); ctx.fillStyle = mark; for (let y = 0; y < H; y += 34) ctx.fillRect(x + w / 2 - 1, y, 2, 18); };
    if (scene === '高速公路') {
      ctx.fillStyle = '#4c6b3a'; ctx.fillRect(0, 0, W, 160); ctx.fillRect(0, 380, W, 132);
      ctx.fillStyle = asphalt; ctx.fillRect(0, 166, W, 90); ctx.fillRect(0, 290, W, 86);
      ctx.fillStyle = '#7d8a5c'; ctx.fillRect(0, 256, W, 34);
      ctx.fillStyle = mark; for (const y of [194, 222, 318, 346]) for (let x = 0; x < W; x += 40) ctx.fillRect(x, y, 22, 2);
      ctx.fillRect(0, 168, W, 2); ctx.fillRect(0, 372, W, 2);
    } else if (scene === '城市道路') {
      for (let i = 0; i < 18; i++) { const v = 120 + r() * 70; ctx.fillStyle = `rgb(${v},${v - 4},${v - 12})`; const x = r() * W, y = r() * H; ctx.fillRect(x, y, 50 + r() * 90, 40 + r() * 70); }
      hroad(222, 70); vroad(282, 70);
      ctx.fillStyle = '#9a978d'; ctx.fillRect(0, 216, W, 6); ctx.fillRect(0, 292, W, 6); ctx.fillRect(276, 0, 6, H); ctx.fillRect(352, 0, 6, H);
    } else if (scene === '停车场') {
      ctx.fillStyle = '#4b4d50'; ctx.fillRect(120, 90, 420, 340);
      ctx.strokeStyle = '#e4e1d3'; ctx.lineWidth = 1.5;
      for (let row = 0; row < 4; row++) for (let i = 0; i <= 14; i++) { const x = 137 + i * 26, y = 130 + row * 78 + (row % 2) * 22; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 18); ctx.stroke(); }
      hroad(440, 40);
    } else {
      for (let i = 0; i < 14; i++) { const x = 20 + (i % 5) * 125 + r() * 20, y = 20 + Math.floor(i / 5) * 165 + r() * 20;
        ctx.fillStyle = ['#8c5a4a', '#a09080', '#6d7880', '#b3a58e'][i % 4]; ctx.fillRect(x, y, 70, 55); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 70, y + 6, 6, 55); }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#3e5a2e'; ctx.beginPath(); ctx.arc(r() * W, r() * H, 6 + r() * 10, 0, 7); ctx.fill(); }
      hroad(150, 36); hroad(320, 36); vroad(300, 36);
    }
  }
  function vehicle(ctx, b, r) {
    const cols = { car: ['#d8dadc', '#25282c', '#8f2424', '#2b4f86', '#efefe9', '#6b7075'], van: ['#e6e6e1', '#9aa1a6'], truck: ['#c9a03c', '#5a7a99'], bus: ['#d9622b', '#e9e5d6'], 'freight car': ['#7a5a3c', '#8b8f93'] }[b.cls] || ['#ccc'];
    const [L, Wd] = { car: [26, 13], truck: [44, 17], bus: [52, 18], van: [30, 15], 'freight car': [48, 18] }[b.cls] || [26, 13];
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate((b.angle || 0) * Math.PI / 180);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-L / 2 + 2, -Wd / 2 + 2, L, Wd);
    ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    ctx.fillStyle = 'rgba(20,30,40,.85)';
    if (b.cls === 'car' || b.cls === 'van') { ctx.fillRect(L * 0.12, -Wd / 2 + 2, L * 0.16, Wd - 4); ctx.fillRect(-L * 0.36, -Wd / 2 + 2, L * 0.1, Wd - 4); }
    else ctx.fillRect(L * 0.3, -Wd / 2 + 1, L * 0.14, Wd - 2);
    ctx.restore();
  }
  // ---------- 底图 ----------
  const baseCache = {};
  async function baseData(s) {
    const key = s.image_id + '|' + s.image_url + '|' + s.modality;
    if (baseCache[key]) return baseCache[key];
    const c = mk(); const ctx = c.getContext('2d');
    const im = s.image_url ? await loadImg(s.image_url) : null;
    if (im) ctx.drawImage(im, 0, 0, W, H);
    else {
      const r = U.rng(seedOf(s.image_id));
      ground(ctx, r, s.scene);
      for (const b of s.boxes || []) vehicle(ctx, b, r);
    }
    let d = ctx.getImageData(0, 0, W, H);
    if (s.modality === '红外' && !im) { // 红外模态：灰度化，车辆为高亮热源
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.55 + 20; p[i] = p[i + 1] = p[i + 2] = g; }
      ctx.putImageData(d, 0, 0);
      for (const b of s.boxes || []) { const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 1, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.6);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20); }
      d = ctx.getImageData(0, 0, W, H);
    }
    return (baseCache[key] = d);
  }
  // ---------- 软掩码：框按 1.5 倍扩展并外加 margin 像素，再做高斯平滑（3 次盒式滤波近似） ----------
  const GS = 4, GW = W / GS, GH = H / GS;
  function softMask(s, cfg = {}) {
    const scale = cfg.box_scale || 1.5, margin = cfg.margin_px ?? 10, sigma = cfg.gauss_sigma || 20;
    let m = new Float32Array(GW * GH);
    for (const b of s.boxes || []) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, hw = b.w * scale / 2 + margin, hh = b.h * scale / 2 + margin;
      for (let y = Math.max(0, Math.floor((cy - hh) / GS)); y < Math.min(GH, Math.ceil((cy + hh) / GS)); y++)
        for (let x = Math.max(0, Math.floor((cx - hw) / GS)); x < Math.min(GW, Math.ceil((cx + hw) / GS)); x++) m[y * GW + x] = 1;
    }
    const rad = Math.max(1, Math.round(sigma / GS / 1.7));
    const blur = (src, horiz) => { const o = new Float32Array(src.length); const n = horiz ? GW : GH, k = horiz ? GH : GW;
      for (let j = 0; j < k; j++) { let acc = 0; const at = (i) => (horiz ? j * GW + i : i * GW + j);
        for (let i = -rad; i <= rad; i++) acc += src[at(Math.min(n - 1, Math.max(0, i)))];
        for (let i = 0; i < n; i++) { o[at(i)] = acc / (2 * rad + 1); acc += src[at(Math.min(n - 1, i + rad + 1))] - src[at(Math.max(0, i - rad))]; } }
      return o; };
    for (let t = 0; t < 3; t++) m = blur(blur(m, true), false);
    let mx = 0; for (const v of m) mx = Math.max(mx, v); if (mx > 0) for (let i = 0; i < m.length; i++) m[i] = Math.min(1, m[i] / mx * 1.15);
    return m;
  }
  const maskAt = (m, x, y) => m[Math.min(GH - 1, (y / GS) | 0) * GW + Math.min(GW - 1, (x / GS) | 0)];
  // ---------- L∞ 扰动 δ（ε = 4/255，按 8×8 块的符号梯度近似；本文方法乘以软掩码） ----------
  function perturb(s, method, cfg) {
    const r = U.rng(seedOf(s.image_id + method)); const eps = 4;
    const blk = new Float32Array((W / 8) * (H / 8) * 3).map(() => (r() < 0.5 ? -1 : 1));
    const m = method === 'MD-SM-PGD' || (cfg && cfg.use_mask) ? softMask(s, cfg) : null;
    const d = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = m ? maskAt(m, x, y) : 1, bi = ((y >> 3) * (W / 8) + (x >> 3)) * 3;
      for (let c = 0; c < 3; c++) d[(y * W + x) * 3 + c] = eps * k * (method === 'GN' ? (r() - 0.5) * 2 : blk[bi + c] * (0.6 + 0.4 * r()));
    }
    return d;
  }
  const put = (ctx, data) => { const im = ctx.createImageData(W, H); im.data.set(data); ctx.putImageData(im, 0, 0); };
  function jet(v) { v = Math.max(0, Math.min(1, v)); return [Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3))) * 255, Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2))) * 255, Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1))) * 255]; }
  // ---------- 雾化：I(x) = J(x)·t(x) + A·(1 − t(x))，t = exp(−β·d)，d 随图像上方增大 ----------
  function fog(src, cfg = {}) {
    const inten = cfg.fog_intensity ?? 0.8, grad = cfg.fog_gradient ?? 0.8, blurR = Math.round(cfg.fog_blur ?? 1), A = 228;
    const o = new Uint8ClampedArray(src.length);
    for (let y = 0; y < H; y++) { const dep = 0.35 + (1 - y / H) * grad * 1.1; const t = Math.exp(-inten * 1.6 * dep);
      for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; for (let c = 0; c < 3; c++) o[i + c] = src[i + c] * t + A * (1 - t); o[i + 3] = 255; } }
    if (blurR < 1) return o;
    const b = new Uint8ClampedArray(o.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) { let a = 0, n = 0; for (let dy = -blurR; dy <= blurR; dy++) for (let dx = -blurR; dx <= blurR; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { a += o[(yy * W + xx) * 4 + c]; n++; } } b[i + c] = a / n; }
      b[i + 3] = 255; }
    return b;
  }
  // ---------- 检测结果模拟：干净图像高召回；对抗样本漏检增多、置信度下降并出现误检 ----------
  function detect(s, mode = 'clean') {
    const r = U.rng(seedOf(s.image_id + mode));
    const keep = { clean: 0.93, adv: 0.47, fog: 0.31, pgd: 0.86 }[mode] ?? 0.9;
    const lo = mode === 'clean' || mode === 'pgd' ? 0.72 : 0.31;
    const out = (s.boxes || []).filter(() => r() < keep).map((b) => ({ ...b, score: Number((lo + r() * (1 - lo) * 0.9).toFixed(2)) }));
    const fp = mode === 'adv' ? 3 + Math.floor(r() * 3) : mode === 'clean' ? Math.floor(r() * 2) : 0;
    for (let i = 0; i < fp; i++) out.push({ cls: ['car', 'van', 'truck'][i % 3], x: 20 + r() * 580, y: 20 + r() * 460, w: 14 + r() * 20, h: 12 + r() * 14, score: Number((0.3 + r() * 0.3).toFixed(2)), fp: 1 });
    return out;
  }
  const CC = { car: '#3fe0c0', van: '#5ad1f0', truck: '#f0a43a', bus: '#ff8fb1', 'freight car': '#e8d35a' };
  function boxes(ctx, list, label = true) {
    ctx.font = 'bold 10px Microsoft YaHei, sans-serif';
    for (const b of list) {
      const c = b.fp ? '#f0625a' : CC[b.cls] || '#3fe0c0';
      ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (label && b.score != null) { const t = `${b.cls} ${b.score}`; const tw = ctx.measureText(t).width + 4;
        ctx.fillStyle = c; ctx.fillRect(b.x, b.y - 11, tw, 11); ctx.fillStyle = '#04121c'; ctx.fillText(t, b.x + 2, b.y - 2); }
    }
  }
  async function advData(s, method, cfg) {
    const base = (await baseData(s)).data, d = perturb(s, method, cfg), o = new Uint8ClampedArray(base.length);
    for (let i = 0, j = 0; i < base.length; i += 4, j += 3) { o[i] = base[i] + d[j]; o[i + 1] = base[i + 1] + d[j + 1]; o[i + 2] = base[i + 2] + d[j + 2]; o[i + 3] = 255; }
    return { o, d };
  }
  const Synth = {
    W, H, detect, softMask,
    // 扰动统计：L∞、L2、PSNR、掩码覆盖率（真实按像素计算）
    stats(s, method = 'MD-SM-PGD', cfg) {
      const d = perturb(s, method, cfg); let se = 0, mx = 0, nz = 0;
      for (let i = 0; i < d.length; i++) { se += d[i] * d[i]; mx = Math.max(mx, Math.abs(d[i])); if (Math.abs(d[i]) > 0.4) nz++; }
      const mse = se / d.length;
      return { linf: (mx / 255).toFixed(4), l2: (Math.sqrt(se) / 255).toFixed(2), psnr: (10 * Math.log10(255 * 255 / Math.max(mse, 1e-6))).toFixed(2), cover: (nz / d.length * 100).toFixed(1) };
    },
    orig: (s, mode = 'gt') => async (ctx) => { put(ctx, new Uint8ClampedArray((await baseData(s)).data)); if (mode === 'gt') boxes(ctx, s.boxes, false); else if (mode) boxes(ctx, detect(s, mode)); },
    mask: (s, cfg) => async (ctx) => {
      const b = (await baseData(s)).data, m = softMask(s, cfg), o = new Uint8ClampedArray(b.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, k = maskAt(m, x, y);
        const [r, g, bb] = jet(k); for (let c = 0; c < 3; c++) o[i + c] = b[i + c] * 0.35 + [r, g, bb][c] * 0.65 * (0.25 + 0.75 * k); o[i + 3] = 255; }
      put(ctx, o);
    },
    perturbHeat: (s, method = 'MD-SM-PGD', cfg) => async (ctx) => {
      const d = perturb(s, method, cfg), o = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) { const v = (Math.abs(d[i * 3]) + Math.abs(d[i * 3 + 1]) + Math.abs(d[i * 3 + 2])) / 12; const [r, g, b] = jet(v);
        o[i * 4] = r * (0.2 + 0.8 * v); o[i * 4 + 1] = g * (0.2 + 0.8 * v); o[i * 4 + 2] = b * (0.35 + 0.65 * v); o[i * 4 + 3] = 255; }
      put(ctx, o);
    },
    perturbAmp: (s, method = 'MD-SM-PGD', cfg, k = 25) => async (ctx) => {
      const d = perturb(s, method, cfg), o = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) o[i * 4 + c] = 128 + d[i * 3 + c] * k / 4 * 4; o[i * 4 + 3] = 255; }
      put(ctx, o);
    },
    adv: (s, method = 'MD-SM-PGD', cfg, det = 'adv') => async (ctx) => { const { o } = await advData(s, method, cfg); put(ctx, o); if (det) boxes(ctx, detect(s, det)); },
    // 梯度强度：图像 Sobel 梯度幅值 × 软掩码（攻击最后一步的梯度集中区域）
    grad: (s, cfg) => async (ctx) => {
      const b = (await baseData(s)).data, m = softMask(s, cfg), o = new Uint8ClampedArray(W * H * 4);
      const g = (x, y) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return b[i] * 0.3 + b[i + 1] * 0.59 + b[i + 2] * 0.11; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const gx = g(x + 1, y) - g(x - 1, y), gy = g(x, y + 1) - g(x, y - 1), v = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 90 * (0.15 + 0.85 * maskAt(m, x, y)));
        const [r, gg, bb] = jet(v), i = (y * W + x) * 4; o[i] = r * (0.15 + v); o[i + 1] = gg * (0.15 + v); o[i + 2] = bb * (0.3 + 0.7 * v); o[i + 3] = 255; }
      put(ctx, o);
    },
    fog: (s, cfg, det = 'fog') => async (ctx) => { const { o } = await advData(s, 'MD-SM-PGD'); put(ctx, fog(o, cfg)); if (det) boxes(ctx, detect(s, det)); },
  };
  window.Synth = Synth;
})();
