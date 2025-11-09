#!/usr/bin/env node

/**
 * @file CLI tool for formatting validation reports in multiple formats
 * Usage: node scripts/formatValidationReport.js <report.json> --format <html|markdown|csv>
 */

import fs from 'fs';
import path from 'path';

// Import validation utilities
import { ValidationReport } from '../src/anatomy/validation/ValidationReport.js';
import { ReportFormatter } from '../src/anatomy/validation/ReportFormatter.js';
import { FixableIssueDetector } from '../src/anatomy/validation/FixableIssueDetector.js';
import { RelatedFileFinder } from '../src/anatomy/validation/RelatedFileFinder.js';

/**
 * Parse command line arguments
 *
 * @returns {object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node formatValidationReport.js <report.json> --format <html|markdown|csv>');
    console.error('\nOptions:');
    console.error('  --format <type>     Output format: html, markdown, csv (required)');
    console.error('  --output <file>     Output file (optional, defaults to stdout)');
    console.error('  --fixable           Include fixable issues analysis');
    console.error('  --files             Include related files list');
    console.error('\nExamples:');
    console.error('  node formatValidationReport.js report.json --format html --output report.html');
    console.error('  node formatValidationReport.js report.json --format markdown --fixable --files');
    process.exit(1);
  }

  const config = {
    inputFile: args[0],
    format: null,
    outputFile: null,
    includeFixable: false,
    includeFiles: false,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
        config.format = args[++i];
        break;
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--fixable':
        config.includeFixable = true;
        break;
      case '--files':
        config.includeFiles = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // Validate required arguments
  if (!config.format) {
    console.error('Error: --format is required');
    process.exit(1);
  }

  if (!['html', 'markdown', 'csv'].includes(config.format)) {
    console.error(`Error: Invalid format '${config.format}'. Must be: html, markdown, or csv`);
    process.exit(1);
  }

  return config;
}

/**
 * Load JSON report from file
 * Exits process on error
 *
 * @param {string} filePath - Path to JSON report file
 * @returns {object} Report data or exits process
 */
function loadReport(filePath) {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`Error: File not found: ${absolutePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading report: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Format report in specified format
 *
 * @param {ValidationReport} report - ValidationReport instance
 * @param {string} format - Output format
 * @returns {string} Formatted report
 */
function formatReport(report, format) {
  const formatter = new ReportFormatter(report);

  switch (format) {
    case 'html':
      return formatter.toHTML();
    case 'markdown':
      return formatter.toMarkdown();
    case 'csv':
      return formatter.toCSV();
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Generate fixable issues section
 *
 * @param {object} report - ValidationReport instance
 * @param {string} format - Output format
 * @returns {string} Formatted fixable issues section
 */
function generateFixableSection(report, format) {
  const fixable = FixableIssueDetector.analyze(report);
  const batched = FixableIssueDetector.generateBatchSuggestions(fixable);

  if (format === 'markdown') {
    let md = '\n## Fixable Issues Analysis\n\n';
    md += '### Summary\n\n';
    md += `- **Total Issues:** ${batched.summary.total}\n`;
    md += `- **Automatic:** ${batched.summary.automatic}\n`;
    md += `- **Semi-Automatic:** ${batched.summary.semiAutomatic}\n`;
    md += `- **Manual:** ${batched.summary.manual}\n\n`;

    if (batched.automatic.length > 0) {
      md += '### Automatic Fixes\n\n';
      for (const issue of batched.automatic) {
        md += `- **${issue.type}:** ${issue.original.message}\n`;
        md += `  - Action: ${issue.action}\n`;
        md += `  - Suggestion: ${issue.suggestion}\n\n`;
      }
    }

    if (batched.semiAutomatic.length > 0) {
      md += '### Semi-Automatic Fixes\n\n';
      for (const issue of batched.semiAutomatic) {
        md += `- **${issue.type}:** ${issue.original.message}\n`;
        md += `  - Action: ${issue.action}\n`;
        md += `  - Suggestion: ${issue.suggestion}\n\n`;
      }
    }

    if (batched.manual.length > 0) {
      md += '### Manual Fixes Required\n\n';
      for (const issue of batched.manual) {
        md += `- **${issue.type}:** ${issue.original.message}\n`;
        md += `  - Reason: ${issue.reason}\n`;
        md += `  - Suggestion: ${issue.suggestion}\n\n`;
      }
    }

    // Add fix script
    const script = FixableIssueDetector.generateFixScript(fixable);
    if (script.length > 0) {
      md += '### Fix Script\n\n```bash\n';
      md += script.join('\n');
      md += '\n```\n';
    }

    return md;
  } else if (format === 'html') {
    let html = '<div class="section">\n';
    html += '  <h2>Fixable Issues Analysis</h2>\n';
    html += '  <div class="stats">\n';
    html += `    <div class="stat"><strong>Total:</strong> ${batched.summary.total}</div>\n`;
    html += `    <div class="stat success"><strong>Automatic:</strong> ${batched.summary.automatic}</div>\n`;
    html += `    <div class="stat warning"><strong>Semi-Automatic:</strong> ${batched.summary.semiAutomatic}</div>\n`;
    html += `    <div class="stat error"><strong>Manual:</strong> ${batched.summary.manual}</div>\n`;
    html += '  </div>\n';
    html += '</div>\n';
    return html;
  }

  return '';
}

