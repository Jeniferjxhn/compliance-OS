/**
 * Browser Agent - Orchestrates ComplianceOS data extraction
 * High-level interface for browser automation tasks
 */

import { ComplianceOSService } from '../services/complianceOS.service.js';
import { BrowserAgentResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface BrowserAgentConfig {
  url: string;
  username: string;
  password: string;
  headless: boolean;
  timeout: number;
}

export class BrowserAgent {
  private complianceService: ComplianceOSService;

  constructor(config: BrowserAgentConfig) {
    this.complianceService = new ComplianceOSService(config);
  }

  /**
   * Execute the browser automation workflow
   * @param customerName - Name of the customer to investigate
   * @returns BrowserAgentResult with customer data or error
   */
  async execute(customerName: string): Promise<BrowserAgentResult> {
    const startTime = Date.now();
    logger.info('Starting browser automation workflow', { customerName });

    try {
      // Initialize browser
      await this.complianceService.initialize();
      logger.info('Browser initialized');

      // Login to ComplianceOS
      await this.complianceService.login();
      logger.info('Successfully authenticated');

      // Search for customer
      const found = await this.complianceService.searchCustomer(customerName);
      
      if (!found) {
        logger.warn('Customer not found', { customerName });
        return {
          success: false,
          error: `Customer "${customerName}" not found in ComplianceOS`,
        };
      }

      // Extract customer data
      const customerData = await this.complianceService.extractCustomerData();
      
      const duration = Date.now() - startTime;
      logger.info('Browser automation completed successfully', {
        customerName,
        duration: `${duration}ms`,
        transactionCount: customerData.transactions.length,
        investigationCount: customerData.investigations.length,
      });

      return {
        success: true,
        data: customerData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Browser automation failed', {
        customerName,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      // Always cleanup browser resources
      await this.complianceService.cleanup();
      logger.debug('Browser resources cleaned up');
    }
  }

  /**
   * Test connection to ComplianceOS
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.complianceService.initialize();
      await this.complianceService.login();
      await this.complianceService.cleanup();
      return true;
    } catch (error) {
      logger.error('Connection test failed', { error });
      await this.complianceService.cleanup();
      return false;
    }
  }
}

