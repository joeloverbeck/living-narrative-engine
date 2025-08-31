# EXEPHAMIG-003: Create Migration Validation Framework

## Overview

Create a comprehensive validation framework to ensure migrated test files maintain identical behavior to their original versions. This framework captures baseline behavior, compares migrated results, and generates detailed validation reports for each migration phase.

## Background Context

The Living Narrative Engine project requires migration of 56 test files across 5 mod categories from legacy patterns to new infrastructure. Critical success factors include:

- **Behavior Preservation**: Migrated tests must produce identical results to originals
- **Performance Validation**: Test execution time must remain within acceptable thresholds (<30% regression)
- **Quality Assurance**: Systematic validation prevents regression during migration
- **Risk Mitigation**: Early detection of migration issues before they impact development

## Problem Statement

The migration process requires robust validation capabilities that currently **do not exist**:

- **Baseline Capture**: Capture detailed behavior from original test files
- **Behavior Comparison**: Compare original vs migrated test execution
- **Performance Measurement**: Track test execution performance impact
- **Report Generation**: Provide actionable insights on migration success/failure

Without this framework, migration phases risk introducing subtle behavioral changes or performance regressions that could impact development productivity.

## Technical Requirements

### 1. Migration Validator Core Class

**File**: `tests/migration/MigrationValidator.js`

**Core Implementation**:
```javascript
import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';

class MigrationValidator {
  /**
   * Captures comprehensive baseline behavior from existing test file
   * @param {string} testFilePath - Path to original test file
   * @returns {Promise<Object>} Baseline behavior data
   */
  static async captureBaseline(testFilePath) {
    const baselineData = {
      timestamp: new Date().toISOString(),
      testFile: testFilePath,
      testResults: null,
      performanceMetrics: null,
      eventSequences: [],
      entityStates: {},
      errorScenarios: [],
      metadata: {}
    };

    try {
      // Execute test and capture comprehensive data
      const testExecution = await this.executeTestWithCapture(testFilePath);
      
      baselineData.testResults = testExecution.results;
      baselineData.performanceMetrics = testExecution.performance;
      baselineData.eventSequences = testExecution.events;
      baselineData.entityStates = testExecution.entities;
      baselineData.errorScenarios = testExecution.errors;
      baselineData.metadata = testExecution.metadata;

      // Save baseline to file for future comparison
      const baselineFile = this.generateBaselineFilePath(testFilePath);
      await fs.writeJson(baselineFile, baselineData, { spaces: 2 });

      return baselineData;
    } catch (error) {
      baselineData.error = error.message;
      baselineData.stack = error.stack;
      return baselineData;
    }
  }

  /**
   * Validates migrated test produces identical behavior to baseline
   * @param {string} originalPath - Path to original test file
   * @param {string} migratedPath - Path to migrated test file
   * @returns {Promise<Object>} Validation results
   */
  static async validateMigration(originalPath, migratedPath) {
    const validation = {
      timestamp: new Date().toISOString(),
      originalFile: originalPath,
      migratedFile: migratedPath,
      passed: false,
      differences: [],
      performanceImpact: null,
      recommendation: null
    };

    try {
      // Load or capture baseline
      const baseline = await this.loadOrCaptureBaseline(originalPath);
      
      // Execute migrated test with capture
      const migratedData = await this.executeTestWithCapture(migratedPath);

      // Perform comprehensive comparison
      validation.differences = this.compareTestBehavior(baseline, migratedData);
      validation.performanceImpact = this.analyzePerformanceImpact(baseline, migratedData);
      
      // Determine overall pass/fail
      validation.passed = this.evaluateValidation(validation.differences, validation.performanceImpact);
      validation.recommendation = this.generateRecommendation(validation);

      return validation;
    } catch (error) {
      validation.error = error.message;
      validation.stack = error.stack;
      return validation;
    }
  }

  /**
   * Generates comprehensive migration report with differences and recommendations
   * @param {string} originalPath - Original test file path
   * @param {string} migratedPath - Migrated test file path  
   * @param {Object} validationResults - Results from validateMigration
   * @returns {Promise<Object>} Detailed migration report
   */
  static generateMigrationReport(originalPath, migratedPath, validationResults) {
    const report = {
      summary: {
        testFile: path.basename(originalPath),
        migrationStatus: validationResults.passed ? 'SUCCESS' : 'FAILED',
        criticalIssues: validationResults.differences.filter(d => d.severity === 'critical').length,
        warningIssues: validationResults.differences.filter(d => d.severity === 'warning').length,
        performanceChange: validationResults.performanceImpact?.percentageChange || 0
      },
      behaviorDifferences: this.categorizeDifferences(validationResults.differences),
      performanceAnalysis: this.generatePerformanceAnalysis(validationResults.performanceImpact),
      codeReductionMetrics: this.calculateCodeReduction(originalPath, migratedPath),
      migrationRecommendations: this.generateActionableRecommendations(validationResults),
      nextSteps: this.determineNextSteps(validationResults)
    };

    return report;
  }
}
```

