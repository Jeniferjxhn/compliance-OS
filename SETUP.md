# Greenlite Compliance Agent - Setup Guide

## Installation

```bash
npm install
npx playwright install chromium
```

## Configuration

Edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=your_actual_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

Get an API key at: https://platform.openai.com/api-keys

## Usage

### Test Connection
```bash
npm run dev test
```

### Run Investigation (Standard)
```bash
npm run dev investigate "Customer Name"
```

### Natural Language Interface
Accepts flexible input formats:

```bash
npm run dev prompt "Pull Will Lawrence's file from ComplianceOS"
npm run dev prompt "Investigate John Smith and analyze his transactions"
npm run dev prompt "Look up Sarah Chen"
npm run dev prompt "will lawrence"
```

The system will automatically extract the customer name from any reasonable prompt.

## Command Options

```bash
--output ./path       # Custom output directory
--headless false      # Show browser
--verbose            # Debug logging
```

## Output

Reports are saved to `./reports/` as markdown files with timestamps.

## Edge Cases Handled

- Customer not found: Generates a "not found" report without calling OpenAI
- Login failures: Retries with clear error messages
- Network timeouts: Logs and saves screenshots
- Empty/invalid prompts: Asks for clarification
- Missing data fields: Works with partial data

## Cost Optimization

Uses `gpt-4o-mini` by default for cost efficiency. Skips OpenAI API calls when customer is not found.

