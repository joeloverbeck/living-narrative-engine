# MODDEPVAL-008: Enhance UpdateManifest.js with Validation Integration

## Overview

Integrate the mod dependency validation system with the existing `updateManifest.js` script to provide comprehensive validation during manifest updates. This creates a natural enforcement point that prevents violations from being committed to the mod ecosystem.

## Background

The `updateManifest.js` script (582 lines) is a sophisticated manifest processing tool that scans mod directories and updates manifests with discovered content. This is the ideal integration point for cross-reference validation because:

- **Natural workflow integration**: Developers run manifest updates regularly
- **Pre-commit validation**: Catches violations before they're committed
- **Comprehensive scanning**: Already processes all mod files
- **Error reporting**: Established patterns for handling and reporting issues

**Current updateManifest.js capabilities:**

- Recursive directory scanning for multiple file types
- Special handling for entities, scopes, blueprints, recipes
- Advanced error handling and reporting
- Batch processing capabilities
- Sophisticated content discovery and categorization

## Technical Specifications

### Enhanced UpdateManifest Integration

```javascript
// scripts/updateManifest.js - Enhanced with validation integration

const path = require('path');
const fs = require('fs/promises');
const { ValidationError } = require('../src/errors/validationError.js');

// ... existing imports and constants ...

/**
 * Enhanced options interface for manifest updates with validation
 */
const DEFAULT_OPTIONS = {
  // Existing options
  force: false,
  verbose: false,
  dryRun: false,

  // New validation options
  validateReferences: false,
  failOnViolations: false,
  validationFormat: 'console', // console, json, none
  validationOutput: null, // file path for validation report
  skipValidationOnDryRun: true, // skip validation during dry runs
  validationStrictMode: false, // strict validation (fail on warnings)
  showSuggestions: true, // show fix suggestions in validation output

  // Enhanced validation options
  preValidation: false, // validate before scanning files
  postValidation: true, // validate after manifest update
  validateDependencies: true, // include dependency validation
  validateCrossReferences: true, // include cross-reference validation
  validationTimeout: 30000, // validation timeout in milliseconds
};

/**
 * Main manifest update function with integrated validation
 * @param {string} modName - Name of the mod to update
 * @param {Object} options - Update and validation options
 * @returns {Promise<Object>} Update result with validation information
 */
async function updateModManifest(modName, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log(`Starting manifest update for mod: "${modName}"`);

  const modPath = path.join(MODS_BASE_PATH, modName);
  const manifestPath = path.join(modPath, MANIFEST_FILENAME);

  // Initialize validation components if needed
  let validationOrchestrator = null;
  let violationReporter = null;

  if (opts.validateReferences && !opts.skipValidationOnDryRun) {
    try {
      // Dynamically import validation components using the existing pattern
      const {
        configureContainer,
      } = require('../src/dependencyInjection/containerConfig.js');
      const {
        coreTokens,
      } = require('../src/dependencyInjection/tokens/tokens-core.js');
      const AppContainer =
        require('../src/dependencyInjection/appContainer.js').default;

      // Create a minimal container for validation
      const container = new AppContainer();
      await configureContainer(container, {
        outputDiv: null,
        inputElement: null,
        titleElement: null,
        document: null,
      });

      validationOrchestrator = container.resolve(
        coreTokens.IModValidationOrchestrator
      );
      violationReporter = container.resolve(coreTokens.IViolationReporter);
    } catch (error) {
      console.warn('⚠️  Validation components not available:', error.message);
      console.warn('   Continuing without validation...');
      opts.validateReferences = false;
    }
  }

  const result = {
    success: false,
    modName,
    timestamp: new Date().toISOString(),

    // Existing result fields
    manifestUpdated: false,
    filesProcessed: 0,
    errors: [],
    warnings: [],

    // New validation fields
    validation: {
      performed: false,
      preValidation: null,
      postValidation: null,
      violations: [],
      suggestions: [],
    },

    // Performance tracking
    performance: {
      startTime: Date.now(),
      phases: {},
    },
  };

  try {
    // Verify mod directory exists
    const modStats = await fs.stat(modPath);
    if (!modStats.isDirectory()) {
      throw new Error(`Mod path is not a directory: ${modPath}`);
    }

    // Phase 1: Pre-validation (optional)
    if (opts.preValidation && validationOrchestrator) {
      console.log('🔍 Phase 1: Pre-update validation...');
      const preValidationStart = Date.now();

      try {
        const preValidationResult = await runValidation(
          validationOrchestrator,
          violationReporter,
          modName,
          opts
        );

        result.validation.preValidation = preValidationResult;
        result.performance.phases.preValidation =
          Date.now() - preValidationStart;

        if (preValidationResult.hasViolations && opts.validationStrictMode) {
          throw new ValidationError(
            `Pre-validation failed with ${preValidationResult.violationCount} violations`,
            null,
            preValidationResult
          );
        }
      } catch (error) {
        if (opts.failOnViolations) {
          throw error;
        }
        console.warn('⚠️  Pre-validation failed:', error.message);
        result.warnings.push(`Pre-validation failed: ${error.message}`);
      }
    }

    // Phase 2: Existing manifest update logic (enhanced with validation context)
    console.log('📝 Phase 2: Updating manifest...');
    const updateStart = Date.now();

    const updateResult = await performManifestUpdate(
      modName,
      modPath,
      manifestPath,
      opts
    );

    // Merge update results
    result.manifestUpdated = updateResult.manifestUpdated;
    result.filesProcessed = updateResult.filesProcessed;
    result.errors.push(...updateResult.errors);
    result.warnings.push(...updateResult.warnings);
    result.performance.phases.manifestUpdate = Date.now() - updateStart;

    // Phase 3: Post-validation (default)
    if (
      opts.postValidation &&
      validationOrchestrator &&
      result.manifestUpdated
    ) {
      console.log('🔍 Phase 3: Post-update validation...');
      const postValidationStart = Date.now();

      try {
        const postValidationResult = await runValidation(
          validationOrchestrator,
          violationReporter,
          modName,
          opts
        );

        result.validation.postValidation = postValidationResult;
        result.validation.performed = true;
        result.performance.phases.postValidation =
          Date.now() - postValidationStart;

        // Handle validation results
        if (postValidationResult.hasViolations) {
          const violationCount = postValidationResult.violationCount;
          console.log(`⚠️  Found ${violationCount} cross-reference violations`);

          // Store violations for result
          result.validation.violations = postValidationResult.violations;
          result.validation.suggestions = postValidationResult.suggestions;

          // Output validation report
          await outputValidationReport(
            violationReporter,
            postValidationResult,
            opts,
            modName
          );

          if (opts.failOnViolations) {
            throw new ValidationError(
              `Post-validation failed with ${violationCount} violations`,
              null,
              postValidationResult
            );
          }

          result.warnings.push(
            `${violationCount} cross-reference violations found`
          );
        } else {
          console.log('✅ No cross-reference violations found');
        }
      } catch (error) {
        if (opts.failOnViolations || error instanceof ValidationError) {
          throw error;
        }
        console.warn('⚠️  Post-validation failed:', error.message);
        result.warnings.push(`Post-validation failed: ${error.message}`);
      }
    }

    // Success
    result.success = true;
    result.performance.totalTime = Date.now() - result.performance.startTime;

    console.log(
      `✅ Manifest update completed for "${modName}" (${result.performance.totalTime}ms)`
    );

    // Summary output
    if (opts.verbose || result.validation.performed) {
      outputSummary(result, opts);
    }

    return result;
  } catch (error) {
    result.performance.totalTime = Date.now() - result.performance.startTime;
    result.errors.push(error.message);

    console.error(`❌ Manifest update failed for "${modName}":`, error.message);

    // Enhanced error context for validation errors
    if (error instanceof ValidationError) {
      result.validation.performed = true;
      result.validation.violations = error.validationErrors?.violations || [];

      if (
        opts.validationFormat !== 'none' &&
        violationReporter &&
        error.validationErrors
      ) {
        const report = violationReporter.generateReport(
          error.validationErrors,
          opts.validationFormat,
          { showSuggestions: opts.showSuggestions }
        );
        console.error(report);
      }
    }

    return result;
  }
}

/**
 * Enhanced manifest update logic with validation context
 * @param {string} modName - Mod name
 * @param {string} modPath - Mod directory path
 * @param {string} manifestPath - Manifest file path
 * @param {Object} opts - Options
 * @returns {Promise<Object>} Update results
 */
async function performManifestUpdate(modName, modPath, manifestPath, opts) {
  // Load existing manifest
  let existingManifest = {};
  let manifestExists = false;

  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    existingManifest = JSON.parse(manifestContent);
    manifestExists = true;

    if (opts.verbose) {
      console.log(
        `📖 Loaded existing manifest (${Object.keys(existingManifest).length} properties)`
      );
    }
  } catch (error) {
    if (opts.verbose) {
      console.log('📋 No existing manifest found, will create new one');
    }
  }

  // ... existing manifest update logic with enhanced error handling ...

  // Scan directory structure (existing logic)
  const scanResult = await scanModDirectory(modPath, opts);

  // Build new manifest (existing logic with enhancements)
  const newManifest = await buildManifest(
    modName,
    existingManifest,
    scanResult,
    opts
  );

  // Validation-aware manifest writing
  let manifestUpdated = false;
  if (!opts.dryRun) {
    // Check if manifest actually changed
    const manifestChanged =
      !manifestExists ||
      JSON.stringify(existingManifest, null, 2) !==
        JSON.stringify(newManifest, null, 2);

    if (manifestChanged || opts.force) {
      await fs.writeFile(
        manifestPath,
        JSON.stringify(newManifest, null, 2) + '\n'
      );
      manifestUpdated = true;

      if (opts.verbose) {
        console.log(
          `💾 Manifest ${manifestExists ? 'updated' : 'created'}: ${manifestPath}`
        );
      }
    } else if (opts.verbose) {
      console.log('📄 Manifest unchanged, no update needed');
    }
  } else {
    console.log('🔥 Dry run: manifest changes not written');
    manifestUpdated = false; // Don't trigger validation on dry run
  }

  return {
    manifestUpdated,
    filesProcessed: scanResult.filesProcessed || 0,
    errors: scanResult.errors || [],
    warnings: scanResult.warnings || [],
  };
}

/**
 * Runs comprehensive validation for a mod
 * @param {Object} validationOrchestrator - Validation orchestrator instance
 * @param {Object} violationReporter - Violation reporter instance
 * @param {string} modName - Mod name to validate
 * @param {Object} opts - Validation options
 * @returns {Promise<Object>} Validation results
 */
async function runValidation(
  validationOrchestrator,
  violationReporter,
  modName,
  opts
) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Validation timeout')),
      opts.validationTimeout
    );
  });

  const validationPromise = validationOrchestrator.validateMod(modName, {
    skipCrossReferences: !opts.validateCrossReferences,
    includeContext: true,
  });

  try {
    const validationResult = await Promise.race([
      validationPromise,
      timeoutPromise,
    ]);

    const hasViolations =
      validationResult.crossReferences?.hasViolations || false;
    const violations = validationResult.crossReferences?.violations || [];
    const violationCount = violations.length;

    // Generate suggestions
    const suggestions = violations
      .filter((v) => v.suggestedFixes && v.suggestedFixes.length > 0)
      .map((v) => v.suggestedFixes.find((f) => f.priority === 'primary'))
      .filter(Boolean);

    return {
      hasViolations,
      violations,
      violationCount,
      suggestions,
      dependencyValidation: validationResult.dependencies,
      isValid: validationResult.isValid,
      rawResult: validationResult,
    };
  } catch (error) {
    throw new Error(`Validation failed: ${error.message}`);
  }
}

/**
 * Outputs validation report in specified format
 * @param {Object} violationReporter - Reporter instance
 * @param {Object} validationResult - Validation results
 * @param {Object} opts - Output options
 * @param {string} modName - Mod name for context
 */
async function outputValidationReport(
  violationReporter,
  validationResult,
  opts,
  modName
) {
  if (opts.validationFormat === 'none') {
    return;
  }

  try {
    const report = violationReporter.generateReport(
      validationResult.rawResult.crossReferences,
      opts.validationFormat,
      {
        colors: opts.validationFormat === 'console',
        showSuggestions: opts.showSuggestions,
        verbose: opts.verbose,
      }
    );

    if (opts.validationOutput) {
      const outputPath = opts.validationOutput.replace('{modName}', modName);
      await fs.writeFile(outputPath, report);
      console.log(`📊 Validation report written to: ${outputPath}`);
    } else {
      console.log(report);
    }
  } catch (error) {
    console.warn('⚠️  Failed to generate validation report:', error.message);
  }
}

/**
 * Outputs summary of update and validation results
 * @param {Object} result - Complete result object
 * @param {Object} opts - Options for output formatting
 */
function outputSummary(result, opts) {
  console.log('\n📋 Summary:');
  console.log(`   • Files processed: ${result.filesProcessed}`);
  console.log(
    `   • Manifest updated: ${result.manifestUpdated ? 'Yes' : 'No'}`
  );
  console.log(`   • Total time: ${result.performance.totalTime}ms`);

  if (result.validation.performed) {
    console.log(`   • Validation performed: Yes`);

    if (result.validation.postValidation) {
      const v = result.validation.postValidation;
      console.log(`   • Violations found: ${v.violationCount}`);
      console.log(`   • Suggestions available: ${v.suggestions.length}`);

      if (v.hasViolations && opts.showSuggestions && v.suggestions.length > 0) {
        console.log('\n💡 Quick Fixes:');
        v.suggestions.slice(0, 3).forEach((suggestion, i) => {
          console.log(`   ${i + 1}. ${suggestion.description}`);
        });
      }
    }
  }

  if (result.warnings.length > 0) {
    console.log(`   • Warnings: ${result.warnings.length}`);
    if (opts.verbose) {
      result.warnings.forEach((warning) => {
        console.log(`     - ${warning}`);
      });
    }
  }

  if (result.errors.length > 0) {
    console.log(`   • Errors: ${result.errors.length}`);
    result.errors.forEach((error) => {
      console.log(`     - ${error}`);
    });
  }
}

/**
 * Enhanced command line argument parsing with validation options
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed options
 */
function parseCommandLineOptions(args) {
  const options = {
    // ... existing option parsing ...

    // Validation options
    validateReferences:
      args.includes('--validate-references') ||
      args.includes('--validate') ||
      args.includes('-v'),
    failOnViolations:
      args.includes('--fail-on-violations') ||
      args.includes('--strict') ||
      args.includes('-s'),
    validationFormat:
      getArgValue(args, '--validation-format') ||
      getArgValue(args, '--format') ||
      'console',
    validationOutput:
      getArgValue(args, '--validation-output') || getArgValue(args, '--output'),
    preValidation: args.includes('--pre-validation'),
    postValidation: !args.includes('--no-post-validation'),
    validationStrictMode:
      args.includes('--validation-strict') ||
      args.includes('--strict-validation'),
    showSuggestions: !args.includes('--no-suggestions'),
    validationTimeout: parseInt(
      getArgValue(args, '--validation-timeout') || '30000',
      10
    ),
  };

  // Validation format validation
  const validFormats = ['console', 'json', 'html', 'markdown', 'none'];
  if (!validFormats.includes(options.validationFormat)) {
    throw new Error(
      `Invalid validation format: ${options.validationFormat}. Valid options: ${validFormats.join(', ')}`
    );
  }

  return options;
}

/**
 * Utility to get command line argument values
 * @param {string[]} args - Arguments array
 * @param {string} flag - Flag to find value for
 * @returns {string|null} Argument value or null
 */
function getArgValue(args, flag) {
  const flagIndex = args.findIndex((arg) => arg.startsWith(`${flag}=`));
  if (flagIndex !== -1) {
    return args[flagIndex].split('=')[1];
  }

  const nextIndex = args.findIndex((arg) => arg === flag);
  if (
    nextIndex !== -1 &&
    args[nextIndex + 1] &&
    !args[nextIndex + 1].startsWith('-')
  ) {
    return args[nextIndex + 1];
  }

  return null;
}

// ... rest of existing updateManifest.js code ...

// Enhanced CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node updateManifest.js <mod-name> [options]');
    console.log('');
    console.log('Options:');
    console.log(
      '  --validate-references, -v    Enable cross-reference validation'
    );
    console.log('  --fail-on-violations, -s     Fail if violations are found');
    console.log(
      '  --validation-format FORMAT   Report format (console|json|html|markdown|none)'
    );
    console.log(
      '  --validation-output FILE     Write validation report to file'
    );
    console.log(
      '  --pre-validation             Validate before updating manifest'
    );
    console.log(
      '  --no-post-validation         Skip validation after updating manifest'
    );
    console.log('  --validation-strict          Strict validation mode');
    console.log('  --no-suggestions             Hide fix suggestions');
    console.log(
      '  --validation-timeout MS      Validation timeout (default: 30000)'
    );
    console.log('');
    console.log('Examples:');
    console.log('  npm run update-manifest positioning --validate-references');
    console.log('  npm run update-manifest intimacy --validate --strict');
    console.log(
      '  npm run update-manifest core --validate --format=json --output=report.json'
    );
    process.exit(1);
  }

  try {
    const modName = args[0];
    const options = parseCommandLineOptions(args);

    const result = await updateModManifest(modName, options);

    // Exit with appropriate code
    const hasErrors = result.errors.length > 0;
    const hasViolations =
      result.validation.postValidation?.hasViolations || false;

    if (hasErrors) {
      process.exit(2); // Error in manifest update
    } else if (hasViolations && options.failOnViolations) {
      process.exit(1); // Validation violations
    } else {
      process.exit(0); // Success
    }
  } catch (error) {
    // Error handling will be done by the require.main === module wrapper
    throw error;
  }
}

// Export functions for testing
module.exports = {
  updateModManifest,
  performManifestUpdate,
  runValidation,
  ValidationError,
  updateAllManifests,
};

// Run if called directly (CommonJS pattern)
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(3);
  });
}
```

