import { Queue, Job } from 'bullmq';
import config, { getRedisConnection } from '../config/index.js';
import type { ProjectData, JobResult, JobStatus, GenerationResult } from '../types/index.js';

let queue: Queue | null = null;

/**
 * 获取或创建队列实例
 */
async function getQueue(): Promise<Queue> {
    if (queue) return queue;

    const connection = await getRedisConnection();

    queue = new Queue(config.queue.name, {
        connection: connection as never,
        defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        },
    });

    console.log(`📮 队列 "${config.queue.name}" 已创建`);
    return queue;
}

/**
 * 添加文档生成作业到队列
 */
export async function addGenerateJob(projectData: ProjectData): Promise<JobResult> {
    const q = await getQueue();

    const job = await q.add('generate', projectData, {
        priority: projectData.priority || 0,
    });

    console.log(`📝 作业已添加: ${job.id}`);

    return {
        jobId: job.id || '',
        status: 'queued',
        message: '文档生成任务已加入队列',
    };
}

/**
 * 获取作业状态
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
    const q = await getQueue();
    const job = await q.getJob(jobId);

    if (!job) {
        return {
            jobId,
            status: 'not_found',
            message: '作业不存在',
        };
    }

    const state = await job.getState();
    const progress = (job.progress as number) || 0;

    return {
        jobId,
        status: state,
        progress,
        result: state === 'completed' ? (job.returnvalue as GenerationResult) : null,
        error: state === 'failed' ? job.failedReason : null,
        createdAt: new Date(job.timestamp).toISOString(),
    };
}

/**
 * 关闭队列连接
 */
export async function closeQueue(): Promise<void> {
    if (queue) {
        await queue.close();
        queue = null;
        console.log('📮 队列已关闭');
    }
}

export default {
    addGenerateJob,
    getJobStatus,
    closeQueue,
};
