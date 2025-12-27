/**
 * Excel 渲染引擎
 * 使用 exceljs 处理 Excel 模板变量替换
 */

import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';

// 模板缓存
const templateCache = new Map<string, Buffer>();

/**
 * 渲染 Excel 文档
 * @param templatePath - 模板文件路径
 * @param data - 要填充的数据
 * @returns 渲染后的 Excel 文件 Buffer
 */
export async function renderExcel(
    templatePath: string,
    data: Record<string, unknown>
): Promise<Buffer> {
    try {
        // 读取模板文件
        const templateBuffer = await loadTemplate(templatePath);

        // 创建工作簿
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

        // 遍历所有工作表
        workbook.eachSheet((worksheet) => {
            // 遍历所有行和单元格
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    // 处理单元格值
                    if (cell.value && typeof cell.value === 'string') {
                        cell.value = replaceVariables(cell.value, data);
                    } else if (cell.value && typeof cell.value === 'object') {
                        // 处理富文本
                        const richText = cell.value as ExcelJS.CellRichTextValue;
                        if (richText.richText) {
                            richText.richText.forEach((part) => {
                                if (part.text) {
                                    part.text = replaceVariables(part.text, data);
                                }
                            });
                        }
                    }
                });
            });
        });

        // 生成 Buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    } catch (error) {
        const err = error as Error;
        throw new Error(`Excel 渲染失败 [${path.basename(templatePath)}]: ${err.message}`);
    }
}

/**
 * 批量渲染 Excel 文档
 */
export async function renderExcelBatch(
    tasks: Array<{
        templatePath: string;
        data: Record<string, unknown>;
        outputName: string;
    }>
): Promise<Array<{ name: string; buffer: Buffer }>> {
    const results: Array<{ name: string; buffer: Buffer }> = [];

    for (const task of tasks) {
        const buffer = await renderExcel(task.templatePath, task.data);
        results.push({
            name: task.outputName,
            buffer,
        });
    }

    return results;
}

/**
 * 加载模板文件
 */
async function loadTemplate(templatePath: string): Promise<Buffer> {
    // 检查缓存
    if (templateCache.has(templatePath)) {
        return templateCache.get(templatePath)!;
    }

    // 检查文件是否存在
    if (!(await fs.pathExists(templatePath))) {
        throw new Error(`模板文件不存在: ${templatePath}`);
    }

    // 读取文件
    const buffer = await fs.readFile(templatePath);

    // 缓存模板
    templateCache.set(templatePath, buffer);

    return buffer;
}

/**
 * 替换变量
 * 支持 {variable} 格式的占位符
 */
function replaceVariables(text: string, data: Record<string, unknown>): string {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
        const value = getNestedValue(data, key);
        if (value !== undefined && value !== null) {
            return String(value);
        }
        return match; // 保留未匹配的占位符
    });
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }

    return current;
}

/**
 * 清除模板缓存
 */
export function clearExcelCache(templatePath?: string): void {
    if (templatePath) {
        templateCache.delete(templatePath);
    } else {
        templateCache.clear();
    }
    console.log('📊 Excel 模板缓存已清除');
}

/**
 * 检查文件是否为 Excel 格式
 */
export function isExcelFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.xlsx' || ext === '.xls';
}

export default {
    renderExcel,
    renderExcelBatch,
    clearExcelCache,
    isExcelFile,
};
