// 类型定义文件

export interface ProjectData {
    projectName: string;
    projectCode: string;
    projectManager: string;
    projectDescription?: string;
    projectObjective?: string;
    projectScope?: string;
    expectedBenefits?: string;
    budget?: number;
    totalBudget?: number;
    duration?: string;
    priority?: number;
    options?: ProjectOptions;
    teamMembers?: TeamMember[];
    milestones?: Milestone[];
    phases?: Phase[];
    resources?: Resource[];
    wbsItems?: WBSItem[];
    risks?: Risk[];
    budgetItems?: BudgetItem[];
    deliverables?: Deliverable[];
    lessonsLearned?: LessonLearned[];
    improvementSuggestions?: string;
    [key: string]: unknown;
}

export interface ProjectOptions {
    includeMeetingMinutes?: boolean;
    includeAttendance?: boolean;
    [key: string]: boolean | undefined;
}

export interface TeamMember {
    name: string;
    role: string;
    attendanceDays?: number;
}

export interface Milestone {
    name: string;
    date: string;
}

export interface Phase {
    name: string;
    startDate: string;
    endDate: string;
    owner: string;
}

export interface Resource {
    name: string;
    allocation: number;
}

export interface WBSItem {
    code: string;
    name: string;
    description: string;
    duration: string;
    owner: string;
}

export interface Risk {
    name: string;
    category: string;
    probability: string;
    impact: string;
    mitigation: string;
}

export interface BudgetItem {
    category: string;
    amount: number;
    description: string;
}

export interface Deliverable {
    name: string;
    status: string;
    comments: string;
}

export interface LessonLearned {
    description: string;
}

// Manifest 类型
export interface ManifestConfig {
    name: string;
    version: string;
    description: string;
    templateBasePath?: string;
    requiredFields: RequiredField[];
    phases: ManifestPhase[];
}

export interface RequiredField {
    name: string;
    label: string;
    type: string;
}

export interface ManifestPhase {
    name: string;
    folder: string;
    defaultSettings?: DocumentSettings;
    documents: ManifestDocument[];
}

export interface DocumentSettings {
    required?: boolean;
}

export interface ManifestDocument {
    template: string;
    outputName: string;
    outputNameTemplate?: string;
    required?: boolean;
    optionKey?: string;
    aiFields?: AIField[];
    additionalData?: Record<string, unknown>;
}

export interface AIField {
    field: string;
    prompt: string;
}

// 文件计划类型
export interface FilePlan {
    templatePath: string;
    outputPath: string;
    outputName: string;
    phase: string;
    phaseFolder: string;
    data: Record<string, unknown>;
    aiFields: AIField[];
}

// 渲染结果类型
export interface RenderedDocument {
    name: string;
    buffer: Buffer;
}

export interface RenderTask {
    templatePath: string;
    data: Record<string, unknown>;
    outputName: string;
}

// 作业类型
export interface JobResult {
    jobId: string;
    status: string;
    message: string;
}

export interface JobStatus {
    jobId: string;
    status: string;
    progress?: number;
    result?: GenerationResult | null;
    error?: string | null;
    createdAt?: string;
    message?: string;
}

export interface GenerationResult {
    success: boolean;
    outputPath: string;
    documentCount: number;
    generatedAt: string;
}

// 验证结果
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// API 响应类型
export interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    message?: string;
    details?: string[];
    data?: T;
}
