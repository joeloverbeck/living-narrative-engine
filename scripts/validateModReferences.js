#!/usr/bin/env node
/**
 * @file CLI script for comprehensive mod validation using ModValidationOrchestrator
 * @description Validates mod dependencies and cross-references using the integrated
 * validation orchestrator with multiple output formats and comprehensive reporting.
 *
 * Usage:
 *   node scripts/validateModReferences.js [options]
 *
 * Options:
 *   --mod=<mod_id>           Validate single mod instead of all mods
 *   --format=<format>        Output format: console, json, markdown (default: console)
 *   --output=<file>          Write report to file instead of stdout
 *   --skip-cross-references  Skip cross-reference validation (dependencies only)
 *   --fail-fast              Stop validation on first error
 *   --verbose                Include detailed information in reports
 *   --strict                 Treat warnings as errors
 *   --help                   Show usage information
 *
 * Examples:
 *   node scripts/validateModReferences.js
 *   node scripts/validateModReferences.js --mod=positioning --format=json --output=report.json
 *   node scripts/validateModReferences.js --format=console --verbose
 *   npm run validate:ecosystem
 *   npm run validate:mod positioning
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports to avoid issues with DI container initialization
let container;
let tokens;

/**
 * Parse command line arguments
 *
 * @param {string[]} args - Command line arguments
 * @returns {object} Parsed options
 */
