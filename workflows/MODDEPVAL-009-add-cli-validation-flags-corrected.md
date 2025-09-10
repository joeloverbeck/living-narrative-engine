# MODDEPVAL-009: Add CLI Validation Flags and Backward Compatibility (CORRECTED)

## Overview

Implement comprehensive command-line interface enhancements for mod validation, ensuring backward compatibility while providing powerful new validation capabilities. This includes creating new CLI tools, enhancing existing scripts, and providing seamless integration with development workflows.

## Background

The validation system needs accessible CLI interfaces that integrate naturally with existing development workflows while maintaining complete backward compatibility. This ticket focuses on:

- **New CLI tools**: Dedicated validation commands
- **Enhanced existing tools**: Backward-compatible enhancements
- **Developer workflow integration**: Seamless integration with existing processes
- **Flexible options**: Fine-grained control over validation behavior

## Technical Specifications

### New Dedicated Validation CLI Tool

```javascript
// scripts/validateMods.js - New dedicated validation CLI

#!/usr/bin/env node

// CORRECTED: Use ES6 imports as per project convention
import AppContainer from '../src/dependencyInjection/appContainer.js';
import { coreTokens } from '../src/dependencyInjection/tokens/tokens-core.js';
import { configureBaseContainer } from '../src/dependencyInjection/baseContainerConfig.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI configuration
const CLI_VERSION = '1.0.0';
const DEFAULT_CONFIG = {
  // Validation scope
  mods: null,              // null = all mods, or array of mod names
  ecosystem: true,         // validate entire ecosystem vs individual mods

  // Validation types
  dependencies: true,      // validate dependencies
  crossReferences: true,   // validate cross-references
  loadOrder: false,        // validate load order

  // Output options
  format: 'console',       // console, json, html, markdown (junit and csv not supported yet)
  output: null,           // output file path (null = stdout)
  colors: null,           // null = auto-detect, true/false = force
  verbose: false,         // verbose output
  quiet: false,           // minimal output

  // Behavior options
  failFast: false,        // stop on first failure
  continueOnError: true,  // continue validation even if individual mods fail
  showSuggestions: true,  // show fix suggestions
  showSummary: true,      // show summary at end

  // Performance options
  concurrency: 3,         // concurrent validation limit
  timeout: 60000,         // validation timeout per mod (ms)

  // Advanced options
  strictMode: false,      // treat warnings as errors
  includeMetadata: false, // include detailed metadata in output
  cacheResults: true,     // cache validation results

  // Filter options
  severity: null,         // filter by severity (critical, high, medium, low)
  violationType: null,    // filter by violation type
  modFilter: null,        // regex filter for mod names
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

    // Initialize validation components
    // CORRECTED: Proper container initialization
    const container = new AppContainer();
    
    // Configure base container with minimal options for CLI usage
    await configureBaseContainer(container, {
      suppressLogging: config.quiet,
      verboseLogging: config.verbose,
    });
    
    // CORRECTED: Use coreTokens instead of tokens
    const orchestrator = container.resolve(coreTokens.IModValidationOrchestrator);
    const reporter = container.resolve(coreTokens.IViolationReporter);
    const logger = container.resolve(coreTokens.ILogger);

    // Configure logging based on verbosity
    configureLogging(logger, config);

    console.log('🔍 Living Narrative Engine - Mod Validation Tool');
    console.log(`   Version: ${CLI_VERSION}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');

    // Run validation
    const startTime = performance.now();
    const results = await runValidation(orchestrator, config);
    const endTime = performance.now();

    // Generate and output report
    const reportOptions = {
      colors: config.colors !== false && (config.colors === true || process.stdout.isTTY),
      verbose: config.verbose,
      showSuggestions: config.showSuggestions,
      includeMetadata: config.includeMetadata,
      severity: config.severity,
      violationType: config.violationType
    };

    const report = reporter.generateReport(results, config.format, reportOptions);

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
    console.error('❌ Validation failed:', error.message);
    if (args.includes('--verbose') || args.includes('-v')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Parses command line arguments with comprehensive option support
 * @param {string[]} args - Raw command line arguments
 * @returns {Object} Parsed configuration
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
      case '-v':
        config.verbose = true;
        config.quiet = false;
        break;
      case '--quiet':
      case '-q':
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
            throw new Error(`Invalid severity: ${nextArg}. Valid options: ${validSeverities.join(', ')}`);
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
          throw new Error(`Unknown option: ${arg}. Use --help for usage information.`);
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
 * @param {Object} config - Configuration object to modify
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
      throw new Error(`Unknown option: ${flag}. Use --help for usage information.`);
  }
}

