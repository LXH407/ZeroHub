const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// pkg打包兼容：写入型目录（data/uploads）必须使用 exe 同级真实文件系统，不能在 snapshot 内 mkdir
const isPackaged = typeof process !== 'undefined' && !!process.pkg;
const runtimeRoot = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
const dbDir = path.join(runtimeRoot, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// pkg打包兼容：更好-sqlite3 原生.node 必须：① N-API匹配内嵌Node18 ② Windows LoadLibrary 需要真实文件路径
// 启动时把 pkg-native/ 内预编译的 Node18 适配版 .node 释放到 exe 同级 native/ 目录
const nativeDestDir = path.join(runtimeRoot, 'native');
let nativeBindingOption = {};
if (isPackaged) {
  const nativeSrc = path.join(__dirname, '..', 'pkg-native', 'better_sqlite3-node18-x64.node');
  const nativeDest = path.join(nativeDestDir, 'better_sqlite3.node');
  if (!fs.existsSync(nativeDestDir)) fs.mkdirSync(nativeDestDir, { recursive: true });
  if (!fs.existsSync(nativeDest) || fs.statSync(nativeDest).size !== fs.statSync(nativeSrc).size) {
    fs.copyFileSync(nativeSrc, nativeDest);
  }
  nativeBindingOption = { nativeBinding: nativeDest };
}

const dbPath = path.join(dbDir, 'zerohub.db');
const db = new Database(dbPath, { ...nativeBindingOption });

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化数据库表
function initDatabase() {
  db.exec(`
    -- 管理员表
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      card_id INTEGER,
      vip_type TEXT DEFAULT 'none', -- none, week, month, year, permanent
      vip_expire_at DATETIME,
      points INTEGER DEFAULT 0, -- 剩余积分
      status TEXT DEFAULT 'pending', -- pending, active, banned, cancelled
      confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );

    -- 卡密表
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT UNIQUE NOT NULL, -- 10位数字卡密
      type TEXT NOT NULL, -- point, week, month, year, permanent
      points INTEGER DEFAULT 0, -- 积分卡的积分数量
      status TEXT DEFAULT 'unused', -- unused, used, banned
      used_by INTEGER,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    -- 资源表（软件/大模型/游戏/API中转站）
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- software, model, game, api
      description TEXT,
      icon TEXT,
      cover_image TEXT,
      screenshots TEXT, -- JSON数组
      points_required INTEGER DEFAULT 0, -- 需要积分
      download_url TEXT, -- 主下载链接
      mirror_urls TEXT, -- JSON镜像链接数组（直链自动切换）
      download_channels TEXT, -- JSON多网盘下载渠道数组：[{channel, name, url, code, remark}]
      file_size TEXT,
      version TEXT,
      author TEXT,
      tags TEXT, -- JSON数组
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', -- active, inactive
      console_download INTEGER DEFAULT 0, -- 是否需要控制台下载
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 下载记录表
    CREATE TABLE IF NOT EXISTS download_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      resource_id INTEGER NOT NULL,
      points_consumed INTEGER DEFAULT 0,
      download_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (resource_id) REFERENCES resources(id)
    );

    -- 系统设置表
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 镜像源配置表
    CREATE TABLE IF NOT EXISTS mirror_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      type TEXT NOT NULL, -- huggingface, modelscope, custom
      priority INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 待确认账户登记表（用于关机期间接收注册请求）
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      card_number TEXT NOT NULL,
      device_info TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed INTEGER DEFAULT 0 -- 0待处理, 1已处理
    );
  `);

  // 初始化默认管理员
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM admins').get().count > 0;
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123456', 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
    console.log('默认管理员创建成功: admin / admin123456');
  }

  // 初始化默认设置
  const defaultSettings = [
    { key: 'site_name', value: 'ZeroHub 软件商城' },
    { key: 'site_icon', value: '/icon.svg' },
    { key: 'api_proxy_url', value: '' },
    { key: 'confirm_timeout_hours', value: '24' }
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const setting of defaultSettings) {
    stmt.run(setting.key, setting.value);
  }

  // 初始化默认镜像源
  const mirrorsExist = db.prepare('SELECT COUNT(*) as count FROM mirror_sources').get().count > 0;
  if (!mirrorsExist) {
    const defaultMirrors = [
      { name: 'HuggingFace 官方', base_url: 'https://huggingface.co', type: 'huggingface', priority: 1 },
      { name: 'HF-Mirror 国内镜像', base_url: 'https://hf-mirror.com', type: 'huggingface', priority: 2 },
      { name: 'ModelScope 魔搭', base_url: 'https://modelscope.cn', type: 'modelscope', priority: 3 },
      { name: '自定义镜像', base_url: '', type: 'custom', priority: 99 }
    ];
    const mirrorStmt = db.prepare('INSERT INTO mirror_sources (name, base_url, type, priority) VALUES (?, ?, ?, ?)');
    for (const m of defaultMirrors) {
      mirrorStmt.run(m.name, m.base_url, m.type, m.priority);
    }
    console.log('默认镜像源初始化完成');
  }
}

// 数据库迁移 + 旧数据归一化（首次启动/新版本启动时自动运行，幂等安全）
function migrateDatabase() {
  try {
    // 1) 旧版数据库没有 download_channels 列 → SQLite 支持 ALTER TABLE ADD COLUMN
    const cols = db.pragma('table_info(resources)').map(c => c.name);
    if (!cols.includes('download_channels')) {
      db.exec('ALTER TABLE resources ADD COLUMN download_channels TEXT');
      console.log('✅ 数据库迁移：resources 表新增 download_channels 列');
    }

    // 2) 图片URL归一化：本地存储时误存 http://localhost/https://xxx 绝对地址 → 统一转为 /uploads/xxx 相对路径
    //    （换服务器地址/部署到Render后绝对路径会失效，相对路径前后端都会自动拼 serverBase）
    const rows = db.prepare('SELECT id, icon, cover_image, screenshots FROM resources').all();
    const localPrefixRe = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i;
    const upStmt = db.prepare('UPDATE resources SET icon=?, cover_image=?, screenshots=? WHERE id=?');
    let fixed = 0;
    const norm = u => {
      if (!u) return u;
      if (typeof u !== 'string') return u;
      // 去掉本地域名前缀
      const u1 = u.replace(localPrefixRe, '');
      // 如果末尾是 /uploads/... 开头就是相对路径
      return u1;
    };
    const tx = db.transaction(() => {
      for (const r of rows) {
        const nIcon = norm(r.icon);
        const nCover = norm(r.cover_image);
        let nShots = r.screenshots;
        try {
          if (r.screenshots) {
            const arr = JSON.parse(r.screenshots);
            if (Array.isArray(arr)) nShots = JSON.stringify(arr.map(norm));
          }
        } catch (e) {}
        if (nIcon !== r.icon || nCover !== r.cover_image || nShots !== r.screenshots) {
          upStmt.run(nIcon, nCover, nShots, r.id);
          fixed++;
        }
      }
    });
    tx();
    if (fixed > 0) console.log(`✅ 图片URL归一化：修复 ${fixed} 条资源的绝对URL → 转相对路径`);
  } catch (e) {
    // 迁移失败不影响服务运行，日志记录即可
    console.warn('⚠️ 数据库迁移跳过（可忽略）:', e.message);
  }
}

initDatabase();
migrateDatabase();

module.exports = db;
