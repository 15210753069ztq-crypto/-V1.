// 自动截图：用 Playwright 无头 Chromium 按 1920×1080 逐页截图，输出到 screenshots/
// 用法（项目根目录）：npm install && npx playwright install chromium && npm run screenshot
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = require('./shots.json'); // 截图清单：文件名、路由、可选的点击按钮文字
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('页面错误：', e.message));
  await page.goto(url + '#/');
  await page.evaluate(() => localStorage.clear()); // 截图前清空页面编辑缓存，保证与 data/data.js 一致
  for (const s of SHOTS) {
    await page.goto(url + '#' + s.route);
    await page.reload();
    await page.waitForTimeout(s.wait || 1800); // 等待图表动画与画布绘制完成
    if (s.click) {
      await page.getByRole('button', { name: s.click }).first().click();
      await page.waitForTimeout(1500);
    }
    const file = path.join(OUT, s.file);
    await page.screenshot({ path: file });
    console.log('已保存', path.relative(ROOT, file));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