### Enhanced Package.json Scripts

```json
{
  "scripts": {
    // Existing scripts (already implemented)
    "update-manifest": "node scripts/updateManifest.js",
    "update-manifest:validate": "node scripts/updateManifest.js --validate-references",
    "update-manifest:strict": "node scripts/updateManifest.js --validate-references --fail-on-violations",

    // Additional enhanced scripts (to be added)
    "update-manifest:all": "npm run update-manifests --validate-references",
    "update-manifest:batch": "node scripts/updateManifest.js --batch --validate-references",
    "fix-mod-violations": "npm run update-manifest --validate-references --strict --format=console",
    "validate-mod": "npm run update-manifest --validate-references --dry-run --format=console",
    "report-mod-violations": "npm run update-manifest --validate-references --format=json --output=validation-reports/{modName}-violations.json"
  }
}
```

### Batch Processing Enhancement

```javascript
/**
 * Enhanced batch manifest updates with validation
 * @param {Object} options - Batch processing options
 * @returns {Promise<Object>} Batch results
 */
async function updateAllManifests(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const modsPath = path.join(process.cwd(), 'data', 'mods');

  console.log('🔄 Starting batch manifest update with validation...');

  const results = {
    processed: [],
    successful: [],
    failed: [],
    validationSummary: {
      totalViolations: 0,
      modsWithViolations: 0,
      commonViolations: new Map(),
    },
    performance: {
      startTime: Date.now(),
      totalTime: 0,
    },
  };

  try {
    const modDirectories = (await fs.readdir(modsPath, { withFileTypes: true }))
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    console.log(`📦 Found ${modDirectories.length} mods to process`);

    // Process mods concurrently with limit
    const concurrencyLimit = opts.concurrency || 3;
    const promises = [];

    for (let i = 0; i < modDirectories.length; i += concurrencyLimit) {
      const batch = modDirectories.slice(i, i + concurrencyLimit);

      const batchPromise = Promise.allSettled(
        batch.map(async (modName) => {
          const modResult = await updateModManifest(modName, opts);
          return { modName, result: modResult };
        })
      );

      promises.push(batchPromise);
    }

    // Process all batches
    const batchResults = await Promise.all(promises);

    // Aggregate results
    batchResults.forEach((batch) => {
      batch.forEach((modResult) => {
        if (modResult.status === 'fulfilled') {
          const { modName, result } = modResult.value;
          results.processed.push(modName);

          if (result.success) {
            results.successful.push(modName);
          } else {
            results.failed.push(modName);
          }

          // Aggregate validation data
          if (result.validation.performed && result.validation.postValidation) {
            const validation = result.validation.postValidation;
            if (validation.hasViolations) {
              results.validationSummary.modsWithViolations++;
              results.validationSummary.totalViolations +=
                validation.violationCount;

              // Track common violations
              validation.violations.forEach((violation) => {
                const key = `${violation.referencedMod}:${violation.referencedComponent}`;
                const count =
                  results.validationSummary.commonViolations.get(key) || 0;
                results.validationSummary.commonViolations.set(key, count + 1);
              });
            }
          }
        } else {
          console.error(`❌ Failed to process mod: ${modResult.reason}`);
          results.failed.push('unknown');
        }
      });
    });

    results.performance.totalTime = Date.now() - results.performance.startTime;

    // Output batch summary
    console.log('\n📊 Batch Processing Summary:');
    console.log(`   • Total mods: ${modDirectories.length}`);
    console.log(`   • Successful: ${results.successful.length}`);
    console.log(`   • Failed: ${results.failed.length}`);
    console.log(`   • Processing time: ${results.performance.totalTime}ms`);

    if (opts.validateReferences) {
      console.log(
        `   • Mods with violations: ${results.validationSummary.modsWithViolations}`
      );
      console.log(
        `   • Total violations: ${results.validationSummary.totalViolations}`
      );

      if (results.validationSummary.commonViolations.size > 0) {
        console.log('\n🔍 Most Common Violations:');
        const sortedViolations = Array.from(
          results.validationSummary.commonViolations.entries()
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        sortedViolations.forEach(([violation, count]) => {
          console.log(`   • ${violation} (${count} mods)`);
        });
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Batch processing failed:', error.message);
    throw error;
  }
}
```

