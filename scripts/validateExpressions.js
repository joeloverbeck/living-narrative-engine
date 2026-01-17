#!/usr/bin/env node

/**
 * @file Expression Prerequisite Validation CLI
 * @description Validates expression prerequisite JSON Logic structure and var paths
 *
 * Usage:
 *   node scripts/validateExpressions.js [OPTIONS]
 *   npm run validate:expressions [OPTIONS]
 *
 * Options:
 *   --path <path>     Custom path to validate (default: data/mods/emotions-[name]/expressions/)
 *   --strict          Treat warnings as errors (exit 1 on any issue)
 *   --quiet           Minimal output (errors only)
 *   --verbose         Include detailed information about each violation
 *   --help, -h        Show this help message
 *
 * Examples:
 *   npm run validate:expressions                                      # Validate all expressions
 *   npm run validate:expressions -- --strict                          # Exit 1 on any issue
 *   npm run validate:expressions -- --path tests/fixtures/expressionDiagnostics  # Custom path
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { ExpressionPrerequisiteValidator } from '../src/validation/expressionPrerequisiteValidator.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const projectRoot = path.resolve(currentDirPath, '..');

const CLI_VERSION = '1.0.0';

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const config = parseArguments(args);

  // Handle help
  if (config.help) {
    showHelp();
    process.exit(0);
  }

  if (!config.quiet) {
    console.log(`\n🔍 Expression Prerequisite Validator v${CLI_VERSION}\n`);
  }

  // Determine expression file pattern
  const pattern = config.customPath
    ? resolveCustomPattern(config.customPath)
    : path.join(
        projectRoot,
        'data/mods/emotions-*/expressions/*.expression.json'
      );

  if (!config.quiet) {
    console.log(`📁 Scanning: ${pattern}\n`);
  }

  // Find expression files
  const expressionFiles = glob.sync(pattern);

  if (expressionFiles.length === 0) {
    console.log('⚠️  No expression files found matching pattern.');
    process.exit(0);
  }

  if (!config.quiet) {
    console.log(`📋 Found ${expressionFiles.length} expression file(s)\n`);
  }

  // Create validator
  const validator = new ExpressionPrerequisiteValidator();

  // Track results
  const allViolations = [];
  const allWarnings = [];
  let filesWithIssues = 0;

  // Validate each file
  for (const filePath of expressionFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const expression = JSON.parse(content);

      // Extract mod ID from file path or expression id
      const modId = extractModId(filePath, expression);

      const result = validator.validateExpression(expression, {
        modId,
        source: path.relative(projectRoot, filePath),
        strictMode: config.strict,
      });

      if (result.violations.length > 0 || result.warnings.length > 0) {
        filesWithIssues++;

        for (const violation of result.violations) {
          allViolations.push({
            ...violation,
            filePath: path.relative(projectRoot, filePath),
          });
        }

        for (const warning of result.warnings) {
          allWarnings.push({
            ...warning,
            filePath: path.relative(projectRoot, filePath),
          });
        }
      }
    } catch (parseError) {
      allViolations.push({
        issueType: 'parse_error',
        filePath: path.relative(projectRoot, filePath),
        message: `Failed to parse file: ${parseError.message}`,
        severity: 'critical',
      });
      filesWithIssues++;
    }
  }

  // Print results
  printResults(allViolations, allWarnings, config);

  // Print summary
  if (!config.quiet) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Validation Summary\n');
    console.log(`   • Files scanned: ${expressionFiles.length}`);
    console.log(`   • Files with issues: ${filesWithIssues}`);
    console.log(`   • Violations: ${allViolations.length}`);
    console.log(`   • Warnings: ${allWarnings.length}`);
    console.log('='.repeat(70));
  }

  // Determine exit code
  const hasViolations = allViolations.length > 0;
  const hasWarnings = allWarnings.length > 0;

  if (hasViolations) {
    if (!config.quiet) {
      console.log('\n❌ Validation failed with errors.\n');
    }
    process.exit(1);
  } else if (hasWarnings && config.strict) {
    if (!config.quiet) {
      console.log('\n❌ Validation failed (strict mode: warnings treated as errors).\n');
    }
    process.exit(1);
  } else if (hasWarnings) {
    if (!config.quiet) {
      console.log('\n⚠️  Validation passed with warnings.\n');
    }
    process.exit(0);
  } else {
    if (!config.quiet) {
      console.log('\n✅ All expressions validated successfully!\n');
    }
    process.exit(0);
  }
}

/**
 * Parse command line arguments
 *
 * @param {string[]} args - Raw command line arguments
 * @returns {object} Parsed configuration
 */
function parseArguments(args) {
  const config = {
    help: false,
    strict: false,
    quiet: false,
    verbose: false,
    customPath: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        config.help = true;
        break;
      case '--strict':
      case '-s':
        config.strict = true;
        break;
      case '--quiet':
      case '-q':
        config.quiet = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--path':
      case '-p':
        if (nextArg && !nextArg.startsWith('-')) {
          config.customPath = nextArg;
          i++;
        } else {
          console.error('Error: --path requires a value');
          process.exit(2);
        }
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(2);
        }
        break;
    }
  }

  return config;
}

/**
 * Resolve custom path to a glob pattern
 *
 * @param {string} customPath - User-provided path
 * @returns {string} Resolved glob pattern
 */
function resolveCustomPattern(customPath) {
  const absolutePath = path.isAbsolute(customPath)
    ? customPath
    : path.join(projectRoot, customPath);

  // Check if it's a directory
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      return path.join(absolutePath, '**/*.expression.json');
    }
  } catch {
    // Path doesn't exist yet or is a pattern
  }

  // Assume it's a file or glob pattern
  if (path.isAbsolute(customPath)) {
    return customPath;
  }
  return path.join(projectRoot, customPath);
}

