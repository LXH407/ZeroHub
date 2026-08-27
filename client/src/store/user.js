import { defineStore } from 'pinia';
import { login as loginApi, autoLogin, getUserInfo, register as registerApi } from '../api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('zh_token') || '',
    user: JSON.parse(localStorage.getItem('zh_user') || 'null'),
    firstLoadDone: false
  }),
  actions: {
    async login(username, password, remember = true) {
      const res = await loginApi({ username, password, rememberMe: remember });
      this.token = res.token;
      this.user = res.user;
      this.save(remember);
      return res;
    },
    async tryAutoLogin() {
      if (!this.token) return false;
      try {
        const res = await autoLogin();
        this.user = res.user;
        this.save(true);
        this.firstLoadDone = true;
        return true;
      } catch (e) {
        this.logout();
        this.firstLoadDone = true;
        return false;
      }
    },
    async refresh() {
      if (!this.token) return null;
      try {
        const res = await getUserInfo();
        this.user = res.user;
        this.save(true);
        return res.user;
      } catch (e) { return null; }
    },
    async register(data) {
      return registerApi(data);
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('zh_token');
      localStorage.removeItem('zh_user');
    },
    save(remember) {
      if (remember) {
        localStorage.setItem('zh_token', this.token);
        localStorage.setItem('zh_user', JSON.stringify(this.user));
      }
    }
  }
});
