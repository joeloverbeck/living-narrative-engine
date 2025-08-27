#!/usr/bin/env node

/**
 * Logger Compatibility Validation Script
 * Validates that all existing logger implementations are present and tests pass
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper function for colored output
/**
 *
 * @param message
 * @param color
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 *
 * @param title
 */
function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
  console.log('');
}

/**
 *
 * @param message
 */
function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

/**
 *
 * @param message
 */
function logError(message) {
  log(`❌ ${message}`, colors.red);
}

/**
 *
 * @param message
 */
function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 *
 * @param message
 */
function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Check if file exists
/**
 *
 * @param filepath
 */
function checkFileExists(filepath) {
  const fullPath = path.join(process.cwd(), filepath);
  return fs.existsSync(fullPath);
}

// Check existing logger implementations
/**
 *
 */
function checkExistingLoggers() {
  logSection('Checking Existing Logger Implementations');

  const loggers = [
    {
      path: 'src/logging/consoleLogger.js',
      name: 'ConsoleLogger',
      required: true,
    },
    {
      path: 'src/logging/hybridLogger.js',
      name: 'HybridLogger',
      required: true,
    },
    {
      path: 'src/logging/remoteLogger.js',
      name: 'RemoteLogger',
      required: true,
    },
    {
      path: 'src/logging/loggerStrategy.js',
      name: 'LoggerStrategy',
      required: true,
    },
    {
      path: 'src/logging/noOpLogger.js',
      name: 'NoOpLogger',
      required: false,
    },
    {
      path: 'src/logging/logCategoryDetector.js',
      name: 'LogCategoryDetector',
      required: false,
    },
    {
      path: 'src/logging/circuitBreaker.js',
      name: 'CircuitBreaker',
      required: false,
    },
    {
      path: 'src/logging/logMetadataEnricher.js',
      name: 'LogMetadataEnricher',
      required: false,
    },
  ];

  let allRequiredPresent = true;
  let foundCount = 0;

  loggers.forEach((logger) => {
    if (checkFileExists(logger.path)) {
      logSuccess(`Found: ${logger.name} at ${logger.path}`);
      foundCount++;
    } else {
      if (logger.required) {
        logError(`Missing: ${logger.name} at ${logger.path}`);
        allRequiredPresent = false;
      } else {
        logWarning(`Optional missing: ${logger.name} at ${logger.path}`);
      }
    }
  });

  console.log('');
  logInfo(`Found ${foundCount}/${loggers.length} logger implementations`);

  return allRequiredPresent;
}

// Check mock utilities
/**
 *
 */
function checkMockUtilities() {
  logSection('Checking Mock Utilities');

  const mockPath = 'tests/common/mockFactories/loggerMocks.js';

  if (checkFileExists(mockPath)) {
    logSuccess(`Mock utilities available at: ${mockPath}`);

    // Check for specific exports
    try {
      const mockContent = fs.readFileSync(
        path.join(process.cwd(), mockPath),
        'utf8'
      );

      const hasCreateMockLogger = mockContent.includes(
        'export const createMockLogger'
      );
      const hasEnhancedMockLogger = mockContent.includes(
        'export const createEnhancedMockLogger'
      );

      if (hasCreateMockLogger) {
        logSuccess('Found createMockLogger export');
      } else {
        logError('Missing createMockLogger export');
      }

      if (hasEnhancedMockLogger) {
        logSuccess('Found createEnhancedMockLogger export');
      } else {
        logError('Missing createEnhancedMockLogger export');
      }

      return hasCreateMockLogger && hasEnhancedMockLogger;
    } catch (error) {
      logError(`Error reading mock utilities: ${error.message}`);
      return false;
    }
  } else {
    logError(`Mock utilities not found at: ${mockPath}`);
    return false;
  }
}

// Run a test suite
/**
 *
 * @param suite
 * @param description
 */
function runTestSuite(suite, description) {
  logSection(`Running ${description}`);

  try {
    const command = `npm run test:${suite}`;
    logInfo(`Executing: ${command}`);

    const startTime = Date.now();
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Parse test results from output
    const testMatches = output.match(/Tests:\s+(\d+)\s+passed/);
    const suiteMatches = output.match(/Test Suites:\s+(\d+)\s+passed/);

    if (testMatches) {
      logSuccess(`Tests passed: ${testMatches[1]}`);
    }
    if (suiteMatches) {
      logSuccess(`Test suites passed: ${suiteMatches[1]}`);
    }

    logSuccess(`${description} completed in ${duration}s`);
    return true;
  } catch (error) {
    // Check if it's just a test failure or a real error
    if (error.stdout) {
      const output = error.stdout.toString();

      // Try to extract failure information
      const failureMatch = output.match(/Tests:\s+(\d+)\s+failed/);
      const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);

      if (failureMatch) {
        logError(`${failureMatch[1]} tests failed`);
      }
      if (passMatch) {
        logWarning(`${passMatch[1]} tests passed`);
      }

      // Look for specific error messages
      if (output.includes('Cannot find module')) {
        logError('Module not found errors detected');
      }
      if (output.includes('SyntaxError')) {
        logError('Syntax errors detected');
      }
    }

    logError(`${description} failed!`);
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    return false;
  }
}

// Check compatibility test suite
/**
 *
 */