/**
 * Extract mod ID from file path or expression
 *
 * @param {string} filePath - Full file path
 * @param {object} expression - Parsed expression object
 * @returns {string} Mod ID
 */
function extractModId(filePath, expression) {
  // Try to extract from expression id (format: modId:expressionId)
  if (expression.id && expression.id.includes(':')) {
    return expression.id.split(':')[0];
  }

  // Fall back to extracting from path
  const match = filePath.match(/mods\/([^/]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Print validation results
 *
 * @param {Array} violations - List of violations
 * @param {Array} warnings - List of warnings
 * @param {object} config - CLI configuration
 */
function printResults(violations, warnings, config) {
  // Print violations
  if (violations.length > 0) {
    console.log('\n❌ VIOLATIONS:\n');
    for (const v of violations) {
      printIssue(v, 'ERROR', config);
    }
  }

  // Print warnings (unless quiet and not strict)
  if (warnings.length > 0 && (!config.quiet || config.strict)) {
    console.log('\n⚠️  WARNINGS:\n');
    for (const w of warnings) {
      printIssue(w, 'WARN', config);
    }
  }
}

/**
 * Print a single issue
 *
 * @param {object} issue - Issue object
 * @param {string} level - 'ERROR' or 'WARN'
 * @param {object} config - CLI configuration
 */
function printIssue(issue, level, config) {
  const prefix = level === 'ERROR' ? '[ERROR]' : '[WARN]';
  const expressionInfo = issue.expressionId ? ` - ${issue.expressionId}` : '';
  const prereqInfo =
    issue.prerequisiteIndex !== undefined
      ? ` - prerequisite #${issue.prerequisiteIndex}`
      : '';

  console.log(`${prefix} ${issue.filePath}${expressionInfo}${prereqInfo}`);
  console.log(`       ${issue.message}`);

  if (config.verbose) {
    if (issue.varPath) {
      console.log(`       Var path: ${issue.varPath}`);
    }
    if (issue.logicSummary) {
      console.log(`       Logic: ${issue.logicSummary}`);
    }
    if (issue.severity) {
      console.log(`       Severity: ${issue.severity}`);
    }
  }

  // Print fix hint based on issue type
  const hint = getFixHint(issue);
  if (hint) {
    console.log(`       Fix: ${hint}`);
  }

  console.log('');
}

/**
 * Get fix hint for an issue
 *
 * @param {object} issue - Issue object
 * @returns {string|null} Fix hint
 */
function getFixHint(issue) {
  switch (issue.issueType) {
    case 'missing_logic':
      return 'Add a "logic" property with valid JSON Logic to the prerequisite.';
    case 'invalid_logic':
      return 'Ensure prerequisite.logic is a valid JSON Logic object with a single operator.';
    case 'invalid_operator':
      return 'Use a supported JSON Logic operator (and, or, ==, >=, <, var, etc.).';
    case 'invalid_var_root':
      return `Use an allowed var root: emotions, sexualStates, moodAxes, affectTraits, previousEmotions, previousSexualStates, previousMoodAxes, sexualArousal, actor.`;
    case 'invalid_var_path':
      return 'Check the var path format (e.g., "emotions.joy", "moodAxes.valence").';
    case 'unknown_var_key':
      return 'Verify the emotion/state/axis name exists in your mod definitions.';
    case 'range_mismatch':
      return 'Use values within the valid range: emotions/sexualStates (0-1), moodAxes (-100 to 100).';
    case 'mood_axes_fractional_threshold':
      return 'Use integer values when comparing mood axes (not decimals).';
    case 'mood_axes_mixed_scale':
      return 'Avoid mixing mood axes (-100..100) with normalized values (0..1) without scaling.';
    case 'invalid_args':
      return 'Check the operator arguments match the expected format.';
    case 'vacuous_operator':
      return 'Add at least one condition to the "and" or "or" operator.';
    case 'parse_error':
      return 'Fix the JSON syntax error in the file.';
    default:
      return null;
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`Expression Prerequisite Validator v${CLI_VERSION}

USAGE:
    node scripts/validateExpressions.js [OPTIONS]
    npm run validate:expressions [-- OPTIONS]

DESCRIPTION:
    Validates expression prerequisite JSON Logic structure and var paths.
    Checks for valid operators, var path roots, and value ranges.

OPTIONS:
    --path <path>, -p <path>    Custom path to validate
                                (default: data/mods/emotions-*/expressions/*.expression.json)
    --strict, -s                Treat warnings as errors (exit 1 on any issue)
    --quiet, -q                 Minimal output (errors only)
    --verbose, -v               Include detailed information about each violation
    --help, -h                  Show this help message

EXAMPLES:
    npm run validate:expressions                              # Validate all expressions
    npm run validate:expressions -- --strict                  # Exit 1 on any issue
    npm run validate:expressions -- --path tests/fixtures/expressionDiagnostics
    npm run validate:expressions -- --verbose                 # Show detailed info

EXIT CODES:
    0    Success (no violations, or only warnings in non-strict mode)
    1    Validation violations found (or warnings in strict mode)
    2    CLI error (invalid arguments, etc.)

VALIDATION CHECKS:
    • Prerequisite has valid "logic" property
    • JSON Logic object has exactly one operator
    • Operators are supported (and, or, ==, >=, <, var, etc.)
    • Var paths use allowed roots (emotions, moodAxes, etc.)
    • Var path keys exist for the root type
    • Numeric values are within valid ranges
    • Mood axes use integer thresholds
    • Scale mixing is detected (mood axes vs normalized values)
`);
}

// Run main function only when executed directly (not when imported as a module)
// Check if this module is the entry point by comparing resolved paths
const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(2);
  });
}

export { main, parseArguments, extractModId };
