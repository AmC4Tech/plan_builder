/**
 * 自动化项目文档生成器 - 前端逻辑
 */

// API 基础路径
const API_BASE = '';

// DOM 元素
const elements = {
    form: document.getElementById('projectForm'),
    previewBtn: document.getElementById('previewBtn'),
    generateBtn: document.getElementById('generateBtn'),
    previewSection: document.getElementById('previewSection'),
    progressSection: document.getElementById('progressSection'),
    resultSection: document.getElementById('resultSection'),
    errorSection: document.getElementById('errorSection'),
    fileList: document.getElementById('fileList'),
    fileCount: document.getElementById('fileCount'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    statusText: document.getElementById('statusText'),
    docCount: document.getElementById('docCount'),
    generateTime: document.getElementById('generateTime'),
    outputPath: document.getElementById('outputPath'),
    errorMessage: document.getElementById('errorMessage'),
    newTaskBtn: document.getElementById('newTaskBtn'),
    retryBtn: document.getElementById('retryBtn'),
};

// 当前任务ID
let currentJobId = null;
let pollInterval = null;

/**
 * 初始化
 */
function init() {
    // 表单提交
    elements.form.addEventListener('submit', handleGenerate);

    // 预览按钮
    elements.previewBtn.addEventListener('click', handlePreview);

    // 新建任务按钮
    elements.newTaskBtn.addEventListener('click', resetForm);

    // 重试按钮
    elements.retryBtn.addEventListener('click', handleGenerate);

    // 自动填充默认值
    const today = new Date();
    document.getElementById('startYear').value = today.getFullYear();
    document.getElementById('startMonth').value = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('endYear').value = today.getFullYear();
    document.getElementById('endMonth').value = '12';
}

/**
 * 获取表单数据
 */
function getFormData() {
    const formData = new FormData(elements.form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    return data;
}

/**
 * 验证表单
 */
function validateForm() {
    const data = getFormData();
    const required = ['projectName', 'projectCode', 'projectManager', 'companyName',
        'startYear', 'startMonth', 'endYear', 'endMonth'];

    for (const field of required) {
        if (!data[field] || !data[field].trim()) {
            return { valid: false, error: `请填写必填字段` };
        }
    }

    return { valid: true, data };
}

/**
 * 处理预览
 */
async function handlePreview() {
    const validation = validateForm();
    if (!validation.valid) {
        showError(validation.error);
        return;
    }

    elements.previewBtn.disabled = true;
    elements.previewBtn.innerHTML = '<span class="btn-icon">⏳</span> 加载中...';

    try {
        const response = await fetch(`${API_BASE}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validation.data),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '预览失败');
        }

        // 显示文件列表
        renderFileList(result.files);
        elements.fileCount.textContent = `${result.fileCount} 个文件`;
        elements.previewSection.classList.remove('hidden');

    } catch (error) {
        showError(error.message);
    } finally {
        elements.previewBtn.disabled = false;
        elements.previewBtn.innerHTML = '<span class="btn-icon">👁️</span> 预览文件';
    }
}

/**
 * 渲染文件列表
 */
function renderFileList(files) {
    elements.fileList.innerHTML = files.map(file => `
        <div class="file-item">
            <span class="file-icon">${file.outputName.endsWith('.xlsx') ? '📊' : '📄'}</span>
            <span class="file-name">${file.outputName}</span>
            <span class="file-phase">${file.phase}</span>
        </div>
    `).join('');
}

/**
 * 处理生成
 */
async function handleGenerate(e) {
    if (e) e.preventDefault();

    const validation = validateForm();
    if (!validation.valid) {
        showError(validation.error);
        return;
    }

    // 隐藏其他区域
    hideAllSections();
    elements.progressSection.classList.remove('hidden');

    // 禁用按钮
    elements.generateBtn.disabled = true;
    elements.previewBtn.disabled = true;

    try {
        // 创建任务
        updateProgress(5, '正在创建任务...');

        const response = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validation.data),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '创建任务失败');
        }

        currentJobId = result.jobId;
        updateProgress(10, '任务已创建，正在处理...');

        // 开始轮询状态
        startPolling();

    } catch (error) {
        showError(error.message);
        enableButtons();
    }
}

/**
 * 开始轮询任务状态
 */
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/jobs/${currentJobId}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '获取状态失败');
            }

            // 更新进度
            updateProgress(result.progress || 0, getStatusText(result.status));

            // 检查是否完成
            if (result.status === 'completed') {
                stopPolling();
                showResult(result.result);
            } else if (result.status === 'failed') {
                stopPolling();
                showError(result.error || '任务处理失败');
            }

        } catch (error) {
            stopPolling();
            showError(error.message);
        }
    }, 1000);
}

/**
 * 停止轮询
 */
function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

/**
 * 更新进度
 */
function updateProgress(percent, status) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
    elements.statusText.textContent = status;
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
    const statusMap = {
        'pending': '等待处理...',
        'processing': '正在生成文档...',
        'completed': '生成完成',
        'failed': '生成失败',
    };
    return statusMap[status] || status;
}

/**
 * 显示结果
 */
function showResult(result) {
    hideAllSections();
    elements.resultSection.classList.remove('hidden');

    elements.docCount.textContent = result.documentCount + ' 个';
    elements.generateTime.textContent = new Date(result.generatedAt).toLocaleString('zh-CN');
    elements.outputPath.textContent = result.outputPath;

    enableButtons();
}

/**
 * 显示错误
 */
function showError(message) {
    hideAllSections();
    elements.errorSection.classList.remove('hidden');
    elements.errorMessage.textContent = message;
    enableButtons();
}

/**
 * 隐藏所有区域
 */
function hideAllSections() {
    elements.previewSection.classList.add('hidden');
    elements.progressSection.classList.add('hidden');
    elements.resultSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');
}

/**
 * 启用按钮
 */
function enableButtons() {
    elements.generateBtn.disabled = false;
    elements.previewBtn.disabled = false;
    elements.generateBtn.innerHTML = '<span class="btn-icon">🚀</span> 生成文档';
}

/**
 * 重置表单
 */
function resetForm() {
    elements.form.reset();
    hideAllSections();
    currentJobId = null;

    // 重新填充默认日期
    const today = new Date();
    document.getElementById('startYear').value = today.getFullYear();
    document.getElementById('startMonth').value = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('endYear').value = today.getFullYear();
    document.getElementById('endMonth').value = '12';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
