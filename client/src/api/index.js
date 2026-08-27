import axios from 'axios';
import { ElMessage } from 'element-plus';

let baseURL = (await (window.zerohub?.getConfig?.()))?.serverUrl || 'http://localhost:3000';

const request = axios.create({
  baseURL,
  timeout: 15000
});

export function setBaseURL(url) {
  baseURL = url;
  request.defaults.baseURL = url;
}
export function getBaseURL() {
  return baseURL;
}

request.interceptors.request.use(config => {
  const token = localStorage.getItem('zh_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data && data.success === false) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(data);
    }
    return data;
  },
  (err) => {
    if (err.response) {
      const msg = err.response.data?.message || `服务器错误 (${err.response.status})`;
      ElMessage.error(msg);
    } else {
      ElMessage.error('无法连接到服务器，请检查网络或服务器地址');
    }
    return Promise.reject(err);
  }
);

export default request;

// ========== 具体API ==========
export const verifyCard = cardNumber => request.get(`/api/cards/verify/${cardNumber}`);
export const register = data => request.post('/api/auth/register', data);
export const login = data => request.post('/api/auth/login', data);
export const autoLogin = () => request.get('/api/auth/auto-login');
export const getUserInfo = () => request.get('/api/auth/info');

export const getPublicSettings = () => request.get('/api/admin/settings/public');
export const getMirrors = () => request.get('/api/admin/mirrors/public');

export const getResources = params => request.get('/api/resources/list', { params });
export const getResourceDetail = id => request.get(`/api/resources/${id}`);
export const requestDownload = id => request.post(`/api/resources/${id}/download`);

export const healthCheck = (url) => {
  const inst = axios.create({ baseURL: url, timeout: 5000 });
  return inst.get('/api/health');
};
