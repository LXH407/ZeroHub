import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useAdminStore } from '../store/admin';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 30000
});

request.interceptors.request.use(config => {
  const store = useAdminStore();
  if (store.token) {
    config.headers.Authorization = `Bearer ${store.token}`;
  }
  return config;
});

request.interceptors.response.use(
  response => {
    const data = response.data;
    if (data.success === false) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(data);
    }
    return data;
  },
  error => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        const store = useAdminStore();
        store.logout();
        ElMessage.error('登录已过期，请重新登录');
        window.location.href = '/admin/#/login';
      } else {
        ElMessage.error(data?.message || `请求失败 (${status})`);
      }
    } else {
      ElMessage.error('网络错误，请检查连接');
    }
    return Promise.reject(error);
  }
);

export default request;
