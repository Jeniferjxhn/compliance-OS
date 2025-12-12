/**
 * ComplianceOS browser automation service using Playwright Handles authentication, navigation, and data extraction
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { CustomerData, Transaction, Investigation, PersonalInfo } from '../types/index.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ComplianceOSConfig {
  url: string;
  username: string;
  password: string;
  headless: boolean;
  timeout: number;
}

export class ComplianceOSService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ComplianceOSConfig;
  private screenshotDir: string = './screenshots';

  constructor(config: ComplianceOSConfig) {
    this.config = config;
  }

  /**
   * Initialize browser and create context
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing browser...', { headless: this.config.headless });
      
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(this.config.timeout);

      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser', { error });
      throw new Error(`Browser initialization failed: ${error}`);
    }
  }

  /**
   * Authenticate with ComplianceOS
   */
  async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      logger.info('Logging into ComplianceOS...', { url: this.config.url });

      // Navigate to login page
      await this.page.goto(this.config.url, { waitUntil: 'networkidle' });
      
      // Wait for login form to be visible
      await this.page.waitForSelector('input[type="text"], input[name="username"], input[id*="user"]', {
        state: 'visible',
        timeout: 10000,
      });

      // Find and fill username field
      const usernameField = await this.page.locator(
        'input[type="text"], input[name="username"], input[id*="user"]'
      ).first();
      await usernameField.fill(this.config.username);
      logger.debug('Username field filled');

      // Find and fill password field
      const passwordField = await this.page.locator(
        'input[type="password"], input[name="password"], input[id*="pass"]'
      ).first();
      await passwordField.fill(this.config.password);
      logger.debug('Password field filled');

      // Submit login form
      const submitButton = await this.page.locator(
        'button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), input[type="submit"]'
      ).first();
      
      await submitButton.click();
      logger.debug('Login form submitted');

      // Wait for navigation after login
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });

      // Verify successful login by checking for dashboard elements or URL change
      const currentUrl = this.page.url();
      if (currentUrl.includes('login')) {
        // Check for error messages
        const errorMessage = await this.page.locator('.error, .alert-danger, [role="alert"]').textContent().catch(() => null);
        if (errorMessage) {
          throw new Error(`Login failed: ${errorMessage}`);
        }
        throw new Error('Login failed: Still on login page');
      }

      logger.info('Successfully logged into ComplianceOS', { url: currentUrl });
    } catch (error) {
      await this.captureScreenshot('login-error');
      logger.error('Login failed', { error });
      throw new Error(`Login failed: ${error}`);
    }
  }

  /**
   * Search for a customer by name
   */
  async searchCustomer(customerName: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Searching for customer...', { customerName });

      // Wait a moment for page to be fully ready
      await this.page.waitForLoadState('domcontentloaded');
      
      // Look for search input field - try multiple strategies
      let searchInput = null;
      
      // Strategy 1: Look for common search input patterns
      try {
        searchInput = this.page.locator('input[type="search"], input[placeholder*="Search"], input[name*="search"], input[id*="search"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 3000 });
      } catch {
        // Strategy 2: Look for any visible text input
        searchInput = this.page.locator('input[type="text"]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 3000 });
      }

      await searchInput.fill(customerName);
      logger.debug('Search query entered');

      // Try to click search button or press Enter
      try {
        const searchButton = this.page.locator('button:has-text("Search"), button[type="submit"], button:has-text("Go")').first();
        await searchButton.click({ timeout: 2000 });
      } catch {
        await searchInput.press('Enter');
      }

      // Wait for navigation or results - give extra time for React/dynamic content
      await this.page.waitForTimeout(3000);
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Take screenshot for debugging
      await this.captureScreenshot('after-search');

      // Check if we landed on a customer profile page directly
      const currentUrl = this.page.url();
      logger.debug('Current URL after search', { url: currentUrl });
      
      if (currentUrl.includes('/customer') || currentUrl.includes('/profile') || currentUrl.includes(customerName.replace(' ', '-'))) {
        logger.info('Landed directly on customer profile', { url: currentUrl });
        return true;
      }

      // Log all visible text on page
      const pageText = await this.page.textContent('body').catch(() => null);
      const hasCustomerName = pageText ? pageText.toLowerCase().includes(customerName.toLowerCase()) : false;
      
      logger.debug('Page analysis', { 
        url: currentUrl,
        hasCustomerName,
        pageLength: pageText ? pageText.length : 0
      });

      // Check if results are present
      const hasTable = await this.page.locator('table').isVisible().catch(() => false);
      const hasRows = await this.page.locator('table tbody tr').count().catch(() => 0);
      const allRows = await this.page.locator('table tbody tr').count().catch(() => 0);
      
      logger.debug('Search results check', { hasTable, hasRows, allRows });

      // Try to find and click the customer name anywhere on the page
      if (hasCustomerName) {
        logger.debug('Customer name found on page, attempting to click');
        
        // Try various selectors
        const selectors = [
          `a:text-is("${customerName}")`,
          `a:has-text("${customerName}")`,
          `tr:has-text("${customerName}") a`,
          `tr:has-text("${customerName}")`,
          `div:has-text("${customerName}") a`,
          `button:has-text("${customerName}")`,
          `[role="button"]:has-text("${customerName}")`,
        ];

        for (const selector of selectors) {
          try {
            const element = this.page.locator(selector).first();
            const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
            
            if (isVisible) {
              logger.debug('Found clickable element', { selector });
              await element.click();
              await this.page.waitForLoadState('networkidle', { timeout: 10000 });
              logger.info('Customer profile loaded', { customerName, selector });
              return true;
            }
          } catch (e) {
            // Try next selector
          }
        }
      }

      // If no table and customer not found, fail
      if (!hasTable || hasRows === 0) {
        logger.warn('No search results found', { customerName, hasTable, hasRows });
        return false;
      }

      // Click on the first result
      const firstRow = this.page.locator('table tbody tr').first();
      
      // Try clicking on a link within the row first
      const linkInRow = firstRow.locator('a').first();
      const hasLink = await linkInRow.count() > 0;
      
      if (hasLink) {
        await linkInRow.click();
      } else {
        // Click the row itself
        await firstRow.click();
      }
      
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });

      logger.info('Customer profile loaded', { customerName });
      return true;
    } catch (error) {
      await this.captureScreenshot('search-error');
      logger.error('Customer search failed', { error, customerName });
      throw new Error(`Customer search failed: ${error}`);
    }
  }

  /**
   * Extract customer data from the profile page
   */
  async extractCustomerData(): Promise<CustomerData> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info('Extracting customer data...');

      // Take screenshot of customer profile page for debugging
      await this.captureScreenshot('customer-profile');

      // Extract personal information
      const personalInfo = await this.extractPersonalInfo();
      logger.debug('Personal info extracted', { name: personalInfo.name });

      // Extract risk level
      const riskLevel = await this.extractRiskLevel();
      logger.debug('Risk level extracted', { riskLevel });

      // Extract transactions
      const transactions = await this.extractTransactions();
      logger.debug('Transactions extracted', { count: transactions.length });

      // Extract investigations
      const investigations = await this.extractInvestigations();
      logger.debug('Investigations extracted', { count: investigations.length });

      const customerData: CustomerData = {
        personalInfo,
        riskLevel,
        transactions,
        investigations,
      };

      logger.info('Customer data extraction completed', {
        name: personalInfo.name,
        transactionCount: transactions.length,
        investigationCount: investigations.length,
      });

      return customerData;
    } catch (error) {
      await this.captureScreenshot('extraction-error');
      logger.error('Data extraction failed', { error });
      throw new Error(`Data extraction failed: ${error}`);
    }
  }

  /**
   * Extract personal information from the profile
   */
  private async extractPersonalInfo(): Promise<PersonalInfo> {
    if (!this.page) {
      throw new Error('Page not available');
    }

    const personalInfo: PersonalInfo = {
      name: '',
      dateOfBirth: '',
      address: '',
    };

    // Extract name
    personalInfo.name = await this.page.locator(
      'h1, h2, .customer-name, [data-testid*="name"]'
    ).first().textContent().catch(() => '') || '';

    // Extract DOB
    personalInfo.dateOfBirth = await this.extractFieldValue([
      'Date of Birth', 'DOB', 'Birth Date', 'dob'
    ]);

    // Extract address
    personalInfo.address = await this.extractFieldValue([
      'Address', 'Location', 'Residence'
    ]);

    // Extract optional fields
    personalInfo.email = await this.extractFieldValue(['Email', 'E-mail']);
    personalInfo.phone = await this.extractFieldValue(['Phone', 'Telephone', 'Mobile']);
    personalInfo.customerId = await this.extractFieldValue(['Customer ID', 'ID', 'Account Number']);

    return personalInfo;
  }

  /**
   * Helper to extract field values by label
   */
  private async extractFieldValue(labels: string[]): Promise<string> {
    if (!this.page) {
      return '';
    }

    for (const label of labels) {
      try {
        // Try different patterns to find the field
        const patterns = [
          `text="${label}"`,
          `text=/.*${label}.*/i`,
          `[data-testid*="${label.toLowerCase()}"]`,
          `label:has-text("${label}")`,
        ];

        for (const pattern of patterns) {
          const element = await this.page.locator(pattern).first();
          if (await element.isVisible().catch(() => false)) {
            // Get the value from the next sibling or parent's next sibling
            const value = await element.locator('xpath=following-sibling::*[1]')
              .textContent()
              .catch(() => null);
            
            if (value) {
              return value.trim();
            }

            // Try parent's next sibling
            const parentValue = await element.locator('xpath=..')
              .locator('xpath=following-sibling::*[1]')
              .textContent()
              .catch(() => null);
            
            if (parentValue) {
              return parentValue.trim();
            }
          }
        }
      } catch (error) {
        // Continue trying other labels
      }
    }

    return '';
  }

  /**
   * Extract risk level
   */
  private async extractRiskLevel(): Promise<string> {
    if (!this.page) {
      return 'Unknown';
    }

    const riskLevel = await this.extractFieldValue([
      'Risk Level', 'Risk', 'Risk Score', 'Risk Rating'
    ]);

    // Parse the risk level from text that might contain extra content
    // e.g., "Current Levelmedium RiskLast assessment..." -> "Medium"
    if (riskLevel) {
      const lowercaseText = riskLevel.toLowerCase();
      
      // Check for risk level keywords
      if (lowercaseText.includes('high') || lowercaseText.includes('critical')) {
        return 'High';
      } else if (lowercaseText.includes('medium') || lowercaseText.includes('moderate')) {
        return 'Medium';
      } else if (lowercaseText.includes('low') || lowercaseText.includes('minimal')) {
        return 'Low';
      }
      
      // Return cleaned version if no keyword found
      return riskLevel.trim();
    }

    return 'Unknown';
  }

  /**
   * Extract transaction history
   */
  private async extractTransactions(): Promise<Transaction[]> {
    if (!this.page) {
      return [];
    }

    try {
      // Wait for page to fully load
      await this.page.waitForTimeout(2000);
      
      const transactions: Transaction[] = [];
      
      // Look for the "Recent Transactions" heading
      const transactionHeading = await this.page.locator('text="Recent Transactions"').first();
      const headingExists = await transactionHeading.isVisible().catch(() => false);
      
      logger.info('Transaction section check', { headingExists });
      
      if (headingExists) {
        // Get the parent container (the whole card/section)
        const container = await transactionHeading.locator('../..').first();
        const containerText = await container.textContent() || '';
        
        logger.info('Transaction container text', { 
          length: containerText.length,
          preview: containerText.substring(0, 150)
        });
        
        // Parse transactions using regex since everything is concatenated
        // Pattern: YYYY-MM-DD followed by merchant name, category, and amount
        // Example: "2024-01-15Best BuyElectronics$4500.00"
        // Use a more specific pattern: date, then non-digit text, then amount (ending at next digit or end)
        const transactionPattern = /(\d{4}-\d{2}-\d{2})([^$\d]+?)(\$[\d,]+\.\d{2})(?=\d{4}|$)/g;
        
        let match;
        while ((match = transactionPattern.exec(containerText)) !== null) {
          const [_, date, merchantAndCategory, amount] = match;
          
          // Try to split merchant and category
          // Usually the last word before the amount is the category
          const parts = merchantAndCategory.trim().split(/(?=[A-Z])/); // Split on capital letters
          const merchant = parts.slice(0, -1).join('').trim() || merchantAndCategory.trim();
          const category = parts[parts.length - 1]?.trim() || 'Transfer';
          
          const transaction: Transaction = {
            id: `TXN-${transactions.length + 1}`,
            date,
            amount,
            counterparty: merchant || 'Unknown',
            type: category,
            status: 'Completed',
            flagged: merchant.toLowerCase().includes('crypto') || parseFloat(amount.replace(/[$,]/g, '')) > 10000,
          };
          
          transactions.push(transaction);
          logger.info('Transaction parsed', { date, merchant, category, amount });
        }
      }

      logger.info('Transactions extracted', { count: transactions.length });
      return transactions;
    } catch (error) {
      logger.warn('Failed to extract transactions', { error });
      return [];
    }
  }

  /**
   * Extract investigation history
   */
  private async extractInvestigations(): Promise<Investigation[]> {
    if (!this.page) {
      return [];
    }

    try {
      const investigations: Investigation[] = [];
      
      // Look for the "Past Investigations" heading
      const investigationHeading = await this.page.locator('text="Past Investigations"').first();
      const headingExists = await investigationHeading.isVisible().catch(() => false);
      
      logger.info('Investigation section check', { headingExists });
      
      if (headingExists) {
        // Get the parent container (the whole card/section)
        const container = await investigationHeading.locator('../..').first();
        const containerText = await container.textContent() || '';
        
        logger.info('Investigation container text', { 
          length: containerText.length,
          preview: containerText.substring(0, 150)
        });
        
        // Parse investigations using regex since everything is concatenated
        // Pattern: Title text, then INV-YYYY-NNN, then date, then status
        // Example: "Unusual transaction volumeINV-2023-0012023-11-15closed"
        const investigationPattern = /(INV-\d{4}-\d{3})(\d{4}-\d{2}-\d{2})(closed|open)/gi;
        
        let match;
        while ((match = investigationPattern.exec(containerText)) !== null) {
          const [fullMatch, invId, date, status] = match;
          
          // Find the title by looking backwards from the match position
          const matchIndex = match.index;
          const textBeforeMatch = containerText.substring(0, matchIndex);
          
          // Extract the last meaningful phrase before the INV ID
          // Split by common separators and take the last chunk
          const titleCandidates = textBeforeMatch.split(/(?=[A-Z][a-z])|alerts|checks/);
          const title = titleCandidates[titleCandidates.length - 1]?.trim() || 'Investigation';
          
          // Clean up the title - remove common noise words
          const cleanTitle = title
            .replace(/^(Past Investigations|History of compliance|checks and|alerts)/gi, '')
            .trim() || 'Compliance Investigation';
          
          const investigation: Investigation = {
            id: invId,
            date,
            status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
            investigator: 'Compliance Officer',
            summary: cleanTitle,
          };
          
          investigations.push(investigation);
          logger.info('Investigation parsed', { id: invId, title: cleanTitle, status, date });
        }
      }

      logger.info('Investigations extracted', { count: investigations.length });
      return investigations;
    } catch (error) {
      logger.warn('Failed to extract investigations', { error });
      return [];
    }
  }

  /**
   * Capture screenshot for debugging
   */
  private async captureScreenshot(name: string): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      const filename = `${name}-${Date.now()}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.debug('Screenshot captured', { path: filepath });
    } catch (error) {
      logger.warn('Failed to capture screenshot', { error });
    }
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('Browser cleanup completed');
    } catch (error) {
      logger.error('Error during browser cleanup', { error });
    }
  }
}

