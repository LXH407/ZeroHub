const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authAdmin, JWT_SECRET } = require('../middleware/auth');
const { getVipInfoByCardType, processPendingRegistrations } = require('./auth');

const router = express.Router();

// 管理员登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(400).json({ success: false, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: admin.id, type: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    admin: { id: admin.id, username: admin.username }
  });
});

// 获取管理员信息
router.get('/info', authAdmin, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// 修改管理员密码
router.post('/change-password', authAdmin, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '密码不能为空' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: '新密码至少6位' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(oldPassword, admin.password)) {
    return res.status(400).json({ success: false, message: '原密码错误' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashedPassword, req.admin.id);
  res.json({ success: true, message: '密码修改成功' });
});

// 获取用户列表
router.get('/users', authAdmin, (req, res) => {
  const { page = 1, pageSize = 20, status, keyword, vipType } = req.query;
  const offset = (page - 1) * pageSize;

  let where = 'WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    where += ' AND status = ?';
    params.push(status);
  }
  if (vipType && vipType !== 'all') {
    where += ' AND vip_type = ?';
    params.push(vipType);
  }
  if (keyword) {
    where += ' AND username LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
  const users = db.prepare(`
    SELECT id, username, vip_type, vip_expire_at, points, status, confirmed_at, created_at
    FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({
    success: true,
    list: users,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

// 封禁用户
router.post('/users/:id/ban', authAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(id);
  res.json({ success: true, message: '用户已封禁' });
});

// 解封用户
router.post('/users/:id/unban', authAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

  if (user.status === 'pending') {
    // 如果是待确认状态，改为激活
    db.prepare("UPDATE users SET status = 'active', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(id);
  }
  res.json({ success: true, message: '用户已解封/激活' });
});

// 手动确认用户注册（24小时确认机制）
router.post('/users/:id/confirm', authAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  if (user.status !== 'pending') {
    return res.status(400).json({ success: false, message: '用户状态不是待确认' });
  }
  db.prepare("UPDATE users SET status = 'active', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.json({ success: true, message: '用户已确认激活' });
});

// 手动注销用户
router.post('/users/:id/cancel', authAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE users SET status = 'cancelled' WHERE id = ?").run(id);
  res.json({ success: true, message: '用户已注销' });
});

// 修改用户VIP/积分
router.post('/users/:id/vip', authAdmin, (req, res) => {
  const { id } = req.params;
  const { vipType, points } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

  const vipInfo = getVipInfoByCardType(vipType || 'none', user.points);
  
  db.prepare(`
    UPDATE users SET 
      vip_type = ?, 
      vip_expire_at = ?,
      points = ?
    WHERE id = ?
  `).run(
    vipInfo.vip_type,
    vipInfo.vip_expire_at,
    points !== undefined ? parseInt(points) : vipInfo.points,
    id
  );

  res.json({ success: true, message: '用户信息已更新' });
});

// 获取系统设置
router.get('/settings', authAdmin, (req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  settings.forEach(s => obj[s.key] = s.value);
  res.json({ success: true, settings: obj });
});

// 更新系统设置
router.post('/settings', authAdmin, (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: '参数错误' });
  }

  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value), String(value));
    }
  });
  tx();

  res.json({ success: true, message: '设置已更新' });
});

// 获取公开系统设置（客户端用）
router.get('/settings/public', (req, res) => {
  const keys = ['site_name', 'site_icon', 'api_proxy_url'];
  const placeholders = keys.map(() => '?').join(',');
  const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys);
  const obj = {};
  settings.forEach(s => obj[s.key] = s.value);
  res.json({ success: true, settings: obj });
});

// 获取镜像源列表
router.get('/mirrors', authAdmin, (req, res) => {
  const mirrors = db.prepare('SELECT * FROM mirror_sources ORDER BY priority ASC').all();
  res.json({ success: true, list: mirrors });
});

// 更新镜像源
router.post('/mirrors', authAdmin, (req, res) => {
  const { mirrors } = req.body;
  if (!Array.isArray(mirrors)) {
    return res.status(400).json({ success: false, message: '参数错误' });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM mirror_sources').run();
    const stmt = db.prepare('INSERT INTO mirror_sources (name, base_url, type, priority, enabled) VALUES (?, ?, ?, ?, ?)');
    for (const m of mirrors) {
      stmt.run(m.name, m.base_url, m.type, parseInt(m.priority || 0), m.enabled ? 1 : 0);
    }
  });
  tx();

  res.json({ success: true, message: '镜像源已更新' });
});

// 获取公开镜像源（客户端用）
router.get('/mirrors/public', (req, res) => {
  const mirrors = db.prepare("SELECT * FROM mirror_sources WHERE enabled = 1 ORDER BY priority ASC").all();
  res.json({ success: true, list: mirrors });
});

// 获取待处理注册列表
router.get('/pending-registrations', authAdmin, (req, res) => {
  const { processed } = req.query;
  let where = '';
  if (processed !== undefined) {
    where = `WHERE processed = ${processed ? 1 : 0}`;
  }
  const list = db.prepare(`SELECT * FROM pending_registrations ${where} ORDER BY received_at DESC LIMIT 100`).all();
  res.json({ success: true, list });
});

// 手动触发处理待注册
router.post('/process-pending', authAdmin, (req, res) => {
  processPendingRegistrations();
  res.json({ success: true, message: '已触发处理待注册请求' });
});

// 获取统计数据
router.get('/stats', authAdmin, (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    activeUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count,
    totalCards: db.prepare('SELECT COUNT(*) as count FROM cards').get().count,
    usedCards: db.prepare("SELECT COUNT(*) as count FROM cards WHERE status = 'used'").get().count,
    totalResources: db.prepare('SELECT COUNT(*) as count FROM resources').get().count,
    totalDownloads: db.prepare('SELECT COUNT(*) as count FROM download_records').get().count,
    pendingRegistrations: db.prepare("SELECT COUNT(*) as count FROM pending_registrations WHERE processed = 0").get().count,
    vipUsers: db.prepare("SELECT COUNT(*) as count FROM users WHERE vip_type != 'none' AND status = 'active'").get().count
  };
  res.json({ success: true, stats });
});

module.exports = router;
