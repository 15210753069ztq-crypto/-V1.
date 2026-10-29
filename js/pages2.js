// 页面：攻击算法配置、对抗样本生成、白盒攻击评估
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed, reactive } = Vue;
  const TYPES = ['单步梯度', '迭代梯度', '随机噪声', '迁移增强', '本文方法'];

  PAGES.methods = {
    setup() {
      const ms = computed(() => Store.list('attack_method'));
      const sel = ref(ms.value.find((m) => m.is_ours) || ms.value[0]);
      const columns = [{ prop: 'name', label: '算法', minWidth: 110 }, { prop: 'type', label: '类型', type: 'tag' }, { prop: 'norm', label: '范数', width: 65 },
        { prop: 'eps', label: 'ε', width: 70 }, { prop: 'alpha', label: '步长 α', width: 75 }, { prop: 'iters', label: '迭代', width: 65 }, { prop: 'momentum', label: '动量 μ', width: 75 },
        { prop: 'di_prob', label: 'DI 概率', width: 80 }, { prop: 'use_mask', label: '软掩码', type: 'bool', width: 85 }, { prop: 'desc', label: '说明', minWidth: 230 }, { prop: 'status', label: '状态', type: 'tag', width: 75 }];
      const yes = [{ label: '启用', value: 1 }, { label: '不启用', value: 0 }];
      const form = [{ prop: 'name', label: '算法名称', required: true }, { prop: 'type', label: '类型', type: 'select', options: TYPES }, { prop: 'norm', label: '扰动范数' },
        { prop: 'eps', label: '最大扰动 ε' }, { prop: 'alpha', label: '步长 α' }, { prop: 'iters', label: '迭代次数', type: 'number' }, { prop: 'momentum', label: '动量系数 μ', type: 'number', step: 0.1 },
        { prop: 'di_prob', label: '多样性输入概率', type: 'number', step: 0.05 }, { prop: 'random_init', label: '随机初始化', type: 'select', options: yes },
        { prop: 'use_mask', label: '软掩码约束', type: 'select', options: yes }, { prop: 'box_scale', label: '真值框扩展比例', type: 'number', step: 0.1 },
        { prop: 'gauss_sigma', label: '高斯平滑系数', type: 'number' }, { prop: 'margin_px', label: '额外像素边距', type: 'number' }, { prop: 'desc', label: '说明', type: 'textarea' },
        { prop: 'status', label: '状态', type: 'select', options: ['启用', '停用'] }];
      const newRow = () => ({ name: '', type: '迭代梯度', norm: 'L∞', eps: '4/255', alpha: '1/255', iters: 10, momentum: 0, di_prob: 0, random_init: 1, use_mask: 0, box_scale: 0, gauss_sigma: 0, margin_px: 0, desc: '', is_ours: 0, status: '启用' });
      const P = computed(() => [['扰动约束范数', sel.value.norm], ['最大扰动幅度 ε', sel.value.eps], ['迭代步长 α', sel.value.alpha], ['迭代次数 T', sel.value.iters],
        ['动量系数 μ', sel.value.momentum], ['多样性输入概率 p', sel.value.di_prob], ['随机初始化扰动', sel.value.random_init ? 'True' : 'False'],
        ['真值框扩展比例', sel.value.box_scale || '-'], ['高斯平滑系数', sel.value.gauss_sigma || '-'], ['额外像素边距', sel.value.margin_px ? sel.value.margin_px + ' px' : '-'], ['输入分辨率', '640×640']]);
      return { sel, columns, form, newRow, P };
    },
    template: `<div>
      <panel title="对抗攻击算法管理" class="mb"><crud-table table="attack_method" title="攻击算法" :columns="columns" :form="form" :new-row="newRow" :page-size="8" @select="r=>sel=r"/></panel>
      <div class="row">
        <panel :title="'扰动参数 — '+sel.name" style="width:520px"><el-table :data="P.map(([k,v])=>({k,v}))" border stripe size="small">
          <el-table-column prop="k" label="参数"/><el-table-column prop="v" label="取值"/></el-table></panel>
        <panel title="MD-SM-PGD 算法流程" style="flex:1"><div class="formula" style="line-height:2">
          输入：原图 x，真值框 B，检测器 f(·)，ε，α，迭代次数 T，重启次数 R，动量 μ，多样性概率 p<br>
          1：由真值框 B 按 1.5 倍扩展并外加 10 px 边距构造区域掩码，高斯平滑得到软掩码 M ∈ [0,1]<br>
          2：for r = 1 … R：在 ε 约束区域内随机初始化 δ<sub>0</sub>，动量 g<sub>0</sub> = 0<br>
          3：　for t = 0 … T−1：以概率 p 对 x + δ<sub>t</sub> 做多样性输入变换 D(·)<br>
          4：　　计算检测损失 L = L<sub>obj</sub> + L<sub>cls</sub> + L<sub>box</sub>，梯度 ∇ = ∂L/∂δ<br>
          5：　　动量累积 g<sub>t+1</sub> = μ·g<sub>t</sub> + ∇ / ‖∇‖<sub>1</sub><br>
          6：　　软掩码约束更新 δ<sub>t+1</sub> = δ<sub>t</sub> + α · M ⊙ sign(g<sub>t+1</sub>)<br>
          7：　　投影 δ<sub>t+1</sub> = Proj<sub>ε</sub>(δ<sub>t+1</sub>)，并裁剪 x + δ<sub>t+1</sub> ∈ [0,1]<br>
          8：保留使检测器 F1 最低的 δ*，输出对抗样本 x<sub>adv</sub> = x + δ*</div></panel>
      </div>
    </div>`,
  };
  PAGES.generate = {
    setup() {
      const samples = Store.list('image_sample');
      const methods = Store.list('attack_method').map((m) => m.name);
      const f = reactive({ sample: samples.find((s) => s.scene === '城市道路') || samples[0], method: 'MD-SM-PGD', surrogate: 'YOLOv5n', iters: 10, momentum: 1.0, di: 0.1 });
      const shown = ref({ sample: f.sample, method: f.method });
      const prog = ref(100); const running = ref(false); const step = ref(10);
      const cfg = computed(() => Store.list('attack_method').find((m) => m.name === shown.value.method) || {});
      const loss = computed(() => { const r = U.rng(shown.value.sample.obj_num * 7 + f.iters); const xs = [], a = [], b = [];
        let v = 8.6; for (let t = 0; t <= f.iters; t++) { xs.push(t); a.push(Number(v.toFixed(3))); b.push(Number((0.89 - (0.89 - 0.425) * (1 - Math.exp(-t / 3.2)) + (r() - 0.5) * 0.02).toFixed(3))); v += 1.9 * Math.exp(-t / 4) + (r() - 0.4) * 0.3; }
        return U.chart({ grid: { left: 50, right: 50, top: 40, bottom: 30 }, xAxis: U.axis({ type: 'category', data: xs, name: '迭代' }),
          yAxis: [U.axis({ type: 'value', name: '攻击损失' }), U.axis({ type: 'value', name: 'F1', min: 0.3, max: 1, splitLine: { show: false } })],
          series: [{ name: '检测损失 L', type: 'line', smooth: true, data: a.slice(0, step.value + 1) }, { name: '估计 F1', type: 'line', smooth: true, yAxisIndex: 1, data: b.slice(0, step.value + 1) }] }); });
      const st = computed(() => Synth.stats(shown.value.sample, shown.value.method, cfg.value));
      const run = () => {
        running.value = true; prog.value = 0; step.value = 0; shown.value = { sample: f.sample, method: f.method };
        const t = setInterval(() => { step.value = Math.min(f.iters, step.value + 1); prog.value = Math.round(step.value / f.iters * 100);
          if (step.value >= f.iters) { clearInterval(t); running.value = false;
            Store.add('attack_task', { task_no: 'AT' + U.nowText().replace(/\D/g, '').slice(0, 12), method: f.method, surrogate: f.surrogate, dataset: f.sample.image_id, img_num: 1,
              eps: '4/255', iters: f.iters, progress: 100, status: '已完成', f1_after: null, f1_drop: null, created_at: U.nowText() });
            ElementPlus.ElMessage.success('对抗样本生成完成，已写入攻击任务记录'); } }, 160);
      };
      return { samples, methods, f, shown, prog, running, step, cfg, loss, st, run, Synth };
    },
    template: `<div>
      <panel title="生成参数" class="mb"><div class="query" style="margin:0">
        <div class="q"><span>输入图像</span><el-select v-model="f.sample" value-key="image_id" style="width:240px"><el-option v-for="s in samples" :key="s.image_id" :value="s" :label="s.image_id+'（'+s.modality+'·'+s.scene+'）'"/></el-select></div>
        <div class="q"><span>攻击算法</span><el-select v-model="f.method" style="width:140px"><el-option v-for="m in methods" :key="m" :value="m" :label="m"/></el-select></div>
        <div class="q"><span>代理模型</span><el-select v-model="f.surrogate" style="width:110px"><el-option value="YOLOv5n" label="YOLOv5n"/></el-select></div>
        <div class="q"><span>ε</span><el-input model-value="4/255" style="width:76px"/></div>
        <div class="q"><span>迭代 T</span><el-input-number v-model="f.iters" :min="1" :max="50" controls-position="right" style="width:96px"/></div>
        <div class="q"><span>动量 μ</span><el-input-number v-model="f.momentum" :step="0.1" controls-position="right" style="width:96px"/></div>
        <div class="q"><span>DI 概率</span><el-input-number v-model="f.di" :step="0.05" controls-position="right" style="width:96px"/></div>
        <el-button type="primary" :loading="running" @click="run"><el-icon><MagicStick/></el-icon>&nbsp;生成对抗样本</el-button>
        <el-progress :percentage="prog" style="width:200px" :stroke-width="10"/></div></panel>
      <div class="row">
        <div class="grid3" style="flex:1">
          <canvas-view :draw="Synth.orig(shown.sample,'gt')" :deps="shown" :w="640" :h="512" cap="① 原始图像与真值框"/>
          <canvas-view :draw="Synth.mask(shown.sample,cfg)" :deps="[shown,cfg]" :w="640" :h="512" cap="② 软掩码 M（1.5× 扩展 + 10px + 高斯平滑）"/>
          <canvas-view :draw="Synth.perturbHeat(shown.sample,shown.method,cfg)" :deps="[shown,cfg]" :w="640" :h="512" cap="③ 对抗扰动热力图 |δ|"/>
          <canvas-view :draw="Synth.perturbAmp(shown.sample,shown.method,cfg)" :deps="[shown,cfg]" :w="640" :h="512" cap="④ 扰动可视化（放大 25 倍）"/>
          <canvas-view :draw="Synth.adv(shown.sample,shown.method,cfg)" :deps="[shown,cfg]" :w="640" :h="512" cap="⑤ 对抗样本及 YOLOv5n 检测结果"/>
          <canvas-view :draw="Synth.grad(shown.sample,cfg)" :deps="[shown,cfg]" :w="640" :h="512" cap="⑥ 最后一步梯度强度分布"/>
        </div>
        <div style="width:440px;display:flex;flex-direction:column;gap:16px">
          <panel title="迭代过程"><e-chart :option="loss" :height="280"/></panel>
          <panel title="扰动统计"><div class="kv">
            <span class="k">攻击算法</span><span class="hl">{{shown.method}}</span><span class="k">输入图像</span><span>{{shown.sample.image_id}}（{{shown.sample.scene}}）</span>
            <span class="k">当前迭代</span><span>{{step}} / {{f.iters}}</span><span class="k">L∞ 范数</span><span>{{st.linf}}（≤ 4/255 = 0.0157）</span>
            <span class="k">L2 范数</span><span>{{st.l2}}</span><span class="k">PSNR</span><span>{{st.psnr}} dB</span>
            <span class="k">扰动覆盖率</span><span>{{st.cover}} %</span><span class="k">真值目标数</span><span>{{shown.sample.obj_num}}</span></div></panel>
        </div>
      </div>
    </div>`,
  };
  // 表格加粗：攻击方法中各指标最低者为最优攻击效果（原始图像行不参与比较）
  const boldMin = (rows, cols) => { const b = U.best(rows.filter((r) => (r.method || r.config) !== '原始图像'), cols, 'min');
    return (r, c) => ((r.method || r.config) !== '原始图像' && r[c] === b[c] ? `<b class="best">${U.fmt(r[c], 3)}</b>` : U.fmt(r[c], 3)); };
  PAGES.whitebox = {
    setup() {
      const rows = computed(() => Store.list('eval_result').filter((e) => e.detector === 'YOLOv5n'));
      const fmt = computed(() => boldMin(rows.value, ['precision', 'recall', 'f1']));
      const orig = computed(() => rows.value.find((r) => r.method === '原始图像') || { f1: 1 });
      const bar = computed(() => U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 50 },
        xAxis: U.axis({ type: 'category', data: rows.value.map((r) => r.method), axisLabel: { color: '#9fb0cc', rotate: 20 } }), yAxis: U.axis({ type: 'value', max: 1 }),
        series: [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']].map(([k, n]) => ({ name: n, type: 'bar', data: rows.value.map((r) => r[k]) })) }));
      const drop = computed(() => U.chart({ grid: { left: 90, right: 50, top: 20, bottom: 30 }, legend: { show: false },
        yAxis: U.axis({ type: 'category', data: rows.value.filter((r) => r.method !== '原始图像').map((r) => r.method) }), xAxis: U.axis({ type: 'value', name: '%' }),
        series: [{ type: 'bar', barWidth: 14, label: { show: true, position: 'right', color: '#d6e2f5', formatter: '{c}%' },
          data: rows.value.filter((r) => r.method !== '原始图像').map((r) => ({ value: Number(((orig.value.f1 - r.f1) / orig.value.f1 * 100).toFixed(1)), itemStyle: { color: r.method === 'MD-SM-PGD' ? '#3fe0c0' : '#3c8cff' } })) }] }));
      const s = Store.list('image_sample').find((x) => x.scene === '高速公路') || Store.list('image_sample')[0];
      return { rows, fmt, bar, drop, s, Synth };
    },
    template: `<div>
      <div class="row mb">
        <panel title="YOLOv5n 白盒攻击评估结果" style="flex:1">
          <el-table :data="rows" border :row-class-name="({row}) => row.method==='MD-SM-PGD' ? 'ours' : ''" size="small">
            <el-table-column prop="method" label="攻击方法" min-width="130"><template #default="{row}"><b v-if="row.method==='MD-SM-PGD'" class="hl">MD-SM-PGD（本文）</b><span v-else>{{row.method}}</span></template></el-table-column>
            <el-table-column v-for="c in ['precision','recall','f1']" :key="c" :label="({precision:'Precision',recall:'Recall',f1:'F1-Score'})[c]"><template #default="{row}"><span v-html="fmt(row,c)"></span></template></el-table-column>
          </el-table>
          <div class="muted" style="margin-top:8px;font-size:13px">指标越低说明攻击越有效；各列最优（最低）结果加粗。</div></panel>
        <panel title="各方法检测指标对比" style="flex:1.2"><e-chart :option="bar" :height="350"/></panel>
        <panel title="F1 相对下降率" style="width:420px"><e-chart :option="drop" :height="350"/></panel>
      </div>
      <panel title="原始图像与对抗样本检测结果对比（YOLOv5n）"><div class="grid3">
        <canvas-view :draw="Synth.orig(s,'clean')" :deps="s" :w="640" :h="512" cap="原始图像检测"/>
        <canvas-view :draw="Synth.adv(s,'PGD',{},'pgd')" :deps="s" :w="640" :h="512" cap="PGD 全局攻击后检测"/>
        <canvas-view :draw="Synth.adv(s)" :deps="s" :w="640" :h="512" cap="MD-SM-PGD 攻击后检测（红框为误检）"/>
      </div></panel>
    </div>`,
  };
  window.boldMin = boldMin;
})();