/**
 * Validates configuration for consistency and correctness
 * @param {Object} config - Configuration to validate
 */
function validateConfiguration(config) {
  // CORRECTED: Only formats currently supported by ViolationReporter
  const validFormats = ['console', 'json', 'html', 'markdown'];
  if (!validFormats.includes(config.format)) {
    throw new Error(`Invalid format: ${config.format}. Valid options: ${validFormats.join(', ')}`);
  }

  if (config.concurrency < 1 || config.concurrency > 20) {
    throw new Error('Concurrency must be between 1 and 20');
  }

  if (config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms');
  }

  if (config.quiet && config.verbose) {
    throw new Error('Cannot use --quiet and --verbose together');
  }
}

/**
 * Runs validation based on configuration
 * @param {Object} orchestrator - Validation orchestrator
 * @param {Object} config - CLI configuration
 * @returns {Promise<Object>} Validation results
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
    timeout: config.timeout
  };

  let results;

  if (config.ecosystem) {
    // CORRECTED: validateEcosystem method exists in ModValidationOrchestrator
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

        // CORRECTED: validateMod method exists in ModValidationOrchestrator
        const modResult = await orchestrator.validateMod(modId, {
          skipCrossReferences: !config.crossReferences,
          includeContext: true
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
 * @param {Object} logger - Logger instance
 * @param {Object} config - CLI configuration
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
 * @param {Object} results - Validation results
 * @param {number} executionTime - Execution time in milliseconds
 */
function showValidationSummary(results, executionTime) {
  console.log('\n📊 Validation Summary:');
  console.log(`   • Execution time: ${executionTime.toFixed(2)}ms`);

  if (results instanceof Map) {
    // Individual mod results
    console.log(`   • Mods validated: ${results.size}`);
    const modsWithViolations = Array.from(results.values()).filter(r =>
      r.crossReferences?.hasViolations
    ).length;
    console.log(`   • Mods with violations: ${modsWithViolations}`);
  } else {
    // Ecosystem results
    console.log(`   • Dependencies valid: ${results.dependencies?.isValid ? 'Yes' : 'No'}`);
    if (results.crossReferences) {
      const totalViolations = Array.from(results.crossReferences.values())
        .reduce((sum, r) => sum + r.violations.length, 0);
      console.log(`   • Cross-reference violations: ${totalViolations}`);
    }
  }
}

/**
 * Calculates appropriate exit code based on results
 * @param {Object} results - Validation results
 * @param {Object} config - CLI configuration
 * @returns {number} Exit code
 */
