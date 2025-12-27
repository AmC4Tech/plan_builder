import { Worker, Job } from 'bullmq';
import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import config, { getRedisConnection } from '../config/index.js';
import { orchestrator } from '../core/orchestrator.js';
import { renderer } from '../core/renderer.js';
import excelRenderer from '../core/excel-renderer.js';
import { aiWriter } from '../core/ai_writer.js';
import type { ProjectData, FilePlan, GenerationResult, AIField } from '../types/index.js';

let worker: Worker | null = null;

interface RenderedDoc {
    path: string;
    buffer: Buffer;
}

/**
 * 处理文档生成作业
 */
async function processJob(job: Job<ProjectData>): Promise<GenerationResult> {
    const { data } = job;
    console.log(`🔄 开始处理作业 ${job.id}: ${data.projectName}`);

    try {
        // 1. 加载 manifest 并生成文件计划
        await job.updateProgress(10);
        const filePlan = await orchestrator.planFileTree(data);
        console.log(`📋 文件计划: ${filePlan.length} 个文档`);

        // 2. 生成 AI 内容（如果需要）
        await job.updateProgress(20);
        const aiContents = await generateAIContents(filePlan, data);

        // 3. 渲染所有文档
        await job.updateProgress(30);
        const renderedDocs = await renderAllDocuments(job, filePlan, data, aiContents);

        // 4. 打包 ZIP
        await job.updateProgress(80);
        const zipPath = await createZipArchive(data.projectName, renderedDocs);

        // 5. 完成
        await job.updateProgress(100);
        console.log(`✅ 作业 ${job.id} 完成: ${zipPath}`);

        return {
            success: true,
            outputPath: zipPath,
            documentCount: renderedDocs.length,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        const err = error as Error;
        console.error(`❌ 作业 ${job.id} 失败:`, err.message);
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
    job: Job<ProjectData>,
    filePlan: FilePlan[],
    projectData: ProjectData,
    aiContents: Map<string, string>
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
                // 使用 Excel 渲染器
                buffer = await excelRenderer.renderExcel(file.templatePath, mergedData);
            } else {
                // 使用 Word 渲染器
                buffer = await renderer.renderDocument(file.templatePath, mergedData);
            }

            renderedDocs.push({
                path: file.outputPath,
                buffer,
            });

            processed++;
            const progress = 30 + Math.floor((processed / totalFiles) * 50);
            await job.updateProgress(progress);

            console.log(`📄 已渲染: ${file.outputName}`);
        } catch (error) {
            const err = error as Error;
            console.error(`❌ 渲染失败 [${file.outputName}]:`, err.message);
            // 继续处理其他文件
        }
    }

    return renderedDocs;
}

/**
 * 创建 ZIP 归档
 */
async function createZipArchive(projectName: string, documents: RenderedDoc[]): Promise<string> {
    // 确保输出目录存在
    await fs.ensureDir(config.paths.output);

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = projectName.replace(/[<>:"/\\|?*]/g, '_');
    const zipFileName = `${sanitizedName}_${timestamp}.zip`;
    const zipPath = path.join(config.paths.output, zipFileName);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            console.log(`📦 ZIP 创建完成: ${archive.pointer()} bytes`);
            resolve(zipPath);
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // 添加所有文档到归档
        for (const doc of documents) {
            archive.append(doc.buffer, { name: doc.path });
        }

        archive.finalize();
    });
}

/**
 * 启动 Worker
 */
export async function startWorker(): Promise<Worker> {
    const connection = await getRedisConnection();

    worker = new Worker<ProjectData>(config.queue.name, processJob, {
        connection: connection as never,
        concurrency: config.queue.concurrency,
    });

    worker.on('completed', (job) => {
        console.log(`✅ 作业完成: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ 作业失败: ${job?.id} - ${err.message}`);
    });

    worker.on('error', (err) => {
        console.error('Worker 错误:', err);
    });

    console.log(`👷 Worker 已启动，监听队列: ${config.queue.name}`);
    return worker;
}

/**
 * 停止 Worker
 */
export async function stopWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
        console.log('👷 Worker 已停止');
    }
}

export default {
    startWorker,
    stopWorker,
};