### GitHub Actions Integration

```yaml
# .github/workflows/mod-validation.yml
name: Mod Validation

on:
  push:
    paths:
      - 'data/mods/**'
      - 'scripts/updateManifest.js'
  pull_request:
    paths:
      - 'data/mods/**'

jobs:
  validate-mods:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate mod manifests and cross-references
        run: |
          npm run update-manifest:all -- --validate-references --fail-on-violations --format=json --output=validation-report.json

      - name: Upload validation report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: validation-report.json

      - name: Comment PR with violations
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            try {
              const report = JSON.parse(fs.readFileSync('validation-report.json', 'utf8'));
              const violations = report.mods ? Object.values(report.mods).reduce((sum, mod) => sum + (mod.violations?.length || 0), 0) : 0;
              
              if (violations > 0) {
                await github.rest.issues.createComment({
                  issue_number: context.issue.number,
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  body: `❌ **Mod validation failed**\n\n${violations} cross-reference violations found. Please check the uploaded validation report for details.`
                });
              }
            } catch (error) {
              console.log('Could not post comment:', error.message);
            }
```

## Integration Points

### Existing updateManifest.js Integration

```javascript
// Preserve existing functionality while adding validation
// Current updateManifest.js already has the following structure:
// - scanDirectoryRecursively
// - scanScopeDirectoryRecursively
// - scanBlueprintDirectoryRecursively
// - updateModManifest (enhanced version)
// - main function

// The enhanced version will integrate with existing functions:
module.exports = {
  // Enhanced main functions
  updateModManifest,
  performManifestUpdate,
  runValidation,
  ValidationError,
  updateAllManifests,

  // Existing utility functions (if needed for testing)
  scanDirectoryRecursively,
  scanScopeDirectoryRecursively,
  scanBlueprintDirectoryRecursively,
};
```