/**
 * Generate related files section
 *
 * @param {object} report - ValidationReport instance
 * @param {string} format - Output format
 * @returns {string} Formatted related files section
 */
function generateFilesSection(report, format) {
  const fileList = RelatedFileFinder.extractFiles(report);

  if (format === 'markdown') {
    let md = '\n## Related Files\n\n';

    if (fileList.recipes.length > 0) {
      md += `### Recipes (${fileList.recipes.length})\n\n`;
      for (const file of fileList.recipes) {
        md += `- \`${file}\`\n`;
      }
      md += '\n';
    }

    if (fileList.blueprints.length > 0) {
      md += `### Blueprints (${fileList.blueprints.length})\n\n`;
      for (const file of fileList.blueprints) {
        md += `- \`${file}\`\n`;
      }
      md += '\n';
    }

    if (fileList.components.length > 0) {
      md += `### Components (${fileList.components.length})\n\n`;
      for (const file of fileList.components) {
        md += `- \`${file}\`\n`;
      }
      md += '\n';
    }

    if (fileList.other.length > 0) {
      md += `### Other Files (${fileList.other.length})\n\n`;
      for (const file of fileList.other) {
        md += `- \`${file}\`\n`;
      }
      md += '\n';
    }

    md += `**Total:** ${fileList.total} file(s)\n`;

    // Add file commands
    const commands = RelatedFileFinder.generateFileCommands(fileList);
    if (commands.length > 0) {
      md += '\n### File Check Script\n\n```bash\n';
      md += commands.join('\n');
      md += '\n```\n';
    }

    return md;
  } else if (format === 'html') {
    let html = '<div class="section">\n';
    html += '  <h2>Related Files</h2>\n';
    html += `  <p><strong>Total:</strong> ${fileList.total} file(s)</p>\n`;
    html += '</div>\n';
    return html;
  }

  return '';
}

/**
 * Main function
 *
 * @returns {void}
 */
function main() {
  const config = parseArgs();

  console.error(`Loading report from: ${config.inputFile}`);
  const reportData = loadReport(config.inputFile);

  // Create ValidationReport instance
  const report = new ValidationReport(reportData);

  console.error(`Formatting report as ${config.format}...`);
  let output = formatReport(report, config.format);

  // Add optional sections for markdown and html
  if (config.format === 'markdown' || config.format === 'html') {
    if (config.includeFixable) {
      console.error('Adding fixable issues analysis...');
      output += generateFixableSection(report, config.format);
    }

    if (config.includeFiles) {
      console.error('Adding related files list...');
      output += generateFilesSection(report, config.format);
    }
  }

  // Output results
  if (config.outputFile) {
    console.error(`Writing output to: ${config.outputFile}`);
    fs.writeFileSync(config.outputFile, output, 'utf-8');
    console.error('Done!');
  } else {
    console.log(output);
  }
}

// Run main
main();
