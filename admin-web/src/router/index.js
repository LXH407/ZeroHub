import { createRouter, createWebHashHistory } from 'vue-router';
import { useAdminStore } from '../store/admin';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'DataAnalysis' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/Users.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'cards',
        name: 'Cards',
        component: () => import('../views/Cards.vue'),
        meta: { title: '卡密管理', icon: 'CreditCard' }
      },
      {
        path: 'resources',
        name: 'Resources',
        component: () => import('../views/Resources.vue'),
        meta: { title: '资源管理', icon: 'Folder' }
      },
      {
        path: 'mirrors',
        name: 'Mirrors',
        component: () => import('../views/Mirrors.vue'),
        meta: { title: '镜像源配置', icon: 'Connection' }
      },
      {
        path: 'pending',
        name: 'Pending',
        component: () => import('../views/Pending.vue'),
        meta: { title: '待注册处理', icon: 'Clock' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory('/admin/'),
  routes
});

router.beforeEach(async (to, from, next) => {
  const store = useAdminStore();
  const title = to.meta?.title ? `${to.meta.title} - ZeroHub管理后台` : 'ZeroHub管理后台';
  document.title = title;

  if (to.path === '/login') {
    next();
  } else {
    if (!store.token) {
      next('/login');
    } else {
      if (!store.admin) {
        await store.loadInfo();
      }
      next();
    }
  }
});

export default router;