### Pre-commit Hook Integration

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "🔍 Running mod validation before commit..."

# Get list of modified mod files
modified_mods=$(git diff --cached --name-only | grep '^data/mods/' | cut -d'/' -f3 | sort -u)

if [ -n "$modified_mods" ]; then
    echo "📦 Validating modified mods: $modified_mods"

    for mod in $modified_mods; do
        echo "🔍 Validating mod: $mod"
        npm run update-manifest "$mod" -- --validate-references --fail-on-violations --format=console

        if [ $? -ne 0 ]; then
            echo "❌ Validation failed for mod: $mod"
            echo "💡 Fix violations before committing or use --no-verify to skip validation"
            exit 1
        fi
    done

    echo "✅ All modified mods passed validation"
else
    echo "📋 No mod files modified"
fi

echo "✅ Pre-commit validation passed"
```

## Testing Requirements

### Enhanced Testing Structure

```javascript
// tests/unit/scripts/updateManifest.test.js

const {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} = require('@jest/globals');
const {
  updateModManifest,
  ValidationError,
} = require('../../../scripts/updateManifest.js');
const { createTestBed } = require('../../common/testBed.js');
const fs = require('fs/promises');

describe('UpdateManifest - Validation Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.setupModEnvironment();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Validation Integration', () => {
    it('should perform post-validation by default', async () => {
      await testBed.createTestMod('test-mod', {
        manifest: { id: 'test-mod', dependencies: [] },
        files: {
          'actions/test.action.json': {
            required_components: { actor: ['missing:component'] },
          },
        },
      });

      const result = await updateModManifest('test-mod', {
        validateReferences: true,
        postValidation: true,
      });

      expect(result.validation.performed).toBe(true);
      expect(result.validation.postValidation.hasViolations).toBe(true);
    });

    it('should fail on violations when strictMode enabled', async () => {
      await testBed.createTestModWithViolation('test-mod');

      await expect(
        updateModManifest('test-mod', {
          validateReferences: true,
          failOnViolations: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should generate validation reports in different formats', async () => {
      await testBed.createTestModWithViolation('test-mod');

      const jsonResult = await updateModManifest('test-mod', {
        validateReferences: true,
        validationFormat: 'json',
        validationOutput: 'test-report.json',
      });

      expect(jsonResult.validation.performed).toBe(true);

      const reportExists = await fs
        .access('test-report.json')
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple mods with validation', async () => {
      await testBed.createMultipleMods([
        { name: 'mod-a', hasViolations: false },
        { name: 'mod-b', hasViolations: true },
        { name: 'mod-c', hasViolations: false },
      ]);

      const results = await updateAllManifests({
        validateReferences: true,
        concurrency: 2,
      });

      expect(results.processed).toHaveLength(3);
      expect(results.validationSummary.modsWithViolations).toBe(1);
      expect(results.validationSummary.totalViolations).toBeGreaterThan(0);
    });
  });

  describe('CLI Integration', () => {
    it('should parse validation command line arguments', () => {
      const args = [
        'test-mod',
        '--validate-references',
        '--fail-on-violations',
        '--format=json',
        '--output=report.json',
      ];

      const options = parseCommandLineOptions(args);

      expect(options.validateReferences).toBe(true);
      expect(options.failOnViolations).toBe(true);
      expect(options.validationFormat).toBe('json');
      expect(options.validationOutput).toBe('report.json');
    });
  });
});
```

## Success Criteria

- [ ] `updateManifest.js` enhanced with comprehensive validation integration
- [ ] Command-line options provide full control over validation behavior
- [ ] Batch processing supports validation across entire mod ecosystem
- [ ] Multiple output formats support different development workflows
- [ ] Performance remains acceptable for large mod ecosystems
- [ ] Integration preserves all existing functionality and backward compatibility
- [ ] CI/CD integration provides automated validation in development pipeline
- [ ] Pre-commit hooks prevent violations from being committed
- [ ] Error handling provides clear guidance for resolution
- [ ] Documentation explains all new validation options and workflows

## Implementation Notes

### Performance Optimization

- **Concurrent processing**: Process multiple mods in parallel during batch operations
- **Validation caching**: Cache validation results to avoid repeated work
- **Smart validation**: Only validate when manifest actually changes
- **Timeout handling**: Prevent hanging on problematic validation cases

### User Experience

- **Progressive enhancement**: Validation is opt-in, doesn't break existing workflows
- **Clear output**: Provide actionable error messages and suggestions
- **Format flexibility**: Support different output formats for various use cases
- **Integration guidance**: Clear documentation for CI/CD and hook setup

### Backward Compatibility

- **Existing functionality**: All current updateManifest.js features preserved
- **Option compatibility**: New options don't conflict with existing ones
- **Error handling**: Enhanced error handling maintains existing behavior
- **API stability**: Function signatures remain compatible for testing

## Next Steps

After completion:

1. **MODDEPVAL-009**: Add CLI validation flags and backward compatibility
2. **MODDEPVAL-010**: Implement performance optimization and caching
3. **Integration testing**: Validate with real mod ecosystem

## References

- **Existing updateManifest.js**: Current implementation patterns and structure
- **Validation infrastructure**: Integration points from MODDEPVAL-005/006/007
- **CLI patterns**: Existing command-line tools in the project
- **CI/CD patterns**: GitHub Actions workflows in the project
