const express = require('express');
const db = require('../db/database');
const { authAdmin, authUser } = require('../middleware/auth');
const { checkVipExpire } = require('./auth');

const router = express.Router();

// 获取资源列表（公开接口）
router.get('/list', (req, res) => {
  const { type, page = 1, pageSize = 20, keyword, sort = 'new' } = req.query;
  const offset = (page - 1) * pageSize;

  let where = "WHERE status = 'active'";
  const params = [];

  if (type && type !== 'all') {
    where += ' AND type = ?';
    params.push(type);
  }
  if (keyword) {
    where += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  let orderBy = 'ORDER BY sort_order ASC, created_at DESC';
  if (sort === 'hot') {
    orderBy = 'ORDER BY (SELECT COUNT(*) FROM download_records dr WHERE dr.resource_id = resources.id) DESC';
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM resources ${where}`).get(...params).count;
  const resources = db.prepare(`
    SELECT id, name, type, description, icon, cover_image, screenshots, 
           points_required, file_size, version, author, tags, console_download
    FROM resources 
    ${where} 
    ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  // 解析JSON字段
  const parsed = resources.map(r => ({
    ...r,
    screenshots: r.screenshots ? JSON.parse(r.screenshots) : [],
    tags: r.tags ? JSON.parse(r.tags) : []
  }));

  res.json({
    success: true,
    list: parsed,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

// 获取资源详情（公开接口）
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const resource = db.prepare(`
    SELECT id, name, type, description, icon, cover_image, screenshots, 
           points_required, download_url, mirror_urls, download_channels, file_size, version, 
           author, tags, console_download, created_at, updated_at
    FROM resources 
    WHERE id = ? AND status = 'active'
  `).get(id);

  if (!resource) {
    return res.status(404).json({ success: false, message: '资源不存在' });
  }

  resource.screenshots = resource.screenshots ? JSON.parse(resource.screenshots) : [];
  resource.tags = resource.tags ? JSON.parse(resource.tags) : [];
  resource.mirror_urls = resource.mirror_urls ? JSON.parse(resource.mirror_urls) : [];
  resource.download_channels = resource.download_channels ? JSON.parse(resource.download_channels) : [];

  // 获取下载次数
  resource.download_count = db.prepare(
    'SELECT COUNT(*) as count FROM download_records WHERE resource_id = ?'
  ).get(id).count;

  res.json({ success: true, resource });
});

// 用户请求下载（验证权限，扣除积分）
router.post('/:id/download', authUser, (req, res) => {
  const { id } = req.params;
  const resource = db.prepare('SELECT * FROM resources WHERE id = ? AND status = "active"').get(id);

  if (!resource) {
    return res.status(404).json({ success: false, message: '资源不存在' });
  }

  const user = checkVipExpire(req.user);
  const isVip = user.vip_type !== 'none';

  if (!isVip) {
    if (resource.points_required > 0 && user.points < resource.points_required) {
      return res.status(400).json({ success: false, message: '积分不足，请充值VIP或购买积分卡' });
    }

    // 检查是否已经下载过（积分卡用户重复下载不重复扣费）
    const alreadyDownloaded = db.prepare(
      'SELECT id FROM download_records WHERE user_id = ? AND resource_id = ?'
    ).get(user.id, resource.id);

    if (!alreadyDownloaded && resource.points_required > 0) {
      // 扣除积分并记录
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(resource.points_required, user.id);
      db.prepare(
        'INSERT INTO download_records (user_id, resource_id, points_consumed) VALUES (?, ?, ?)'
      ).run(user.id, resource.id, resource.points_required);
    } else {
      db.prepare(
        'INSERT INTO download_records (user_id, resource_id, points_consumed) VALUES (?, ?, 0)'
      ).run(user.id, resource.id);
    }
  } else {
    // VIP用户直接记录，不扣费
    db.prepare(
      'INSERT INTO download_records (user_id, resource_id, points_consumed) VALUES (?, ?, 0)'
    ).run(user.id, resource.id);
  }

  // 返回下载信息（含多网盘渠道）
  res.json({
    success: true,
    download: {
      download_url: resource.download_url,
      mirror_urls: resource.mirror_urls ? JSON.parse(resource.mirror_urls) : [],
      download_channels: resource.download_channels ? JSON.parse(resource.download_channels) : [],
      console_download: resource.console_download === 1,
      file_size: resource.file_size,
      name: resource.name
    }
  });
});

// ============ 管理员接口 ============

// 获取资源完整列表（管理员）
router.get('/admin/list', authAdmin, (req, res) => {
  const { type, page = 1, pageSize = 20, keyword, status } = req.query;
  const offset = (page - 1) * pageSize;

  let where = 'WHERE 1=1';
  const params = [];

  if (type && type !== 'all') {
    where += ' AND type = ?';
    params.push(type);
  }
  if (status && status !== 'all') {
    where += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    where += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM resources ${where}`).get(...params).count;
  const resources = db.prepare(`
    SELECT * FROM resources ${where} ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  const parsed = resources.map(r => ({
    ...r,
    screenshots: r.screenshots ? JSON.parse(r.screenshots) : [],
    tags: r.tags ? JSON.parse(r.tags) : [],
    mirror_urls: r.mirror_urls ? JSON.parse(r.mirror_urls) : [],
    download_channels: r.download_channels ? JSON.parse(r.download_channels) : []
  }));

  res.json({
    success: true,
    list: parsed,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

// 创建资源（管理员）
router.post('/admin', authAdmin, (req, res) => {
  const {
    name, type, description, icon, cover_image, screenshots,
    points_required, download_url, mirror_urls, download_channels, file_size, version,
    author, tags, sort_order, console_download, status
  } = req.body;

  if (!name || !type) {
    return res.status(400).json({ success: false, message: '名称和类型不能为空' });
  }

  const validTypes = ['software', 'model', 'game', 'api'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: '无效的资源类型' });
  }

  const result = db.prepare(`
    INSERT INTO resources (name, type, description, icon, cover_image, screenshots,
      points_required, download_url, mirror_urls, download_channels, file_size, version, author, 
      tags, sort_order, console_download, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, type, description || '', icon || '', cover_image || '',
    JSON.stringify(screenshots || []),
    parseInt(points_required || 0),
    download_url || '',
    JSON.stringify(mirror_urls || []),
    JSON.stringify(download_channels || []),
    file_size || '',
    version || '',
    author || '',
    JSON.stringify(tags || []),
    parseInt(sort_order || 0),
    console_download ? 1 : 0,
    status || 'active'
  );

  res.json({ success: true, id: result.lastInsertRowid, message: '资源创建成功' });
});

// 更新资源（管理员）
router.put('/admin/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  if (!resource) {
    return res.status(404).json({ success: false, message: '资源不存在' });
  }

  const {
    name, type, description, icon, cover_image, screenshots,
    points_required, download_url, mirror_urls, download_channels, file_size, version,
    author, tags, sort_order, console_download, status
  } = req.body;

  db.prepare(`
    UPDATE resources SET
      name = ?, type = ?, description = ?, icon = ?, cover_image = ?, 
      screenshots = ?, points_required = ?, download_url = ?, mirror_urls = ?,
      download_channels = ?, file_size = ?, version = ?, author = ?, tags = ?, sort_order = ?,
      console_download = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || resource.name,
    type || resource.type,
    description !== undefined ? description : resource.description,
    icon !== undefined ? icon : resource.icon,
    cover_image !== undefined ? cover_image : resource.cover_image,
    screenshots ? JSON.stringify(screenshots) : resource.screenshots,
    points_required !== undefined ? parseInt(points_required) : resource.points_required,
    download_url !== undefined ? download_url : resource.download_url,
    mirror_urls ? JSON.stringify(mirror_urls) : resource.mirror_urls,
    download_channels !== undefined ? JSON.stringify(download_channels) : resource.download_channels,
    file_size !== undefined ? file_size : resource.file_size,
    version !== undefined ? version : resource.version,
    author !== undefined ? author : resource.author,
    tags ? JSON.stringify(tags) : resource.tags,
    sort_order !== undefined ? parseInt(sort_order) : resource.sort_order,
    console_download !== undefined ? (console_download ? 1 : 0) : resource.console_download,
    status || resource.status,
    id
  );

  res.json({ success: true, message: '资源更新成功' });
});

// 删除资源（管理员）
router.delete('/admin/:id', authAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  db.prepare('DELETE FROM download_records WHERE resource_id = ?').run(id);
  res.json({ success: true, message: '资源已删除' });
});

module.exports = router;
