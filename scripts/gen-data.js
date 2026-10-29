// 生成 data/data.js 的初始内容（仅首次使用；重新执行会覆盖 data/data.js 中的手工修改）
// 用法：node scripts/gen-data.js
const fs = require('fs');
const path = require('path');
let s = 20261028;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const r2 = (v, n = 2) => Number(v.toFixed(n));
const pad = (n) => String(n).padStart(2, '0');
const ts = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ---------- 图像样本（640×512，框坐标为像素，angle 为车辆朝向角度） ----------
const SCENES = ['城市道路', '高速公路', '停车场', '居民区'];
const CLS = ['car', 'truck', 'bus', 'van', 'freight car'];
const SIZE = { car: [26, 13], truck: [44, 17], bus: [52, 18], van: [30, 15], 'freight car': [48, 18] };
function genBoxes(scene) {
  const out = [];
  const add = (cx, cy, ang, cls) => {
    const [L, W] = SIZE[cls].map((v) => v * (0.9 + rnd() * 0.2));
    const c = Math.abs(Math.cos(ang * Math.PI / 180)), sn = Math.abs(Math.sin(ang * Math.PI / 180));
    const w = L * c + W * sn, h = L * sn + W * c;
    if (cx - w / 2 < 2 || cy - h / 2 < 2 || cx + w / 2 > 638 || cy + h / 2 > 510) return;
    if (out.some((b) => Math.abs(b.x + b.w / 2 - cx) < (b.w + w) / 2 + 2 && Math.abs(b.y + b.h / 2 - cy) < (b.h + h) / 2 + 2)) return;
    out.push({ cls, x: r2(cx - w / 2, 1), y: r2(cy - h / 2, 1), w: r2(w, 1), h: r2(h, 1), angle: Math.round(ang) });
  };
  const pickCls = () => { const v = rnd(); return v < 0.78 ? 'car' : v < 0.85 ? 'van' : v < 0.91 ? 'truck' : v < 0.96 ? 'bus' : 'freight car'; };
  if (scene === '停车场') {
    for (let row = 0; row < 4; row++) for (let i = 0; i < 14; i++) if (rnd() < 0.7) add(150 + i * 26, 130 + row * 78 + (row % 2) * 22, 90, rnd() < 0.9 ? 'car' : 'van');
  } else if (scene === '高速公路') {
    for (let i = 0; i < 18; i++) { const lane = Math.floor(rnd() * 6); add(40 + rnd() * 560, 180 + lane * 28 + (lane > 2 ? 30 : 0), 0, pickCls()); }
  } else if (scene === '城市道路') {
    for (let i = 0; i < 12; i++) { const lane = Math.floor(rnd() * 4); add(30 + rnd() * 580, 232 + lane * 16, 0, pickCls()); }
    for (let i = 0; i < 8; i++) { const lane = Math.floor(rnd() * 4); add(292 + lane * 16, 20 + rnd() * 470, 90, pickCls()); }
  } else {
    for (let i = 0; i < 10; i++) add(60 + rnd() * 520, 60 + rnd() * 400, [0, 90, 35, 120][Math.floor(rnd() * 4)], 'car');
  }
  return out;
}
const samples = [];
for (let i = 0; i < 32; i++) {
  const scene = SCENES[i % 4];
  const boxes = genBoxes(scene);
  const counts = Object.fromEntries(CLS.map((c) => [c, boxes.filter((b) => b.cls === c).length]));
  samples.push({ image_id: `DV_${String(10021 + i * 37).padStart(5, '0')}`, modality: i % 8 < 6 ? 'RGB' : '红外', scene,
    split: i < 24 ? 'test' : 'train', width: 640, height: 512, obj_num: boxes.length, car: counts.car, truck: counts.truck,
    bus: counts.bus, van: counts.van, freight_car: counts['freight car'], boxes, image_url: '',
    created_at: ts(new Date(2026, 9, 10 + (i % 6), 9 + (i % 9), (i * 13) % 60)) });
}
// ---------- 检测模型（论文 Table 3 训练参数） ----------
const detectors = [
  ['YOLOv5n', '白盒代理模型', 1.9, 4.5, 0.871, 0.908, 0.889], ['YOLOv5s', '迁移目标模型', 7.2, 16.5, 0.873, 0.93, 0.901],
  ['YOLOv5m', '迁移目标模型', 21.2, 49.0, 0.859, 0.923, 0.89], ['YOLOv4', '迁移目标模型', 64.4, 142.8, 0.866, 0.579, 0.694],
].map(([name, role, params_m, flops_g, precision, recall, f1], i) => ({ name, role, params_m, flops_g, input_size: '640×640',
  lr0: 0.0005, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005, box_w: 0.05, cls_w: 0.5, obj_w: 0.5, batch_size: 2, epochs: 100,
  precision, recall, f1, status: '已部署', updated_at: ts(new Date(2026, 9, 5 + i, 14, 20)) }));
