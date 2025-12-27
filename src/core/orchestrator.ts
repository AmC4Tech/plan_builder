import fs from 'fs-extra';
import path from 'path';
import config from '../config/index.js';
import type {
    ManifestConfig,
    ManifestPhase,
    ManifestDocument,
    ProjectData,
    ProjectOptions,
    FilePlan,
    ValidationResult,
    AIField
} from '../types/index.js';

/**
 * 编排器 - 解析 manifest.json 并规划文件生成树
 */
class Orchestrator {
    private manifest: ManifestConfig | null = null;
    private manifestPath: string;

    constructor() {
        this.manifestPath = path.join(config.paths.templates, 'manifest.json');
    }

    /**
     * 加载 manifest 配置
     */
    async loadManifest(): Promise<ManifestConfig> {
        try {
            const content = await fs.readFile(this.manifestPath, 'utf-8');
            this.manifest = JSON.parse(content) as ManifestConfig;
            return this.manifest;
        } catch (error) {
            const err = error as Error;
            throw new Error(`加载 manifest.json 失败: ${err.message}`);
        }
    }

    /**
     * 根据用户输入生成文件计划
     * @param projectData - 用户输入的项目数据
     * @returns 文件生成计划列表
     */
    async planFileTree(projectData: ProjectData): Promise<FilePlan[]> {
        if (!this.manifest) {
            await this.loadManifest();
        }

        const filePlan: FilePlan[] = [];
        const { phases, templateBasePath } = this.manifest!;
        const { projectName, options = {} } = projectData;

        // 遍历所有阶段
        for (const phase of phases) {
            const phaseDir = phase.folder;

            // 处理阶段内的文档
            const documents = this.resolveDocuments(phase, projectData, options);

            for (const doc of documents) {
                // 检查是否为必需文档或用户选择了可选文档
                if (doc.required || (doc.optionKey && options[doc.optionKey])) {
                    // 计算模板路径，支持 templateBasePath
                    const templateFullPath = templateBasePath
                        ? path.join(config.paths.templates, templateBasePath, doc.template)
                        : path.join(config.paths.templates, doc.template);

                    // 插值输出文件名
                    const resolvedOutputName = this.interpolateName(doc.outputName, projectData);

                    filePlan.push({
                        templatePath: templateFullPath,
                        outputPath: path.join(projectName, phaseDir, resolvedOutputName),
                        outputName: resolvedOutputName,
                        phase: phase.name,
                        phaseFolder: phaseDir,
                        data: this.mergeData(projectData, doc.additionalData || {}),
                        aiFields: doc.aiFields || [],
                    });
                }
            }
        }

        return filePlan;
    }

    /**
     * 解析文档列表，支持 Fill-down 继承策略
     */
    private resolveDocuments(
        phase: ManifestPhase,
        projectData: ProjectData,
        options: ProjectOptions
    ): ManifestDocument[] {
        const documents: ManifestDocument[] = [];
        const inheritedSettings = phase.defaultSettings || {};

        for (const doc of phase.documents || []) {
            // Fill-down: 继承父级设置
            const resolvedDoc: ManifestDocument = {
                ...inheritedSettings,
                ...doc,
            };

            // 处理动态输出名称
            if (resolvedDoc.outputNameTemplate) {
                resolvedDoc.outputName = this.interpolateName(
                    resolvedDoc.outputNameTemplate,
                    projectData
                );
            }

            documents.push(resolvedDoc);
        }

        return documents;
    }

    /**
     * 合并数据，添加通用字段
     */
    private mergeData(
        projectData: ProjectData,
        additionalData: Record<string, unknown>
    ): Record<string, unknown> {
        const now = new Date();

        return {
            ...projectData,
            ...additionalData,
            // 添加通用字段
            _generatedAt: now.toISOString(),
            _generatedDate: now.toLocaleDateString('zh-CN'),
            _year: now.getFullYear(),
            _month: now.getMonth() + 1,
            _day: now.getDate(),
        };
    }

    /**
     * 插值文件名
     */
    private interpolateName(template: string, data: ProjectData): string {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = data[key as keyof ProjectData];
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * 验证项目数据
     */
    validateProjectData(projectData: ProjectData): ValidationResult {
        const errors: string[] = [];

        if (!projectData.projectName) {
            errors.push('项目名称 (projectName) 是必填项');
        }

        if (!this.manifest) {
            errors.push('Manifest 尚未加载');
        }

        // 检查必填字段
        if (this.manifest?.requiredFields) {
            for (const field of this.manifest.requiredFields) {
                if (!projectData[field.name as keyof ProjectData]) {
                    errors.push(`${field.label} (${field.name}) 是必填项`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * 重新加载 manifest（用于热重载）
     */
    async reload(): Promise<void> {
        this.manifest = null;
        await this.loadManifest();
        console.log('📋 Manifest 已重新加载');
    }
}

// 导出单例
export const orchestrator = new Orchestrator();
export default orchestrator;
