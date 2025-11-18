#!/usr/bin/env node
/**
 * @file CLI script for cross-reference validation with enhanced reporting
 * @description Validates cross-mod references against dependency declarations using the enhanced
 * ModCrossReferenceValidator with multi-format reporting capabilities.
 *
 * Usage:
 *   node scripts/validateCrossReferences.js [options]
 *
 * Options:
 *   --mod=<mod_id>           Validate single mod instead of all mods
 *   --path=<mod_path>        Explicit path to mod directory (used with --mod)
 *   --format=<format>        Output format: console, json, html, markdown (default: console)
 *   --output=<file>          Write report to file instead of stdout
 *   --enhanced               Use enhanced validation with file context (default: true)
 *   --no-enhanced            Disable enhanced validation features
 *   --verbose                Include detailed information in reports
 *   --no-suggestions         Hide fix suggestions in console output
 *   --pretty                 Pretty-print JSON output (only for --format=json)
 *   --help                   Show usage information
 *
 * Examples:
 *   node scripts/validateCrossReferences.js
 *   node scripts/validateCrossReferences.js --mod=intimacy --format=json --output=report.json
 *   node scripts/validateCrossReferences.js --format=html --output=violations.html --verbose
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports to avoid issues with DI container initialization
let container;
let coreTokens;
let ViolationReporter;

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle help request
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  const options = parseCommandLineArgs(args);

  try {
    console.log('🔍 Cross-Reference Validation Starting...');
    console.log(`Mode: ${options.modId ? 'Single Mod' : 'Ecosystem'}`);
    console.log(`Format: ${options.format}`);
    console.log(`Enhanced: ${options.enhanced}`);
    console.log('');

    // Load dependencies
    await loadDependencies();

    // Initialize services
    const validator = container.resolve(coreTokens.IModCrossReferenceValidator);
    const manifestLoader = container.resolve(coreTokens.ModManifestLoader);
    const logger = container.resolve(coreTokens.ILogger);

    // Discover all mod IDs first
    const modsPath = path.join(process.cwd(), 'data', 'mods');
    const entries = await fs.readdir(modsPath, { withFileTypes: true });
    const modIds = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if it has a mod-manifest.json
        const manifestPath = path.join(
          modsPath,
          entry.name,
          'mod-manifest.json'
        );
        try {
          await fs.access(manifestPath);
          modIds.push(entry.name);
        } catch {
          // No manifest, skip
        }
      }
    }

    // Load manifests using existing infrastructure
    const manifestsMap = await manifestLoader.loadRequestedManifests(modIds);
    logger.info(`Loaded ${manifestsMap.size} mod manifests`);

    let results;

    if (options.modId) {
      // Single mod validation
      const modPath = options.modPath || resolveModPath(options.modId);

      if (options.enhanced && validator.validateModReferencesEnhanced) {
        results = await validator.validateModReferencesEnhanced(
          modPath,
          manifestsMap,
          {
            includeContext: true,
          }
        );
      } else {
        results = await validator.validateModReferences(modPath, manifestsMap);
      }
    } else {
      // Ecosystem-wide validation
      if (options.enhanced && validator.validateAllModReferencesEnhanced) {
        // If enhanced ecosystem validation exists, use it
        results = await validator.validateAllModReferencesEnhanced(
          manifestsMap,
          {
            includeContext: true,
          }
        );
      } else {
        results = await validator.validateAllModReferences(manifestsMap);
      }
    }

    // Generate report using ViolationReporter
    const reporter = new ViolationReporter({ logger });
    const report = reporter.generateReport(results, options.format, {
      verbose: options.verbose,
      showSuggestions: options.showSuggestions,
      pretty: options.pretty,
      colors: !options.output, // Only use colors for console output
    });

    // Output report
    if (options.output) {
      await fs.writeFile(options.output, report, 'utf8');
      console.log(`📄 Report written to: ${options.output}`);
      console.log(`📊 Format: ${options.format}`);
    } else {
      console.log(report);
    }

    // Exit with appropriate code
    const hasViolations =
      results instanceof Map
        ? Array.from(results.values()).some((r) => r.hasViolations)
        : results.hasViolations;

    if (hasViolations) {
      const violationCount =
        results instanceof Map
          ? Array.from(results.values()).reduce(
              (sum, r) => sum + r.violations.length,
              0
            )
          : results.violations.length;

      console.log('');
      console.log(`❌ Validation completed with ${violationCount} violations`);
      process.exit(1);
    } else {
      console.log('');
      console.log(
        '✅ Validation completed successfully - no violations detected'
      );
      process.exit(0);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Cross-reference validation failed:');
    console.error(`   ${error.message}`);

    if (process.env.NODE_ENV === 'development') {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(2);
  }
}

/**
 * Dynamically loads required dependencies to avoid circular imports
 */
