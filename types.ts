
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
  FATAL = 'FATAL',
}

export enum Role {
  OWNER = 'OWNER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  MEMBER = 'MEMBER',
}

export enum ContainerStatus {
  Running = 'Running',
  Stopped = 'Stopped',
  Restarting = 'Restarting',
}

export enum PodStatus {
  Running = 'Running',
  Pending = 'Pending',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
}

export type InsightType = 'rca' | 'pattern' | 'playbook';

export enum IncidentStatus {
  INVESTIGATING = 'INVESTIGATING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum AuditLogAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_INVITED = 'USER_INVITED',
  USER_REMOVED = 'USER_REMOVED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  PLAN_CHANGED = 'PLAN_CHANGED',
  DATASET_IMPORTED = 'DATASET_IMPORTED',
}

export interface LogEntry {
  id: string;
  organizationId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  anomalyScore?: number;
}

export interface Anomaly extends LogEntry {
  anomalyScore: number;
}

export interface LogSummary {
  hour: string;
  total: number;
  anomalies: number;
  errors: number;
  fatals: number;
}

export interface User {
  id: string;
  organizationId: string;
  username: string;
  password?: string;
  role: Role;
  email: string;
  jobTitle: string;
  salary: number;
  hireDate: string;
  notificationEmail?: string;
  phone?: string;
  isVerified?: boolean;
  verificationToken?: string;
}

export type SubscriptionPlan = 'Free' | 'Pro' | 'Enterprise';

export interface PlanDetails {
    name: SubscriptionPlan;
    price: string;
    quotas: {
        logsPerMonth: number;
        members: number;
    };
    features: string[];
}

export interface Organization {
    id: string;
    name: string;
    plan: PlanDetails;
}

export interface GeneratedFilters {
  keyword?: string;
  levels?: LogLevel[];
  sources?: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export interface Container {
    id: string;
    name: string;
    image: string;
    status: ContainerStatus;
    cpuUsage: number;
    memoryUsage: number;
    uptime: string;
}

export interface Pod {
    id: string;
    name: string;
    namespace: string;
    status: PodStatus;
    restarts: number;
    cpuUsage: string;
    memoryUsage: string;
    age: string;
}

export interface AlertRule {
    id: string;
    name: string;
    condition: {
        type: 'keyword' | 'threshold';
        keyword?: string;
        level?: LogLevel;
        source?: string;
        count?: number;
        timeWindowMinutes?: number;
    };
    channel: 'email' | 'sms';
    enabled: boolean;
}

export interface NotificationContact {
    id: string;
    name: string;
    phone: string;
    role: Role;
}

export interface AlertHistoryEntry {
    id: string;
    timestamp: string;
    log: LogEntry;
}

export interface DetectedObjectInfo {
    name: string;
    description: string;
    confidence: number;
    emoji: string;
}

export interface FlowchartNode {
    id: string;
    text: string;
    type: 'rect' | 'rhombus' | 'oval' | 'parallelogram' | 'document';
}

export interface FlowchartLink {
    source: string;
    target: string;
    label?: string;
}

export interface FlowchartResponse {
    nodes: FlowchartNode[];
    links: FlowchartLink[];
}

export interface RootCauseAnalysisResponse {
    summary: string;
    keyEvents: string[];
    nextSteps: string[];
}

export interface LogPattern {
    id: string;
    title: string;
    type: 'Temporal' | 'Causal' | 'Behavioral' | 'Unknown';
    description: string;
    exampleLogIds: string[];
}

export interface AiPlaybook {
    title: string;
    summary: string;
    severity: 1 | 2 | 3 | 4 | 5;
    triageSteps: {
        step: number;
        action: string;
        command?: string;
    }[];
    escalationPath: string;
}

export interface LearnedInsight {
    id: string;
    timestamp: string;
    type: InsightType;
    title: string;
    summary: string;
    userNotes?: string;
    originalQuery?: string;
    originalLog?: LogEntry;
    pattern?: LogPattern;
    playbook?: AiPlaybook;
}

export interface AiDiscovery {
    id: string;
    type: 'TREND' | 'NEW_ERROR' | 'SPIKE' | 'ANOMALY_CLUSTER';
    title: string;
    summary: string;
    implication: string;
    investigationFilters: {
        keyword?: string;
        source?: string;
        level?: LogLevel;
    };
}

export interface ActivityLogEntry {
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    note: string;
}

export interface Incident {
    id: string;
    title: string;
    status: IncidentStatus;
    severity: 1 | 2 | 3 | 4 | 5;
    createdAt: string;
    resolvedAt?: string;
    triggeringLog: LogEntry;
    rcaResult: RootCauseAnalysisResponse;
    playbook: AiPlaybook;
    activityLog: ActivityLogEntry[];
}

export interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    organizationId: string;
    createdAt: string;
    lastUsed: string | null;
}

export interface SavedSearch {
    id: string;
    name: string;
    query: {
        query?: string;
        startDate?: string;
        endDate?: string;
        levels?: LogLevel[];
        sources?: string[];
    };
    userId: string;
    organizationId: string;
    createdAt: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    action: AuditLogAction;
    details: Record<string, any>;
}

export interface QueryResult {
    rows?: any[];
    columns?: string[];
    message?: string;
}

export interface LogFilter {
  key: string;
  value: any;
}

export interface DeploymentCheckpoint {
    id: string;
    version: string;
    timestamp: string;
    description: string;
    isCurrent: boolean;
}

export interface DatasetMapping {
  timestamp: string;
  level: string;
  message: string;
  source: string;
  anomalyScore?: string;
}
