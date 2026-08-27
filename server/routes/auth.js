const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authUser, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 生成10位数字卡密（工具函数，外部也可用）
function generateCardNumber() {
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

// 检查VIP是否过期
function checkVipExpire(user) {
  if (user.vip_type && user.vip_type !== 'none' && user.vip_type !== 'permanent' && user.vip_expire_at) {
    if (new Date(user.vip_expire_at) < new Date()) {
      db.prepare("UPDATE users SET vip_type = 'none', vip_expire_at = NULL WHERE id = ?").run(user.id);
      user.vip_type = 'none';
      user.vip_expire_at = null;
    }
  }
  return user;
}

// 处理待处理注册（定时任务）
function processPendingRegistrations() {
  const pending = db.prepare('SELECT * FROM pending_registrations WHERE processed = 0 ORDER BY received_at ASC').all();
  const timeoutHours = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'confirm_timeout_hours'").get()?.value || '24');

  for (const reg of pending) {
    const regTime = new Date(reg.received_at);
    const now = new Date();
    const hoursDiff = (now - regTime) / (1000 * 60 * 60);

    if (hoursDiff >= timeoutHours) {
      // 超时未处理，标记为已处理（相当于注销）
      db.prepare('UPDATE pending_registrations SET processed = 1 WHERE id = ?').run(reg.id);
      continue;
    }

    // 检查卡密是否有效（卡密号trim兜底，兼容历史带空格的脏数据）
    const card = db.prepare("SELECT * FROM cards WHERE card_number = ? AND status = 'unused'").get(String(reg.card_number || '').trim());
    if (!card) {
      // 卡密无效，跳过
      db.prepare('UPDATE pending_registrations SET processed = 1 WHERE id = ?').run(reg.id);
      continue;
    }

    // 检查用户名是否已存在
    const userExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(reg.username).count > 0;
    if (userExists) {
      db.prepare('UPDATE pending_registrations SET processed = 1 WHERE id = ?').run(reg.id);
      continue;
    }

    // 创建用户
    const hashedPassword = bcrypt.hashSync(reg.password, 10);
    const vipInfo = getVipInfoByCardType(card.type, card.points);
    
    const userResult = db.prepare(`
      INSERT INTO users (username, password, card_id, vip_type, vip_expire_at, points, status, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(reg.username, hashedPassword, card.id, vipInfo.vip_type, vipInfo.vip_expire_at, vipInfo.points);

    // 更新卡密状态
    db.prepare("UPDATE cards SET status = 'used', used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?").run(userResult.lastInsertRowid, card.id);

    // 标记为已处理
    db.prepare('UPDATE pending_registrations SET processed = 1 WHERE id = ?').run(reg.id);
    console.log(`已处理待注册用户: ${reg.username}`);
  }
}

function getVipInfoByCardType(cardType, cardPoints) {
  const now = new Date();
  let vip_type = 'none';
  let vip_expire_at = null;
  let points = 0;

  switch (cardType) {
    case 'point':
      points = cardPoints || 1;
      break;
    case 'week':
      vip_type = 'week';
      vip_expire_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'month':
      vip_type = 'month';
      vip_expire_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'year':
      vip_type = 'year';
      vip_expire_at = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'permanent':
      vip_type = 'permanent';
      break;
  }
  return { vip_type, vip_expire_at, points };
}

// 启动定时任务，每5分钟处理一次待注册
setInterval(processPendingRegistrations, 5 * 60 * 1000);
// 启动时立即处理一次
setTimeout(processPendingRegistrations, 2000);

// 用户注册（即使后端关机，客户端也会发送，后端在线时处理）
router.post('/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const cardNumber = String(req.body.cardNumber || '').trim();
  const deviceInfo = req.body.deviceInfo;

  if (!username || !password || !cardNumber) {
    return res.status(400).json({ success: false, message: '用户名、密码、卡密不能为空' });
  }

  if (!/^\d{10}$/.test(cardNumber)) {
    return res.status(400).json({ success: false, message: '卡密必须是10位数字' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, message: '用户名长度应为3-20位' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: '密码至少6位' });
  }

  // 先保存到待注册表（确保关机重启后也能处理）
  db.prepare(`
    INSERT INTO pending_registrations (username, password, card_number, device_info)
    VALUES (?, ?, ?, ?)
  `).run(username, password, cardNumber, JSON.stringify(deviceInfo || {}));

  // 后端也兜底：pending保存时卡密已trim过
  void 0;

  // 立即尝试处理
  processPendingRegistrations();

  // 检查是否处理成功
  const user = db.prepare('SELECT id, status FROM users WHERE username = ?').get(username);
  if (user && user.status === 'active') {
    return res.json({ success: true, message: '注册成功，请登录', status: 'active' });
  }

  return res.json({ 
    success: true, 
    message: '注册请求已提交，请等待后端确认（24小时内），确认后即可登录', 
    status: 'pending' 
  });
});

// 用户登录
router.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  // 先检查有没有待处理的注册
  processPendingRegistrations();

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(400).json({ success: false, message: '用户不存在或尚未确认' });
  }

  if (user.status === 'pending') {
    const timeoutHours = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'confirm_timeout_hours'").get()?.value || '24');
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff >= timeoutHours) {
      db.prepare("UPDATE users SET status = 'cancelled' WHERE id = ?").run(user.id);
      return res.status(400).json({ success: false, message: '账户未在24小时内确认，已自动注销' });
    }
    return res.status(400).json({ success: false, message: '账户尚未确认，请等待后端确认（24小时内）' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ success: false, message: '账户已被封禁' });
  }

  if (user.status === 'cancelled') {
    return res.status(400).json({ success: false, message: '账户已注销' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ success: false, message: '密码错误' });
  }

  const updatedUser = checkVipExpire(user);
  const expiresIn = rememberMe ? '30d' : '7d';
  const token = jwt.sign(
    { id: user.id, type: 'user' },
    JWT_SECRET,
    { expiresIn }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      vipType: updatedUser.vip_type,
      vipExpireAt: updatedUser.vip_expire_at,
      points: updatedUser.points
    }
  });
});

// 自动登录（通过token）
router.get('/auto-login', authUser, (req, res) => {
  const user = checkVipExpire(req.user);
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      vipType: user.vip_type,
      vipExpireAt: user.vip_expire_at,
      points: user.points
    }
  });
});

// 获取用户信息
router.get('/info', authUser, (req, res) => {
  const user = checkVipExpire(req.user);
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      vipType: user.vip_type,
      vipExpireAt: user.vip_expire_at,
      points: user.points
    }
  });
});

module.exports = { router, generateCardNumber, processPendingRegistrations, getVipInfoByCardType, checkVipExpire };
