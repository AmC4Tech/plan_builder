import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Config {
    port: number;
    nodeEnv: string;
    redis: {
        host: string;
        port: number;
        useMock: boolean;
    };
    openai: {
        apiKey: string;
        baseURL: string;
        modelName: string;
    };
    paths: {
        root: string;
        templates: string;
        output: string;
    };
    queue: {
        name: string;
        concurrency: number;
    };
}

export const config: Config = {
    // 服务器配置
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Redis 配置
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        useMock: process.env.USE_REDIS_MOCK === 'true',
    },

    // OpenAI 配置
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        modelName: process.env.MODEL_NAME || 'gpt-3.5-turbo',
    },

    // 路径配置
    paths: {
        root: path.resolve(__dirname, '../..'),
        templates: path.resolve(__dirname, '../templates'),
        output: path.resolve(__dirname, '../../output'),
    },

    // 队列配置
    queue: {
        name: 'generate-docs',
        concurrency: 2,
    },
};

/**
 * 获取 Redis 连接配置
 * 如果启用 mock 模式，返回 ioredis-mock 实例
 */
export async function getRedisConnection(): Promise<unknown> {
    if (config.redis.useMock) {
        const RedisMock = (await import('ioredis-mock')).default as any;
        return new RedisMock();
    }

    const Redis = (await import('ioredis')).default as any;
    return new Redis({
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null,
    });
}

export default config;
