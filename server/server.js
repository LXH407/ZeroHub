const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const resourceRoutes = require('./routes/resources');
const adminRoutes = require('./routes/admin');
const { authAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 上传目录
// pkg打包兼容：写入型目录（uploads/data）必须使用 exe 同级真实文件系统，不能在 snapshot 内 mkdir
const isPackaged = typeof process !== 'undefined' && !!process.pkg;
const runtimeRoot = isPackaged ? path.dirname(process.execPath) : __dirname;
const uploadDir = path.join(runtimeRoot, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 静态文件：管理后台
const adminDist = path.join(__dirname, '..', 'admin-web', 'dist');
if (fs.existsSync(adminDist)) {
  app.use('/admin', express.static(adminDist));
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

// 静态文件：上传的图片
app.use('/uploads', express.static(uploadDir));

// 静态文件：公共资源（图标/logo/favicon）
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Multer 配置：上传图片
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|gif|webp|ico|svg/;
    const ext = types.test(path.extname(file.originalname).toLowerCase());
    if (ext) cb(null, true);
    else cb(new Error('只支持图片格式'));
  }
});

// 上传图片接口（管理员）
app.post('/api/upload', authAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '上传失败' });
  }
  // 统一返回相对路径 /uploads/xxx（不要带本地 http://localhost 前缀，避免部署后失效）
  // 前后端资源展示时 resolveUrl 会自动拼接正确服务器地址，所以存相对路径是跨环境唯一标准
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

// API 路由
app.use('/api/auth', authRoutes.router);
app.use('/api/cards', cardRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          ZeroHub 软件商城后端服务启动成功                ║
╠══════════════════════════════════════════════════════════╣
║  后端地址:   http://localhost:${PORT}                      ║
║  管理后台:   http://localhost:${PORT}/admin                ║
║  健康检查:   http://localhost:${PORT}/api/health           ║
║  默认账号:  admin / admin123456                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