### 2. Test Execution and Capture System

**Core Functionality**:
```javascript
class TestExecutionCapture {
  /**
   * Execute test file with comprehensive behavior capture
   */
  static async executeTestWithCapture(testFilePath) {
    const captureData = {
      results: null,
      performance: {},
      events: [],
      entities: {},
      errors: [],
      metadata: {}
    };

    // Setup test environment with capture capabilities
    const testEnv = this.setupCaptureEnvironment();
    
    // Performance measurement
    const startTime = performance.now();
    
    try {
      // Execute test with Jest programmatically
      const jestResults = await this.runJestTest(testFilePath, testEnv);
      
      const endTime = performance.now();
      
      // Capture results
      captureData.results = {
        passed: jestResults.success,
        testCount: jestResults.numTotalTests,
        failureCount: jestResults.numFailedTests,
        failures: jestResults.testResults.map(r => ({
          description: r.fullName,
          error: r.failureMessages.join('\n')
        }))
      };

      // Capture performance metrics
      captureData.performance = {
        executionTime: endTime - startTime,
        memoryUsage: process.memoryUsage(),
        testCounts: {
          total: jestResults.numTotalTests,
          passed: jestResults.numPassedTests,
          failed: jestResults.numFailedTests
        }
      };

      // Capture event sequences (if event bus available)
      captureData.events = testEnv.capturedEvents || [];
      
      // Capture entity states (if entity manager available)
      captureData.entities = testEnv.capturedEntityStates || {};

      // Capture error scenarios
      captureData.errors = testEnv.capturedErrors || [];

      return captureData;
    } catch (error) {
      captureData.error = error.message;
      captureData.stack = error.stack;
      return captureData;
    }
  }

  /**
   * Setup test environment with capture capabilities
   */
  static setupCaptureEnvironment() {
    // Create isolated test environment
    // Add event capture hooks
    // Add entity state capture hooks
    // Add error capture hooks
    // Return environment with capture methods
  }
}
```

### 3. Behavior Comparison Engine

**Core Functionality**:
```javascript
class BehaviorComparator {
  /**
   * Compare test behavior between baseline and migrated versions
   */
  static compareTestBehavior(baseline, migrated) {
    const differences = [];

    // Compare test results (pass/fail)
    const resultDiff = this.compareTestResults(baseline.testResults, migrated.testResults);
    if (resultDiff.hasDifferences) {
      differences.push({
        category: 'testResults',
        severity: 'critical',
        description: 'Test pass/fail results differ',
        details: resultDiff.details
      });
    }

    // Compare event sequences
    const eventDiff = this.compareEventSequences(baseline.eventSequences, migrated.eventSequences);
    if (eventDiff.hasDifferences) {
      differences.push({
        category: 'eventSequences',
        severity: eventDiff.severity,
        description: 'Event sequences differ',
        details: eventDiff.details
      });
    }

    // Compare final entity states
    const entityDiff = this.compareEntityStates(baseline.entityStates, migrated.entityStates);
    if (entityDiff.hasDifferences) {
      differences.push({
        category: 'entityStates',
        severity: entityDiff.severity,
        description: 'Final entity states differ',
        details: entityDiff.details
      });
    }

    // Compare error handling
    const errorDiff = this.compareErrorHandling(baseline.errorScenarios, migrated.errorScenarios);
    if (errorDiff.hasDifferences) {
      differences.push({
        category: 'errorHandling',
        severity: 'warning',
        description: 'Error handling differs',
        details: errorDiff.details
      });
    }

    return differences;
  }

  /**
   * Analyze performance impact of migration
   */
  static analyzePerformanceImpact(baseline, migrated) {
    const baselineTime = baseline.performanceMetrics?.executionTime || 0;
    const migratedTime = migrated.performanceMetrics?.executionTime || 0;
    
    const percentageChange = ((migratedTime - baselineTime) / baselineTime) * 100;
    
    return {
      baselineTime,
      migratedTime,
      absoluteChange: migratedTime - baselineTime,
      percentageChange,
      withinThreshold: Math.abs(percentageChange) <= 30, // 30% threshold
      severity: this.determinePerformanceSeverity(percentageChange)
    };
  }
}
```

### 4. Report Generation System

**Core Functionality**:
```javascript
class ReportGenerator {
  /**
   * Generate detailed HTML report for migration results
   */
  static generateHTMLReport(migrationReport) {
    // Generate comprehensive HTML report with:
    // - Executive summary
    // - Detailed behavior analysis
    // - Performance charts
    // - Code reduction metrics
    // - Action items and recommendations
  }

  /**
   * Generate JSON report for programmatic consumption
   */
  static generateJSONReport(migrationReport) {
    // Structure data for automated processing
    // Include all metrics and details
    // Enable integration with CI/CD pipelines
  }

  /**
   * Generate console summary for quick feedback
   */
  static generateConsoleSummary(migrationReport) {
    // Colorized console output
    // Key metrics and status
    // Critical issues highlighted
    // Next steps clearly stated
  }
}
```

