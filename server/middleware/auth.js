const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'zerohub-secret-key-2026';

// 管理员认证中间件
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'admin') {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(decoded.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: '管理员不存在' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
}

// 用户认证中间件
function authUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const user = db.prepare('SELECT id, username, status, vip_type, vip_expire_at, points FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: '账户已被封禁' });
    }
    if (user.status === 'cancelled') {
      return res.status(403).json({ success: false, message: '账户已注销' });
    }
    // 检查VIP是否过期
    if (user.vip_type && user.vip_type !== 'none' && user.vip_type !== 'permanent' && user.vip_expire_at) {
      if (new Date(user.vip_expire_at) < new Date()) {
        db.prepare("UPDATE users SET vip_type = 'none', vip_expire_at = NULL WHERE id = ?").run(user.id);
        user.vip_type = 'none';
        user.vip_expire_at = null;
      }
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
}

module.exports = { authAdmin, authUser, JWT_SECRET };