function calculateExitCode(results, config) {
  let hasErrors = false;
  let hasViolations = false;

  if (results instanceof Map) {
    hasViolations = Array.from(results.values()).some(r =>
      r.crossReferences?.hasViolations
    );
    hasErrors = results.errors && results.errors.length > 0;
  } else {
    hasErrors = !results.dependencies?.isValid || results.errors?.length > 0;
    if (results.crossReferences) {
      hasViolations = Array.from(results.crossReferences.values())
        .some(r => r.hasViolations);
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
 * @param {Object} config - CLI configuration
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
    node scripts/validateMods.js [OPTIONS]

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
    --format <fmt>, -f <fmt>    Output format (console|json|html|markdown)
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
    node scripts/validateMods.js                         # Validate entire ecosystem
    node scripts/validateMods.js --mod positioning --mod intimacy  # Validate specific mods
    node scripts/validateMods.js --format json -o report.json      # Generate JSON report
    node scripts/validateMods.js --strict --fail-fast              # Strict validation, stop on first error
    node scripts/validateMods.js --severity critical               # Show only critical violations
    node scripts/validateMods.js --mod-filter "^(core|positioning)$"  # Validate mods matching pattern

EXIT CODES:
    0    Success (no violations or violations in non-strict mode)
    1    Validation violations found (in strict mode)
    2    System errors or dependency validation failures
`);
}

// Export for testing
export { main, parseArguments, runValidation, calculateExitCode };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

### Enhanced Package.json Scripts

```json
{
  "scripts": {
    "validate": "node scripts/validateMods.js",
    "validate:ecosystem": "node scripts/validateMods.js --ecosystem",
    "validate:mod": "node scripts/validateMods.js --mod",
    "validate:strict": "node scripts/validateMods.js --strict",
    "validate:json": "node scripts/validateMods.js --format json",
    "validate:html": "node scripts/validateMods.js --format html --output validation-report.html",

    "validate:quick": "node scripts/validateMods.js --no-dependencies --quiet",
    "validate:dependencies": "node scripts/validateMods.js --no-cross-references",
    "validate:cross-refs": "node scripts/validateMods.js --no-dependencies",

    "validate:critical": "node scripts/validateMods.js --severity critical",

    "update-manifest": "node scripts/updateManifest.js",
    "update-manifest:validate": "node scripts/updateManifest.js --validate-references",
    "update-manifest:strict": "node scripts/updateManifest.js --validate-references --fail-on-violations"
  }
}
```

### Backward Compatibility for updateManifest.js

The updateManifest.js file already exists and has validation integration. No changes needed as it already supports:
- `--validate-references` flag
- `--fail-on-violations` flag
- `--format` flag for output formatting
- `--batch` mode for processing all mods
- Proper container initialization with AppContainer

### Configuration File Support

```javascript
// scripts/lib/configLoader.js - Configuration file support

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads configuration from various sources
 * @param {Object} cliConfig - CLI-provided configuration
 * @returns {Promise<Object>} Merged configuration
 */
export async function loadConfiguration(cliConfig = {}) {
  const configs = [];

  // 1. Default configuration
  configs.push(await loadDefaultConfig());

  // 2. Global configuration
  const globalConfig = await loadGlobalConfig();
  if (globalConfig) configs.push(globalConfig);

  // 3. Project configuration
  const projectConfig = await loadProjectConfig();
  if (projectConfig) configs.push(projectConfig);

  // 4. Local configuration
  const localConfig = await loadLocalConfig();
  if (localConfig) configs.push(localConfig);

  // 5. CLI configuration (highest priority)
  configs.push(cliConfig);

  // Merge configurations
  return mergeConfigurations(configs);
}

/**
 * Loads default configuration
 */
async function loadDefaultConfig() {
  return {
    validation: {
      dependencies: true,
      crossReferences: true,
      loadOrder: false,
      strictMode: false,
      continueOnError: true,
      timeout: 60000,
      concurrency: 3,
    },
    output: {
      format: 'console',
      colors: null, // auto-detect
      verbose: false,
      quiet: false,
      showSuggestions: true,
      showSummary: true,
    },
    filters: {
      severity: null,
      violationType: null,
      modFilter: null,
    },
  };
}

/**
 * Loads global configuration from user home directory
 */
async function loadGlobalConfig() {
  const configPaths = [
    path.join(process.env.HOME || '', '.living-narrative-validate.json'),
    path.join(
      process.env.HOME || '',
      '.config',
      'living-narrative-validate',
      'config.json'
    ),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Config file doesn't exist or is invalid
      continue;
    }
  }

  return null;
}

/**
 * Loads project-specific configuration
 */
async function loadProjectConfig() {
  const configPaths = [
    'living-narrative-validate.json',
    '.living-narrative-validate.json',
    'validate.config.json',
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Loads local configuration (project/.validate directory)
 */
async function loadLocalConfig() {
  try {
    const content = await fs.readFile('.validate/config.json', 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Merges multiple configuration objects
 * @param {Object[]} configs - Configuration objects to merge
 * @returns {Object} Merged configuration
 */
function mergeConfigurations(configs) {
  return configs.reduce((merged, config) => {
    return deepMerge(merged, config);
  }, {});
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
```

### Enhanced Error Handling and Help System

```javascript
// scripts/lib/errorHandler.js - Enhanced error handling

// CORRECTED: chalk is a devDependency, so we need to handle dynamic import
let chalk;
try {
  chalk = await import('chalk');
} catch {
  // Fallback if chalk is not available
  chalk = {
    red: (text) => text,
    yellow: (text) => text,
    cyan: (text) => text,
    blue: (text) => text,
  };
}

/**
 * Enhanced error handler with context-aware suggestions
 */
export class ValidationCLIError extends Error {
  constructor(message, type = 'GENERAL_ERROR', suggestions = []) {
    super(message);
    this.name = 'ValidationCLIError';
    this.type = type;
    this.suggestions = suggestions;
  }
}

/**
 * Handles and displays CLI errors with helpful suggestions
 * @param {Error} error - Error to handle
 * @param {Object} config - CLI configuration for context
 */
export function handleCLIError(error, config = {}) {
  console.error(chalk.red('❌ Error:'), error.message);

  if (error instanceof ValidationCLIError) {
    // Show error-specific suggestions
    if (error.suggestions.length > 0) {
      console.error('\n💡 Suggestions:');
      error.suggestions.forEach((suggestion, i) => {
        console.error(chalk.yellow(`   ${i + 1}. ${suggestion}`));
      });
    }

    // Show context-specific help
    showContextualHelp(error.type, config);
  }

  if (config.verbose && error.stack) {
    console.error('\n🔍 Stack trace:');
    console.error(error.stack);
  }

  console.error(`\n📖 Use ${chalk.cyan('--help')} for usage information.`);
}

/**
 * Shows contextual help based on error type
 */
function showContextualHelp(errorType, config) {
  const contextHelp = {
    INVALID_MOD: [
      'Check that the mod exists in the data/mods/ directory',
      'Verify the mod name is spelled correctly',
      'Use --ecosystem to validate all mods',
    ],
    INVALID_FORMAT: [
      'Supported formats: console, json, html, markdown',
      'Use --format console for terminal output',
      'Use --format json for machine-readable output',
    ],
    VALIDATION_TIMEOUT: [
      'Increase timeout with --timeout <milliseconds>',
      'Reduce concurrency with --concurrency <number>',
      'Try validating specific mods instead of entire ecosystem',
    ],
    DEPENDENCY_INJECTION_FAILED: [
      'Ensure all required dependencies are properly installed',
      'Check that the project is properly built',
      'Try running npm install to restore dependencies',
    ],
  };

  const help = contextHelp[errorType];
  if (help && help.length > 0) {
    console.error('\n🎯 Specific help:');
    help.forEach((tip, i) => {
      console.error(chalk.blue(`   ${i + 1}. ${tip}`));
    });
  }
}

/**
 * Validates CLI environment and provides setup suggestions
 */
export async function validateEnvironment() {
  const issues = [];

  // Check for required directories
  try {
    await fs.access('data/mods');
  } catch (error) {
    issues.push({
      type: 'MISSING_MODS_DIRECTORY',
      message: 'Mods directory not found',
      suggestion: 'Ensure you are running from the project root directory',
    });
  }

  // Check for dependency injection container
  try {
    const { default: AppContainer } = await import(
      '../src/dependencyInjection/appContainer.js'
    );
    // Test container instantiation
    new AppContainer();
  } catch (error) {
    issues.push({
      type: 'DEPENDENCY_INJECTION_FAILED',
      message: 'Dependency injection system not available',
      suggestion: 'Run npm install and ensure project is properly built',
    });
  }

  return issues;
}
```

### Tab Completion Support

```bash
#!/bin/bash
# scripts/completion/validateMods-completion.bash

_validate_mods_completion() {
    local cur prev opts
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Available options
    opts="--help --version --mod --ecosystem --no-dependencies --no-cross-references
          --check-load-order --format --output --colors --no-colors --verbose --quiet
          --fail-fast --strict --no-suggestions --no-summary --concurrency --timeout
          --severity --mod-filter --include-metadata --no-cache"

    case "${prev}" in
        --format|-f)
            # CORRECTED: Only formats supported by ViolationReporter
            COMPREPLY=($(compgen -W "console json html markdown" -- ${cur}))
            return 0
            ;;
        --severity)
            COMPREPLY=($(compgen -W "critical high medium low" -- ${cur}))
            return 0
            ;;
        --mod|-m)
            # Complete with available mod names
            local mods_dir="data/mods"
            if [[ -d "$mods_dir" ]]; then
                local mods=$(ls -1 "$mods_dir" 2>/dev/null)
                COMPREPLY=($(compgen -W "$mods" -- ${cur}))
            fi
            return 0
            ;;
        --output|-o)
            # Complete with file names
            COMPREPLY=($(compgen -f -- ${cur}))
            return 0
            ;;
        --concurrency|-c)
            COMPREPLY=($(compgen -W "1 2 3 4 5" -- ${cur}))
            return 0
            ;;
        --timeout)
            COMPREPLY=($(compgen -W "30000 60000 120000" -- ${cur}))
            return 0
            ;;
    esac

    COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
    return 0
}

# Register completion
complete -F _validate_mods_completion validateMods
complete -F _validate_mods_completion "node scripts/validateMods.js"
```

### GitHub Actions Workflow Integration

```yaml
# .github/workflows/mod-validation.yml

name: Mod Validation

on:
  push:
    paths:
      - 'data/mods/**'
      - 'scripts/validateMods.js'
      - 'scripts/updateManifest.js'
  pull_request:
    paths:
      - 'data/mods/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        validation-type: [quick, full, strict]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run validation
        run: |
          case "${{ matrix.validation-type }}" in
            quick)
              npm run validate:quick
              ;;
            full)
              npm run validate:ecosystem
              ;;
            strict)
              npm run validate:strict
              ;;
          esac

      - name: Upload validation results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: validation-results-${{ matrix.validation-type }}
          path: validation-report.*
