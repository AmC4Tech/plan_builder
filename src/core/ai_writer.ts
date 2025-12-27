import config from '../config/index.js';
import type { ProjectData } from '../types/index.js';

interface ChatModel {
    invoke(prompt: string): Promise<{ content: string }>;
}

/**
 * AI 内容生成器 - 使用 LangChain.js 生成文本内容
 */
class AIWriter {
    private llm: ChatModel | null = null;
    private initialized = false;

    /**
     * 初始化 LLM
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (config.openai.apiKey) {
            // 使用 OpenAI
            const { ChatOpenAI } = await import('@langchain/openai');
            this.llm = new ChatOpenAI({
                openAIApiKey: config.openai.apiKey,
                modelName: 'gpt-3.5-turbo',
                temperature: 0.7,
            });
            console.log('🤖 AI Writer: 使用 OpenAI 模式');
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

        if (this.llm) {
            // 使用真实 LLM
            try {
                const response = await this.llm.invoke(fullPrompt);
                return response.content;
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

        // 根据提示词类型返回不同的 Mock 内容
        const mockTemplates: Record<string, string> = {
            'feasibility': `
# 可行性分析报告

## 技术可行性
${projectName}项目从技术角度分析具有较高的可行性。当前市场上已有成熟的技术方案可供参考，开发团队具备相关技术经验。

## 经济可行性
根据初步估算，项目投资回报期预计为18-24个月，投资回报率预计可达150%以上。

## 运营可行性
项目运营模式清晰，人员配置合理，风险可控。

## 结论
综合以上分析，建议立项推进。
      `.trim(),

            'risk': `
# 风险分析

## 技术风险
- 新技术学习曲线可能影响开发进度
- 第三方依赖稳定性需要评估

## 市场风险
- 市场需求变化可能影响产品方向
- 竞争对手动态需持续关注

## 管理风险
- 团队协作效率需要保障
- 需求变更控制需要加强

## 应对措施
1. 建立技术预研机制
2. 定期市场调研
3. 完善项目管理流程
      `.trim(),

            'summary': `
# 项目概述

${projectName}是一个旨在解决特定业务问题的创新项目。通过采用先进的技术方案和科学的管理方法，本项目将为用户提供高效、可靠的解决方案。

## 项目目标
- 提高业务效率30%以上
- 降低运营成本20%
- 提升用户满意度至90%以上

## 预期成果
项目完成后将交付完整的系统解决方案，包括核心功能模块、配套文档和培训材料。
      `.trim(),
        };

        // 匹配模板
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('feasibility') || promptLower.includes('可行性')) {
            return mockTemplates.feasibility;
        }
        if (promptLower.includes('risk') || promptLower.includes('风险')) {
            return mockTemplates.risk;
        }
        if (promptLower.includes('summary') || promptLower.includes('概述') || promptLower.includes('概要')) {
            return mockTemplates.summary;
        }

        // 默认返回
        return `[AI 生成内容]\n\n针对"${prompt.substring(0, 50)}..."的分析内容将在此处展示。\n\n项目名称: ${projectName}\n生成时间: ${new Date().toLocaleString('zh-CN')}`;
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
