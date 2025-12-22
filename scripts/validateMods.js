#!/usr/bin/env node

/**
 * @file Comprehensive mod validation CLI tool
 * @description Provides powerful validation capabilities for mod dependencies and cross-references
 * with multiple output formats, flexible options, and CI/CD integration.
 *
 * Usage:
 *   validateMods [OPTIONS]
 *   npm run validate [OPTIONS]
 *   npx living-narrative-validate [OPTIONS]
 *
 * Examples:
 *   validateMods                                    # Validate entire ecosystem
 *   validateMods --mod positioning --mod intimacy  # Validate specific mods
 *   validateMods --format json -o report.json      # Generate JSON report
 *   validateMods --strict --fail-fast               # Strict validation, stop on first error
 *   validateMods --severity critical                # Show only critical violations
 */

import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { overrideDataFetcher } from './utils/cliContainerOverrides.js';

// Handle both Node.js ES modules and Jest environment
let __filename, __dirname;
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Jest/CommonJS fallback - improved Jest compatibility
  if (process.env.NODE_ENV === 'test' && typeof jest !== 'undefined') {
    // In Jest environment, use a safe fallback
    __dirname = path.resolve(process.cwd(), 'scripts');
    __filename = path.resolve(__dirname, 'validateMods.js');
  } else {
    __filename = process.argv[1] || '/fake/path/validateMods.js';
    __dirname = path.dirname(__filename);
  }
}

// Shared symbol used to signal tests that intercept process.exit
const TEST_EXIT_SIGNAL = Symbol.for('validateMods.test.exit');

