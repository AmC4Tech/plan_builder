import expressions from 'angular-expressions';

// 扩展 angular-expressions 类型
declare module 'angular-expressions' {
    interface Filters {
        formatDate: (input: string | Date) => string;
        formatDateTime: (input: string | Date) => string;
        formatCurrency: (input: number) => string;
        uppercase: (input: string) => string;
        lowercase: (input: string) => string;
        default: (input: unknown, defaultValue: unknown) => unknown;
        join: (input: unknown[], separator?: string) => string;
        index: (input: number) => number;
    }
}

/**
 * Angular Expressions 解析器配置
 * 用于在 docxtemplater 中支持复杂的表达式语法
 */

// 注册自定义过滤器
(expressions.filters as Record<string, unknown>).formatDate = function (input: string | Date): string {
    if (!input) return '';
    const date = new Date(input);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

(expressions.filters as Record<string, unknown>).formatDateTime = function (input: string | Date): string {
    if (!input) return '';
    const date = new Date(input);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

(expressions.filters as Record<string, unknown>).formatCurrency = function (input: number): string {
    if (input === null || input === undefined) return '';
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
    }).format(input);
};

(expressions.filters as Record<string, unknown>).uppercase = function (input: string): string {
    return input ? String(input).toUpperCase() : '';
};

(expressions.filters as Record<string, unknown>).lowercase = function (input: string): string {
    return input ? String(input).toLowerCase() : '';
};

(expressions.filters as Record<string, unknown>).default = function (input: unknown, defaultValue: unknown): unknown {
    return input !== null && input !== undefined && input !== '' ? input : defaultValue;
};

(expressions.filters as Record<string, unknown>).join = function (input: unknown[], separator = ', '): string {
    if (!Array.isArray(input)) return String(input);
    return input.join(separator);
};

(expressions.filters as Record<string, unknown>).index = function (input: number): number {
    // 用于数组循环中的索引显示（从1开始）
    return input + 1;
};

interface ParserContext {
    scopeList?: Record<string, unknown>[];
    num?: number;
}

interface ParserPart {
    module?: string;
}

interface ParserResult {
    get: (scope: Record<string, unknown>, context?: ParserContext) => unknown;
}

/**
 * 创建 docxtemplater 兼容的表达式解析器
 * @param tag - 模板标签内容
 * @returns 解析器对象
 */
function expressionParser(tag: string): ParserResult {
    // 处理循环标签的特殊情况
    tag = tag
        .replace(/^\.$/, 'this')
        .replace(/^\.(.+)/, 'this.$1');

    // 编译表达式
    let expr: (scope: Record<string, unknown>) => unknown;
    try {
        expr = expressions.compile(tag);
    } catch (e) {
        const error = e as Error;
        throw new Error(`表达式编译错误: "${tag}" - ${error.message}`);
    }

    return {
        get: function (scope: Record<string, unknown>, context?: ParserContext): unknown {
            // 构建完整的作用域，包含所有上下文
            let fullScope: Record<string, unknown> = {};

            if (context) {
                // 合并所有父级作用域
                if (context.scopeList) {
                    for (const s of context.scopeList) {
                        Object.assign(fullScope, s);
                    }
                }
                // 添加特殊变量
                if (context.num !== undefined) {
                    fullScope.$index = context.num;
                    fullScope.$first = context.num === 0;
                    fullScope.$last = context.scopeList ? context.num === context.scopeList.length - 1 : false;
                }
            }

            // 当前作用域优先
            Object.assign(fullScope, scope);

            try {
                return expr(fullScope);
            } catch {
                // 静默处理未定义变量
                return undefined;
            }
        },
    };
}

// Null getter for docxtemplater
export function nullGetter(part: ParserPart): string {
    if (!part.module) {
        return '';
    }
    if (part.module === 'rawxml') {
        return '';
    }
    return '';
}

export default expressionParser;
