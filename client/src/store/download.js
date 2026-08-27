import { defineStore } from 'pinia';

export const useDownloadStore = defineStore('download', {
  state: () => ({
    tasks: new Map() // id -> task object
  }),
  getters: {
    taskList: (state) => Array.from(state.tasks.values()).sort((a, b) => {
      const order = { downloading: 0, running: 0, pending: 1, paused: 2, completed: 3, error: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }),
    activeCount: (state) => {
      let c = 0;
      for (const t of state.tasks.values()) {
        if (t.status === 'downloading' || t.status === 'running') c++;
      }
      return c;
    }
  },
  actions: {
    addTask(task) {
      this.tasks.set(task.id, { ...task });
    },
    updateTask(id, data) {
      if (this.tasks.has(id)) {
        this.tasks.set(id, { ...this.tasks.get(id), ...data });
      } else {
        this.tasks.set(id, { ...data });
      }
    },
    removeTask(id) {
      this.tasks.delete(id);
    },
    clearCompleted() {
      for (const [id, t] of this.tasks.entries()) {
        if (t.status === 'completed' || t.status === 'error') this.tasks.delete(id);
      }
    }
  }
});
