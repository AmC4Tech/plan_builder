import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs-extra';
import path from 'path';
import expressionParser, { nullGetter } from './expression-parser.js';
import type { RenderedDocument, RenderTask } from '../types/index.js';

/**
 * 文档渲染器 - 使用 docxtemplater 处理 Word 模板
 */
class Renderer {
    private templateCache: Map<string, Buffer>;

    constructor() {
        this.templateCache = new Map();
    }

    /**
     * 渲染文档
     * @param templatePath - 模板文件路径
     * @param data - 要填充的数据
     * @returns 渲染后的文档 Buffer
     */
    async renderDocument(templatePath: string, data: Record<string, unknown>): Promise<Buffer> {
        try {
            // 读取模板文件
            const templateContent = await fs.readFile(templatePath);

            // 使用 PizZip 加载文档
            const zip = new PizZip(templateContent);

            // 创建 Docxtemplater 实例，配置 angular-expressions
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                parser: expressionParser,
                nullGetter: nullGetter,
            });

            // 设置数据并渲染
            doc.render(data);

            // 生成文档 Buffer
            const buffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 },
            });

            return buffer;
        } catch (error) {
            const err = error as Error & { properties?: { errors?: Array<{ message: string; properties?: { id?: string } }> } };
            // 增强错误信息
            if (err.properties?.errors) {
                const errorMessages = err.properties.errors
                    .map((e) => `${e.message} (${e.properties?.id || 'unknown'})`)
                    .join('; ');
                throw new Error(`模板渲染错误 [${path.basename(templatePath)}]: ${errorMessages}`);
            }
            throw new Error(`模板渲染失败 [${path.basename(templatePath)}]: ${err.message}`);
        }
    }

    /**
     * 批量渲染多个文档
     * @param tasks - 渲染任务列表
     * @returns 渲染结果数组
     */
    async renderMultiple(tasks: RenderTask[]): Promise<RenderedDocument[]> {
        const results: RenderedDocument[] = [];

        for (const task of tasks) {
            const buffer = await this.renderDocument(task.templatePath, task.data);
            results.push({
                name: task.outputName,
                buffer,
            });
        }

        return results;
    }

    /**
     * 清除模板缓存
     * @param templatePath - 可选，指定要清除的模板路径
     */
    clearCache(templatePath?: string): void {
        if (templatePath) {
            this.templateCache.delete(templatePath);
        } else {
            this.templateCache.clear();
        }
    }
}

// 导出单例
export const renderer = new Renderer();
export default renderer;