async function loadDependencies() {
  try {
    // Load DI container and tokens
    const containerModule = await import(
      '../src/dependencyInjection/containerConfig.js'
    );
    const tokensModule = await import(
      '../src/dependencyInjection/tokens/tokens-core.js'
    );
    // Try to import ViolationReporter, with fallback if not available
    let violationReporterModule;
    try {
      violationReporterModule = await import(
        '../src/validation/violationReporter.js'
      );
    } catch (error) {
      // Fallback if ViolationReporter doesn't exist yet
      console.warn('ViolationReporter not found, using fallback reporting');
      violationReporterModule = {
        default: class ViolationReporter {
          constructor({ logger }) {
            this.logger = logger;
          }
          generateReport(results, format, options) {
            if (format === 'json') {
              return options.pretty
                ? JSON.stringify(results, null, 2)
                : JSON.stringify(results);
            }
            // Simple console format fallback
            let report = '';
            if (results instanceof Map) {
              for (const [modId, result] of results) {
                if (result.hasViolations) {
                  report += `\nMod: ${modId}\n`;
                  result.violations.forEach((v) => {
                    report += `  - ${v.severity}: ${v.message}\n`;
                  });
                }
              }
            } else if (results.hasViolations) {
              results.violations.forEach((v) => {
                report += `- ${v.severity}: ${v.message}\n`;
              });
            }
            return report || 'No violations found';
          }
        },
      };
    }

    container = containerModule.container;
    coreTokens = tokensModule.coreTokens;
    ViolationReporter = violationReporterModule.default;
  } catch (error) {
    throw new Error(`Failed to load dependencies: ${error.message}`);
  }
}

/**
 * Parses command line arguments into options object
 *
 * @param args
 */
function parseCommandLineArgs(args) {
  const options = {
    modId: null,
    modPath: null,
    format: 'console',
    output: null,
    enhanced: true,
    verbose: false,
    showSuggestions: true,
    pretty: false,
  };

  args.forEach((arg) => {
    if (arg.startsWith('--mod=')) {
      options.modId = arg.split('=')[1];
    } else if (arg.startsWith('--path=')) {
      options.modPath = arg.split('=')[1];
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (!['console', 'json', 'html', 'markdown'].includes(format)) {
        throw new Error(
          `Unsupported format: ${format}. Supported: console, json, html, markdown`
        );
      }
      options.format = format;
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--enhanced') {
      options.enhanced = true;
    } else if (arg === '--no-enhanced') {
      options.enhanced = false;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--no-suggestions') {
      options.showSuggestions = false;
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else if (!arg.startsWith('--')) {
      // Positional argument - treat as mod ID if none specified
      if (!options.modId) {
        options.modId = arg;
      }
    } else {
      console.warn(`Warning: Unknown argument '${arg}' ignored`);
    }
  });

  // Validation
  if (options.modId && !options.modPath) {
    // Auto-resolve mod path if not explicitly provided
    options.modPath = resolveModPath(options.modId);
  }

  return options;
}

/**
 * Resolves mod path from mod ID using standard project structure
 *
 * @param modId
 */
function resolveModPath(modId) {
  // Use standard project structure: data/mods/<modId>
  const projectRoot = path.resolve(__dirname, '..');
  return path.join(projectRoot, 'data', 'mods', modId);
}

/**
 * Shows usage information
 */
function showUsage() {
  const scriptName = path.basename(__filename);

  console.log('Cross-Reference Validation Tool');
  console.log('===============================');
  console.log('');
  console.log(`Usage: node ${scriptName} [options]`);
  console.log('');
  console.log('Options:');
  console.log(
    '  --mod=<mod_id>           Validate single mod instead of all mods'
  );
  console.log(
    '  --path=<mod_path>        Explicit path to mod directory (used with --mod)'
  );
  console.log(
    '  --format=<format>        Output format: console, json, html, markdown (default: console)'
  );
  console.log(
    '  --output=<file>          Write report to file instead of stdout'
  );
  console.log(
    '  --enhanced               Use enhanced validation with file context (default)'
  );
  console.log(
    '  --no-enhanced            Disable enhanced validation features'
  );
  console.log(
    '  --verbose                Include detailed information in reports'
  );
  console.log(
    '  --no-suggestions         Hide fix suggestions in console output'
  );
  console.log(
    '  --pretty                 Pretty-print JSON output (only for --format=json)'
  );
  console.log('  --help, -h               Show this usage information');
  console.log('');
  console.log('Examples:');
  console.log(`  node ${scriptName}`);
  console.log(
    '    Validate all mods with enhanced features, output to console'
  );
  console.log('');
  console.log(
    `  node ${scriptName} --mod=intimacy --format=json --output=report.json`
  );
  console.log('    Validate single mod, output JSON report to file');
  console.log('');
  console.log(
    `  node ${scriptName} --format=html --output=violations.html --verbose`
  );
  console.log('    Validate all mods, generate detailed HTML report');
  console.log('');
  console.log(`  node ${scriptName} --no-enhanced --format=json --pretty`);
  console.log(
    '    Use basic validation, output pretty-printed JSON to console'
  );
  console.log('');
  console.log('Exit Codes:');
  console.log('  0: Validation successful, no violations found');
  console.log('  1: Validation completed, but violations were detected');
  console.log('  2: Validation failed due to error');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(2);
  });
}

export { main, parseCommandLineArgs, resolveModPath };
