import config from '../config/index.js';
import type { ProjectData } from '../types/index.js';

import OpenAI from 'openai';

/**
 * AI 内容生成器 - 使用 OpenAI SDK 生成文本内容
 */
class AIWriter {
    private client: OpenAI | null = null;
    private initialized = false;

    /**
     * 初始化 OpenAI 客户端
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (config.openai.apiKey) {
            // 使用 OpenAI SDK
            this.client = new OpenAI({
                apiKey: config.openai.apiKey,
                baseURL: config.openai.baseURL,
            });
            console.log(`🤖 AI Writer: 使用 OpenAI 模式 (Model: ${config.openai.modelName}, BaseURL: ${config.openai.baseURL})`);
        } else {
            // 使用 Mock LLM
            console.log('🤖 AI Writer: 使用 Mock LLM 模式（未配置 OpenAI API Key）');
        }

        this.initialized = true;
    }

    /**
     * 生成内容
     * @param prompt - 提示词
     * @param context - 上下文数据
     * @returns 生成的文本
     */
    async generateContent(prompt: string, context: Partial<ProjectData> = {}): Promise<string> {
        await this.initialize();

        // 构建完整提示词
        const fullPrompt = this.buildPrompt(prompt, context);

        if (this.client) {
            // 使用真实 LLM
            try {
                const response = await this.client.chat.completions.create({
                    model: config.openai.modelName,
                    messages: [
                        { role: 'user', content: fullPrompt }
                    ],
                    temperature: 0.7,
                });
                return response.choices[0].message.content || '';
            } catch (error) {
                const err = error as Error;
                console.error('AI 生成失败，使用 Mock 回退:', err.message);
                return this.mockGenerate(prompt, context);
            }
        } else {
            // 使用 Mock
            return this.mockGenerate(prompt, context);
        }
    }

    /**
     * 生成 JSON 数据 (用于 Excel 等结构化生成)
     */
    async generateJSON(prompt: string, context: Partial<ProjectData> = {}): Promise<any> {
        const jsonPrompt = `${prompt}\n\n请只返回纯 JSON 格式的数据，不要包含 markdown 代码块标记，不要包含其他解释文字。`;
        const result = await this.generateContent(jsonPrompt, context);

        try {
            // 尝试清理 markdown 代码块标记
            const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanResult);
        } catch (e) {
            console.error('JSON 解析失败，返回空数组', result);
            return [];
        }
    }

    /**
     * 构建完整提示词
     */
    private buildPrompt(prompt: string, context: Partial<ProjectData>): string {
        let fullPrompt = prompt;

        // 注入上下文
        if (context.projectName) {
            fullPrompt = fullPrompt.replace('{projectName}', context.projectName);
        }
        if (context.projectDescription) {
            fullPrompt = `项目背景: ${context.projectDescription}\n\n${fullPrompt}`;
        }

        return fullPrompt;
    }

    /**
     * Mock 生成器 - 返回模拟内容
     */
    private mockGenerate(prompt: string, context: Partial<ProjectData>): string {
        const projectName = context.projectName || '示例项目';
        console.log(`[Mock Generating] Prompt length: ${prompt.length}`);

        // 简单的 Mock 逻辑，如果检测到 JSON 请求（通过 prompt 内容猜测）
        if (prompt.includes('JSON') || prompt.includes('Excel') || prompt.includes('测试用例')) {
            return JSON.stringify([
                { "ID": "TC001", "模块": "用户管理", "功能": "登录", "步骤": "输入正确账号密码", "预期结果": "登录成功" },
                { "ID": "TC002", "模块": "用户管理", "功能": "登录", "步骤": "输入错误密码", "预期结果": "提示密码错误" },
                { "ID": "TC003", "模块": "数据报表", "功能": "导出", "步骤": "点击导出按钮", "预期结果": "下载 Excel 文件" }
            ], null, 2);
        }

        // 匹配模板
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('feasibility') || promptLower.includes('可行性')) {
            return `# 可行性分析报告\n\n## 技术可行性\n${projectName}项目技术成熟...\n\n## 经济可行性\n回报率高...`;
        }

        // 默认返回 Markdown
        return `# ${projectName} - 生成文档\n\n基于模板生成的示例内容。\n\n## 章节一\n这是第一部分的内容。\n\n## 章节二\n这是第二部分的内容。`;
    }

    /**
     * 批量生成内容
     */
    async generateBatch(
        requests: Array<{ field: string; prompt: string }>,
        context: Partial<ProjectData> = {}
    ): Promise<Record<string, string>> {
        const results: Record<string, string> = {};

        for (const req of requests) {
            results[req.field] = await this.generateContent(req.prompt, context);
        }

        return results;
    }
}

// 导出单例
export const aiWriter = new AIWriter();
export default aiWriter;
