#!/usr/bin/env node

/**
 * Greenlite Compliance Agent - Main Entry Point
 * CLI interface for automated compliance investigations
 */

import { Command } from 'commander';
import { Orchestrator } from './agent/orchestrator.js';
import { loadConfig } from './utils/config.js';

const program = new Command();

program
  .name('greenlite-agent')
  .description('AI-powered compliance investigation agent')
  .version('1.0.0');

program
  .command('investigate')
  .description('Investigate a customer from ComplianceOS')
  .argument('<customer-name>', 'Name of the customer to investigate')
  .option('-o, --output <path>', 'Output directory for reports', './reports')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--verbose', 'Enable verbose logging')
  .action(async (customerName: string, options) => {
    try {
      // Set log level if verbose
      if (options.verbose) {
        process.env.LOG_LEVEL = 'debug';
      }

      console.log('\n--- Greenlite Compliance Agent ---');
      console.log('==================================\n');

      // Load configuration
      const config = loadConfig();

      // Override config with CLI options
      if (options.output) {
        config.output.dir = options.output;
      }
      if (options.headless !== undefined) {
        config.browser.headless = options.headless === 'true';
      }

      // Create orchestrator
      const orchestrator = new Orchestrator({
        browser: {
          ...config.browser,
          ...config.compliance,
        },
        openai: config.openai,
        output: config.output,
      });

      // Execute investigation
      console.log(`Target Customer: ${customerName}`);
      console.log(`Output Directory: ${config.output.dir}\n`);

      console.log('Phase 1: Extracting data from ComplianceOS...');
      console.log('  - Logging in...');
      console.log('  - Searching for customer...');
      console.log('  - Extracting profile data...\n');

      const result = await orchestrator.investigate(customerName);

      if (!result.success) {
        console.error('\n[FAILED] Investigation Failed');
        console.error(`Error: ${result.error}\n`);
        process.exit(1);
      }

      console.log('[OK] Phase 1 Complete\n');
      console.log('Phase 2: AI-powered research and analysis...');
      console.log('  - Conducting external research...');
      console.log('  - Analyzing risk factors...');
      console.log('  - Generating compliance report...\n');

      console.log('[OK] Phase 2 Complete\n');
      console.log('==================================');
      console.log('Investigation Complete');
      console.log('==================================\n');

      if (result.report) {
        console.log(`Customer: ${result.report.customerName}`);
        console.log(`Risk Level: ${result.report.internalDataOverview.riskLevel}`);
        console.log(`Risk Score: ${result.report.riskAssessment.overallRiskScore}`);
        console.log(`Transactions: ${result.report.internalDataOverview.transactionsSummary.total} (${result.report.internalDataOverview.transactionsSummary.flagged} flagged)`);
        console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s\n`);

        if (result.reportPath) {
          console.log(`Report saved to: ${result.reportPath}\n`);
        }

        // Display executive summary
        console.log('Executive Summary:');
        console.log('------------------');
        console.log(result.report.executiveSummary);
        console.log('\n');

        // Display recommended actions
        if (result.report.recommendedActions.length > 0) {
          console.log('Recommended Actions:');
          console.log('-------------------');
          result.report.recommendedActions.forEach((action, i) => {
            console.log(`${i + 1}. ${action}`);
          });
          console.log('\n');
        }

        console.log(`For full report, see: ${result.reportPath}\n`);
      }

      process.exit(0);
    } catch (error) {
      console.error('\n[FATAL] Fatal Error');
      console.error(error instanceof Error ? error.message : String(error));
      console.error('\nCheck the logs for more details.\n');
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test connections to ComplianceOS and OpenAI')
  .action(async () => {
    try {
      console.log('\nTesting System Connections...\n');

      const config = loadConfig();

      const orchestrator = new Orchestrator({
        browser: {
          ...config.browser,
          ...config.compliance,
        },
        openai: config.openai,
        output: config.output,
      });

      const results = await orchestrator.testConnections();

      console.log('Browser (ComplianceOS):', results.browser ? '[OK] Connected' : '[FAIL] Failed');
      console.log('OpenAI API:', results.openai ? '[OK] Connected' : '[FAIL] Failed');
      console.log('');

      if (results.browser && results.openai) {
        console.log('[OK] All systems operational\n');
        process.exit(0);
      } else {
        console.log('[FAIL] Some systems failed\n');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n[FAIL] Test Failed');
      console.error(error instanceof Error ? error.message : String(error));
      console.error('');
      process.exit(1);
    }
  });

program
  .command('prompt')
  .description('Natural language interface for investigations')
  .argument('<prompt>', 'Natural language prompt (e.g., "Pull Will Lawrence\'s file")')
  .action(async (promptText: string) => {
    try {
      console.log('\nProcessing Natural Language Prompt...\n');
      console.log(`Prompt: "${promptText}"\n`);

      // Extract customer name from prompt
      const customerName = extractCustomerName(promptText);

      if (!customerName) {
        console.error('[ERROR] Could not identify customer name in prompt');
        console.error('Try: "Pull [Customer Name]\'s file" or "Investigate [Customer Name]"\n');
        process.exit(1);
      }

      console.log(`Identified Customer: ${customerName}\n`);

      // Execute investigation
      const config = loadConfig();
      const orchestrator = new Orchestrator({
        browser: {
          ...config.browser,
          ...config.compliance,
        },
        openai: config.openai,
        output: config.output,
      });

      console.log('Starting investigation...\n');

      const result = await orchestrator.investigate(customerName);

      if (!result.success) {
        console.error('\n[FAIL] Investigation Failed');
        console.error(`Error: ${result.error}\n`);
        process.exit(1);
      }

      console.log('[OK] Investigation Complete\n');

      if (result.report && result.reportPath) {
        console.log(`Report saved to: ${result.reportPath}\n`);
      }

      process.exit(0);
    } catch (error) {
      console.error('\n[ERROR] Error');
      console.error(error instanceof Error ? error.message : String(error));
      console.error('');
      process.exit(1);
    }
  });

/**
 * Extract customer name from natural language prompt
 */
function extractCustomerName(prompt: string): string | null {
  // Normalize the prompt
  let normalized = prompt.trim();
  
  // Remove common command phrases (case insensitive)
  const commandPhrases = [
    'pull',
    'get me',
    'get',
    'fetch',
    'retrieve',
    'investigate',
    'analyze',
    'research',
    'look up',
    'lookup',
    'check',
    'find',
    'search for',
    'search',
    'from complianceos',
    'from compliance',
    'in complianceos',
    'in compliance',
    "'s file",
    "'s data",
    "'s profile",
    "'s info",
    "'s information",
    "'s record",
    "'s records",
    'file',
    'data',
    'profile',
    'info',
    'information',
    'record',
    'records',
    'and analyze',
    'and investigate',
    'and research',
    'transactions',
    'the customer',
    'customer',
    'for me',
    'please',
    'me',
  ];

  // Remove command phrases
  for (const phrase of commandPhrases) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    normalized = normalized.replace(regex, ' ');
  }

  // Clean up extra spaces and punctuation
  normalized = normalized
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If we have something left, it's likely the name
  if (normalized.length > 0) {
    // Capitalize each word properly
    const words = normalized.split(' ').filter(w => w.length > 0);
    const capitalizedName = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return capitalizedName;
  }

  return null;
}

// Parse command line arguments
program.parse();