## Implementation Specifications

### File Structure
```
tests/
├── migration/
│   ├── MigrationValidator.js           # Core validator class
│   ├── TestExecutionCapture.js        # Test execution with capture
│   ├── BehaviorComparator.js          # Behavior comparison engine
│   ├── ReportGenerator.js             # Report generation
│   ├── baselines/                     # Stored baseline data
│   │   ├── exercise/                  # Category-specific baselines
│   │   ├── violence/
│   │   ├── positioning/
│   │   ├── sex/
│   │   └── intimacy/
│   └── reports/                       # Generated migration reports
│       ├── html/                      # HTML reports
│       ├── json/                      # JSON reports
│       └── summaries/                 # Console summaries
```

### Validation Thresholds

**Performance Thresholds**:
- **Acceptable**: ≤10% performance change
- **Warning**: 10-30% performance change
- **Critical**: >30% performance change

**Behavior Differences**:
- **Critical**: Test pass/fail changes, entity state differences
- **Warning**: Event sequence variations, timing differences
- **Info**: Performance improvements, code style changes

### Integration Points

**Jest Integration**:
- Programmatic Jest execution
- Custom test reporters
- Test result capture and analysis

**Project Integration**:
- Event bus capture hooks
- Entity manager state capture
- Error handling capture

## Acceptance Criteria

### Core Functionality
- [ ] MigrationValidator successfully captures baseline behavior from existing tests
- [ ] Validation accurately compares original vs migrated test behavior
- [ ] Performance impact analysis correctly identifies regressions
- [ ] Report generation provides actionable insights and recommendations

### Accuracy Requirements
- [ ] Behavior comparison identifies all significant differences
- [ ] Performance measurement is consistent and reliable
- [ ] False positive rate for differences is <5%
- [ ] Validation correctly identifies successful migrations

### Reporting Requirements
- [ ] HTML reports are comprehensive and user-friendly
- [ ] JSON reports enable programmatic integration
- [ ] Console summaries provide quick feedback
- [ ] Reports include actionable next steps

### Integration Requirements
- [ ] Framework integrates with migration scripts (EXEPHAMIG-001)
- [ ] Baseline capture works with all test file types
- [ ] Validation handles edge cases and error scenarios
- [ ] Framework supports batch validation operations

## Dependencies

**Prerequisites**:
- EXEPHAMIG-001: Migration Scripts Infrastructure
- EXEPHAMIG-002: Migration Templates and Utilities

**Enables**:
- EXEPHAMIG-004: Validate and Test Migration Tooling
- All migration phase validation (006, 009, 012, 015, 018)

## Risk Mitigation

### Validation Accuracy Risk
- **Risk**: Framework misses subtle behavioral differences
- **Mitigation**: Comprehensive test coverage with known edge cases
- **Contingency**: Manual validation process for critical migrations

### Performance Measurement Risk
- **Risk**: Inconsistent performance measurements due to system variations
- **Mitigation**: Multiple test runs, statistical analysis, controlled environment
- **Contingency**: Performance trending over time vs absolute measurements

### Baseline Corruption Risk
- **Risk**: Baseline data becomes corrupted or invalid
- **Mitigation**: Baseline versioning, validation of baseline integrity
- **Contingency**: Baseline regeneration and historical comparison

## Success Metrics

### Quantitative Metrics
- **Detection Accuracy**: 95% accuracy in identifying behavioral differences
- **Performance Consistency**: <5% variation in performance measurements
- **Report Generation**: 100% successful report generation for valid inputs

### Qualitative Metrics
- **Developer Confidence**: High confidence in migration validation results
- **Report Usefulness**: Reports provide clear, actionable guidance
- **Process Efficiency**: Validation process streamlines migration workflow

## Timeline

**Estimated Duration**: 4-5 days

**Milestones**:
- Day 1: Core MigrationValidator class and baseline capture
- Day 2: Test execution capture and behavior comparison engine
- Day 3: Report generation system and HTML/JSON reports
- Day 4: Integration testing and validation with sample files
- Day 5: Documentation, refinement, and edge case handling

## Next Steps

Upon completion, this ticket enables:
1. EXEPHAMIG-004: Comprehensive testing of migration tooling
2. Validation steps in all migration phases (006, 009, 012, 015, 018)
3. Confidence in migration success before proceeding to next phases

**Critical Success Factor**: Validation framework quality directly impacts migration confidence and success. Framework must reliably detect behavioral differences while minimizing false positives.