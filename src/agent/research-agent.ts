/**
 * Research Agent - Orchestrates AI-powered compliance research
 * High-level interface for OpenAI-based analysis
 */

import { OpenAIService } from '../services/openai.service.js';
import { CustomerData, ResearchAgentResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ResearchAgentConfig {
  apiKey: string;
  model: string;
}

export class ResearchAgent {
  private openaiService: OpenAIService;

  constructor(config: ResearchAgentConfig) {
    this.openaiService = new OpenAIService(config);
  }

  /**
   * Execute the research and analysis workflow
   * @param customerData - Customer data from ComplianceOS
   * @returns ResearchAgentResult with compliance report or error
   */
  async execute(customerData: CustomerData): Promise<ResearchAgentResult> {
    const startTime = Date.now();
    logger.info('Starting AI research workflow', {
      customer: customerData.personalInfo.name,
      riskLevel: customerData.riskLevel,
      transactionCount: customerData.transactions.length,
    });

    try {
      // Generate comprehensive compliance report
      const report = await this.openaiService.generateComplianceReport(customerData);
      
      const duration = Date.now() - startTime;
      logger.info('Research workflow completed successfully', {
        customer: customerData.personalInfo.name,
        duration: `${duration}ms`,
        riskScore: report.riskAssessment.overallRiskScore,
      });

      return {
        success: true,
        report,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Research workflow failed', {
        customer: customerData.personalInfo.name,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Test OpenAI API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Create a minimal test request
      const testData: CustomerData = {
        personalInfo: {
          name: 'Test Customer',
          dateOfBirth: '1990-01-01',
          address: 'Test Address',
        },
        riskLevel: 'Low',
        transactions: [],
        investigations: [],
      };

      const result = await this.execute(testData);
      return result.success;
    } catch (error) {
      logger.error('OpenAI connection test failed', { error });
      return false;
    }
  }
}

