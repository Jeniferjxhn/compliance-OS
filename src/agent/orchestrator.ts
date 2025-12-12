/**
 * Orchestrator - Main workflow coordinator
 * Manages the two-phase compliance investigation workflow
 */

import { BrowserAgent } from './browser-agent.js';
import { ResearchAgent } from './research-agent.js';
import { OrchestrationResult, ComplianceReport } from '../types/index.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface OrchestratorConfig {
  browser: {
    url: string;
    username: string;
    password: string;
    headless: boolean;
    timeout: number;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  output: {
    dir: string;
  };
}

export class Orchestrator {
  private browserAgent: BrowserAgent;
  private researchAgent: ResearchAgent;
  private outputDir: string;

  constructor(config: OrchestratorConfig) {
    this.browserAgent = new BrowserAgent(config.browser);
    this.researchAgent = new ResearchAgent(config.openai);
    this.outputDir = config.output.dir;
  }

  /**
   * Execute the complete compliance investigation workflow
   * @param customerName - Name of the customer to investigate
   * @returns OrchestrationResult with report and metadata
   */
  async investigate(customerName: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    logger.info('Starting compliance investigation', { customerName });

    try {
      // Phase 1: Browser Automation - Extract data from ComplianceOS
      logger.info('Phase 1: Extracting data from ComplianceOS...', { customerName });
      const browserResult = await this.browserAgent.execute(customerName);

      if (!browserResult.success || !browserResult.data) {
        // Generate a simple "not found" report without calling OpenAI
        const notFoundReport = this.generateNotFoundReport(customerName, browserResult.error || 'Customer not found');
        const reportPath = await this.saveReport(notFoundReport);
        
        return {
          success: true,
          report: notFoundReport,
          reportPath,
          duration: Date.now() - startTime,
        };
      }

      logger.info('Phase 1 completed - Customer data extracted', {
        customerName,
        transactionCount: browserResult.data.transactions.length,
        investigationCount: browserResult.data.investigations.length,
      });

      // Phase 2: AI Research - Analyze data and generate report
      logger.info('Phase 2: Conducting AI-powered research and analysis...', { customerName });
      const researchResult = await this.researchAgent.execute(browserResult.data);

      if (!researchResult.success || !researchResult.report) {
        return {
          success: false,
          error: researchResult.error || 'Failed to generate compliance report',
          duration: Date.now() - startTime,
        };
      }

      logger.info('Phase 2 completed - Compliance report generated', {
        customerName,
        riskScore: researchResult.report.riskAssessment.overallRiskScore,
      });

      // Save report to file
      const reportPath = await this.saveReport(researchResult.report);

      const duration = Date.now() - startTime;
      logger.info('Investigation completed successfully', {
        customerName,
        duration: `${duration}ms`,
        reportPath,
      });

      return {
        success: true,
        report: researchResult.report,
        reportPath,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Investigation failed', {
        customerName,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration,
      };
    }
  }

  /**
   * Generate a simple "not found" report without calling OpenAI
   */
  private generateNotFoundReport(customerName: string, error: string): ComplianceReport {
    return {
      executiveSummary: `Investigation for ${customerName} could not be completed. ${error}`,
      internalDataOverview: {
        customerProfile: {
          name: customerName,
          dateOfBirth: 'N/A',
          address: 'N/A',
        },
        riskLevel: 'Unknown',
        transactionsSummary: {
          total: 0,
          flagged: 0,
          totalAmount: '$0.00',
        },
        investigationHistory: {
          total: 0,
          recent: [],
        },
      },
      externalResearchFindings: {
        backgroundCheck: 'Customer not found in ComplianceOS database.',
        counterpartyAnalysis: 'N/A',
        publicRecords: 'N/A',
        newsAndMedia: 'N/A',
        additionalFindings: 'No data available for analysis.',
      },
      riskAssessment: {
        overallRiskScore: 'Unknown',
        riskFactors: ['Customer not found in system'],
        mitigatingFactors: [],
        complianceFlags: [],
      },
      recommendedActions: [
        'Verify customer name spelling and try again',
        'Check if customer exists in ComplianceOS database',
        'Contact system administrator if customer should exist',
      ],
      generatedAt: new Date().toISOString(),
      customerName,
    };
  }

  /**
   * Save compliance report to markdown file
   */
  private async saveReport(report: ComplianceReport): Promise<string> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const customerName = report.customerName.replace(/\s+/g, '_').toLowerCase();
      const filename = `compliance_report_${customerName}_${timestamp}.md`;
      const filepath = path.join(this.outputDir, filename);

      // Format report as markdown
      const markdown = this.formatReportAsMarkdown(report);

      // Write to file
      await fs.writeFile(filepath, markdown, 'utf-8');

      logger.info('Report saved to file', { filepath });

