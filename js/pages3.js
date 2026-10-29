// 页面：迁移攻击评估、消融实验分析、复杂天气鲁棒性
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed, reactive } = Vue;
  const DETS = ['YOLOv5m', 'YOLOv5s', 'YOLOv4'];

  PAGES.transfer = {
    setup() {
      const ev = computed(() => Store.list('eval_result'));
      const det = ref('YOLOv5m');
      const rows = computed(() => ev.value.filter((e) => e.detector === det.value));
      const fmt = computed(() => boldMin(rows.value, ['precision', 'recall', 'f1']));
      const methods = computed(() => [...new Set(ev.value.filter((e) => DETS.includes(e.detector)).map((e) => e.method))]);
      const all = ['YOLOv5n', ...DETS];
      const heat = computed(() => { const data = [];
        methods.value.forEach((m, i) => all.forEach((d, j) => { const e = ev.value.find((x) => x.method === m && x.detector === d); if (e) data.push([j, i, e.f1]); }));
        return U.chart({ tooltip: { trigger: 'item', formatter: (p) => `${methods.value[p.value[1]]} → ${all[p.value[0]]}<br>F1 = ${p.value[2]}` }, grid: { left: 100, right: 70, top: 20, bottom: 40 },
          xAxis: U.axis({ type: 'category', data: all }), yAxis: U.axis({ type: 'category', data: methods.value }),
          visualMap: { min: 0, max: 0.95, calculable: true, orient: 'vertical', right: 0, top: 'center', textStyle: { color: '#c3d0e6' }, inRange: { color: ['#3fe0c0', '#2464c8', '#1b2a47'] } },
          series: [{ type: 'heatmap', data, label: { show: true, color: '#fff' } }] }); });
      const line = computed(() => U.chart({ grid: { left: 45, right: 20, top: 40, bottom: 30 }, xAxis: U.axis({ type: 'category', data: all }), yAxis: U.axis({ type: 'value', name: 'F1', max: 1 }),
        series: methods.value.map((m) => ({ name: m, type: 'line', symbolSize: 7, lineStyle: { width: m === 'MD-SM-PGD' ? 4 : 1.5 }, data: all.map((d) => (ev.value.find((x) => x.method === m && x.detector === d) || {}).f1 ?? null) })) }));
      return { det, rows, fmt, heat, line, DETS };
    },
    template: `<div>
      <div class="row mb">
        <panel title="迁移攻击评估（YOLOv5n 生成样本 → 目标模型）" style="flex:1">
          <template #extra><el-radio-group v-model="det" size="small"><el-radio-button v-for="d in DETS" :key="d" :value="d">{{d}}</el-radio-button></el-radio-group></template>
          <el-table :data="rows" border size="small" :row-class-name="({row}) => row.method==='MD-SM-PGD' ? 'ours' : ''">
            <el-table-column prop="method" label="攻击方法" min-width="130"><template #default="{row}"><b v-if="row.method==='MD-SM-PGD'" class="hl">MD-SM-PGD（本文）</b><span v-else>{{row.method}}</span></template></el-table-column>
            <el-table-column v-for="c in ['precision','recall','f1']" :key="c" :label="({precision:'Precision',recall:'Recall',f1:'F1-Score'})[c]"><template #default="{row}"><span v-html="fmt(row,c)"></span></template></el-table-column>
          </el-table></panel>
        <panel title="方法 × 检测模型 F1 矩阵" style="flex:1.2"><e-chart :option="heat" :height="340"/></panel>
      </div>
      <panel title="跨模型 F1 变化趋势"><e-chart :option="line" :height="330"/></panel>
    </div>`,
  };

  PAGES.ablation = {
    setup() {
      const rows = computed(() => Store.list('ablation_result'));
      const fmt = computed(() => { const b = U.best(rows.value, ['precision', 'recall', 'f1'], 'min'); return (r, c) => (r[c] === b[c] ? `<b class="best">${U.fmt(r[c], 3)}</b>` : U.fmt(r[c], 3)); });
      const bar = computed(() => U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 40 }, xAxis: U.axis({ type: 'category', data: rows.value.map((r) => r.config) }), yAxis: U.axis({ type: 'value', max: 1 }),
        series: [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']].map(([k, n]) => ({ name: n, type: 'bar', data: rows.value.map((r) => r[k]) })) }));
      const base = computed(() => rows.value[0] || {});
      const gain = computed(() => U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 40 }, xAxis: U.axis({ type: 'category', data: rows.value.slice(1).map((r) => r.config) }), yAxis: U.axis({ type: 'value', name: '相对 Basic PGD 下降(%)' }),
        series: [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']].map(([k, n]) => ({ name: n, type: 'line', symbolSize: 8, data: rows.value.slice(1).map((r) => Number(((base.value[k] - r[k]) / base.value[k] * 100).toFixed(1))) })) }));
      return { rows, fmt, bar, gain };
    },
    template: `<div>
      <div class="row mb">
        <panel title="消融实验结果（YOLOv5n）" style="flex:1">
          <el-table :data="rows" border size="small">
            <el-table-column prop="config" label="配置" min-width="150"/>
            <el-table-column v-for="c in ['mi','softmask','di']" :key="c" :label="({mi:'MI 动量',softmask:'SoftMask',di:'DI 多样性'})[c]" width="100" align="center">
              <template #default="{row}"><span :style="{color: row[c] ? '#3fe0c0' : '#55657f'}">{{row[c] ? '✔' : '—'}}</span></template></el-table-column>
            <el-table-column v-for="c in ['precision','recall','f1']" :key="c" :label="({precision:'Precision',recall:'Recall',f1:'F1-Score'})[c]"><template #default="{row}"><span v-html="fmt(row,c)"></span></template></el-table-column>
          </el-table>
          <div class="formula" style="margin-top:12px">SoftMask 使 Precision/Recall/F1 下降近 40%，是最关键组件；MI 提供更稳定的梯度方向；<br>DI 在白盒模型上略弱，但提升向 YOLOv5s / YOLOv5m 的迁移攻击能力。</div></panel>
        <panel title="各配置检测指标" style="flex:1.1"><e-chart :option="bar" :height="360"/></panel>
      </div>
      <panel title="各模块相对 Basic PGD 的指标下降幅度"><e-chart :option="gain" :height="320"/></panel>
    </div>`,
  };
  PAGES.weather = {
    setup() {
      const samples = Store.list('image_sample').filter((s) => s.modality === 'RGB');
      const s = ref(samples.find((x) => x.scene === '城市道路') || samples[0]);
      const cfg = reactive({ fog_intensity: 0.8, fog_blur: 1.0, fog_gradient: 0.8 });
      const shownCfg = ref({ ...cfg });
      const apply = () => { shownCfg.value = { ...cfg }; };
      const rows = computed(() => Store.list('weather_result'));
      const bar = computed(() => U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 30 }, xAxis: U.axis({ type: 'category', data: ['Precision', 'Recall', 'F1'] }), yAxis: U.axis({ type: 'value', max: 1 }),
        series: rows.value.map((r) => ({ name: r.condition, type: 'bar', barWidth: 34, label: { show: true, position: 'top', color: '#d6e2f5' }, data: [r.precision, r.recall, r.f1] })) }));
      return { samples, s, cfg, shownCfg, apply, rows, bar, Synth };
    },
    template: `<div>
      <panel title="雾天场景仿真参数" class="mb"><div class="query" style="margin:0">
        <div class="q"><span>对抗样本</span><el-select v-model="s" value-key="image_id" style="width:220px"><el-option v-for="x in samples" :key="x.image_id" :value="x" :label="x.image_id+'（'+x.scene+'）'"/></el-select></div>
        <div class="q" style="width:300px"><span>FOG_INTENSITY</span><el-slider v-model="cfg.fog_intensity" :min="0" :max="1.5" :step="0.1" style="width:160px"/><b>{{cfg.fog_intensity}}</b></div>
        <div class="q" style="width:280px"><span>FOG_BLUR</span><el-slider v-model="cfg.fog_blur" :min="0" :max="3" :step="1" style="width:160px"/><b>{{cfg.fog_blur}}</b></div>
        <div class="q" style="width:340px"><span>FOG_VERTICAL_GRADIENT</span><el-slider v-model="cfg.fog_gradient" :min="0" :max="1.5" :step="0.1" style="width:150px"/><b>{{cfg.fog_gradient}}</b></div>
        <el-button type="primary" @click="apply"><el-icon><Cloudy/></el-icon>&nbsp;生成雾化样本</el-button></div></panel>
      <div class="row mb">
        <div class="grid2" style="flex:1">
          <canvas-view :draw="Synth.adv(s)" :deps="s" :w="640" :h="512" cap="(a) 原始对抗样本及检测结果"/>
          <canvas-view :draw="Synth.fog(s, shownCfg)" :deps="[s, shownCfg]" :w="640" :h="512" cap="(b) 雾天仿真后的对抗样本及检测结果"/>
        </div>
        <panel title="大气散射模型" style="width:420px"><div class="formula" style="line-height:2.1">
          I(x) = J(x)·t(x) + A·(1 − t(x))　　(16)<br>J(x)：清晰图像　I(x)：雾化图像<br>A：全局大气光强度（本系统取 0.9）<br>t(x) = exp(−β·d(x))：透射率<br>d(x)：按图像纵坐标构造的深度，上方更远、雾更浓<br>β 由 FOG_INTENSITY 控制，深度梯度由<br>FOG_VERTICAL_GRADIENT 控制，雾化后按 FOG_BLUR 做高斯模糊</div>
          <div class="kv" style="margin-top:14px"><span class="k">当前雾强度</span><span class="hl">{{shownCfg.fog_intensity}}</span><span class="k">模糊强度</span><span>{{shownCfg.fog_blur}}</span><span class="k">纵向梯度</span><span>{{shownCfg.fog_gradient}}</span></div></panel>
      </div>
      <div class="row">
        <panel title="雾天条件下的检测性能（YOLOv5n）" style="flex:1"><el-table :data="rows" border size="small">
          <el-table-column prop="condition" label="条件" min-width="140"/><el-table-column prop="fog_intensity" label="FOG_INTENSITY"/><el-table-column prop="fog_blur" label="FOG_BLUR"/>
          <el-table-column prop="fog_gradient" label="FOG_VERTICAL_GRADIENT" min-width="170"/><el-table-column prop="precision" label="Precision"/><el-table-column prop="recall" label="Recall"/><el-table-column prop="f1" label="F1-Score"/></el-table>
          <div class="muted" style="margin-top:10px;font-size:13px;line-height:1.8">加雾后 Recall 由 0.476 降至 0.314，大量真实目标被漏检；Precision 升高源于候选框减少、检测更保守，并不代表检测能力提升。</div></panel>
        <panel title="加雾前后指标对比" style="width:620px"><e-chart :option="bar" :height="260"/></panel>
      </div>
    </div>`,
  };
})();