// ---------- 攻击算法（论文 Table 2 为本文方法参数） ----------
const M = (name, type, iters, momentum, di_prob, use_mask, desc, is_ours = 0) => ({ name, type, norm: 'L∞', eps: '4/255', alpha: iters > 1 ? '1/255' : '4/255',
  iters, momentum, di_prob, random_init: iters > 1 ? 1 : 0, use_mask, box_scale: use_mask ? 1.5 : 0, gauss_sigma: use_mask ? 20 : 0, margin_px: use_mask ? 10 : 0, desc, is_ours, status: '启用' });
const methods = [
  M('FGSM', '单步梯度', 1, 0, 0, 0, '沿损失梯度符号方向单步扰动'),
  M('PGD', '迭代梯度', 10, 0, 0, 0, '全局投影梯度下降，随机初始化'),
  M('BIM', '迭代梯度', 10, 0, 0, 0, '基本迭代法，逐步裁剪到 ε 球内'),
  M('GN', '随机噪声', 1, 0, 0, 0, '高斯噪声扰动（σ=4/255）'),
  M('Jitter', '迭代梯度', 10, 0, 0, 0, '对 logits 加抖动的迭代攻击'),
  M('TI-FGSM', '迁移增强', 10, 1.0, 0, 0, '平移不变梯度平滑，提升迁移性'),
  M('TFNS', '迁移增强', 10, 1.0, 0, 0, '基于特征空间的迁移攻击'),
  M('MD-SM-PGD', '本文方法', 10, 1.0, 0.1, 1, '软掩码局部约束 + 动量迭代 + 多样性输入', 1),
];
// ---------- 评估结果（论文 Table 4~7） ----------
const T = {
  YOLOv5n: [['原始图像', 0.871, 0.908, 0.889], ['FGSM', 0.853, 0.786, 0.818], ['PGD', 0.816, 0.871, 0.842], ['BIM', 0.817, 0.647, 0.722], ['GN', 0.92, 0.655, 0.765],
    ['Jitter', 0.851, 0.838, 0.844], ['TI-FGSM', 0.862, 0.764, 0.81], ['TFNS', 0.815, 0.763, 0.788], ['MD-SM-PGD', 0.385, 0.476, 0.425]],
  YOLOv5m: [['原始图像', 0.859, 0.923, 0.89], ['FGSM', 0.846, 0.836, 0.773], ['PGD', 0.826, 0.901, 0.841], ['BIM', 0.837, 0.752, 0.792], ['GN', 0.867, 0.668, 0.754],
    ['Jitter', 0.865, 0.887, 0.876], ['MD-SM-PGD', 0.67, 0.725, 0.696]],
  YOLOv5s: [['原始图像', 0.873, 0.93, 0.901], ['FGSM', 0.872, 0.843, 0.857], ['PGD', 0.852, 0.907, 0.906], ['BIM', 0.898, 0.748, 0.816], ['GN', 0.929, 0.675, 0.782],
    ['Jitter', 0.838, 0.87, 0.854], ['MD-SM-PGD', 0.731, 0.721, 0.726]],
  YOLOv4: [['原始图像', 0.866, 0.579, 0.694], ['FGSM', 0.835, 0.382, 0.524], ['PGD', 0.046, 0.598, 0.086], ['BIM', 0.771, 0.281, 0.412], ['GN', 0.864, 0.249, 0.386],
    ['Jitter', 0.687, 0.313, 0.43], ['MD-SM-PGD', 0.67, 0.376, 0.455]],
};
const evals = [];
for (const [det, rows] of Object.entries(T)) for (const [method, precision, recall, f1] of rows)
  evals.push({ detector: det, setting: det === 'YOLOv5n' ? '白盒攻击' : '迁移攻击', method, precision, recall, f1 });
