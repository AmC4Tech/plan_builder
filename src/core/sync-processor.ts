/**
 * 同步文档处理器
 * 开发环境使用同步模式处理文档生成，避免 BullMQ + ioredis-mock 兼容性问题
 */

import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import config from '../config/index.js';
import { orchestrator } from './orchestrator.js';
import { renderer } from './renderer.js';
import excelRenderer from './excel-renderer.js';
import { aiWriter } from './ai_writer.js';
import type { ProjectData, FilePlan, GenerationResult } from '../types/index.js';

interface RenderedDoc {
    path: string;
    buffer: Buffer;
}

// 存储作业状态
const jobStore = new Map<string, {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: GenerationResult;
    error?: string;
    createdAt: Date;
}>();

/**
 * 创建文档生成作业
 */
export async function createJob(projectData: ProjectData): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    jobStore.set(jobId, {
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
    });

    // 异步处理作业
    processJob(jobId, projectData).catch((err: Error) => {
        const job = jobStore.get(jobId);
        if (job) {
            job.status = 'failed';
            job.error = err.message;
        }
    });

    return jobId;
}

/**
 * 获取作业状态
 */
export function getJobStatus(jobId: string) {
    const job = jobStore.get(jobId);
    if (!job) {
        return null;
    }
    return {
        jobId,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
    };
}

/**
 * 处理文档生成作业
 */
async function processJob(jobId: string, projectData: ProjectData): Promise<void> {
    const job = jobStore.get(jobId);
    if (!job) return;

    job.status = 'processing';
    console.log(`🔄 开始处理作业 ${jobId}: ${projectData.projectName}`);

    try {
        // 1. 生成文件计划
        job.progress = 10;
        const filePlan = await orchestrator.planFileTree(projectData);
        console.log(`📋 文件计划: ${filePlan.length} 个文档`);

        // 2. 生成 AI 内容
        job.progress = 20;
        const aiContents = await generateAIContents(filePlan, projectData);

        // 3. 渲染所有文档
        job.progress = 30;
        const renderedDocs = await renderAllDocuments(filePlan, projectData, aiContents, (progress) => {
            job.progress = 30 + Math.floor(progress * 50);
        });

        // 4. 创建 ZIP 文件
        job.progress = 80;
        const zipPath = await createZipArchive(projectData.projectName, renderedDocs);

        // 5. 完成
        job.progress = 100;
        job.status = 'completed';
        job.result = {
            success: true,
            outputPath: zipPath,
            documentCount: renderedDocs.length,
            generatedAt: new Date().toISOString(),
        };

        console.log(`✅ 作业 ${jobId} 完成: ${zipPath}`);
    } catch (error) {
        job.status = 'failed';
        job.error = (error as Error).message;
        console.error(`❌ 作业 ${jobId} 失败:`, job.error);
        throw error;
    }
}

/**
 * 生成 AI 内容
 */
async function generateAIContents(
    filePlan: FilePlan[],
    projectData: ProjectData
): Promise<Map<string, string>> {
    const aiContents = new Map<string, string>();

    for (const file of filePlan) {
        if (file.aiFields && file.aiFields.length > 0) {
            for (const aiField of file.aiFields) {
                const key = `${file.outputPath}:${aiField.field}`;
                const content = await aiWriter.generateContent(aiField.prompt, projectData);
                aiContents.set(key, content);
            }
        }
    }

    return aiContents;
}

/**
 * 渲染所有文档
 */
async function renderAllDocuments(
    filePlan: FilePlan[],
    projectData: ProjectData,
    aiContents: Map<string, string>,
    onProgress: (progress: number) => void
): Promise<RenderedDoc[]> {
    const renderedDocs: RenderedDoc[] = [];
    const totalFiles = filePlan.length;
    let processed = 0;

    for (const file of filePlan) {
        try {
            // 检查模板是否存在
            const templateExists = await fs.pathExists(file.templatePath);
            if (!templateExists) {
                console.warn(`⚠️ 模板不存在: ${file.templatePath}`);
                continue;
            }

            // 合并 AI 内容到数据
            const mergedData: Record<string, unknown> = { ...file.data };
            if (file.aiFields) {
                for (const aiField of file.aiFields) {
                    const key = `${file.outputPath}:${aiField.field}`;
                    if (aiContents.has(key)) {
                        mergedData[aiField.field] = aiContents.get(key);
                    }
                }
            }

            // 根据文件类型选择渲染器
            let buffer: Buffer;
            if (excelRenderer.isExcelFile(file.templatePath)) {
                buffer = await excelRenderer.renderExcel(file.templatePath, mergedData);
            } else {
                buffer = await renderer.renderDocument(file.templatePath, mergedData);
            }

            renderedDocs.push({
                path: file.outputPath,
                buffer,
            });

            processed++;
            onProgress(processed / totalFiles);
            console.log(`📄 已渲染: ${file.outputName}`);
        } catch (error) {
            const err = error as Error;
            console.error(`❌ 渲染失败 [${file.outputName}]:`, err.message);
        }
    }

    return renderedDocs;
}

/**
 * 创建 ZIP 归档
 */
async function createZipArchive(projectName: string, documents: RenderedDoc[]): Promise<string> {
    await fs.ensureDir(config.paths.output);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = projectName.replace(/[<>:"/\\|?*]/g, '_');
    const zipFileName = `${sanitizedName}_${timestamp}.zip`;
    const zipPath = path.join(config.paths.output, zipFileName);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`📦 ZIP 创建完成: ${archive.pointer()} bytes`);
            resolve(zipPath);
        });

        archive.on('error', reject);
        archive.pipe(output);

        for (const doc of documents) {
            archive.append(doc.buffer, { name: doc.path });
        }

        archive.finalize();
    });
}

export default {
    createJob,
    getJobStatus,
};
