const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 数据存储
const DATA_FILE = '/var/www/war-room/data.json';

// 默认数据
const defaultData = {
  updateTime: new Date().toISOString(),
  overview: {
    idle: 2,
    busy: 3,
    vacation: 0,
    totalTasks: 5
  },
  generals: [
    { id: 'guanyu', name: '关羽', title: '武圣 · 代码审查', avatar: '🔴', status: 'idle', task: '暂无任务', progress: 0, deadline: '--' },
    { id: 'zhaoyun', name: '赵云', title: '常胜将军 · 架构设计', avatar: '⚪', status: 'busy', task: '看板UI/UX设计', progress: 60, deadline: '16:30' },
    { id: 'zhangfei', name: '张飞', title: '万人敌 · 快速原型', avatar: '⚫', status: 'busy', task: '前端开发', progress: 30, deadline: '17:00' },
    { id: 'machao', name: '马超', title: '锦马超 · 性能优化', avatar: '🔵', status: 'idle', task: '暂无任务', progress: 0, deadline: '--' },
    { id: 'huangzhong', name: '黄忠', title: '老当益壮 · 测试稳定', avatar: '🟡', status: 'busy', task: '测试验收', progress: 10, deadline: '17:30' }
  ]
};

// 初始化数据文件
function initData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// 读取数据
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return defaultData;
  }
}

// 保存数据
function saveData(data) {
  data.updateTime = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join('/var/www/war-room', url);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (url === '/api/data') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readData()));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 广播数据给所有客户端
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// 模拟数据更新
function simulateUpdate() {
  const data = readData();
  
  // 随机更新进度
  data.generals.forEach(g => {
    if (g.status === 'busy' && g.progress < 100) {
      g.progress = Math.min(100, g.progress + Math.floor(Math.random() * 10));
      if (g.progress >= 100) {
        g.status = 'idle';
        g.task = '已完成';
      }
    }
  });
  
  // 更新概览
  data.overview.idle = data.generals.filter(g => g.status === 'idle').length;
  data.overview.busy = data.generals.filter(g => g.status === 'busy').length;
  
  saveData(data);
  broadcast(data);
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // 发送当前数据
  ws.send(JSON.stringify(readData()));
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// 初始化
initData();

// 每 10 秒模拟更新
setInterval(simulateUpdate, 10000);

// 启动服务器
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
