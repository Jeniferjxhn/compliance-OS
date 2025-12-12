# Greenlite Compliance Agent

A TypeScript CLI application that automates compliance investigations by scraping ComplianceOS and generating AI-powered research reports.

# Overview

The Greenlite Compliance Agent streamlines the compliance investigation workflow through a two-phase automated process:

1. **Browser Automation (Phase 1)**: Uses Playwright to log into ComplianceOS, search for customers, and extract comprehensive profile data
2. **AI Research (Phase 2)**: Leverages OpenAI's GPT-4o-mini to analyze the data, conduct external research, and generate professional compliance reports

The system intelligently handles edge cases, including customers not found in the database, without wasting API calls.

# Architecture

The application follows a modular architecture with clear separation of concerns:

```
src/
├── agent/
│   ├── browser-agent.ts       # High-level browser automation orchestration
│   ├── research-agent.ts      # AI research workflow coordination
│   └── orchestrator.ts        # Main workflow coordinator
├── services/
│   ├── complianceOS.service.ts  # Playwright-based scraping implementation
│   └── openai.service.ts        # OpenAI API integration
├── types/
│   └── index.ts               # TypeScript interfaces
├── utils/
│   ├── logger.ts              # Winston logging
│   └── config.ts              # Environment configuration
└── index.ts                   # CLI entry point
```

# Workflow

```
User Input (Natural Language)
         |
         v
  Extract Customer Name
         |
         v
    [Phase 1: Browser Automation]
         |
         +-- Login to ComplianceOS
         +-- Search for Customer
         +-- Extract Data
         |
         v
    Customer Found?
         |
    +----+----+
    |         |
   YES       NO
    |         |
    v         v
[Phase 2]  [Generate Not Found Report]
    |         |
    +-- AI Research (OpenAI)
    +-- Risk Assessment
    +-- Generate Report
         |
         v
    Save Markdown Report
```

# Installation

# Prerequisites

- Node.js 18.x or higher
- npm or yarn
- OpenAI API key

# Setup

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Configuration

Edit `.env` file:

```bash
# Required
OPENAI_API_KEY=your_api_key_here

# Optional (defaults shown)
OPENAI_MODEL=gpt-4o-mini
COMPLIANCE_URL=https://compliance-j9ehback.manus.space/login
COMPLIANCE_USERNAME=admin
COMPLIANCE_PASSWORD=password123
HEADLESS=true
BROWSER_TIMEOUT=30000
LOG_LEVEL=info
OUTPUT_DIR=./reports
```

Get an OpenAI API key at: https://platform.openai.com/api-keys

# Usage

# Test Connections

Verify system connectivity before running investigations:

```bash
npm run dev test
```

Expected output:
```
Testing System Connections...

Browser (ComplianceOS): [OK] Connected
OpenAI API: [OK] Connected

[OK] All systems operational
```

# Standard Investigation

```bash
npm run dev investigate "Customer Name"
```

# Natural Language Interface

The system accepts flexible natural language prompts:

```bash
# Full sentences
npm run dev prompt "Pull Will Lawrence's file from ComplianceOS"
npm run dev prompt "Investigate John Smith and analyze his transactions"

# Imperative commands
npm run dev prompt "Get Sarah Chen's data"
npm run dev prompt "Look up Michael Rodriguez"

# Simple names (case insensitive)
npm run dev prompt "will lawrence"
npm run dev prompt "JANE DOE"

# Casual requests
npm run dev prompt "check out robert kim please"
```

