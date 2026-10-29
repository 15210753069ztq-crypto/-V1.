// 应用入口：导航菜单、页面路由、顶部栏
(function () {
  const { createApp, ref, onMounted, onBeforeUnmount } = Vue;
  const D = window.APP_DATA;

  // 导航菜单（路由路径、菜单名称、图标、页面组件）
  const MENU = [
    { path: '/dashboard', title: '评估总览大屏', icon: 'Monitor', page: 'dashboard' },
    { path: '/dataset', title: '数据集管理', icon: 'FolderOpened', page: 'dataset' },
    { path: '/detectors', title: '检测模型管理', icon: 'Cpu', page: 'detectors' },
    { path: '/methods', title: '攻击算法配置', icon: 'SetUp', page: 'methods' },
    { path: '/generate', title: '对抗样本生成', icon: 'MagicStick', page: 'generate' },
    { path: '/whitebox', title: '白盒攻击评估', icon: 'Aim', page: 'whitebox' },
    { path: '/transfer', title: '迁移攻击评估', icon: 'Connection', page: 'transfer' },
    { path: '/ablation', title: '消融实验分析', icon: 'DataAnalysis', page: 'ablation' },
    { path: '/weather', title: '复杂天气鲁棒性', icon: 'Cloudy', page: 'weather' },
  ];

  const Layout = {
    setup() {
      const now = ref(U.nowText());
      let t = null;
      onMounted(() => { t = setInterval(() => (now.value = U.nowText()), 1000); });
      onBeforeUnmount(() => clearInterval(t));
      const reset = () => ElementPlus.ElMessageBox.confirm('将清除页面上的新增/编辑，恢复为 data/data.js 中的数据，是否继续？', '重置数据', { type: 'warning' })
        .then(() => Store.reset()).catch(() => {});
      return { MENU, sys: D.system, now, reset };
    },
    template: `<div class="layout">
      <aside class="side">
        <div class="brand"><el-icon><Promotion/></el-icon>{{sys.short}}</div>
        <router-link v-for="m in MENU" :key="m.path" :to="m.path" custom v-slot="{navigate, isActive}">
          <div class="menu-item" :class="{active:isActive}" @click="navigate"><el-icon><component :is="m.icon"/></el-icon>{{m.title}}</div>
        </router-link>
      </aside>
      <section class="main">
        <header class="header"><span class="sys">{{sys.name}} {{sys.version}}</span>
          <div class="right"><span>{{now}}</span><el-button size="small" text @click="reset">重置数据</el-button>
            <span class="user"><el-icon><User/></el-icon>{{sys.user}}</span></div></header>
        <main class="content"><router-view :key="$route.path"/></main>
      </section>
    </div>`,
  };

  const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [{ path: '/', redirect: MENU[0].path }, ...MENU.map((m) => ({ path: m.path, component: PAGES[m.page], meta: { title: m.title } }))],
  });
  router.afterEach((to) => { document.title = (to.meta.title ? to.meta.title + ' - ' : '') + D.system.name; });

  const app = createApp(Layout);
  app.use(router);
  app.use(ElementPlus, { locale: window.ElementPlusLocaleZhCn });
  for (const [k, c] of Object.entries(window.ElementPlusIconsVue)) app.component(k, c);
  for (const [k, c] of Object.entries(window.COMMON_COMPONENTS)) app.component(k, c);
  app.config.errorHandler = (e) => { console.error(e); ElementPlus.ElMessage.error('页面出错：' + e.message); };
  app.mount('#app');
})();
