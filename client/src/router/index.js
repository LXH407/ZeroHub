import { createRouter, createWebHashHistory } from 'vue-router';
import { useUserStore } from '../store/user';

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录', guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { title: '注册', guest: true }
  },
  {
    path: '/server-config',
    name: 'ServerConfig',
    component: () => import('../views/ServerConfigView.vue'),
    meta: { title: '服务器配置', guest: true }
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomeView.vue'),
        meta: { title: '首页', icon: 'HomeFilled', auth: true }
      },
      {
        path: 'software',
        name: 'Software',
        component: () => import('../views/ResourceListView.vue'),
        meta: { title: '软件下载', icon: 'Monitor', auth: true, type: 'software' }
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('../views/ResourceListView.vue'),
        meta: { title: '大模型下载', icon: 'Cpu', auth: true, type: 'model' }
      },
      {
        path: 'games',
        name: 'Games',
        component: () => import('../views/ResourceListView.vue'),
        meta: { title: '游戏下载', icon: 'Game', auth: true, type: 'game' }
      },
      {
        path: 'api-proxy',
        name: 'ApiProxy',
        component: () => import('../views/ApiProxyView.vue'),
        meta: { title: 'API中转站', icon: 'Connection', auth: true, type: 'api' }
      },
      {
        path: 'resource/:id',
        name: 'ResourceDetail',
        component: () => import('../views/ResourceDetailView.vue'),
        meta: { title: '资源详情', auth: true }
      },
      {
        path: 'downloads',
        name: 'Downloads',
        component: () => import('../views/DownloadsView.vue'),
        meta: { title: '下载中心', icon: 'Download', auth: true }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/SettingsView.vue'),
        meta: { title: '设置', icon: 'Setting', auth: true }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const docTitle = to.meta?.title ? `${to.meta.title} - ZeroHub` : 'ZeroHub 软件商城';
  document.title = docTitle;

  if (to.meta?.guest) {
    next();
    return;
  }

  // 需要登录
  if (!userStore.token) {
    next('/login');
    return;
  }

  // 首次加载尝试自动登录确认token有效
  if (!userStore.firstLoadDone) {
    await userStore.tryAutoLogin();
  }
  if (!userStore.token) {
    next('/login');
    return;
  }

  next();
});

export default router;