```

## Testing Requirements

### CLI Testing Framework

```javascript
// tests/unit/scripts/validateMods.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  parseArguments,
  runValidation,
  calculateExitCode,
} from '../../../scripts/validateMods.js';

describe('ValidateMods CLI', () => {
  describe('Argument Parsing', () => {
    it('should parse basic validation options', () => {
      const args = ['--mod', 'positioning', '--format', 'json', '--verbose'];
      const config = parseArguments(args);

      expect(config.mods).toEqual(['positioning']);
      expect(config.ecosystem).toBe(false);
      expect(config.format).toBe('json');
      expect(config.verbose).toBe(true);
    });

    it('should parse --flag=value format', () => {
      const args = ['--format=html', '--output=report.html', '--concurrency=5'];
      const config = parseArguments(args);

      expect(config.format).toBe('html');
      expect(config.output).toBe('report.html');
      expect(config.concurrency).toBe(5);
    });

    it('should handle conflicting options appropriately', () => {
      expect(() => {
        parseArguments(['--quiet', '--verbose']);
      }).toThrow('Cannot use --quiet and --verbose together');
    });

    it('should validate format options', () => {
      expect(() => {
        parseArguments(['--format', 'invalid']);
      }).toThrow('Invalid format: invalid');
    });
  });

  describe('Exit Code Calculation', () => {
    it('should return 0 for successful validation', () => {
      const results = new Map([
        ['mod1', { crossReferences: { hasViolations: false } }],
      ]);
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(0);
    });

    it('should return 1 for violations in strict mode', () => {
      const results = new Map([
        ['mod1', { crossReferences: { hasViolations: true } }],
      ]);
      const config = { strictMode: true };

      expect(calculateExitCode(results, config)).toBe(1);
    });

    it('should return 2 for system errors', () => {
      const results = {
        dependencies: { isValid: false },
        errors: ['Dependency validation failed'],
      };
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(2);
    });
  });
});
```

## Success Criteria

- [x] Comprehensive CLI tool provides full validation functionality
- [x] Backward compatibility maintained for all existing scripts and APIs
- [x] Multiple output formats support different development workflows (console, json, html, markdown)
- [x] Configuration file support enables team standardization
- [x] Tab completion improves developer experience
- [ ] VS Code integration provides IDE-level validation access (requires .vscode directory creation)
- [ ] NPX support allows global installation and usage (requires bin directory creation)
- [x] Error handling provides actionable guidance for resolution
- [x] Performance options allow optimization for different use cases
- [x] CI/CD integration supports automated validation workflows

## Implementation Notes

### Key Corrections Made

1. **Import System**: Changed from CommonJS `require()` to ES6 `import` statements to match project convention
2. **Container Initialization**: Use `AppContainer` directly instead of non-existent `container.js` export
3. **Token Imports**: Import from `coreTokens` instead of generic `tokens` object
4. **Container Configuration**: Use `configureBaseContainer` instead of full `configureContainer` for CLI usage
5. **Output Formats**: Removed `junit` and `csv` formats as they're not implemented in ViolationReporter
6. **Module Paths**: Corrected all import paths to match actual file locations
7. **Dependency Management**: Handle chalk as devDependency with dynamic import and fallback

### Differences from Original Workflow

1. **No bin directory**: Would need to be created for NPX support
2. **No .vscode directory**: Would need to be created for VS Code integration
3. **Limited output formats**: ViolationReporter only supports console, json, html, markdown (not junit, csv)
4. **Existing updateManifest.js**: Already has validation integration, doesn't need backward compatibility wrapper
5. **Container instantiation**: Must create new AppContainer instance rather than importing singleton

### Developer Experience Focus

- **Progressive disclosure**: Basic usage simple, advanced features discoverable
- **Clear error messages**: Actionable suggestions for common problems
- **Flexible output**: Support for human and machine consumption
- **Performance awareness**: Options to control resource usage

### Maintenance Strategy

- **Backward compatibility**: Maintain existing APIs indefinitely
- **Versioning**: Clear version management for CLI tools
- **Documentation**: Comprehensive help and usage examples
- **Testing**: Extensive test coverage for CLI functionality

## Next Steps

After completion:

1. **Create bin directory**: For NPX support
2. **Create .vscode directory**: For VS Code task integration
3. **Extend ViolationReporter**: Add junit and csv output formats if needed
4. **Documentation**: Create comprehensive CLI usage guides
5. **Team adoption**: Roll out enhanced CLI to development team

## References

- **Existing validation infrastructure**: ModValidationOrchestrator, ViolationReporter
- **Container system**: AppContainer, configureBaseContainer
- **Token system**: coreTokens from tokens-core.js
- **Existing scripts**: updateManifest.js with validation integration