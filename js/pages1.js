// 页面：评估总览大屏、数据集管理、检测模型管理
window.PAGES = window.PAGES || {};
(function () {
  const { ref, computed } = Vue;
  const ST = window.APP_DATA.stats;
  const CLS = ['car', 'truck', 'bus', 'van', 'freight car'];

  PAGES.dashboard = {
    setup() {
      const samples = computed(() => Store.list('image_sample').filter((x) => x.modality === 'RGB'));
      const sample = ref(samples.value.find((x) => x.scene === '停车场') || samples.value[0]);
      const tasks = computed(() => Store.list('attack_task'));
      const ev = computed(() => Store.list('eval_result'));
      const f1 = (m, d = 'YOLOv5n') => (ev.value.find((e) => e.method === m && e.detector === d) || {}).f1;
      const cards = computed(() => [
        { label: '数据集图像（RGB+红外）', value: ST.total_images.toLocaleString(), icon: 'Picture', color: '#3c8cff' },
        { label: '检测模型', value: Store.list('detector').length, icon: 'Cpu', color: '#36c98e' },
        { label: '攻击算法', value: Store.list('attack_method').length, icon: 'Aim', color: '#f0a43a' },
        { label: '对抗攻击任务', value: tasks.value.length, icon: 'List', color: '#a879f0' },
        { label: '白盒 F1 下降率', value: ((f1('原始图像') - f1('MD-SM-PGD')) / f1('原始图像') * 100).toFixed(1) + '%', icon: 'TrendCharts', color: '#f0625a' }]);
      const bar = computed(() => {
        const rows = ev.value.filter((e) => e.detector === 'YOLOv5n');
        return U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 50 },
          xAxis: U.axis({ type: 'category', data: rows.map((r) => r.method), axisLabel: { color: '#9fb0cc', rotate: 25 } }), yAxis: U.axis({ type: 'value', max: 1 }),
          series: ['precision', 'recall', 'f1'].map((k, i) => ({ name: ['Precision', 'Recall', 'F1'][i], type: 'bar', data: rows.map((r) => r[k]) })) });
      });
      const nClean = computed(() => Synth.detect(sample.value, 'clean').filter((b) => !b.fp).length);
      const nAdv = computed(() => Synth.detect(sample.value, 'adv'));
      return { samples, sample, tasks, cards, bar, nClean, nAdv, Synth, U };
    },
    template: `<div>
      <stat-cards :items="cards"/>
      <div class="row mb" style="height:500px">
        <panel title="原始图像与对抗样本检测对比（YOLOv5n）" style="flex:1" body-style="display:flex;flex-direction:column;gap:8px">
          <template #extra><el-select v-model="sample" value-key="image_id" size="small" style="width:260px">
            <el-option v-for="s in samples" :key="s.image_id" :value="s" :label="s.image_id+'（'+s.scene+'）'"/></el-select></template>
          <div class="grid2" style="flex:1">
            <canvas-view :draw="Synth.orig(sample,'clean')" :deps="sample" :w="640" :h="512" height="100%" cap="原始图像检测结果" :info="'真实目标 '+sample.obj_num+'　正确检出 '+nClean"/>
            <canvas-view :draw="Synth.adv(sample)" :deps="sample" :w="640" :h="512" height="100%" cap="MD-SM-PGD 对抗样本检测结果（红框为误检）" :info="'正确检出 '+nAdv.filter(b=>!b.fp).length+'　误检 '+nAdv.filter(b=>b.fp).length"/>
          </div>
        </panel>
        <panel title="最新攻击任务" style="width:400px" body-style="overflow:auto">
          <div class="feed"><div class="feed-item" v-for="t in tasks.slice(0,6)" :key="t.task_no" :style="{borderLeftColor: t.method==='MD-SM-PGD' ? '#3fe0c0' : '#f0a43a'}">
            <div class="ft"><span>{{t.method}}</span><el-tag size="small" effect="dark" :type="U.tagType(t.status)">{{t.status}}</el-tag></div>
            <div>任务编号：{{t.task_no}}　代理模型：{{t.surrogate}}</div>
            <div>样本数 {{t.img_num}}，ε = {{t.eps}}，迭代 {{t.iters}} 次<span v-if="t.f1_drop!=null">，F1 下降 {{t.f1_drop}}%</span></div>
            <div class="muted">{{t.created_at}}</div></div></div>
        </panel>
      </div>
      <div class="row">
        <panel title="攻击任务执行状态" style="flex:1">
          <el-table :data="tasks" stripe border size="small" max-height="300">
            <el-table-column prop="task_no" label="任务编号" width="150"/><el-table-column prop="method" label="攻击算法" width="120"/>
            <el-table-column prop="surrogate" label="代理模型" width="100"/><el-table-column prop="dataset" label="数据集" min-width="170"/>
            <el-table-column prop="img_num" label="样本数" width="80"/>
            <el-table-column label="进度" min-width="170"><template #default="{row}"><el-progress :percentage="row.progress" :stroke-width="9" :status="row.progress>=100?'success':''"/></template></el-table-column>
            <el-table-column label="攻击后 F1" width="95"><template #default="{row}">{{row.f1_after ?? '-'}}</template></el-table-column>
            <el-table-column label="状态" width="90"><template #default="{row}"><el-tag :type="U.tagType(row.status)" effect="dark" size="small">{{row.status}}</el-tag></template></el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160"/>
          </el-table></panel>
        <panel title="白盒攻击效果（YOLOv5n）" style="width:640px"><e-chart :option="bar" :height="290"/></panel>
      </div>
    </div>`,
  };
  const SCENES = ['城市道路', '高速公路', '停车场', '居民区'];
  PAGES.dataset = {
    setup() {
      const sel = ref(Store.list('image_sample')[2]);
      const cls = U.chart({ grid: { left: 70, right: 16, top: 30, bottom: 30 }, legend: { show: false }, tooltip: { trigger: 'axis' },
        xAxis: U.axis({ type: 'category', data: CLS }), yAxis: U.axis({ type: 'value', name: '标注数' }),
        series: [{ type: 'bar', barWidth: 34, data: CLS.map((c) => ST.class_total[c]), label: { show: true, position: 'top', color: '#d6e2f5' },
          itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3fe0c0' }, { offset: 1, color: '#2464c8' }] } } }] });
      const mod = U.chart({ grid: { left: 70, right: 16, top: 40, bottom: 30 },
        xAxis: U.axis({ type: 'category', data: CLS }), yAxis: U.axis({ type: 'log', name: '标注数(对数)' }),
        series: [{ name: 'RGB', type: 'bar', data: CLS.map((c) => ST.class_rgb[c]) }, { name: '红外', type: 'bar', data: CLS.map((c) => ST.class_ir[c]) }] });
      const columns = [{ prop: 'image_id', label: '图像编号', minWidth: 110 }, { prop: 'modality', label: '模态', width: 70 }, { prop: 'scene', label: '场景' },
        { prop: 'split', label: '划分', width: 70 }, { prop: 'width', label: '宽', width: 60 }, { prop: 'height', label: '高', width: 60 }, { prop: 'obj_num', label: '目标数', width: 80 },
        { prop: 'car', label: 'car', width: 60 }, { prop: 'truck', label: 'truck', width: 65 }, { prop: 'bus', label: 'bus', width: 60 }, { prop: 'van', label: 'van', width: 60 },
        { prop: 'freight_car', label: 'freight', width: 75 }, { prop: 'created_at', label: '入库时间', minWidth: 150 }];
      const form = [{ prop: 'image_id', label: '图像编号', required: true }, { prop: 'modality', label: '模态', type: 'select', options: ['RGB', '红外'], required: true },
        { prop: 'scene', label: '场景', type: 'select', options: SCENES, required: true }, { prop: 'split', label: '划分', type: 'select', options: ['train', 'test'] },
        { prop: 'obj_num', label: '目标数', type: 'number' }, { prop: 'car', label: 'car 数', type: 'number' }, { prop: 'truck', label: 'truck 数', type: 'number' },
        { prop: 'bus', label: 'bus 数', type: 'number' }, { prop: 'van', label: 'van 数', type: 'number' }, { prop: 'freight_car', label: 'freight car 数', type: 'number' },
        { prop: 'image_url', label: '图片路径（可选）' }];
      const filters = [{ prop: 'image_id', label: '图像编号' }, { prop: 'modality', label: '模态', type: 'select', options: ['RGB', '红外'] },
        { prop: 'scene', label: '场景', type: 'select', options: SCENES }, { prop: 'split', label: '划分', type: 'select', options: ['train', 'test'] }];
      const newRow = () => ({ image_id: '', modality: 'RGB', scene: '城市道路', split: 'test', width: 640, height: 512, obj_num: 0, car: 0, truck: 0, bus: 0, van: 0, freight_car: 0, boxes: [], image_url: '', created_at: U.nowText() });
      const cards = [{ label: '图像总数', value: ST.total_images.toLocaleString(), color: '#3c8cff' }, { label: 'RGB 图像', value: ST.rgb_images.toLocaleString(), color: '#36c98e' },
        { label: '红外图像', value: ST.ir_images.toLocaleString(), color: '#f0a43a' }, { label: '目标类别', value: CLS.length, color: '#a879f0' },
        { label: '标注总数', value: Object.values(ST.class_total).reduce((a, b) => a + b, 0).toLocaleString(), color: '#f0625a' }];
      return { sel, cls, mod, columns, form, filters, newRow, cards, Synth };
    },
    template: `<div>
      <stat-cards :items="cards" center/>
      <div class="row" style="align-items:flex-start">
        <panel title="DroneVehicle 图像样本管理" style="flex:1"><crud-table table="image_sample" title="图像样本" :columns="columns" :form="form" :filters="filters" :new-row="newRow" :page-size="12" size="small" @select="r=>sel=r"/></panel>
        <div style="width:470px;display:flex;flex-direction:column;gap:16px">
          <panel title="样本预览（绿色为真值标注）"><canvas-view :draw="Synth.orig(sel,'gt')" :deps="sel" :w="640" :h="512" :info="sel.image_id+'　'+sel.modality+'　'+sel.scene+'　目标 '+sel.obj_num"/></panel>
          <panel title="(a) 各类别标注总数"><e-chart :option="cls" :height="230"/></panel>
          <panel title="(b) RGB 与红外模态标注数对比"><e-chart :option="mod" :height="230"/></panel>
        </div>
      </div>
    </div>`,
  };
  PAGES.detectors = {
    setup() {
      const sel = ref(Store.list('detector')[0]);
      const opt = computed(() => { const ds = Store.list('detector');
        return U.chart({ grid: { left: 45, right: 16, top: 40, bottom: 30 }, xAxis: U.axis({ type: 'category', data: ds.map((d) => d.name) }), yAxis: U.axis({ type: 'value', max: 1 }),
          series: [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']].map(([k, n]) => ({ name: n, type: 'bar', data: ds.map((d) => d[k]), label: { show: true, position: 'top', color: '#c3d0e6', fontSize: 11 } })) }); });
      const columns = [{ prop: 'name', label: '模型' }, { prop: 'role', label: '角色', type: 'tag', minWidth: 110 }, { prop: 'params_m', label: '参数量(M)' }, { prop: 'flops_g', label: 'GFLOPs' },
        { prop: 'input_size', label: '输入尺寸' }, { prop: 'epochs', label: '训练轮数' }, { prop: 'precision', label: 'Precision' }, { prop: 'recall', label: 'Recall' }, { prop: 'f1', label: 'F1' },
        { prop: 'status', label: '状态', type: 'tag' }, { prop: 'updated_at', label: '更新时间', minWidth: 150 }];
      const form = [{ prop: 'name', label: '模型名称', required: true }, { prop: 'role', label: '角色', type: 'select', options: ['白盒代理模型', '迁移目标模型'] },
        { prop: 'params_m', label: '参数量(M)', type: 'number', step: 0.1 }, { prop: 'flops_g', label: 'GFLOPs', type: 'number', step: 0.1 },
        ...[['lr0', '初始学习率'], ['lrf', '最终学习率'], ['momentum', 'SGD 动量'], ['weight_decay', '权重衰减'], ['box_w', '回归损失权重'], ['cls_w', '分类损失权重'], ['obj_w', '目标损失权重']].map(([p, l]) => ({ prop: p, label: l, type: 'number', step: 0.0001 })),
        { prop: 'batch_size', label: 'Batch size', type: 'number' }, { prop: 'epochs', label: '训练轮数', type: 'number' },
        { prop: 'precision', label: '原图 Precision', type: 'number', step: 0.001 }, { prop: 'recall', label: '原图 Recall', type: 'number', step: 0.001 }, { prop: 'f1', label: '原图 F1', type: 'number', step: 0.001 },
        { prop: 'status', label: '状态', type: 'select', options: ['已部署', '已停用'] }];
      const newRow = () => ({ name: '', role: '迁移目标模型', params_m: 0, flops_g: 0, input_size: '640×640', lr0: 0.0005, lrf: 0.01, momentum: 0.937, weight_decay: 0.0005, box_w: 0.05, cls_w: 0.5, obj_w: 0.5, batch_size: 2, epochs: 100, precision: 0, recall: 0, f1: 0, status: '已部署', updated_at: U.nowText() });
      const P = [['lr0', '初始学习率'], ['lrf', '最终学习率'], ['momentum', 'SGD 动量'], ['weight_decay', '权重衰减'], ['box_w', '回归损失权重'], ['cls_w', '分类损失权重'], ['obj_w', '目标损失权重'], ['batch_size', 'Batch size'], ['input_size', '图像尺寸'], ['epochs', '训练轮数']];
      return { sel, opt, columns, form, newRow, P };
    },
    template: `<div>
      <panel title="目标检测模型管理" class="mb"><crud-table table="detector" title="检测模型" :columns="columns" :form="form" :new-row="newRow" :page-size="6" @select="r=>sel=r"/></panel>
      <div class="row">
        <panel :title="'训练参数 — '+sel.name" style="width:520px"><el-table :data="P.map(([k,l])=>({k:l,v:sel[k]}))" border stripe size="small">
          <el-table-column prop="k" label="参数"/><el-table-column prop="v" label="取值"/></el-table></panel>
        <panel title="各检测模型在原始图像上的检测性能" style="flex:1"><e-chart :option="opt" :height="420"/></panel>
      </div>
    </div>`,
  };
})();
