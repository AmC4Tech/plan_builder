/**
 * DOC 文件转换器
 * 使用 LibreOffice 将 .doc 文件转换为 .docx 格式
 * 
 * 前提条件: 系统需要安装 LibreOffice
 * - Windows: 从 https://www.libreoffice.org 下载安装
 * - 安装后需要将 soffice.exe 路径添加到环境变量
 * 
 * 运行方式: npx tsx src/scripts/convert-doc-to-docx.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// LibreOffice 可能的安装路径
const LIBREOFFICE_PATHS = [
    'soffice', // 如果在 PATH 中
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
];

/**
 * 查找 LibreOffice 可执行文件
 */
async function findLibreOffice(): Promise<string | null> {
    for (const soffice of LIBREOFFICE_PATHS) {
        try {
            // 尝试运行 --version 来验证路径是否有效
            await execAsync(`"${soffice}" --version`);
            return soffice;
        } catch {
            // 继续尝试下一个路径
        }
    }
    return null;
}

/**
 * 将 .doc 文件转换为 .docx
 */
async function convertDocToDocx(
    inputPath: string,
    outputDir: string,
    soffice: string
): Promise<string> {
    // 确保输出目录存在
    await fs.ensureDir(outputDir);

    // 使用 LibreOffice 转换
    // --headless: 无界面模式
    // --convert-to: 指定输出格式
    // --outdir: 指定输出目录
    const command = `"${soffice}" --headless --convert-to docx --outdir "${outputDir}" "${inputPath}"`;

    try {
        await execAsync(command, { timeout: 60000 });

        // 构建输出文件路径
        const baseName = path.basename(inputPath, '.doc');
        const outputPath = path.join(outputDir, `${baseName}.docx`);

        // 验证文件是否创建成功
        if (await fs.pathExists(outputPath)) {
            return outputPath;
        }

        throw new Error('转换后的文件不存在');
    } catch (error) {
        throw new Error(`转换失败: ${(error as Error).message}`);
    }
}

/**
 * 批量转换目录中的所有 .doc 文件
 */
async function convertAllDocFiles(inputDir: string, outputDir: string): Promise<void> {
    // 查找 LibreOffice
    const soffice = await findLibreOffice();

    if (!soffice) {
        console.error('❌ 未找到 LibreOffice！');
        console.log('\n请安装 LibreOffice:');
        console.log('  Windows: https://www.libreoffice.org/download/download/');
        console.log('  macOS: brew install --cask libreoffice');
        console.log('  Linux: sudo apt install libreoffice');
        return;
    }

    console.log(`✅ 找到 LibreOffice: ${soffice}\n`);

    // 查找所有 .doc 文件
    const docFiles: string[] = [];

    async function findDocFiles(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await findDocFiles(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.doc') && !entry.name.startsWith('~$')) {
                docFiles.push(fullPath);
            }
        }
    }

    await findDocFiles(inputDir);

    console.log(`找到 ${docFiles.length} 个 .doc 文件:\n`);

    let successCount = 0;
    let failCount = 0;

    for (const docFile of docFiles) {
        const relativePath = path.relative(inputDir, docFile);
        const outputSubDir = path.join(outputDir, path.dirname(relativePath));

        console.log(`📄 转换: ${relativePath}`);

        try {
            const outputPath = await convertDocToDocx(docFile, outputSubDir, soffice);
            console.log(`   ✅ 成功 -> ${path.relative(outputDir, outputPath)}`);
            successCount++;
        } catch (error) {
            console.log(`   ❌ 失败: ${(error as Error).message}`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`转换完成: ${successCount} 成功, ${failCount} 失败`);
    console.log('='.repeat(60));
}

/**
 * 主函数
 */
async function main() {
    const inputDir = path.resolve(__dirname, '../templates/template');
    const outputDir = path.resolve(__dirname, '../templates/template_converted/template');

    console.log('🔄 DOC 转 DOCX 转换器\n');
    console.log(`输入目录: ${inputDir}`);
    console.log(`输出目录: ${outputDir}\n`);

    await convertAllDocFiles(inputDir, outputDir);
}

main().catch(console.error);
