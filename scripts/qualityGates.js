#!/usr/bin/env node

/**
 * @file Quality Gates Script for ActionDefinitionBuilder
 * @description Automated quality validation including coverage thresholds,
 * performance benchmarks, and code quality metrics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Quality gate configuration for ActionDefinitionBuilder components
 */
const QUALITY_GATES = {
  coverage: {
    // Minimum coverage thresholds for ActionDefinitionBuilder components
    actionDefinitionBuilder: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95
    },
    actionDefinitionValidator: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95
    },
    // Global minimums for related test files
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  performance: {
    // Performance thresholds from benchmark tests
    simpleCreation: 0.1, // ms per action
    complexCreation: 0.5, // ms per action
    validation: 0.01, // ms per validation
    memoryPerAction: 2048, // bytes per action
    builderOverhead: 100 // percentage compared to manual creation
  },
  codeQuality: {
    // ESLint error tolerance
    maxErrors: 0,
    maxWarnings: 5,
    // Complexity thresholds (adjusted for builder pattern complexity)
    maxComplexity: 50,
    maxLines: 500
  }
};

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Logs a message with color formatting
 * @param {string} message - Message to log
 * @param {string} color - Color code
 */
function logWithColor(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Logs a section header
 * @param {string} title - Section title
 */
function logSection(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}\n`);
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Reads and parses a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {object|null} - Parsed JSON or null if error
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logWithColor(`Error reading ${filePath}: ${error.message}`, colors.red);
    return null;
  }
}

/**
 * Runs a command and returns the output
 * @param {string} command - Command to run
 * @param {object} options - Execution options
 * @returns {string} - Command output
 */
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      ...options 
    });
    return output.trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Validates test coverage against thresholds
 * @returns {Promise<boolean>} - True if coverage passes
 */
async function validateCoverage() {
  logSection('Coverage Validation');
  
  const coverageDir = path.join(process.cwd(), 'coverage');
  const coverageJsonPath = path.join(coverageDir, 'coverage-final.json');
  
  // Run tests with coverage if coverage data doesn't exist
  if (!fileExists(coverageJsonPath)) {
    logWithColor('Running tests to generate coverage data...', colors.yellow);
    try {
      runCommand('npm run test:unit');
    } catch (error) {
      logWithColor('Failed to run tests for coverage', colors.red);
      return false;
    }
  }
  
  if (!fileExists(coverageJsonPath)) {
    logWithColor('Coverage data not found', colors.red);
    return false;
  }
  
  const coverageData = readJsonFile(coverageJsonPath);
  if (!coverageData) {
    return false;
  }
  
  let passed = true;
  
  // Check specific component coverage
  const componentsToCheck = {
    'actionDefinitionBuilder': 'src/actions/builders/actionDefinitionBuilder.js',
    'actionDefinitionValidator': 'src/actions/builders/actionDefinitionValidator.js'
  };
  
  for (const [componentName, filePath] of Object.entries(componentsToCheck)) {
    const fullPath = path.resolve(filePath);
    const fileData = coverageData[fullPath];
    
    if (!fileData) {
      logWithColor(`❌ No coverage data found for ${componentName}`, colors.red);
      passed = false;
      continue;
    }
    
    const thresholds = QUALITY_GATES.coverage[componentName];
    
    // Use coverage summary if available, otherwise calculate from raw data
    const metrics = {};
    
    if (fileData.statements !== undefined) {
      // Use pre-calculated coverage summary
      metrics.statements = fileData.statements.pct || 0;
      metrics.branches = fileData.branches.pct || 0;
      metrics.functions = fileData.functions.pct || 0;
      metrics.lines = fileData.lines.pct || 0;
    } else {
      // Calculate from raw coverage data
      metrics.statements = fileData.s ? (Object.values(fileData.s).filter(v => v > 0).length / Object.keys(fileData.s).length) * 100 : 0;
      metrics.branches = fileData.b ? (Object.values(fileData.b).flat().filter(v => v > 0).length / Object.values(fileData.b).flat().length) * 100 : 0;
      metrics.functions = fileData.f ? (Object.values(fileData.f).filter(v => v > 0).length / Object.keys(fileData.f).length) * 100 : 0;
      metrics.lines = fileData.l ? (Object.values(fileData.l).filter(v => v > 0).length / Object.keys(fileData.l).length) * 100 : 0;
    }
    
    logWithColor(`\n📊 ${componentName} Coverage:`, colors.blue);
    
    for (const [metric, actual] of Object.entries(metrics)) {
      const required = thresholds[metric];
      const status = actual >= required ? '✅' : '❌';
      const color = actual >= required ? colors.green : colors.red;
      
      logWithColor(`  ${status} ${metric}: ${actual.toFixed(2)}% (required: ${required}%)`, color);
      
      if (actual < required) {
        passed = false;
      }
    }
  }
  
  return passed;
}

/**
 * Validates performance benchmarks
 * @returns {Promise<boolean>} - True if performance passes
 */
async function validatePerformance() {
  logSection('Performance Validation');
  
  try {
    logWithColor('Running performance tests...', colors.yellow);
    const output = runCommand('npm run test:performance');
    
    // Parse performance output for key metrics
    const lines = output.split('\n');
    const performanceResults = {};
    
    // Extract performance metrics from test output
    for (const line of lines) {
      if (line.includes('Average creation time:')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) performanceResults.simpleCreation = parseFloat(match[1]);
      }
      if (line.includes('Complex action average time:')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) performanceResults.complexCreation = parseFloat(match[1]);
      }
      if (line.includes('Validation average time:')) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) performanceResults.validation = parseFloat(match[1]);
      }
      if (line.includes('Memory usage:') && line.includes('bytes per action')) {
        const match = line.match(/(\d+)/);
        if (match) performanceResults.memoryPerAction = parseFloat(match[1]);
      }
      if (line.includes('Builder overhead:')) {
        const match = line.match(/(\d+\.?\d*)%/);
        if (match) performanceResults.builderOverhead = parseFloat(match[1]);
      }
    }
    
    let passed = true;
    const thresholds = QUALITY_GATES.performance;
    
    logWithColor('\n📈 Performance Results:', colors.blue);
    
    for (const [metric, threshold] of Object.entries(thresholds)) {
      const actual = performanceResults[metric];
      if (actual !== undefined) {
        const status = actual <= threshold ? '✅' : '❌';
        const color = actual <= threshold ? colors.green : colors.red;
        const unit = metric === 'memoryPerAction' ? ' bytes' : metric === 'builderOverhead' ? '%' : 'ms';
        
        logWithColor(`  ${status} ${metric}: ${actual}${unit} (max: ${threshold}${unit})`, color);
        
        if (actual > threshold) {
          passed = false;
        }
      } else {
        logWithColor(`  ⚠️ ${metric}: No data available`, colors.yellow);
      }
    }
    
    return passed;
    
  } catch (error) {
    logWithColor(`Performance validation failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Validates code quality using ESLint
 * @returns {Promise<boolean>} - True if code quality passes
 */
async function validateCodeQuality() {
  logSection('Code Quality Validation');
  
  try {
    // Run ESLint on ActionDefinitionBuilder components
    const lintTargets = [
      'src/actions/builders/actionDefinitionBuilder.js',
      'src/actions/builders/actionDefinitionValidator.js',
      'tests/unit/actions/builders/',
      'tests/performance/actions/'
    ];
    
    let totalErrors = 0;
    let totalWarnings = 0;
    
    for (const target of lintTargets) {
      if (fileExists(target) || fs.existsSync(target)) {
        try {
          const output = runCommand(`npx eslint ${target} --format json`);
          const results = JSON.parse(output);
          
          for (const result of results) {
            totalErrors += result.errorCount;
            totalWarnings += result.warningCount;
            
            if (result.errorCount > 0 || result.warningCount > 0) {
              logWithColor(`\n📁 ${result.filePath}:`, colors.blue);
              for (const message of result.messages) {
                const severity = message.severity === 2 ? 'ERROR' : 'WARNING';
                const color = message.severity === 2 ? colors.red : colors.yellow;
                logWithColor(`  ${severity}: ${message.message} (line ${message.line})`, color);
              }
            }
          }
        } catch (error) {
          // ESLint returns non-zero exit code for errors, but we want to parse the output
          if (error.message.includes('Command failed')) {
            const output = error.message.split('\n').slice(1).join('\n');
            try {
              const results = JSON.parse(output);
              for (const result of results) {
                totalErrors += result.errorCount;
                totalWarnings += result.warningCount;
              }
            } catch (parseError) {
              logWithColor(`Failed to parse ESLint output for ${target}`, colors.red);
            }
          }
        }
      }
    }
    
    const thresholds = QUALITY_GATES.codeQuality;
    let passed = true;
    
    logWithColor('\n🔍 Code Quality Summary:', colors.blue);
    
    // Check errors
    const errorStatus = totalErrors <= thresholds.maxErrors ? '✅' : '❌';
    const errorColor = totalErrors <= thresholds.maxErrors ? colors.green : colors.red;
    logWithColor(`  ${errorStatus} Errors: ${totalErrors} (max: ${thresholds.maxErrors})`, errorColor);
    if (totalErrors > thresholds.maxErrors) passed = false;
    
    // Check warnings
    const warningStatus = totalWarnings <= thresholds.maxWarnings ? '✅' : '❌';
    const warningColor = totalWarnings <= thresholds.maxWarnings ? colors.green : colors.yellow;
    logWithColor(`  ${warningStatus} Warnings: ${totalWarnings} (max: ${thresholds.maxWarnings})`, warningColor);
    if (totalWarnings > thresholds.maxWarnings) passed = false;
    
    return passed;
    
  } catch (error) {
    logWithColor(`Code quality validation failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Validates file complexity and size
 * @returns {Promise<boolean>} - True if complexity passes
 */
async function validateComplexity() {
  logSection('Complexity Validation');
  
  const filesToCheck = [
    'src/actions/builders/actionDefinitionBuilder.js',
    'src/actions/builders/actionDefinitionValidator.js'
  ];
  
  let passed = true;
  const thresholds = QUALITY_GATES.codeQuality;
  
  for (const filePath of filesToCheck) {
    if (!fileExists(filePath)) {
      logWithColor(`❌ File not found: ${filePath}`, colors.red);
      passed = false;
      continue;
    }
    
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    
    logWithColor(`\n📄 ${path.basename(filePath)}:`, colors.blue);
    
    // Check file size
    const sizeStatus = lines <= thresholds.maxLines ? '✅' : '❌';
    const sizeColor = lines <= thresholds.maxLines ? colors.green : colors.red;
    logWithColor(`  ${sizeStatus} Lines: ${lines} (max: ${thresholds.maxLines})`, sizeColor);
    if (lines > thresholds.maxLines) passed = false;
    
    // Simple complexity check based on cyclomatic indicators
    const complexityIndicators = (content.match(/\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcatch\b/g) || []).length;
    const complexityStatus = complexityIndicators <= thresholds.maxComplexity ? '✅' : '❌';
    const complexityColor = complexityIndicators <= thresholds.maxComplexity ? colors.green : colors.red;
    logWithColor(`  ${complexityStatus} Complexity indicators: ${complexityIndicators} (max: ${thresholds.maxComplexity})`, complexityColor);
    if (complexityIndicators > thresholds.maxComplexity) passed = false;
  }
  
  return passed;
}

/**
 * Main quality gate validation function
 */
async function runQualityGates() {
  logWithColor(`${colors.bold}${colors.cyan}🚪 ActionDefinitionBuilder Quality Gates${colors.reset}\n`);
  
  const results = {
    coverage: false,
    performance: false,
    codeQuality: false,
    complexity: false
  };
  
  try {
    // Run all validations
    results.coverage = await validateCoverage();
    results.performance = await validatePerformance();
    results.codeQuality = await validateCodeQuality();
    results.complexity = await validateComplexity();
    
    // Summary
    logSection('Quality Gates Summary');
    
    const allPassed = Object.values(results).every(result => result === true);
    
    for (const [gate, passed] of Object.entries(results)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const color = passed ? colors.green : colors.red;
      logWithColor(`  ${status} ${gate.charAt(0).toUpperCase() + gate.slice(1)}`, color);
    }
    
    if (allPassed) {
      logWithColor(`\n🎉 All quality gates passed!`, colors.green);
      process.exit(0);
    } else {
      logWithColor(`\n💥 Quality gates failed. Please address the issues above.`, colors.red);
      process.exit(1);
    }
    
  } catch (error) {
    logWithColor(`\n💥 Quality gate validation failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run quality gates if called directly
if (require.main === module) {
  runQualityGates();
}

module.exports = {
  runQualityGates,
  validateCoverage,
  validatePerformance,
  validateCodeQuality,
  validateComplexity,
  QUALITY_GATES
};