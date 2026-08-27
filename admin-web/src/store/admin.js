import { defineStore } from 'pinia';
import { adminLogin, getAdminInfo } from '../api';

const STORAGE_KEY = 'zerohub_admin';

export const useAdminStore = defineStore('admin', {
  state: () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return {
          token: data.token || '',
          admin: data.admin || null
        };
      } catch (e) {}
    }
    return {
      token: '',
      admin: null
    };
  },

  actions: {
    async login(username, password) {
      const res = await adminLogin({ username, password });
      this.token = res.token;
      this.admin = res.admin;
      this.save();
      return res;
    },

    async loadInfo() {
      if (!this.token) return null;
      try {
        const res = await getAdminInfo();
        this.admin = res.admin;
        this.save();
        return res.admin;
      } catch (e) {
        this.logout();
        return null;
      }
    },

    logout() {
      this.token = '';
      this.admin = null;
      localStorage.removeItem(STORAGE_KEY);
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: this.token,
        admin: this.admin
      }));
    }
  }
});
