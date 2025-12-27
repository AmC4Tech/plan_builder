import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import { generateController } from './controllers/generateController.js';
import { startWorker, stopWorker } from './queues/worker.js';
import { startHotReload, stopHotReload } from './utils/hot_reload.js';
import { closeQueue } from './queues/producer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 请求日志
app.use((req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// API 信息 (JSON)
app.get('/api', (req: Request, res: Response) => {
    res.json({
        name: '自动化项目文档生成器',
        version: '1.0.0',
        endpoints: {
            'POST /api/generate': '创建文档生成任务',
            'GET /api/jobs/:id': '获取任务状态',
            'GET /api/manifest': '获取模板配置',
            'POST /api/preview': '预览文件计划',
            'GET /health': '健康检查',
        },
    });
});

// 健康检查
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// API 路由
app.post('/api/generate', generateController.createJob);
app.get('/api/jobs/:jobId', generateController.getStatus);
app.get('/api/manifest', generateController.getManifest);
app.post('/api/preview', generateController.previewPlan);

// 404 处理
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: '接口不存在',
        path: req.path,
    });
});

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('未捕获的错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: config.nodeEnv === 'development' ? err.message : undefined,
    });
});

// 启动服务器
async function start(): Promise<void> {
    try {
        console.log('\n🚀 自动化项目文档生成器启动中...\n');

        // 启动热重载
        startHotReload();

        // 启动 HTTP 服务器
        const server = app.listen(config.port, () => {
            console.log(`\n🌐 服务器已启动: http://localhost:${config.port}`);
            console.log(`📁 模板目录: ${config.paths.templates}`);
            console.log(`📦 输出目录: ${config.paths.output}`);
            console.log(`🔧 Redis Mock: ${config.redis.useMock ? '启用' : '禁用'}`);
            console.log('\n📋 可用接口:');
            console.log(`   POST /api/generate  - 创建文档生成任务`);
            console.log(`   GET  /api/jobs/:id  - 获取任务状态`);
            console.log(`   GET  /api/manifest  - 获取 manifest 配置`);
            console.log(`   POST /api/preview   - 预览文件计划`);
            console.log(`   GET  /health        - 健康检查`);
            console.log('\n');
        });

        // 启动 Worker (仅在非 Mock 模式下)
        if (!config.redis.useMock) {
            startWorker().catch((err: Error) => {
                console.warn(`⚠️ Worker 启动警告: ${err.message}`);
            });
        } else {
            console.log('⚠️ Mock 模式：使用同步处理器，BullMQ Worker 已禁用');
        }

        // 优雅关闭
        const shutdown = async (): Promise<void> => {
            console.log('\n🛑 正在关闭服务器...');
            await stopHotReload();
            await stopWorker();
            await closeQueue();
            server.close(() => {
                console.log('👋 服务器已关闭');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error) {
        console.error('启动失败:', error);
        process.exit(1);
    }
}

start();

export default app;
