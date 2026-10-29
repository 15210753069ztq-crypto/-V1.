# 无人机视觉检测对抗鲁棒性评估系统 V1.0

对应论文：*Localized Stealthy Adversarial Attack for Robustness Evaluation in UAV Visual Detection*（MD-SM-PGD：软掩码局部约束 + 动量迭代 + 多样性输入，DroneVehicle 数据集，YOLOv5n/s/m 与 YOLOv4）。

本系统是**纯前端单页应用**（Vue 3 + Element Plus + ECharts），第三方库都在 `vendor/` 目录，**不需要安装软件、不需要联网、不需要后端**，用 Chrome 或 Edge 打开 `index.html` 即可使用。航拍画面由程序按固定随机种子合成；软掩码（真值框扩展 1.5 倍 + 10 px 边距 + 高斯平滑）、L∞ 扰动（ε = 4/255）、PSNR/L2 统计、梯度强度图以及雾天仿真（大气散射模型 I = J·t + A·(1−t)）都在浏览器中按像素实际计算。

## 1. 运行

- Windows：双击 `start.bat`，或直接双击 `index.html`。
- macOS / Linux：执行 `./start.sh`，或用浏览器打开 `index.html`。

左侧导航共九个功能模块：评估总览大屏、数据集管理、检测模型管理、攻击算法配置、对抗样本生成、白盒攻击评估、迁移攻击评估、消融实验分析、复杂天气鲁棒性。

## 2. 截图方法

截图尺寸建议统一为 **1920×1080**（与软著说明书模版一致）。

### 方法一：手动截图（最简单）

1. 用 Chrome 打开 `index.html`，按 `F11` 全屏（显示器为 1920×1080 时，全屏后正好是 1920×1080）。
2. 显示器分辨率不是 1920×1080 时：`F12` 打开开发者工具 → `Ctrl+Shift+M` 切换设备模式 → 尺寸填 `1920 × 1080`、缩放 `100%` → `Ctrl+Shift+P` 输入 `screenshot`，选 **Capture screenshot**，即可下载 1920×1080 的 PNG。
3. 依次点击左侧菜单，每个页面截一张；“对抗样本生成”页可先点 **生成对抗样本**，等进度条到 100% 后再截。建议额外截一张“攻击算法配置”页的“新增”对话框。

### 方法二：自动截图

电脑上需装有 Node.js 16 及以上：

```bash
npm install
npx playwright install chromium
npm run screenshot
```

截图保存到 `screenshots/`，截图清单（文件名、页面、等待时间、要点击的按钮）在 `scripts/shots.json` 中配置。

### 截图放进软件说明书

说明书 Word 中每张图的位置放了灰色占位图，图下方注明对应截图文件名（如 `screenshots/01_评估总览大屏.png`）。在 Word 中右键占位图 → **更改图片** → **来自文件**，选择对应截图即可。

## 3. 修改数据

全部展示数据都在 **`data/data.js`**，修改保存后刷新浏览器即可生效。

| data.js 中的键 | 对应页面 | 内容 |
|---|---|---|
| `system` | 顶部栏 | 系统名称、简称、版本、用户名；`fixedTime` 为顶部栏显示的固定时间，改为 `""` 则显示当前时间 |
| `stats` | 总览、数据集管理 | 数据集整体统计：图像总数、RGB/红外数量、各类别标注数（论文 Figure 2） |
| `image_sample` | 数据集管理及所有画面 | 图像样本；`boxes` 为车辆框（640×512 像素坐标，`angle` 为车头朝向角） |
| `detector` | 检测模型管理 | YOLOv5n/s/m、YOLOv4 的训练参数（论文 Table 3）及原图 P/R/F1 |
| `attack_method` | 攻击算法配置 | 8 种攻击算法及参数（MD-SM-PGD 参数对应论文 Table 2） |
| `attack_task` | 总览、对抗样本生成 | 攻击任务记录 |
| `eval_result` | 总览、白盒/迁移攻击评估 | 各检测器 × 各方法的 Precision/Recall/F1（论文 Table 4~7） |
| `ablation_result` | 消融实验分析 | 论文 Table 8 |
| `weather_result` | 复杂天气鲁棒性 | 论文 Table 9 及雾化参数 |

说明：
- 论文 Table 2~9 的数值已按原文录入；`stats` 中各类别标注数、`image_sample` 中的样本为示例数据，请按需替换。
- 表格中攻击方法的“最优”指最低指标（攻击越有效），自动加粗；本文方法行高亮显示。
- 页面上的新增/编辑/删除保存在浏览器缓存中；`data.js` 一旦修改，缓存自动作废；也可点顶部栏“重置数据”。
- `scripts/gen-data.js` 是生成初始 `data.js` 的脚本，重新执行会**覆盖**手工修改，一般不需要运行。

### 换成真实图片

把 DroneVehicle 图片放到 `images/` 目录，在对应 `image_sample` 记录中填写 `"image_url": "images/xxx.jpg"`，并把 `boxes` 改成该图片的真实标注。由于浏览器安全限制，**使用真实图片时不能直接双击打开**，需要在项目目录执行 `python -m http.server 8080`，再访问 `http://localhost:8080`（自动截图脚本此时也需把 `scripts/screenshot.js` 中的 `url` 改为该地址）。

## 4. 目录结构

```
index.html          入口页面
data/data.js        全部展示数据（改数据只改这里）
js/common.js        数据仓库与通用组件
js/synth.js         航拍场景合成与像素级计算（软掩码、扰动、梯度、雾化）
js/pages1~3.js      九个功能页面
js/app.js           导航菜单与路由
css/theme.css       深色主题样式
vendor/             第三方库（本地文件）
scripts/            自动截图脚本、截图清单、初始数据生成脚本
images/             可选：放置真实图片
```
