/**
 * OpenAI service for AI-powered compliance research and analysis
 * Uses OpenAI API with web search capabilities
 */

import OpenAI from 'openai';
import { CustomerData, ComplianceReport, ExternalResearchSection, RiskAssessmentSection } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  /**
   * Generate comprehensive compliance report using AI analysis
   */
  async generateComplianceReport(customerData: CustomerData): Promise<ComplianceReport> {
    try {
      logger.info('Generating compliance report...', { 
        customer: customerData.personalInfo.name 
      });

      // Prepare the context for AI analysis
      const context = this.prepareAnalysisContext(customerData);

      // Generate external research findings
      const externalResearch = await this.conductExternalResearch(customerData, context);

      // Generate risk assessment
      const riskAssessment = await this.generateRiskAssessment(customerData, externalResearch);

      // Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(
        customerData, 
        externalResearch, 
        riskAssessment
      );

      // Generate recommended actions
      const recommendedActions = await this.generateRecommendedActions(
        customerData,
        riskAssessment
      );

      const report: ComplianceReport = {
        executiveSummary,
        internalDataOverview: {
          customerProfile: customerData.personalInfo,
          riskLevel: customerData.riskLevel,
          lastAssessmentDate: customerData.lastAssessmentDate,
          nextReviewDate: customerData.nextReviewDate,
          transactionsSummary: {
            total: customerData.transactions.length,
            flagged: customerData.transactions.filter(t => t.flagged).length,
            totalAmount: this.calculateTotalAmount(customerData.transactions),
          },
          investigationHistory: {
            total: customerData.investigations.length,
            recent: customerData.investigations.slice(0, 3),
          },
        },
        externalResearchFindings: externalResearch,
        riskAssessment,
        recommendedActions,
        generatedAt: new Date().toISOString(),
        customerName: customerData.personalInfo.name,
      };

      logger.info('Compliance report generated successfully', {
        customer: customerData.personalInfo.name,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', { error });
      throw new Error(`Report generation failed: ${error}`);
    }
  }

  /**
   * Prepare analysis context from customer data
   */
  private prepareAnalysisContext(customerData: CustomerData): string {
    const flaggedTransactions = customerData.transactions.filter(t => t.flagged);
    const counterparties = [...new Set(customerData.transactions.map(t => t.counterparty))];

    return `
Customer Profile:
- Name: ${customerData.personalInfo.name}
- Date of Birth: ${customerData.personalInfo.dateOfBirth}
- Address: ${customerData.personalInfo.address}
- Risk Level: ${customerData.riskLevel}

Transaction Summary:
- Total Transactions: ${customerData.transactions.length}
- Flagged Transactions: ${flaggedTransactions.length}
- Unique Counterparties: ${counterparties.length}

Flagged Transactions:
${flaggedTransactions.map(t => `
  - Date: ${t.date}
  - Amount: ${t.amount}
  - Counterparty: ${t.counterparty}
  - Reason: ${t.flagReason || 'Not specified'}
`).join('\n')}

Recent Investigations:
${customerData.investigations.map(inv => `
  - Date: ${inv.date}
  - Status: ${inv.status}
  - Summary: ${inv.summary}
`).join('\n')}

Key Counterparties:
${counterparties.slice(0, 10).join(', ')}
    `.trim();
  }

  /**
   * Conduct external research using OpenAI with web search
   */
  private async conductExternalResearch(
    customerData: CustomerData,
    context: string
  ): Promise<ExternalResearchSection> {
    logger.info('Conducting external research...', {
      customer: customerData.personalInfo.name,
    });

    const prompt = `
You are a compliance analyst conducting a thorough investigation. Based on the following internal customer data, conduct external research to uncover any relevant information that may impact the compliance assessment.

${context}

Please provide comprehensive research findings in the following areas:

1. BACKGROUND CHECK: Research the customer's public profile, business affiliations, and any relevant news or media mentions. Look for any red flags or notable associations.

2. COUNTERPARTY ANALYSIS: Investigate the key counterparties involved in flagged transactions. Are any of them known for suspicious activities, sanctioned entities, or high-risk jurisdictions?

3. PUBLIC RECORDS: Search for any legal proceedings, regulatory actions, or compliance violations associated with this customer.

4. NEWS AND MEDIA: Look for recent news articles, press releases, or media coverage that might be relevant to the customer's risk profile.

5. ADDITIONAL FINDINGS: Any other relevant information discovered during the research.

Format your response as a professional compliance research report. Be thorough but concise. Focus on facts and actionable intelligence.
    `.trim();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert compliance analyst with deep knowledge of financial regulations, AML procedures, and risk assessment. You conduct thorough, professional investigations and provide actionable intelligence.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse the response into structured sections
      return this.parseExternalResearch(content);
    } catch (error) {
      logger.error('External research failed', { error });
      throw error;
    }
  }

  /**
   * Parse AI response into structured external research sections
   */
  private parseExternalResearch(content: string): ExternalResearchSection {
    // Simple parsing - look for section headers and extract content
    const sections: ExternalResearchSection = {
      backgroundCheck: '',
      counterpartyAnalysis: '',
      publicRecords: '',
      newsAndMedia: '',
      additionalFindings: '',
    };

    const sectionMap = {
      'BACKGROUND CHECK': 'backgroundCheck',
      'COUNTERPARTY ANALYSIS': 'counterpartyAnalysis',
      'PUBLIC RECORDS': 'publicRecords',
      'NEWS AND MEDIA': 'newsAndMedia',
      'ADDITIONAL FINDINGS': 'additionalFindings',
    };

    let currentSection = '';
    let currentContent: string[] = [];

    const lines = content.split('\n');
    
    for (const line of lines) {
      // Check if line is a section header
      let foundHeader = false;
      for (const [header, key] of Object.entries(sectionMap)) {
        if (line.toUpperCase().includes(header)) {
          // Save previous section
          if (currentSection && currentContent.length > 0) {
            sections[currentSection as keyof ExternalResearchSection] = currentContent.join('\n').trim();
          }
          // Start new section
          currentSection = key;
          currentContent = [];
          foundHeader = true;
          break;
        }
      }

      if (!foundHeader && currentSection && line.trim()) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection as keyof ExternalResearchSection] = currentContent.join('\n').trim();
    }

    // If sections are empty, put all content in additionalFindings
    if (!sections.backgroundCheck && !sections.counterpartyAnalysis) {
      sections.additionalFindings = content;
    }

    return sections;
  }

  /**
   * Generate risk assessment based on all available data
   */
  private async generateRiskAssessment(
    customerData: CustomerData,
    externalResearch: ExternalResearchSection
  ): Promise<RiskAssessmentSection> {
    logger.info('Generating risk assessment...', {
      customer: customerData.personalInfo.name,
    });

    const prompt = `
Based on the following customer data and external research findings, provide a comprehensive risk assessment.

INTERNAL DATA:
- Risk Level: ${customerData.riskLevel}
- Flagged Transactions: ${customerData.transactions.filter(t => t.flagged).length} out of ${customerData.transactions.length}
- Past Investigations: ${customerData.investigations.length}

EXTERNAL RESEARCH:
Background: ${externalResearch.backgroundCheck}
Counterparties: ${externalResearch.counterpartyAnalysis}
Public Records: ${externalResearch.publicRecords}
News: ${externalResearch.newsAndMedia}

Provide:
1. Overall Risk Score (Low/Medium/High/Critical)
2. Key Risk Factors (list 3-5 specific concerns)
3. Mitigating Factors (any factors that reduce risk)
4. Compliance Flags (specific regulatory or compliance issues)

Be specific and actionable. Focus on facts.
    `.trim();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert risk analyst specializing in compliance and AML. You provide clear, actionable risk assessments.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      return this.parseRiskAssessment(content);
    } catch (error) {
      logger.error('Risk assessment failed', { error });
      throw error;
    }
  }

  /**
   * Parse risk assessment from AI response
   */
  private parseRiskAssessment(content: string): RiskAssessmentSection {
    const assessment: RiskAssessmentSection = {
      overallRiskScore: 'Medium',
      riskFactors: [],
      mitigatingFactors: [],
      complianceFlags: [],
    };

    const lines = content.split('\n');
    let currentList: 'risk' | 'mitigating' | 'compliance' | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Extract risk score
      if (trimmedLine.match(/risk score|overall risk/i)) {
        const match = trimmedLine.match(/(Low|Medium|High|Critical)/i);
        if (match) {
          assessment.overallRiskScore = match[1];
        }
      }

      // Detect list sections
      if (trimmedLine.match(/risk factors?/i)) {
        currentList = 'risk';
      } else if (trimmedLine.match(/mitigating factors?/i)) {
        currentList = 'mitigating';
      } else if (trimmedLine.match(/compliance flags?/i)) {
        currentList = 'compliance';
      }

      // Extract list items
      if (trimmedLine.match(/^[-*•]\s+(.+)/) || trimmedLine.match(/^\d+\.\s+(.+)/)) {
        const match = trimmedLine.match(/^[-*•\d.]+\s+(.+)/);
        if (match && currentList) {
          const item = match[1].trim();
          if (currentList === 'risk') {
            assessment.riskFactors.push(item);
          } else if (currentList === 'mitigating') {
            assessment.mitigatingFactors.push(item);
          } else if (currentList === 'compliance') {
            assessment.complianceFlags.push(item);
          }
        }
      }
    }

    return assessment;
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(
    customerData: CustomerData,
    _externalResearch: ExternalResearchSection,
    riskAssessment: RiskAssessmentSection
  ): Promise<string> {
    logger.info('Generating executive summary...');

    const prompt = `
Generate a concise executive summary (3-4 paragraphs) for a compliance report on ${customerData.personalInfo.name}.

Key Information:
- Risk Level: ${customerData.riskLevel}
- Overall Risk Score: ${riskAssessment.overallRiskScore}
- Flagged Transactions: ${customerData.transactions.filter(t => t.flagged).length}
- Key Risk Factors: ${riskAssessment.riskFactors.join('; ')}

The summary should:
1. Provide a high-level overview of the customer and their risk profile
2. Highlight the most critical findings
3. State the recommended risk level
4. Be suitable for senior management review

Write in a professional, objective tone. No emojis or casual language.
    `.trim();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior compliance officer writing executive summaries for management.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Executive summary generation failed', { error });
      throw error;
    }
  }

  /**
   * Generate recommended actions
   */
  private async generateRecommendedActions(
    _customerData: CustomerData,
    riskAssessment: RiskAssessmentSection
  ): Promise<string[]> {
    logger.info('Generating recommended actions...');

    const prompt = `
Based on the risk assessment, provide 3-5 specific, actionable recommendations for the compliance team.

Risk Score: ${riskAssessment.overallRiskScore}
Risk Factors: ${riskAssessment.riskFactors.join('; ')}
Compliance Flags: ${riskAssessment.complianceFlags.join('; ')}

Each recommendation should be:
- Specific and actionable
- Prioritized by importance
- Practical to implement

Format as a numbered list.
    `.trim();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a compliance expert providing actionable recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse into array
      const actions: string[] = [];
      const lines = content.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^\d+\.\s+(.+)/);
        if (match) {
          actions.push(match[1].trim());
        }
      }

      return actions.length > 0 ? actions : ['Continue monitoring customer activity', 'Review flagged transactions', 'Update risk assessment quarterly'];
    } catch (error) {
      logger.error('Recommended actions generation failed', { error });
      throw error;
    }
  }

  /**
   * Calculate total transaction amount
   */
  private calculateTotalAmount(transactions: { amount: string }[]): string {
    try {
      const total = transactions.reduce((sum, t) => {
        const amount = parseFloat(t.amount.replace(/[^0-9.-]+/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      return `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
      return 'N/A';
    }
  }
}

