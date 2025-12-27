import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import config from '../config/index.js';
import { orchestrator } from '../core/orchestrator.js';
import { renderer } from '../core/renderer.js';
import excelRenderer from '../core/excel-renderer.js';

let watcher: FSWatcher | null = null;

type EventType = 'modified' | 'added' | 'removed';

/**
 * 启动模板热重载监听器
 */
export function startHotReload(): FSWatcher {
    const templatesPath = config.paths.templates;

    watcher = chokidar.watch(templatesPath, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true,
    });

    // 监听文件变化
    watcher
        .on('change', (filePath) => handleFileChange(filePath, 'modified'))
        .on('add', (filePath) => handleFileChange(filePath, 'added'))
        .on('unlink', (filePath) => handleFileChange(filePath, 'removed'));

    console.log(`🔥 热重载已启动，监听目录: ${templatesPath}`);
    return watcher;
}

/**
 * 处理文件变化
 */
function handleFileChange(filePath: string, eventType: EventType): void {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    console.log(`\n🔄 [${timestamp}] 模板${getEventLabel(eventType)}: ${fileName}`);

    if (ext === '.docx') {
        // 清除 Word 渲染器缓存
        renderer.clearCache(filePath);
        console.log(`   ↳ 已清除 Word 模板缓存`);
    } else if (ext === '.xlsx' || ext === '.xls') {
        // 清除 Excel 渲染器缓存
        excelRenderer.clearExcelCache(filePath);
        console.log(`   ↳ 已清除 Excel 模板缓存`);
    } else if (fileName === 'manifest.json') {
        // 重新加载 manifest
        orchestrator.reload().catch((err: Error) => {
            console.error(`   ↳ Manifest 重载失败: ${err.message}`);
        });
    }
}

/**
 * 获取事件标签
 */
function getEventLabel(eventType: EventType): string {
    const labels: Record<EventType, string> = {
        modified: '已更新',
        added: '已添加',
        removed: '已删除',
    };
    return labels[eventType] || eventType;
}

/**
 * 停止热重载监听器
 */
export async function stopHotReload(): Promise<void> {
    if (watcher) {
        await watcher.close();
        watcher = null;
        console.log('🔥 热重载已停止');
    }
}

export default {
    startHotReload,
    stopHotReload,
};
