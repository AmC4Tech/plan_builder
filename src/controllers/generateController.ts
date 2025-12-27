import { Request, Response } from 'express';
import { addGenerateJob, getJobStatus as getQueueJobStatus } from '../queues/producer.js';
import syncProcessor from '../core/sync-processor.js';
import { orchestrator } from '../core/orchestrator.js';
import config from '../config/index.js';
import type { ProjectData } from '../types/index.js';

/**
 * 文档生成控制器
 */
export const generateController = {
    /**
     * POST /api/generate
     * 创建文档生成任务
     */
    async createJob(req: Request, res: Response): Promise<void> {
        try {
            const projectData = req.body as ProjectData;

            // 验证请求数据
            if (!projectData || typeof projectData !== 'object') {
                res.status(400).json({
                    success: false,
                    error: '请求体必须是有效的 JSON 对象',
                });
                return;
            }

            // 加载 manifest 并验证数据
            await orchestrator.loadManifest();
            const validation = orchestrator.validateProjectData(projectData);

            if (!validation.valid) {
                res.status(400).json({
                    success: false,
                    error: '数据验证失败',
                    details: validation.errors,
                });
                return;
            }

            // 根据配置选择处理模式
            let result;
            if (config.redis.useMock) {
                // Mock 模式：使用同步处理器
                const jobId = await syncProcessor.createJob(projectData);
                result = {
                    jobId,
                    message: '任务已创建（同步模式）',
                    statusUrl: `/api/jobs/${jobId}`,
                };
            } else {
                // 生产模式：使用 BullMQ 队列
                result = await addGenerateJob(projectData);
            }

            res.status(202).json({
                success: true,
                ...result,
            });
        } catch (error) {
            const err = error as Error;
            console.error('创建任务失败:', err);
            res.status(500).json({
                success: false,
                error: '服务器内部错误',
                message: err.message,
            });
        }
    },

    /**
     * GET /api/jobs/:jobId
     * 获取任务状态
     */
    async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                res.status(400).json({
                    success: false,
                    error: '缺少 jobId 参数',
                });
                return;
            }

            // 根据配置选择状态查询方式
            let status;
            if (config.redis.useMock) {
                // Mock 模式：使用同步处理器
                status = syncProcessor.getJobStatus(jobId);
                if (!status) {
                    res.status(404).json({
                        success: false,
                        error: '任务不存在',
                    });
                    return;
                }
            } else {
                // 生产模式：使用 BullMQ 队列
                status = await getQueueJobStatus(jobId);
                if (status.status === 'not_found') {
                    res.status(404).json({
                        success: false,
                        error: '任务不存在',
                    });
                    return;
                }
            }

            res.json({
                success: true,
                ...status,
            });
        } catch (error) {
            const err = error as Error;
            console.error('获取任务状态失败:', err);
            res.status(500).json({
                success: false,
                error: '服务器内部错误',
                message: err.message,
            });
        }
    },

    /**
     * GET /api/manifest
     * 获取当前 manifest 配置
     */
    async getManifest(req: Request, res: Response): Promise<void> {
        try {
            const manifest = await orchestrator.loadManifest();
            res.json({
                success: true,
                manifest,
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({
                success: false,
                error: '加载 manifest 失败',
                message: err.message,
            });
        }
    },

    /**
     * POST /api/preview
     * 预览文件计划（不实际生成）
     */
    async previewPlan(req: Request, res: Response): Promise<void> {
        try {
            const projectData = req.body as ProjectData;

            await orchestrator.loadManifest();
            const validation = orchestrator.validateProjectData(projectData);

            if (!validation.valid) {
                res.status(400).json({
                    success: false,
                    error: '数据验证失败',
                    details: validation.errors,
                });
                return;
            }

            const filePlan = await orchestrator.planFileTree(projectData);

            res.json({
                success: true,
                fileCount: filePlan.length,
                files: filePlan.map((f) => ({
                    phase: f.phase,
                    phaseFolder: f.phaseFolder,
                    outputName: f.outputName,
                    outputPath: f.outputPath,
                    hasAIFields: f.aiFields && f.aiFields.length > 0,
                })),
            });
        } catch (error) {
            const err = error as Error;
            res.status(500).json({
                success: false,
                error: '生成预览失败',
                message: err.message,
            });
        }
    },
};

export default generateController;
