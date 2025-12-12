/**
 * Core type definitions for the Greenlite Compliance Agent
 */

export interface CustomerData {
  personalInfo: PersonalInfo;
  riskLevel: string;
  transactions: Transaction[];
  investigations: Investigation[];
}

export interface PersonalInfo {
  name: string;
  dateOfBirth: string;
  address: string;
  customerId?: string;
  email?: string;
  phone?: string;
  profession?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: string;
  counterparty: string;
  type: string;
  status: string;
  flagged?: boolean;
  flagReason?: string;
  description?: string;
}

export interface Investigation {
  id: string;
  date: string;
  status: string;
  investigator: string;
  summary: string;
  outcome?: string;
}

export interface ComplianceReport {
  executiveSummary: string;
  internalDataOverview: InternalDataSection;
  externalResearchFindings: ExternalResearchSection;
  riskAssessment: RiskAssessmentSection;
  recommendedActions: string[];
  generatedAt: string;
  customerName: string;
}

export interface InternalDataSection {
  customerProfile: PersonalInfo;
  riskLevel: string;
  transactionsSummary: {
    total: number;
    flagged: number;
    totalAmount: string;
  };
  investigationHistory: {
    total: number;
    recent: Investigation[];
  };
}

export interface ExternalResearchSection {
  backgroundCheck: string;
  counterpartyAnalysis: string;
  publicRecords: string;
  newsAndMedia: string;
  additionalFindings: string;
}

export interface RiskAssessmentSection {
  overallRiskScore: string;
  riskFactors: string[];
  mitigatingFactors: string[];
  complianceFlags: string[];
}

export interface Config {
  openai: {
    apiKey: string;
    model: string;
  };
  compliance: {
    url: string;
    username: string;
    password: string;
  };
  browser: {
    headless: boolean;
    timeout: number;
  };
  logging: {
    level: string;
  };
  output: {
    dir: string;
  };
}

export interface BrowserAgentResult {
  success: boolean;
  data?: CustomerData;
  error?: string;
  screenshots?: string[];
}

export interface ResearchAgentResult {
  success: boolean;
  report?: ComplianceReport;
  error?: string;
}

export interface OrchestrationResult {
  success: boolean;
  report?: ComplianceReport;
  reportPath?: string;
  error?: string;
  duration: number;
}

export interface LoggerContext {
  module?: string;
  action?: string;
  customerId?: string;
  [key: string]: string | number | boolean | undefined;
}

