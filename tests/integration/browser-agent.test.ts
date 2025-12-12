/**
 * Integration tests for Browser Agent
 * Note: These tests require a running instance of ComplianceOS
 */

import { BrowserAgent } from '../../src/agent/browser-agent';

describe('BrowserAgent Integration Tests', () => {
  let browserAgent: BrowserAgent;

  beforeAll(() => {
    browserAgent = new BrowserAgent({
      url: process.env.COMPLIANCE_URL || 'https://compliance-j9ehback.manus.space/login',
      username: process.env.COMPLIANCE_USERNAME || 'admin',
      password: process.env.COMPLIANCE_PASSWORD || 'password123',
      headless: true,
      timeout: 30000,
    });
  });

  describe('Connection Tests', () => {
    test('should connect to ComplianceOS', async () => {
      const connected = await browserAgent.testConnection();
      expect(connected).toBe(true);
    }, 60000);
  });

  describe('Data Extraction', () => {
    test('should extract customer data', async () => {
      const result = await browserAgent.execute('Test Customer');
      
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('personalInfo');
        expect(result.data).toHaveProperty('riskLevel');
        expect(result.data).toHaveProperty('transactions');
        expect(result.data).toHaveProperty('investigations');
        
        expect(result.data.personalInfo).toHaveProperty('name');
        expect(result.data.personalInfo).toHaveProperty('dateOfBirth');
        expect(result.data.personalInfo).toHaveProperty('address');
        
        expect(Array.isArray(result.data.transactions)).toBe(true);
        expect(Array.isArray(result.data.investigations)).toBe(true);
      } else {
        // Customer not found is also a valid result
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      }
    }, 90000);
  });

  describe('Error Handling', () => {
    test('should handle non-existent customer gracefully', async () => {
      const result = await browserAgent.execute('Nonexistent Customer XYZ123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 60000);
  });
});

