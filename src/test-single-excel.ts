
import { docGenerator } from './core/doc-generator.js';
import aiWriter from './core/ai_writer.js';
import excelGenerator from './core/excel-generator.js';
import templateReader from './core/template-reader.js';
import path from 'path';
import config from './config/index.js';
import type { ProjectData } from './types/index.js';

const projectData: ProjectData = {
    projectName: '广州物联网ai管理平台',
    projectDescription: '一个基于物联网和AI的智慧城市管理平台，包含交通监控、环境监测和公共安全模块。',
    options: {}
};

async function testSingleExcel() {
    const relativePath = '08开发与测试/09测试用例/3、XX平台测试用例.xlsx';
    const templatePath = path.join(config.paths.templates, 'template_backup', relativePath);
    const outputPath = path.join(config.paths.output, projectData.projectName, relativePath);

    console.log(`Testing single excel generation: ${relativePath}`);

    try {
        const templateInfo = await templateReader.readTemplate(templatePath);
        console.log('Template read successfully.');
        console.log('Template type:', templateInfo.type);

        const headers = templateInfo.structure?.headers || [];
        console.log('Headers:', headers);

        const prompt = `
Generate 3 rows of test data for headers: ${headers.join(', ')}.
Return JSON array.
`;
        console.log('Generating JSON with AI...');
        const data = await aiWriter.generateJSON(prompt, projectData);
        console.log('Data generated:', JSON.stringify(data, null, 2));

        console.log('Writing Excel...');
        await excelGenerator.createExcel(outputPath, data, headers);
        console.log('File written to:', outputPath);

    } catch (e) {
        console.error('Error:', e);
    }
}

testSingleExcel();