function parseCommandLineArgs(args) {
  const options = {
    modId: null,
    format: 'console',
    output: null,
    skipCrossReferences: false,
    failFast: false,
    verbose: false,
    strict: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--mod=')) {
      options.modId = arg.substring(6);
    } else if (arg.startsWith('--format=')) {
      options.format = arg.substring(9);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.substring(9);
    } else if (arg === '--skip-cross-references') {
      options.skipCrossReferences = true;
    } else if (arg === '--fail-fast') {
      options.failFast = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      showUsage();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🔍 Mod Validation Tool

USAGE:
  node scripts/validateModReferences.js [options]

OPTIONS:
  --mod=<mod_id>           Validate single mod instead of all mods
  --format=<format>        Output format: console, json, markdown (default: console)
  --output=<file>          Write report to file instead of stdout
  --skip-cross-references  Skip cross-reference validation (dependencies only)
  --fail-fast              Stop validation on first error
  --verbose                Include detailed information in reports
  --strict                 Treat warnings as errors
  --help                   Show this help message

EXAMPLES:
  # Validate entire ecosystem
  node scripts/validateModReferences.js

  # Validate specific mod with JSON output
  node scripts/validateModReferences.js --mod=positioning --format=json --output=report.json

  # Validate with strict mode (warnings = errors)
  node scripts/validateModReferences.js --strict --fail-fast

  # Dependencies only validation
  node scripts/validateModReferences.js --skip-cross-references

NPM SCRIPTS:
  npm run validate:ecosystem              # Validate all mods
  npm run validate:ecosystem:json         # JSON output to file
  npm run validate:mod positioning        # Validate specific mod
`);
}

/**
 * Load dependencies dynamically
 */
async function loadDependencies() {
  const AppContainer = (await import(
    '../src/dependencyInjection/appContainer.js'
  )).default;
  const tokensModule = await import(
    '../src/dependencyInjection/tokens.js'
  );
  const { configureMinimalContainer } = await import(
    '../src/dependencyInjection/minimalContainerConfig.js'
  );

  // Create container and configure with validation services
  container = new AppContainer();
  await configureMinimalContainer(container, {
    includeValidationServices: true
  });

  // Override data fetcher for CLI environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  container.register(tokensModule.tokens.IDataFetcher, () => new NodeDataFetcher());

  tokens = tokensModule.tokens;
}

/**
 * Format validation results for console output
 *
 * @param {object} results - Validation results
 * @param {object} options - Formatting options
 * @returns {string} Formatted output
 */
function formatConsoleOutput(results, options) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`📊 MOD VALIDATION REPORT - ${new Date().toISOString()}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Overall status
  const statusEmoji = results.isValid ? '✅' : '❌';
  lines.push(
    `${statusEmoji} Overall Status: ${results.isValid ? 'PASSED' : 'FAILED'}`
  );
  lines.push('');

  // Performance metrics
  if (results.performance) {
    lines.push('⏱️  Performance Metrics:');
    lines.push(`   Total Time: ${results.performance.totalTime?.toFixed(2)}ms`);
    if (results.performance.phases && options.verbose) {
      results.performance.phases.forEach((time, phase) => {
        lines.push(`   ${phase}: ${time.toFixed(2)}ms`);
      });
    }
    lines.push('');
  }

  // Dependency validation
  if (results.dependencies) {
    lines.push('📦 Dependency Validation:');
    lines.push(
      `   Status: ${results.dependencies.isValid ? '✅ PASSED' : '❌ FAILED'}`
    );

    if (results.dependencies.errors && results.dependencies.errors.length > 0) {
      lines.push(`   Errors (${results.dependencies.errors.length}):`);
      results.dependencies.errors.forEach((error) => {
        lines.push(`     ❌ ${error}`);
      });
    }

    if (
      results.dependencies.warnings &&
      results.dependencies.warnings.length > 0
    ) {
      lines.push(`   Warnings (${results.dependencies.warnings.length}):`);
      results.dependencies.warnings.forEach((warning) => {
        lines.push(`     ⚠️  ${warning}`);
      });
    }
    lines.push('');
  }

  // Cross-reference validation
  if (results.crossReferences) {
    lines.push('🔗 Cross-Reference Validation:');

    if (results.crossReferences instanceof Map) {
      let totalViolations = 0;
      const modViolations = [];

      results.crossReferences.forEach((report, modId) => {
        if (report.hasViolations) {
          totalViolations += report.violations.length;
          modViolations.push({ modId, violations: report.violations });
        }
      });

      lines.push(
        `   Status: ${totalViolations === 0 ? '✅ PASSED' : `❌ FAILED (${totalViolations} violations)`}`
      );

      if (options.verbose && modViolations.length > 0) {
        lines.push('   Violations by mod:');
        modViolations.forEach(({ modId, violations }) => {
          lines.push(`     📁 ${modId} (${violations.length} violations):`);
          violations.forEach((violation) => {
            lines.push(`        ❌ ${violation.file}: ${violation.message}`);
            if (violation.fix) {
              lines.push(`           💡 Fix: ${violation.fix}`);
            }
          });
        });
      }
    } else if (results.crossReferences.hasViolations) {
      lines.push(
        `   Status: ❌ FAILED (${results.crossReferences.violations.length} violations)`
      );

      if (options.verbose) {
        results.crossReferences.violations.forEach((violation) => {
          lines.push(`     ❌ ${violation.file}: ${violation.message}`);
          if (violation.fix) {
            lines.push(`        💡 Fix: ${violation.fix}`);
          }
        });
      }
    } else {
      lines.push('   Status: ✅ PASSED');
    }
    lines.push('');
  }

  // Load order
  if (results.loadOrder && options.verbose) {
    lines.push('📋 Load Order:');
    lines.push(`   ${results.loadOrder.order.join(' → ')}`);
    lines.push('');
  }

  // Summary
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('📝 SUMMARY');
  lines.push('═══════════════════════════════════════════════════════════════');

  if (results.errors && results.errors.length > 0) {
    lines.push(`❌ Critical Errors: ${results.errors.length}`);
    if (options.verbose) {
      results.errors.forEach((error) => {
        lines.push(`   - ${error}`);
      });
    }
  }

  if (results.warnings && results.warnings.length > 0) {
    lines.push(`⚠️  Warnings: ${results.warnings.length}`);
    if (options.verbose) {
      results.warnings.forEach((warning) => {
        lines.push(`   - ${warning}`);
      });
    }
  }

  if (results.isValid) {
    lines.push('✅ All validations passed!');
  } else {
    lines.push('❌ Validation failed - review errors above');
  }

  return lines.join('\n');
}

/**
 * Format validation results as JSON
 *
 * @param {object} results - Validation results
 * @param {boolean} pretty - Pretty print JSON
 * @returns {string} JSON string
 */
function formatJsonOutput(results, pretty = false) {
  // Convert Map to plain object if necessary
  const output = { ...results };

  if (results.crossReferences instanceof Map) {
    output.crossReferences = {};
    results.crossReferences.forEach((value, key) => {
      output.crossReferences[key] = value;
    });
  }

  if (results.performance?.phases instanceof Map) {
    output.performance.phases = {};
    results.performance.phases.forEach((value, key) => {
      output.performance.phases[key] = value;
    });
  }

  return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
}

/**
 * Format validation results as Markdown
 *
 * @param {object} results - Validation results
 * @returns {string} Markdown string
 */
function formatMarkdownOutput(results) {
  const lines = [];

  lines.push('# Mod Validation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`**Status:** ${results.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');

  if (results.performance) {
    lines.push('## Performance');
    lines.push('');
    lines.push(
      `- **Total Time:** ${results.performance.totalTime?.toFixed(2)}ms`
    );
    lines.push('');
  }

  if (results.dependencies) {
    lines.push('## Dependency Validation');
    lines.push('');
    lines.push(
      `**Status:** ${results.dependencies.isValid ? 'PASSED' : 'FAILED'}`
    );
    lines.push('');

    if (results.dependencies.errors?.length > 0) {
      lines.push('### Errors');
      lines.push('');
      results.dependencies.errors.forEach((error) => {
        lines.push(`- ${error}`);
      });
      lines.push('');
    }
  }

  if (results.crossReferences) {
    lines.push('## Cross-Reference Validation');
    lines.push('');

    if (results.crossReferences instanceof Map) {
      let totalViolations = 0;
      results.crossReferences.forEach((report) => {
        if (report.hasViolations) {
          totalViolations += report.violations.length;
        }
      });
      lines.push(`**Total Violations:** ${totalViolations}`);

      if (totalViolations > 0) {
        lines.push('');
        lines.push('### Violations by Mod');
        lines.push('');

        results.crossReferences.forEach((report, modId) => {
          if (report.hasViolations) {
            lines.push(`#### ${modId}`);
            lines.push('');
            report.violations.forEach((violation) => {
              lines.push(`- **File:** ${violation.file}`);
              lines.push(`  - **Message:** ${violation.message}`);
              if (violation.fix) {
                lines.push(`  - **Fix:** ${violation.fix}`);
              }
            });
            lines.push('');
          }
        });
      }
    }
  }

  return lines.join('\n');
}

/**
 * Main execution function
 */
async function main() {
  const options = parseCommandLineArgs(process.argv.slice(2));

  try {
    console.log('🔍 Mod Validation Starting...');
    console.log(
      `Mode: ${options.modId ? `Single Mod (${options.modId})` : 'Ecosystem'}`
    );
    console.log(`Format: ${options.format}`);
    console.log('');

    // Load dependencies
    await loadDependencies();

    // Load schemas before validation
    if (!options.quiet) {
      console.log('📚 Loading schemas...');
    }

    try {
      const schemaPhase = container.resolve(tokens.SchemaPhase);
      const registry = container.resolve(tokens.IDataRegistry);

      // Create minimal load context for schema loading
      const { createLoadContext } = await import('../src/loaders/LoadContext.js');
      const loadContext = createLoadContext({
        worldName: 'validation-context',
        requestedMods: [],
        registry
      });

      await schemaPhase.execute(loadContext);

      if (!options.quiet) {
        console.log('✅ Schemas loaded successfully');
      }
    } catch (error) {
      console.error('❌ Schema loading failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(2);
    }

    // Get validation orchestrator
    const validationOrchestrator = container.resolve(
      tokens.IModValidationOrchestrator
    );
    const logger = container.resolve(tokens.ILogger);

    if (!validationOrchestrator) {
      console.error('❌ Validation orchestrator not available');
      process.exit(1);
    }

    let results;

    if (options.modId) {
      // Single mod validation
      logger.info(`Validating mod: ${options.modId}`);
      results = await validationOrchestrator.validateMod(options.modId, {
        skipCrossReferences: options.skipCrossReferences,
        includeContext: true,
      });
    } else {
      // Ecosystem validation
      logger.info('Validating entire mod ecosystem');
      results = await validationOrchestrator.validateEcosystem({
        skipCrossReferences: options.skipCrossReferences,
        failFast: options.failFast,
      });
    }

    // Apply strict mode
    if (options.strict && results.warnings && results.warnings.length > 0) {
      results.isValid = false;
      results.errors = [...(results.errors || []), ...results.warnings];
    }

    // Format output
    let output;
    switch (options.format) {
      case 'json':
        output = formatJsonOutput(results, true);
        break;
      case 'markdown':
        output = formatMarkdownOutput(results);
        break;
      case 'console':
      default:
        output = formatConsoleOutput(results, options);
        break;
    }

    // Write output
    if (options.output) {
      await fs.writeFile(options.output, output, 'utf8');
      console.log(`✅ Report written to: ${options.output}`);
    } else {
      console.log(output);
    }

    // Exit with appropriate code
    process.exit(results.isValid ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed with error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