// ---------- 消融实验（Table 8）与雾天鲁棒性（Table 9） ----------
const ablation = [['Basic PGD', 0, 0, 0, 0.816, 0.871, 0.842], ['MI', 1, 0, 0, 0.827, 0.873, 0.847], ['SoftMask', 0, 1, 0, 0.402, 0.489, 0.441],
  ['SoftMask+MI', 1, 1, 0, 0.364, 0.461, 0.409], ['SoftMask+DI', 0, 1, 1, 0.372, 0.474, 0.417], ['SoftMask+MI+DI', 1, 1, 1, 0.385, 0.476, 0.425]]
  .map(([config, mi, softmask, di, precision, recall, f1]) => ({ config, mi, softmask, di, detector: 'YOLOv5n', precision, recall, f1 }));
const weather = [{ condition: '原始对抗样本', fog_intensity: 0, fog_blur: 0, fog_gradient: 0, precision: 0.385, recall: 0.476, f1: 0.425 },
  { condition: '加雾对抗样本', fog_intensity: 0.8, fog_blur: 1.0, fog_gradient: 0.8, precision: 0.896, recall: 0.314, f1: 0.465 }];
// ---------- 攻击任务 ----------
const tasks = [['MD-SM-PGD', 'YOLOv5n', 2000, 100, '已完成'], ['TI-FGSM', 'YOLOv5n', 2000, 100, '已完成'], ['TFNS', 'YOLOv5n', 2000, 100, '已完成'],
  ['PGD', 'YOLOv5n', 2000, 100, '已完成'], ['BIM', 'YOLOv5n', 2000, 100, '已完成'], ['FGSM', 'YOLOv5n', 2000, 100, '已完成'],
  ['MD-SM-PGD', 'YOLOv5n', 500, 64, '运行中'], ['MD-SM-PGD', 'YOLOv5n', 800, 0, '排队中']]
  .map(([method, surrogate, img_num, progress, status], i) => {
    const e = evals.find((x) => x.detector === 'YOLOv5n' && x.method === method);
    return { task_no: `AT202610${pad(18 + Math.floor(i / 3))}${String(101 + i * 7)}`, method, surrogate, dataset: 'DroneVehicle-test(RGB)', img_num,
      eps: '4/255', iters: method === 'FGSM' ? 1 : 10, progress, status, f1_after: status === '已完成' ? e.f1 : null,
      f1_drop: status === '已完成' ? r2((0.889 - e.f1) / 0.889 * 100, 1) : null, created_at: ts(new Date(2026, 9, 18 + Math.floor(i / 3), 9 + i, 12 + i * 5)) };
  }).reverse();
const stats = { total_images: 56878, rgb_images: 28439, ir_images: 28439,
  class_total: { car: 389779, truck: 22123, bus: 15333, van: 11935, 'freight car': 13400 },
  class_rgb: { car: 193183, truck: 10995, bus: 7489, van: 5881, 'freight car': 6578 },
  class_ir: { car: 196596, truck: 11128, bus: 7844, van: 6054, 'freight car': 6822 },
  scene_dist: { 城市道路: 16820, 高速公路: 12374, 停车场: 15306, 居民区: 12378 } };
const system = { name: '无人机视觉检测对抗鲁棒性评估系统', short: 'UAV对抗评估', version: 'V1.0', user: '管理员', fixedTime: '2026-10-20 16:32:08' };
const tables = { image_sample: samples, detector: detectors, attack_method: methods, attack_task: tasks, eval_result: evals, ablation_result: ablation, weather_result: weather };
let out = '// 系统二全部展示数据。直接修改本文件中的数值/文字，保存后刷新页面即可生效。\n'
  + '// 若在页面上做过新增/编辑，数据会存入浏览器缓存；本文件一旦修改，缓存自动失效。也可点击顶部“重置数据”。\n'
  + '// system.fixedTime：顶部栏显示的固定时间（便于截图），留空 "" 则显示电脑当前时间。\n'
  + '// stats：数据集整体统计（论文 Figure 2），数据集管理页与总览页使用。\n'
  + 'window.APP_DATA = {\n  system: ' + JSON.stringify(system) + ',\n  stats: ' + JSON.stringify(stats, null, 2).replace(/\n/g, '\n  ') + ',\n  tables: {\n';
for (const [k, rows] of Object.entries(tables)) out += `    ${k}: [\n` + rows.map((r) => '      ' + JSON.stringify(r)).join(',\n') + '\n    ],\n';
out += '  },\n};\n';
fs.writeFileSync(path.resolve(__dirname, '..', 'data', 'data.js'), out);
console.log('data/data.js 已生成', out.length, '字节；样本', samples.length, '条，平均目标数', r2(samples.reduce((a, x) => a + x.obj_num, 0) / samples.length, 1));