The name extraction algorithm automatically:
- Strips common command phrases (pull, get, investigate, look up, etc.)
- Removes filler words (from ComplianceOS, please, for me, etc.)
- Normalizes capitalization
- Handles possessives ('s)

# Command Options

```bash
--output ./path       # Custom output directory
--headless false      # Show browser (for debugging)
--verbose            # Enable debug logging
```

Examples:

```bash
npm run dev investigate "Will Lawrence" --verbose
npm run dev investigate "John Smith" --output ./urgent-cases
npm run dev investigate "Jane Doe" --headless false
```

# Expected Outputs

# Success Case (Customer Found)

```
- Greenlite Compliance Agent -

Target Customer: Will Lawrence
Output Directory: ./reports

Phase 1: Extracting data from ComplianceOS...
  - Logging in...
  - Searching for customer...
  - Extracting profile data...

[OK] Phase 1 Complete

Phase 2: AI-powered research and analysis...
  - Conducting external research...
  - Analyzing risk factors...
  - Generating compliance report...

[OK] Phase 2 Complete

==================================
Investigation Complete
==================================

Customer: Will Lawrence
Risk Level: Medium
Risk Score: Medium
Transactions: 45 (3 flagged)
Duration: 73.27s

Report saved to: ./reports/compliance_report_will_lawrence_2025-12-11T10-30-45.md
```

The generated report includes:
- Executive Summary
- Internal Data Overview (profile, transactions, investigations)
- External Research Findings (background, counterparties, public records)
- Risk Assessment (score, factors, flags)
- Recommended Actions

# Failure Case (Customer Not Found)

```
--- Greenlite Compliance Agent ---

Target Customer: Nonexistent Customer
Output Directory: ./reports

Phase 1: Extracting data from ComplianceOS...
  - Logging in...
  - Searching for customer...
  - Extracting profile data...

[OK] Investigation Complete

Report saved to: ./reports/compliance_report_nonexistent_customer_2025-12-11T10-35-22.md
```

When a customer is not found:
- Phase 2 (OpenAI) is skipped to save API costs
- A simple "not found" report is generated
- The report includes troubleshooting recommendations
- No error is thrown (graceful handling)

## Error Handling

The system gracefully handles all edge cases:

| Scenario | Behavior |
|----------|----------|
| Customer not in database | Generates "not found" report, skips OpenAI call |
| Login fails | Retries with clear error messages, captures screenshot |
| Network timeout | Logs error, saves screenshot for debugging |
| API errors | Returns informative error report |
| Empty/invalid prompts | Displays error with usage examples |
| Missing data fields | Works with partial data, marks fields as N/A |
| Browser crashes | Cleans up resources, logs detailed error |

## Troubleshooting

### Common Issues

**Issue: "Missing required environment variables: OPENAI_API_KEY"**

Solution: Create `.env` file and add your OpenAI API key

**Issue: "Login failed"**

Solution:
- Verify ComplianceOS credentials in `.env`
- Check network connectivity
- Run with `--headless false` to see browser
- Check `screenshots/` directory for visual debugging

**Issue: "Customer not found" (but customer exists)**

Solution:
- Verify exact spelling of customer name
- Check customer exists in ComplianceOS
- Run with `--verbose` for detailed logs
- Check `screenshots/after-search-*.png` to see search results

**Issue: OpenAI API errors**

Solution:
- Verify API key is valid
- Check account has available credits
- Ensure you have access to gpt-4o-mini model
- Try switching to gpt-3.5-turbo in `.env`

### Debug Mode

Enable maximum verbosity:

```bash
npm run dev investigate "Customer Name" --verbose --headless false
```

This will:
- Show all debug logs
- Display the browser window
- Capture screenshots at each step
- Show API request/response details

Check logs:
```bash
tail -f combined.log
tail -f error.log
```

Check screenshots:
```bash
ls -lh screenshots/
```

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
npm run test:integration
```

### Code Quality

The codebase follows strict TypeScript standards:
- Strict mode enabled
- No `any` types
- Modular, single-responsibility functions
- Comprehensive error handling
- Proper async/await patterns
- Clean separation of concerns

# Cost Optimization

The system is designed to minimize OpenAI API costs:

1. **Uses gpt-4o-mini**: Significantly cheaper than GPT-4 while maintaining quality
2. **Skips AI calls for not-found customers**: No wasted API calls
3. **Efficient prompts**: Structured prompts minimize token usage
4. **Single-pass generation**: Generates complete report in one API call

Estimated cost per investigation:
- Customer found: ~$0.02-0.05 (depending on data volume)
- Customer not found: $0.00 (no OpenAI call)

# Production Deployment

# Recommendations

1. **Environment Variables**: Use secure secrets management (AWS Secrets Manager, etc.)
2. **Logging**: Configure log aggregation (CloudWatch, Splunk)
3. **Monitoring**: Set up alerts for failures
4. **Rate Limiting**: Implement queuing for high-volume scenarios
5. **Credentials**: Regularly rotate ComplianceOS and OpenAI credentials
6. **Backups**: Automated backup of generated reports
7. **Audit Trail**: Log all investigations for compliance

# Performance
- Browser automation: 30-60 seconds
- AI research: 15-30 seconds
- Total time: 45-90 seconds per investigation

For high-volume scenarios:
- Implement connection pooling
- Use parallel processing
- Cache frequently accessed data
- Optimize Playwright selectors

## Security Considerations

- Never commit `.env` file or API keys
- Use environment variables for all sensitive data
- Implement rate limiting to prevent abuse
- Sanitize all user inputs
- Use HTTPS for all network communications
- Implement audit trails for all investigations
- Follow principle of least privilege

## Limitations

- Sequential processing (one investigation at a time)
- Requires ComplianceOS access
- Dependent on ComplianceOS page structure
- English language only
- No batch processing (yet)

## Future Enhancements

Potential improvements:
- Batch processing for multiple customers
- Web UI dashboard
- Webhook integration for automated triggers
- Custom data source plugins
- ML-based risk scoring
- PDF export format
- Scheduled periodic reviews
- Integration with case management systems

## Support

For issues or questions:
1. Check this README and SETUP.md
2. Review logs in `combined.log` and `error.log`
3. Run with `--verbose` flag
4. Check `screenshots/` directory
5. Verify environment configuration

## License

MIT License

## Acknowledgments

Built with:
- Playwright for reliable browser automation
- OpenAI GPT-4o-mini for cost-effective AI analysis
- TypeScript for type safety and maintainability
- Winston for structured logging 