function checkCompatibilityTests() {
  logSection('Checking Compatibility Test Suite');

  const compatTestPath =
    'tests/integration/logging/logger-compatibility.test.js';

  if (checkFileExists(compatTestPath)) {
    logSuccess(`Compatibility test suite found at: ${compatTestPath}`);

    // Run just the compatibility tests
    try {
      const command = `npx jest ${compatTestPath} --no-coverage`;
      logInfo(`Running: ${command}`);

      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      logSuccess('Compatibility tests passed!');
      return true;
    } catch (error) {
      logError('Compatibility tests failed');
      if (error.stdout) {
        console.log(error.stdout.toString());
      }
      return false;
    }
  } else {
    logWarning(`Compatibility test suite not found at: ${compatTestPath}`);
    return false;
  }
}

// Analyze test usage patterns
/**
 *
 */
function analyzeTestUsage() {
  logSection('Analyzing Test Usage Patterns');

  try {
    // Count logger usage in tests
    const testDirs = ['unit', 'integration', 'e2e', 'performance', 'memory'];
    let totalUsage = 0;

    testDirs.forEach((dir) => {
      try {
        const result = execSync(
          `grep -r "logger\\." tests/${dir} 2>/dev/null | wc -l`,
          { encoding: 'utf8' }
        ).trim();
        const count = parseInt(result) || 0;
        if (count > 0) {
          logInfo(`${dir} tests: ${count} logger references`);
          totalUsage += count;
        }
      } catch (e) {
        // Directory might not exist or no matches
      }
    });

    logSuccess(`Total logger usage in tests: ${totalUsage} references`);

    // Count mock usage
    try {
      const mockUsage = execSync(
        'grep -r "createMockLogger\\|createEnhancedMockLogger" tests/ 2>/dev/null | wc -l',
        { encoding: 'utf8' }
      ).trim();
      logSuccess(`Mock utility usage: ${mockUsage} occurrences`);
    } catch (e) {
      logWarning('Could not count mock usage');
    }

    return true;
  } catch (error) {
    logError(`Error analyzing test usage: ${error.message}`);
    return false;
  }
}

// Main validation function
/**
 *
 */
async function validateCompatibility() {
  console.log('');
  log(
    '╔════════════════════════════════════════════════════════════╗',
    colors.bright + colors.green
  );
  log(
    '║          Logger Backward Compatibility Validator          ║',
    colors.bright + colors.green
  );
  log(
    '╚════════════════════════════════════════════════════════════╝',
    colors.bright + colors.green
  );

  const startTime = Date.now();
  const results = {
    loggersPresent: false,
    mockUtilitiesPresent: false,
    compatibilityTestsPass: false,
    usageAnalysis: false,
    unitTestsPass: false,
    integrationTestsPass: false,
  };

  // Step 1: Check existing implementations
  results.loggersPresent = checkExistingLoggers();

  // Step 2: Check mock utilities
  results.mockUtilitiesPresent = checkMockUtilities();

  // Step 3: Check and run compatibility tests
  results.compatibilityTestsPass = checkCompatibilityTests();

  // Step 4: Analyze usage patterns
  results.usageAnalysis = analyzeTestUsage();

  // Step 5: Run progressive test validation (optional based on flag)
  if (process.argv.includes('--full')) {
    logInfo('Running full test suite validation...');
    results.unitTestsPass = runTestSuite('unit', 'Unit Tests');
    results.integrationTestsPass = runTestSuite(
      'integration',
      'Integration Tests'
    );
  } else {
    logInfo(
      'Skipping full test suite. Run with --full flag to include all tests.'
    );
  }

  // Final summary
  logSection('Validation Summary');

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const allChecks = Object.values(results);
  const passedChecks = allChecks.filter((r) => r).length;
  const totalChecks = allChecks.length;

  // Calculate without the skipped tests if not running full validation
  const activeChecks = process.argv.includes('--full')
    ? totalChecks
    : totalChecks - 2;
  const activePassedChecks = process.argv.includes('--full')
    ? passedChecks
    : passedChecks;

  console.log('');
  log('Results:', colors.bright);
  Object.entries(results).forEach(([key, value]) => {
    if (key === 'unitTestsPass' || key === 'integrationTestsPass') {
      if (!process.argv.includes('--full')) {
        return; // Skip if not running full tests
      }
    }
    const status = value ? '✅ PASS' : '❌ FAIL';
    const color = value ? colors.green : colors.red;
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());
    log(`  ${status} - ${label}`, color);
  });

  console.log('');
  log(`Total execution time: ${totalTime}s`, colors.cyan);
  log(
    `Overall: ${activePassedChecks}/${activeChecks} checks passed`,
    colors.bright
  );

  if (activePassedChecks === activeChecks) {
    console.log('');
    log(
      '╔════════════════════════════════════════════════════════════╗',
      colors.bright + colors.green
    );
    log(
      '║  ✅  All compatibility checks passed successfully!  ✅    ║',
      colors.bright + colors.green
    );
    log(
      '║      Backward compatibility is fully maintained!          ║',
      colors.bright + colors.green
    );
    log(
      '╚════════════════════════════════════════════════════════════╝',
      colors.bright + colors.green
    );
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    log(
      '╔════════════════════════════════════════════════════════════╗',
      colors.bright + colors.red
    );
    log(
      '║  ❌  Some compatibility checks failed  ❌                 ║',
      colors.bright + colors.red
    );
    log(
      '║      Please review the errors above                       ║',
      colors.bright + colors.red
    );
    log(
      '╚════════════════════════════════════════════════════════════╝',
      colors.bright + colors.red
    );
    console.log('');
    process.exit(1);
  }
}

// Run validation
validateCompatibility().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