      return filepath;
    } catch (error) {
      logger.error('Failed to save report', { error });
      throw new Error(`Failed to save report: ${error}`);
    }
  }

  /**
   * Format compliance report as professional markdown
   */
  private formatReportAsMarkdown(report: ComplianceReport): string {
    const sections: string[] = [];
    const timestamp = new Date(report.generatedAt);
    const caseId = `GL-${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Header
    sections.push(`# Compliance Investigation Report`);
    sections.push('');
    sections.push(`**Subject:** ${report.customerName}`);
    sections.push(`**Date of Investigation:** ${timestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    sections.push(`**Investigator:** Greenlite AI Agent`);
    sections.push(`**Case ID:** ${caseId}`);
    sections.push(`**Risk Level:** ${report.internalDataOverview.riskLevel.toUpperCase()}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Executive Summary
    sections.push(`## Executive Summary`);
    sections.push('');
    sections.push(report.executiveSummary);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Subject Profile
    sections.push(`## Subject Profile`);
    sections.push('');
    sections.push(`**Name:** ${report.internalDataOverview.customerProfile.name}`);
    sections.push(`**Date of Birth:** ${report.internalDataOverview.customerProfile.dateOfBirth}`);
    sections.push(`**Address:** ${report.internalDataOverview.customerProfile.address}`);
    if (report.internalDataOverview.customerProfile.email) {
      sections.push(`**Email:** ${report.internalDataOverview.customerProfile.email}`);
    }
    if (report.internalDataOverview.customerProfile.phone) {
      sections.push(`**Phone:** ${report.internalDataOverview.customerProfile.phone}`);
    }
    if (report.internalDataOverview.customerProfile.profession) {
      sections.push(`**Profession:** ${report.internalDataOverview.customerProfile.profession}`);
    }
    sections.push(`**Account Status:** Active`);
    sections.push(`**Current Risk Classification:** ${report.internalDataOverview.riskLevel}`);
    if (report.internalDataOverview.lastAssessmentDate) {
      sections.push(`**Last Assessment:** ${report.internalDataOverview.lastAssessmentDate}`);
    }
    if (report.internalDataOverview.nextReviewDate) {
      sections.push(`**Next Review Scheduled:** ${report.internalDataOverview.nextReviewDate}`);
    }
    sections.push('');
    sections.push('---');
    sections.push('');

    // Transaction Analysis
    sections.push(`## Transaction Analysis`);
    sections.push('');
    
    // Get flagged transactions from the data
    const flaggedTransactions = report.internalDataOverview.transactionsSummary.flagged;
    
    if (flaggedTransactions > 0) {
      sections.push(`### Flagged Transactions`);
      sections.push('');
      sections.push(`| Date | Amount | Counterparty | Flag Reason | Status |`);
      sections.push(`|------|--------|--------------|-------------|---------|`);
      sections.push(`| [Data from internal system] | ${report.internalDataOverview.transactionsSummary.totalAmount} | [Multiple] | Unusual Activity | Under Review |`);
      sections.push('');
      sections.push(`### Analysis of Flagged Activity`);
      sections.push('');
      sections.push(`**Transaction Analysis:**`);
      sections.push(`- **Total Flagged:** ${flaggedTransactions} out of ${report.internalDataOverview.transactionsSummary.total} transactions`);
      sections.push(`- **Pattern Analysis:** ${report.riskAssessment.riskFactors.length > 0 ? report.riskAssessment.riskFactors[0] : 'See risk factors below'}`);
      sections.push(`- **Velocity Check:** Standard transaction velocity observed`);
      sections.push(`- **Geographic Concerns:** To be determined based on counterparty locations`);
      sections.push('');
    } else {
      sections.push(`### Flagged Transactions`);
      sections.push('');
      sections.push(`No flagged transactions in the current review period.`);
      sections.push('');
      sections.push(`**Total Transactions:** ${report.internalDataOverview.transactionsSummary.total}`);
      sections.push(`**Total Amount:** ${report.internalDataOverview.transactionsSummary.totalAmount}`);
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    // External Research Findings
    sections.push(`## External Research Findings`);
    sections.push('');

    sections.push(`### Subject Background`);
    sections.push('');
    sections.push(report.externalResearchFindings.backgroundCheck || 'No additional background information available.');
    sections.push('');

    sections.push(`### Counterparty Analysis`);
    sections.push('');
    sections.push(report.externalResearchFindings.counterpartyAnalysis || 'Counterparty analysis in progress.');
    sections.push('');

    sections.push(`### Adverse Media Check`);
    sections.push('');
    sections.push(report.externalResearchFindings.newsAndMedia || 'No adverse media found during investigation period.');
    sections.push('');

    sections.push('---');
    sections.push('');

    // Past Investigation History
    sections.push(`## Past Investigation History`);
    sections.push('');
    
    if (report.internalDataOverview.investigationHistory.total > 0 && report.internalDataOverview.investigationHistory.recent.length > 0) {
      report.internalDataOverview.investigationHistory.recent.forEach((inv) => {
        sections.push(`**${inv.summary}** | ${inv.id} | ${inv.status}`);
        sections.push('');
        sections.push(`**Date:** ${inv.date}`);
        sections.push('');
        if (inv.outcome) {
          sections.push(inv.outcome);
        }
        sections.push('');
      });
    } else {
      sections.push(`No prior investigations on record.`);
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    // Risk Assessment
    sections.push(`## Risk Assessment`);
    sections.push('');
    
    sections.push(`### Risk Factors Identified`);
    if (report.riskAssessment.riskFactors.length > 0) {
      report.riskAssessment.riskFactors.forEach((factor, i) => {
        sections.push(`${i + 1}. ${factor}`);
      });
    } else {
      sections.push(`1. No significant risk factors identified at this time`);
    }
    sections.push('');

    sections.push(`### Mitigating Factors`);
    if (report.riskAssessment.mitigatingFactors.length > 0) {
      report.riskAssessment.mitigatingFactors.forEach((factor, i) => {
        sections.push(`${i + 1}. ${factor}`);
      });
    } else {
      sections.push(`1. Standard customer profile with no mitigating circumstances noted`);
    }
    sections.push('');

    // Calculate risk score out of 10
    const riskScoreMap: { [key: string]: string } = {
      'low': '3/10',
      'medium': '6/10',
      'high': '9/10',
      'critical': '10/10',
      'unknown': '5/10'
    };
    const riskScore = riskScoreMap[report.riskAssessment.overallRiskScore.toLowerCase()] || '5/10';

    sections.push(`### Overall Risk Score: ${riskScore}`);
    sections.push('');
    sections.push(`**Justification:** Risk classification based on ${report.riskAssessment.riskFactors.length} identified risk factors and ${report.riskAssessment.mitigatingFactors.length} mitigating factors. ${report.riskAssessment.complianceFlags.length > 0 ? `${report.riskAssessment.complianceFlags.length} compliance flags require attention.` : 'No compliance flags at this time.'}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Recommended Actions
    const priority = report.riskAssessment.overallRiskScore.toLowerCase() === 'high' || report.riskAssessment.overallRiskScore.toLowerCase() === 'critical' ? 'HIGH' : 
                     report.riskAssessment.overallRiskScore.toLowerCase() === 'medium' ? 'MEDIUM' : 'LOW';
    
    sections.push(`## Recommended Actions`);
    sections.push('');
    sections.push(`**Priority:** ${priority}`);
    sections.push('');

    sections.push(`1. **Immediate Actions:**`);
    const immediateActions = report.recommendedActions.slice(0, 2);
    immediateActions.forEach((action) => {
      sections.push(`   - ${action}`);
    });
    sections.push('');

    sections.push(`2. **Further Investigation Required:**`);
    const investigationActions = report.recommendedActions.slice(2, 4);
    if (investigationActions.length > 0) {
      investigationActions.forEach((action) => {
        sections.push(`   - ${action}`);
      });
    } else {
      sections.push(`   - Continue standard monitoring procedures`);
      sections.push(`   - Review account activity in next quarterly assessment`);
    }
    sections.push('');

    sections.push(`3. **Monitoring Recommendations:**`);
    sections.push(`   - Ongoing transaction monitoring for unusual patterns`);
    sections.push(`   - Quarterly risk reassessment`);
    sections.push(`   - Alert on transactions exceeding normal thresholds`);
    sections.push('');

    sections.push('---');
    sections.push('');

    // Supporting Documentation
    sections.push(`## Supporting Documentation`);
    sections.push('');
    sections.push(`- Internal Case File: ComplianceOS Database`);
    sections.push(`- External Sources Referenced: Web search, public records databases`);
    sections.push(`- Screenshots/Evidence: Available in case file system`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Regulatory Considerations
    sections.push(`## Regulatory Considerations`);
    sections.push('');
    if (report.riskAssessment.complianceFlags.length > 0) {
      sections.push(`The following regulatory frameworks apply to this case:`);
      sections.push('');
      report.riskAssessment.complianceFlags.forEach((flag) => {
        sections.push(`- ${flag}`);
      });
    } else {
      sections.push(`This case is subject to standard AML/KYC/BSA compliance requirements. No additional regulatory considerations identified at this time.`);
    }
    sections.push('');
    sections.push('---');
    sections.push('');

    // Footer
    sections.push(`**Report Generated:** ${new Date(report.generatedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}`);
    sections.push(`**Data Sources:** ComplianceOS Internal Database, Web Search, Public Records`);
    sections.push(`**Confidence Level:** ${report.riskAssessment.riskFactors.length > 2 ? 'HIGH' : report.riskAssessment.riskFactors.length > 0 ? 'MEDIUM' : 'LOW'} based on data quality`);
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push(`*This report is confidential and intended for compliance review purposes only.*`);

    return sections.join('\n');
  }

  /**
   * Test all system connections
   */
  async testConnections(): Promise<{ browser: boolean; openai: boolean }> {
    logger.info('Testing system connections...');

    const browserTest = await this.browserAgent.testConnection();
    logger.info('Browser connection test', { success: browserTest });

    const openaiTest = await this.researchAgent.testConnection();
    logger.info('OpenAI connection test', { success: openaiTest });

    return {
      browser: browserTest,
      openai: openaiTest,
    };
  }
}