// CLI configuration
const CLI_VERSION = '1.0.0';
const DEFAULT_CONFIG = {
  // Validation scope
  mods: null, // null = all mods, or array of mod names
  ecosystem: true, // validate entire ecosystem vs individual mods

  // Validation types
  dependencies: true, // validate dependencies
  crossReferences: true, // validate cross-references
  loadOrder: false, // validate load order

  // Output options
  format: 'console', // console, json, html, markdown, junit, csv
  output: null, // output file path (null = stdout)
  colors: null, // null = auto-detect, true/false = force
  verbose: false, // verbose output
  quiet: false, // minimal output

  // Behavior options
  failFast: false, // stop on first failure
  continueOnError: true, // continue validation even if individual mods fail
  showSuggestions: true, // show fix suggestions
  showSummary: true, // show summary at end

  // Performance options
  concurrency: 3, // concurrent validation limit
  timeout: 60000, // validation timeout per mod (ms)

  // Advanced options
  strictMode: false, // treat warnings as errors
  includeMetadata: false, // include detailed metadata in output
  cacheResults: true, // cache validation results

  // Filter options
  severity: null, // filter by severity (critical, high, medium, low)
  violationType: null, // filter by violation type
  modFilter: null, // regex filter for mod names
};

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    // Parse command line arguments
    const config = parseArguments(args);

    // Handle help and version
    if (config.help) {
      showHelp();
      process.exit(0);
    }

    if (config.version) {
      console.log(`Living Narrative Engine Mod Validator v${CLI_VERSION}`);
      process.exit(0);
    }

    if (process.env.VALIDATE_MODS_TEST_MODE === 'fast') {
      const exitCode = await runFastTestMode(config);
      process.exit(exitCode);
    }

    // Create and configure container with minimal configuration
    const container = new AppContainer();

    // Use minimal container configuration for CLI tools with validation services
    await configureMinimalContainer(container, {
      includeValidationServices: true,
    });

    // Override data fetcher for CLI environment
    const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js'))
      .default;
    overrideDataFetcher(container, tokens.IDataFetcher, () => new NodeDataFetcher());

    // Load schemas before validation
    if (!config.quiet) {
      console.log('📚 Loading schemas...');
    }

    try {
      const schemaPhase = container.resolve(tokens.SchemaPhase);
      const registry = container.resolve(tokens.IDataRegistry);

      // Create minimal load context for schema loading
      const { createLoadContext } = await import(
        '../src/loaders/LoadContext.js'
      );
      const loadContext = createLoadContext({
        worldName: 'validation-context',
        requestedMods: [],
        registry,
      });

      await schemaPhase.execute(loadContext);

      if (!config.quiet) {
        console.log('✅ Schemas loaded successfully');
      }
    } catch (error) {
      console.error('❌ Schema loading failed:', error.message);
      if (config.verbose) {
        console.error(error.stack);
      }
      process.exit(2);
    }

    // Initialize validation components
    let orchestrator, reporter, logger;
    try {
      logger = container.resolve(tokens.ILogger);
      if (!config.quiet) {
        console.log('🔧 Resolving validation services...');
      }

      orchestrator = container.resolve(tokens.IModValidationOrchestrator);
      if (!config.quiet) {
        console.log('✅ ModValidationOrchestrator resolved');
      }

      reporter = container.resolve(tokens.IViolationReporter);
      if (!config.quiet) {
        console.log('✅ ViolationReporter resolved');
      }
    } catch (error) {
      console.error('❌ Failed to resolve validation services:', error.message);
      if (config.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(2);
    }

    // Configure logging based on verbosity
    configureLogging(logger, config);

    if (!config.quiet) {
      console.log('🔍 Living Narrative Engine - Mod Validation Tool');
      console.log(`   Version: ${CLI_VERSION}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log('');
    }

    // Run validation
    const startTime = performance.now();
    const results = await runValidation(orchestrator, config);
    const endTime = performance.now();

    // Generate and output report
    const reportOptions = {
      colors:
        config.colors !== false &&
        (config.colors === true || process.stdout.isTTY),
      verbose: config.verbose,
      showSuggestions: config.showSuggestions,
      includeMetadata: config.includeMetadata,
      severity: config.severity,
      violationType: config.violationType,
    };

    // Extract crossReferences Map for ecosystem validation to match reporter's expected structure
    const reportData =
      config.ecosystem && results.crossReferences instanceof Map
        ? results.crossReferences
        : results;

    const report = reporter.generateReport(
      reportData,
      config.format,
      reportOptions
    );

    if (config.output) {
      await fs.writeFile(config.output, report);
      if (!config.quiet) {
        console.log(`📊 Report written to: ${config.output}`);
      }
    } else {
      console.log(report);
    }

    // Show summary
    if (config.showSummary && !config.quiet) {
      showValidationSummary(results, endTime - startTime);
    }

    // Determine exit code
    const exitCode = calculateExitCode(results, config);
    process.exit(exitCode);
  } catch (error) {
    if (error === TEST_EXIT_SIGNAL) {
      // Testing harness intercepted process.exit; rethrow so tests can capture output
      throw error;
    }
    console.error('❌ Validation failed:', error.message);
    if (args.includes('--verbose') || args.includes('-v')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * @description Provides a fast stubbed validation path for tests.
 * @param {object} config - Parsed CLI configuration.
 * @returns {Promise<number>} Exit code indicating success or strict-mode failure.
 */
async function runFastTestMode(config) {
  const mods = Array.isArray(config.mods) ? config.mods : [];
  const scopeSummary =
    mods.length > 0 ? `mods: ${mods.join(', ')}` : 'mods: ecosystem';
  const optionsSummary = {
    quiet: Boolean(config.quiet),
    verbose: Boolean(config.verbose),
    strictMode: Boolean(config.strictMode),
    concurrency: Number.parseInt(
      config.concurrency ?? DEFAULT_CONFIG.concurrency,
      10
    ),
  };

  let outputContent;

  if (config.format === 'json') {
    const jsonReport = {
      status: 'ok',
      scope: scopeSummary,
      options: optionsSummary,
    };
    outputContent = config.quiet
      ? JSON.stringify(jsonReport)
      : JSON.stringify(jsonReport, null, 2);
  } else {
    const lines = [
      'Fast validation stub report',
      `Scope: ${scopeSummary}`,
      `Format: ${config.format}`,
      `Concurrency: ${optionsSummary.concurrency}`,
    ];

    if (config.verbose) {
      lines.push('Verbose mode enabled.');
    }

    outputContent = lines.join('\n');
  }

  let stdoutPayload = outputContent;

  if (config.quiet && config.format !== 'json') {
    stdoutPayload = 'Fast validation complete.';
  }

  if (config.quiet && config.format === 'json') {
    stdoutPayload = JSON.stringify({ status: 'ok' });
  }

  if (config.output) {
    await fs.writeFile(config.output, stdoutPayload, 'utf-8');
    if (!config.quiet) {
      console.log(`Fast validation report written to ${config.output}`);
    }
  } else {
    console.log(stdoutPayload);
  }

  return config.strictMode ? 1 : 0;
}

/**
 * Parses command line arguments with comprehensive option support
 *
 * @param {string[]} args - Raw command line arguments
 * @returns {object} Parsed configuration
 */
function parseArguments(args) {
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      // Help and version
      case '--help':
      case '-h':
        config.help = true;
        break;
      case '--version':
        config.version = true;
        break;

      // Validation scope
      case '--mod':
      case '-m':
        if (nextArg && !nextArg.startsWith('-')) {
          config.mods = config.mods || [];
          config.mods.push(nextArg);
          config.ecosystem = false;
          i++;
        }
        break;
      case '--ecosystem':
      case '-e':
        config.ecosystem = true;
        config.mods = null;
        break;

      // Validation types
      case '--no-dependencies':
        config.dependencies = false;
        break;
      case '--no-cross-references':
        config.crossReferences = false;
        break;
      case '--check-load-order':
        config.loadOrder = true;
        break;

      // Output options
      case '--format':
      case '-f':
        if (nextArg && !nextArg.startsWith('-')) {
          config.format = nextArg;
          i++;
        }
        break;
      case '--output':
      case '-o':
        if (nextArg && !nextArg.startsWith('-')) {
          config.output = nextArg;
          i++;
        }
        break;
      case '--no-colors':
        config.colors = false;
        break;
      case '--colors':
        config.colors = true;
        break;
      case '--verbose':
        // Long form - check for conflicts
        if (config.quiet) {
          throw new Error('Cannot use --quiet and --verbose together');
        }
        config.verbose = true;
        break;
      case '-v':
        // Short form - allow overriding
        config.verbose = true;
        config.quiet = false;
        break;
      case '--quiet':
        // Long form - check for conflicts
        if (config.verbose) {
          throw new Error('Cannot use --quiet and --verbose together');
        }
        config.quiet = true;
        config.showSummary = false;
        break;
      case '-q':
        // Short form - allow overriding
        config.quiet = true;
        config.verbose = false;
        config.showSummary = false;
        break;

      // Behavior options
      case '--fail-fast':
        config.failFast = true;
        break;
      case '--no-fail-fast':
        config.failFast = false;
        break;
      case '--strict':
      case '-s':
        config.strictMode = true;
        break;
      case '--no-suggestions':
        config.showSuggestions = false;
        break;
      case '--no-summary':
        config.showSummary = false;
        break;

      // Performance options
      case '--concurrency':
      case '-c':
        if (nextArg && !nextArg.startsWith('-')) {
          config.concurrency = parseInt(nextArg, 10);
          if (isNaN(config.concurrency) || config.concurrency < 1) {
            throw new Error('Invalid concurrency value');
          }
          i++;
        }
        break;
      case '--timeout':
        if (nextArg && !nextArg.startsWith('-')) {
          config.timeout = parseInt(nextArg, 10);
          if (isNaN(config.timeout) || config.timeout < 1000) {
            throw new Error('Invalid timeout value (minimum 1000ms)');
          }
          i++;
        }
        break;

      // Filter options
      case '--severity':
        if (nextArg && !nextArg.startsWith('-')) {
          const validSeverities = ['critical', 'high', 'medium', 'low'];
          if (!validSeverities.includes(nextArg)) {
            throw new Error(`Invalid severity: ${nextArg}`);
          }
          config.severity = nextArg;
          i++;
        }
        break;
      case '--mod-filter':
        if (nextArg && !nextArg.startsWith('-')) {
          config.modFilter = new RegExp(nextArg);
          i++;
        }
        break;

      // Advanced options
      case '--include-metadata':
        config.includeMetadata = true;
        break;
      case '--no-cache':
        config.cacheResults = false;
        break;

      // Handle --flag=value format
      default:
        if (arg.includes('=')) {
          const [flag, value] = arg.split('=', 2);
          parseArgumentPair(config, flag, value);
        } else if (arg.startsWith('-')) {
          // Unknown flag
          throw new Error(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  // Validation
  validateConfiguration(config);

  return config;
}

/**
 * Handles --flag=value format arguments
 *
 * @param {object} config - Configuration object to modify
 * @param {string} flag - Flag name
 * @param {string} value - Flag value
 */
function parseArgumentPair(config, flag, value) {
  switch (flag) {
    case '--format':
    case '-f':
      config.format = value;
      break;
    case '--output':
    case '-o':
      config.output = value;
      break;
    case '--mod':
    case '-m':
      config.mods = config.mods || [];
      config.mods.push(value);
      config.ecosystem = false;
      break;
    case '--concurrency':
    case '-c':
      config.concurrency = parseInt(value, 10);
      break;
    case '--timeout':
      config.timeout = parseInt(value, 10);
      break;
    case '--severity':
      config.severity = value;
      break;
    case '--mod-filter':
      config.modFilter = new RegExp(value);
      break;
    default:
      throw new Error(`Unknown option: ${flag}`);
  }
}

/**
 * Validates configuration for consistency and correctness
 *
 * @param {object} config - Configuration to validate
 */
function validateConfiguration(config) {
  const validFormats = ['console', 'json', 'html', 'markdown', 'junit', 'csv'];
  if (!validFormats.includes(config.format)) {
    throw new Error(`Invalid format: ${config.format}`);
  }

  if (config.concurrency < 1 || config.concurrency > 20) {
    throw new Error('Concurrency must be between 1 and 20');
  }

  if (config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms');
  }
}

/**
 * Runs validation based on configuration
 *
 * @param {object} orchestrator - Validation orchestrator
 * @param {object} config - CLI configuration
 * @returns {Promise<object>} Validation results
 */
async function runValidation(orchestrator, config) {
  if (!config.quiet) {
    console.log('🔍 Starting validation...');
    if (config.ecosystem) {
      console.log('   Scope: Entire mod ecosystem');
    } else {
      console.log(`   Scope: ${config.mods.length} specific mods`);
    }
    console.log(`   Types: ${getValidationTypes(config).join(', ')}`);
    console.log('');
  }

  const validationOptions = {
    skipCrossReferences: !config.crossReferences,
    failFast: config.failFast,
    modsToValidate: config.mods,
    strictMode: config.strictMode,
    continueOnError: config.continueOnError,
    timeout: config.timeout,
  };

  let results;

  if (config.ecosystem) {
    results = await orchestrator.validateEcosystem(validationOptions);
  } else {
    // Validate specific mods
    const modResults = new Map();
    const errors = [];

    for (const modId of config.mods) {
      try {
        if (!config.quiet) {
          console.log(`🔍 Validating mod: ${modId}`);
        }

        const modResult = await orchestrator.validateMod(modId, {
          skipCrossReferences: !config.crossReferences,
          includeContext: true,
        });

        modResults.set(modId, modResult);
      } catch (error) {
        errors.push({ modId, error: error.message });
        if (config.failFast) {
          throw error;
        }
      }
    }

    results = modResults;
    if (errors.length > 0) {
      results.errors = errors;
    }
  }

  return results;
}

/**
 * Configures logging based on CLI options
 *
 * @param {object} logger - Logger instance
 * @param {object} config - CLI configuration
 */
function configureLogging(logger, config) {
  if (config.quiet) {
    // Suppress all logging
    logger.debug = () => {};
    logger.info = () => {};
    logger.warn = () => {};
  } else if (!config.verbose) {
    // Suppress debug logging
    logger.debug = () => {};
  }
}

/**
 * Shows validation summary
 *
 * @param {object} results - Validation results
 * @param {number} executionTime - Execution time in milliseconds
 */
function showValidationSummary(results, executionTime) {
  console.log('\n📊 Validation Summary:');
  console.log(`   • Execution time: ${executionTime.toFixed(2)}ms`);

  if (results instanceof Map) {
    // Individual mod results
    console.log(`   • Mods validated: ${results.size}`);
    const modsWithViolations = Array.from(results.values()).filter(
      (r) => r.crossReferences?.hasViolations
    ).length;
    console.log(`   • Mods with violations: ${modsWithViolations}`);
  } else {
    // Ecosystem results
    console.log(
      `   • Dependencies valid: ${results.dependencies?.isValid ? 'Yes' : 'No'}`
    );
    if (results.crossReferences) {
      const totalViolations = Array.from(
        results.crossReferences.values()
      ).reduce((sum, r) => sum + r.violations.length, 0);
      console.log(`   • Cross-reference violations: ${totalViolations}`);
    }
  }
}

/**
 * Calculates appropriate exit code based on results
 *
 * @param {object} results - Validation results
 * @param {object} config - CLI configuration
 * @returns {number} Exit code
 */
function calculateExitCode(results, config) {
  let hasErrors = false;
  let hasViolations = false;

  if (results instanceof Map) {
    hasViolations = Array.from(results.values()).some(
      (r) => r.crossReferences?.hasViolations
    );
    hasErrors = results.errors && results.errors.length > 0;
  } else {
    hasErrors = !results.dependencies?.isValid || results.errors?.length > 0;
    if (results.crossReferences) {
      hasViolations = Array.from(results.crossReferences.values()).some(
        (r) => r.hasViolations
      );
    }
  }

  if (hasErrors) {
    return 2; // System/dependency errors
  } else if (hasViolations && config.strictMode) {
    return 1; // Validation violations in strict mode
  } else {
    return 0; // Success
  }
}

/**
 * Gets list of validation types from configuration
 *
 * @param {object} config - CLI configuration
 * @returns {string[]} List of enabled validation types
 */
function getValidationTypes(config) {
  const types = [];
  if (config.dependencies) types.push('Dependencies');
  if (config.crossReferences) types.push('Cross-references');
  if (config.loadOrder) types.push('Load order');
  return types;
}

/**
 * Shows comprehensive help information
 */
function showHelp() {
  console.log(`Living Narrative Engine Mod Validator v${CLI_VERSION}

USAGE:
    validateMods [OPTIONS]

DESCRIPTION:
    Validates mod dependencies and cross-references in the Living Narrative Engine.
    Supports ecosystem-wide validation or validation of specific mods.

VALIDATION SCOPE:
    --mod <name>, -m <name>     Validate specific mod (can be used multiple times)
    --ecosystem, -e             Validate entire mod ecosystem (default)

VALIDATION TYPES:
    --no-dependencies           Skip dependency validation
    --no-cross-references       Skip cross-reference validation
    --check-load-order          Include load order validation

OUTPUT OPTIONS:
    --format <fmt>, -f <fmt>    Output format (console|json|html|markdown|junit|csv)
    --output <file>, -o <file>  Write output to file instead of stdout
    --colors                    Force colored output
    --no-colors                 Disable colored output
    --verbose, -v               Verbose output with detailed information
    --quiet, -q                 Minimal output (errors only)

BEHAVIOR OPTIONS:
    --fail-fast                 Stop validation on first failure
    --strict, -s                Treat warnings as errors
    --no-suggestions           Hide fix suggestions
    --no-summary               Hide summary information

PERFORMANCE OPTIONS:
    --concurrency <n>, -c <n>   Concurrent validation limit (1-20, default: 3)
    --timeout <ms>              Validation timeout per mod (min: 1000, default: 60000)

FILTER OPTIONS:
    --severity <level>          Filter by severity (critical|high|medium|low)
    --mod-filter <regex>        Filter mods by name using regex pattern

ADVANCED OPTIONS:
    --include-metadata          Include detailed metadata in JSON/HTML output
    --no-cache                  Disable validation result caching

EXAMPLES:
    validateMods                                    # Validate entire ecosystem
    validateMods --mod positioning --mod intimacy  # Validate specific mods
    validateMods --format json -o report.json      # Generate JSON report
    validateMods --strict --fail-fast               # Strict validation, stop on first error
    validateMods --severity critical                # Show only critical violations
    validateMods --mod-filter "^(core|positioning)$"  # Validate mods matching pattern

EXIT CODES:
    0    Success (no violations or violations in non-strict mode)
    1    Validation violations found (in strict mode)
    2    System errors or dependency validation failures
`);
}

// Export for testing
export { main, parseArguments, runValidation, calculateExitCode };

// Run if called directly (but not in test environment)
try {
  if (
    import.meta.url === `file://${process.argv[1]}` &&
    process.env.NODE_ENV !== 'test' &&
    typeof jest === 'undefined'
  ) {
    main();
  }
} catch (e) {
  // In Jest/CommonJS environment, check if we should run
  if (
    process.env.NODE_ENV !== 'test' &&
    typeof jest === 'undefined' &&
    process.argv[1] &&
    process.argv[1].endsWith('validateMods.js')
  ) {
    main();
  }
}
