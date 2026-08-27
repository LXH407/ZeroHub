const express = require('express');
const db = require('../db/database');
const { authAdmin } = require('../middleware/auth');
const { generateCardNumber } = require('./auth');

const router = express.Router();

// 批量生成卡密（管理员）
router.post('/generate', authAdmin, (req, res) => {
  const { type, count, points } = req.body;
  const validTypes = ['point', 'week', 'month', 'year', 'permanent'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: '无效的卡密类型' });
  }

  if (!count || count < 1 || count > 1000) {
    return res.status(400).json({ success: false, message: '生成数量应为1-1000' });
  }

  const stmt = db.prepare('INSERT INTO cards (card_number, type, points) VALUES (?, ?, ?)');
  const generated = [];

  const tx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let cardNumber;
      let attempts = 0;
      do {
        cardNumber = generateCardNumber();
        attempts++;
        const exists = db.prepare('SELECT COUNT(*) as count FROM cards WHERE card_number = ?').get(cardNumber).count;
        if (!exists) break;
      } while (attempts < 100);
      
      if (attempts >= 100) {
        throw new Error('生成卡密失败，请重试');
      }

      stmt.run(cardNumber, type, type === 'point' ? (points || 1) : 0);
      generated.push(cardNumber);
    }
  });

  try {
    tx();
    res.json({ success: true, cards: generated, message: `成功生成${count}张卡密` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取卡密列表（管理员）
router.get('/list', authAdmin, (req, res) => {
  const { type, status, page = 1, pageSize = 20, keyword } = req.query;
  const offset = (page - 1) * pageSize;

  let where = 'WHERE 1=1';
  const params = [];

  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    where += ' AND card_number LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM cards ${where}`).get(...params).count;
  const cards = db.prepare(`
    SELECT c.*, u.username as used_by_username 
    FROM cards c 
    LEFT JOIN users u ON c.used_by = u.id
    ${where} 
    ORDER BY c.id DESC 
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  res.json({
    success: true,
    list: cards,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

// 封禁卡密（管理员）
router.post('/ban/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ success: false, message: '卡密不存在' });
  }
  if (card.status === 'used') {
    return res.status(400).json({ success: false, message: '已使用的卡密无法封禁' });
  }
  db.prepare("UPDATE cards SET status = 'banned' WHERE id = ?").run(id);
  res.json({ success: true, message: '卡密已封禁' });
});

// 解封卡密（管理员）
router.post('/unban/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ success: false, message: '卡密不存在' });
  }
  if (card.status !== 'banned') {
    return res.status(400).json({ success: false, message: '卡密状态不正确' });
  }
  db.prepare("UPDATE cards SET status = 'unused' WHERE id = ?").run(id);
  res.json({ success: true, message: '卡密已解封' });
});

// 删除卡密（管理员）
router.delete('/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  res.json({ success: true, message: '卡密已删除' });
});

// 验证卡密有效性（公开接口，用于客户端注册时校验）
router.get('/verify/:cardNumber', (req, res) => {
  const cardNumber = String(req.params.cardNumber || '').trim();
  const card = db.prepare('SELECT id, type, points, status FROM cards WHERE card_number = ?').get(cardNumber);
  
  if (!card) {
    return res.json({ success: false, message: '卡密不存在' });
  }
  if (card.status === 'used') {
    return res.json({ success: false, message: '卡密已被使用' });
  }
  if (card.status === 'banned') {
    return res.json({ success: false, message: '卡密已被封禁' });
  }

  const typeNames = {
    point: `积分卡（${card.points}积分）`,
    week: 'VIP周卡',
    month: 'VIP月卡',
    year: 'VIP年卡',
    permanent: '永久VIP'
  };

  res.json({
    success: true,
    message: '卡密有效',
    card: {
      type: card.type,
      typeName: typeNames[card.type] || '未知',
      points: card.points
    }
  });
});

module.exports = router;
