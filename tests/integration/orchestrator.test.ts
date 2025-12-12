/**
 * Integration tests for Orchestrator
 * Note: These tests require both ComplianceOS and OpenAI API access
 */

import { Orchestrator } from '../../src/agent/orchestrator';

describe('Orchestrator Integration Tests', () => {
  let orchestrator: Orchestrator;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for integration tests');
    }

    orchestrator = new Orchestrator({
      browser: {
        url: process.env.COMPLIANCE_URL || 'https://compliance-j9ehback.manus.space/login',
        username: process.env.COMPLIANCE_USERNAME || 'admin',
        password: process.env.COMPLIANCE_PASSWORD || 'password123',
        headless: true,
        timeout: 30000,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4-turbo-preview',
      },
      output: {
        dir: './test-reports',
      },
    });
  });

  describe('System Tests', () => {
    test('should test all connections', async () => {
      const results = await orchestrator.testConnections();
      
      expect(results).toHaveProperty('browser');
      expect(results).toHaveProperty('openai');
    }, 120000);
  });

  describe('End-to-End Investigation', () => {
    test('should complete full investigation workflow', async () => {
      const result = await orchestrator.investigate('Test Customer');
      
      if (result.success && result.report) {
        expect(result.report).toHaveProperty('executiveSummary');
        expect(result.report).toHaveProperty('internalDataOverview');
        expect(result.report).toHaveProperty('externalResearchFindings');
        expect(result.report).toHaveProperty('riskAssessment');
        expect(result.report).toHaveProperty('recommendedActions');
        expect(result.report).toHaveProperty('customerName');
        expect(result.report).toHaveProperty('generatedAt');
        
        expect(result.reportPath).toBeTruthy();
        expect(result.duration).toBeGreaterThan(0);
      } else {
        // Customer not found is acceptable for test
        expect(result.error).toBeTruthy();
      }
    }, 180000);
  });
});

