// 公共模块：数据仓库、通用组件（指标卡片、面板、图表、画布、增删改查表格）
(function () {
  const { reactive, ref, computed, watch, onMounted, onBeforeUnmount, nextTick } = Vue;
  const D = window.APP_DATA;

  // ---------- 数据仓库：内存 + 浏览器缓存（data.js 改动后自动失效） ----------
  const src = JSON.stringify(D.tables);
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  const KEY = 'APP_STORE_' + D.system.short;
  let cached = null;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.hash === h) cached = c.tables;
  } catch (e) { /* 缓存损坏时忽略 */ }
  const init = cached || JSON.parse(src);
  for (const rows of Object.values(init)) rows.forEach((r, i) => { if (r.id == null) r.id = i + 1; });
  const tables = reactive(init);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ hash: h, tables })); } catch (e) { /* 忽略 */ } };
  const Store = {
    tables,
    list: (t) => tables[t] || [],
    add(t, row) { const rows = tables[t]; row.id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1; rows.unshift(row); save(); },
    update(t, row) { const rows = tables[t]; const i = rows.findIndex((r) => r.id === row.id); if (i >= 0) rows[i] = row; save(); },
    remove(t, id) { const rows = tables[t]; const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); save(); },
    reset() { localStorage.removeItem(KEY); location.reload(); },
  };

  // ---------- 工具 ----------
  const U = {
    fmt: (v, n = 2) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(n)),
    // 返回每列最大（或最小）值，用于表格加粗最优
    best(rows, cols, mode = 'max') {
      const o = {};
      for (const c of cols) {
        const vals = rows.map((r) => Number(r[c])).filter((v) => Number.isFinite(v));
        o[c] = mode === 'min' ? Math.min(...vals) : Math.max(...vals);
      }
      return o;
    },
    rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
    nowText() {
      if (D.system.fixedTime) return D.system.fixedTime;
      const d = new Date(); const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    },
    // ECharts 深色基础配置
    chart(extra = {}) {
      const axis = { axisLine: { lineStyle: { color: '#3a5378' } }, axisLabel: { color: '#9fb0cc' }, splitLine: { lineStyle: { color: '#1e3354' } } };
      return Object.assign({
        backgroundColor: 'transparent', textStyle: { color: '#c3d0e6' },
        color: ['#3c8cff', '#36c98e', '#f0a43a', '#3fe0c0', '#f0625a', '#a879f0', '#5ad1f0', '#e8d35a', '#ff8fb1'],
        grid: { left: 50, right: 20, top: 40, bottom: 30, containLabel: false },
        tooltip: { trigger: 'axis', backgroundColor: '#172843', borderColor: '#2a4268', textStyle: { color: '#d6e2f5' } },
        legend: { textStyle: { color: '#c3d0e6' }, top: 6 },
        _axis: axis,
      }, extra);
    },
    axis(o = {}) { return Object.assign({}, U.chart()._axis, o); },
    tagType(v) {
      const m = { 已就绪: 'success', 已部署: 'success', 已完成: 'success', 启用: 'success', 运行中: 'primary', 训练中: 'primary', 白盒代理模型: 'warning', 迁移目标模型: 'primary', 本文方法: 'success',
        预处理中: 'warning', 待部署: 'warning', 排队中: 'info', 已停用: 'info', 停用: 'info', 已终止: 'danger', 失败: 'danger' };
      return m[v] || 'info';
    },
  };
  const C = {};
  C['stat-cards'] = {
    props: { items: Array, cols: Number, center: Boolean },
    template: `<div class="cards" :style="{gridTemplateColumns:'repeat('+(cols||items.length)+',1fr)'}">
      <div v-for="it in items" :key="it.label" class="stat" :class="{center}">
        <template v-if="center"><div class="val" :style="{color:it.color}">{{it.value}}</div><div class="lab">{{it.label}}</div></template>
        <template v-else>
          <div class="ico" :style="{background:it.color}"><el-icon><component :is="it.icon||'DataLine'"/></el-icon></div>
          <div><div class="val">{{it.value}}</div><div class="lab">{{it.label}}</div></div>
        </template>
      </div></div>`,
  };
  C['panel'] = {
    props: { title: String, bodyStyle: [String, Object] },
    template: `<div class="panel"><div class="panel-hd"><span class="t">{{title}}</span><div><slot name="extra"/></div></div>
      <div class="panel-bd" :style="bodyStyle"><slot/></div></div>`,
  };
  C['e-chart'] = {
    props: { option: Object, height: { type: [Number, String], default: 300 } },
    setup(props) {
      const el = ref(null); let inst = null;
      const clean = (o) => { const c = Object.assign({}, o); delete c._axis; return c; };
      const onResize = () => inst && inst.resize();
      onMounted(() => { inst = echarts.init(el.value); inst.setOption(clean(props.option)); window.addEventListener('resize', onResize); });
      watch(() => props.option, (o) => inst && inst.setOption(clean(o), true), { deep: true });
      onBeforeUnmount(() => { window.removeEventListener('resize', onResize); inst && inst.dispose(); });
      return { el };
    },
    template: `<div ref="el" :style="{height: typeof height==='number' ? height+'px' : height, width:'100%'}"></div>`,
  };
  // 画布：draw(ctx, w, h) 由 synth.js 提供，deps 变化时重绘
  C['canvas-view'] = {
    props: { draw: Function, w: { type: Number, default: 640 }, h: { type: Number, default: 480 }, cap: String, info: String,
      deps: null, height: { type: [Number, String], default: 'auto' } },
    setup(props) {
      const cv = ref(null);
      const redraw = async () => {
        await nextTick(); const c = cv.value; if (!c || !props.draw) return;
        c.width = props.w; c.height = props.h;
        try { await props.draw(c.getContext('2d'), props.w, props.h); } catch (e) { console.error(e); }
      };
      onMounted(redraw);
      watch(() => [props.deps, props.draw], redraw, { deep: true });
      return { cv };
    },
    template: `<div class="canvas-box" :style="{height: typeof height==='number' ? height+'px' : height, aspectRatio: height==='auto' ? (w+'/'+h) : null}">
      <canvas ref="cv"></canvas><span v-if="cap" class="cap">{{cap}}</span><span v-if="info" class="info">{{info}}</span><slot/></div>`,
  };
  // 通用增删改查表格：数据来自 Store，修改即时保存到浏览器缓存
  C['crud-table'] = {
    props: { table: String, title: String, columns: Array, form: Array, filters: { type: Array, default: () => [] },
      pageSize: { type: Number, default: 10 }, actions: { type: Boolean, default: true }, newRow: Function,
      rowClass: Function, readonly: Boolean, size: { type: String, default: 'default' } },
    emits: ['select'],
    setup(props, { emit }) {
      const q = reactive({});
      const applied = reactive({});
      const page = ref(1);
      const dlg = reactive({ show: false, edit: false, row: {} });
      const all = computed(() => Store.list(props.table).filter((r) => props.filters.every((f) => {
        const v = applied[f.prop];
        if (v === undefined || v === '' || v === null) return true;
        return f.type === 'select' ? String(r[f.prop]) === String(v) : String(r[f.prop] ?? '').includes(v);
      })));
      const rows = computed(() => all.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize));
      const search = () => { Object.assign(applied, q); page.value = 1; };
      const reset = () => { for (const k of Object.keys(q)) q[k] = ''; search(); };
      const openAdd = () => { dlg.edit = false; dlg.row = props.newRow ? props.newRow() : {}; dlg.show = true; };
      const openEdit = (r) => { dlg.edit = true; dlg.row = JSON.parse(JSON.stringify(r)); dlg.show = true; };
      const submit = () => {
        for (const f of props.form || []) {
          const v = dlg.row[f.prop];
          if (f.required && (v === undefined || v === null || v === '')) return ElementPlus.ElMessage.warning(f.label + ' 不能为空');
        }
        if (dlg.edit) Store.update(props.table, dlg.row); else Store.add(props.table, dlg.row);
        dlg.show = false; ElementPlus.ElMessage.success(dlg.edit ? '更新成功' : '新增成功');
      };
      const del = (r) => ElementPlus.ElMessageBox.confirm('确定删除该记录吗？', '提示', { type: 'warning' })
        .then(() => { Store.remove(props.table, r.id); ElementPlus.ElMessage.success('删除成功'); }).catch(() => {});
      const exportCsv = () => {
        const esc = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const txt = '\ufeff' + props.columns.map((c) => esc(c.label)).join(',') + '\n'
          + all.value.map((r) => props.columns.map((c) => esc(r[c.prop])).join(',')).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
        a.download = (props.title || props.table) + '.csv'; a.click();
      };
      const cell = (c, r) => (c.fmt ? c.fmt(r) : c.digits != null ? U.fmt(r[c.prop], c.digits) : r[c.prop]);
      const rc = ({ row }) => (props.rowClass ? props.rowClass(row) : '');
      return { q, page, dlg, all, rows, search, reset, openAdd, openEdit, submit, del, exportCsv, cell, rc, U, emit };
    },
    template: `<div>
      <div class="query" v-if="filters.length || !readonly">
        <div class="q" v-for="f in filters" :key="f.prop"><span>{{f.label}}</span>
          <el-select v-if="f.type==='select'" v-model="q[f.prop]" placeholder="全部" clearable style="width:140px">
            <el-option v-for="o in f.options" :key="o" :label="o" :value="o"/></el-select>
          <el-input v-else v-model="q[f.prop]" :placeholder="'请输入'+f.label" clearable style="width:150px"/>
        </div>
        <el-button v-if="filters.length" type="primary" @click="search"><el-icon><Search/></el-icon>&nbsp;查询</el-button>
        <el-button v-if="filters.length" @click="reset">重置</el-button>
        <span style="flex:1"></span>
        <el-button v-if="!readonly" type="success" @click="openAdd"><el-icon><Plus/></el-icon>&nbsp;新增</el-button>
        <el-button @click="exportCsv"><el-icon><Download/></el-icon>&nbsp;导出</el-button>
      </div>
      <el-table :data="rows" stripe border :size="size" highlight-current-row :row-class-name="rc" @current-change="r => r && emit('select', r)">
        <el-table-column type="index" label="序号" width="60" align="center" :index="i => (page-1)*pageSize+i+1"/>
        <el-table-column v-for="c in columns" :key="c.prop" :prop="c.prop" :label="c.label" :width="c.width" :min-width="c.minWidth||90" show-overflow-tooltip>
          <template #default="{row}">
            <el-tag v-if="c.type==='tag'" :type="U.tagType(row[c.prop])" effect="dark" size="small">{{row[c.prop]}}</el-tag>
            <el-progress v-else-if="c.type==='progress'" :percentage="Math.round(c.fmt ? c.fmt(row) : row[c.prop])" :stroke-width="10"/>
            <el-tag v-else-if="c.type==='bool'" :type="row[c.prop] ? 'success':'info'" size="small">{{row[c.prop] ? '启用':'未启用'}}</el-tag>
            <span v-else-if="c.html" v-html="c.html(row)"></span>
            <span v-else>{{cell(c,row)}}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="actions" label="操作" :width="readonly ? 90 : 170" fixed="right" align="center">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click.stop="emit('select', row)">查看</el-button>
            <template v-if="!readonly">
              <el-button size="small" type="warning" link @click.stop="openEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click.stop="del(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="all.length" :page-size="pageSize" v-model:current-page="page"/>
      <el-dialog v-model="dlg.show" :title="(dlg.edit?'编辑':'新增')+(title||'')" width="620px">
        <el-form label-width="140px">
          <el-form-item v-for="f in form" :key="f.prop" :label="f.label" :required="f.required">
            <el-select v-if="f.type==='select'" v-model="dlg.row[f.prop]" style="width:100%"><el-option v-for="o in f.options" :key="String(o.value ?? o)" :label="o.label ?? o" :value="o.value ?? o"/></el-select>
            <el-input-number v-else-if="f.type==='number'" v-model="dlg.row[f.prop]" :step="f.step||1" :min="f.min" style="width:100%" controls-position="right"/>
            <el-input v-else v-model="dlg.row[f.prop]" :type="f.type==='textarea'?'textarea':'text'"/>
          </el-form-item>
        </el-form>
        <template #footer><el-button @click="dlg.show=false">取消</el-button><el-button type="primary" @click="submit">保存</el-button></template>
      </el-dialog>
    </div>`,
  };
  window.COMMON_COMPONENTS = C;
  window.Store = Store;
  window.U = U;
})();
