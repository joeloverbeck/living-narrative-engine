# EXEPHAMIG-001: Create Migration Scripts Infrastructure

## Overview

Create the core migration scripts infrastructure required to execute the phased migration of 56 existing mod integration test files to use the new testing infrastructure (ModTestHandlerFactory, ModEntityScenarios, ModAssertionHelpers, ModActionTestBase, ModTestFixture).

## Background Context

The Living Narrative Engine project currently has 56 mod integration test files across 5 categories containing over 21,600 lines of duplicated code. These files need to be systematically migrated to use new infrastructure to reduce duplication by 90% (to <1,500 lines) while maintaining identical test behavior and performance within acceptable thresholds.

## Problem Statement

The migration process requires automated tooling that currently **does not exist** in the codebase:

- **`scripts/migrateMod.js`** - Semi-automated migration script (Missing)
- **`scripts/validateMigration.js`** - Migration validation script (Missing)  
- **`scripts/compareMigrationResults.js`** - Test result comparison utility (Missing)

These scripts are critical for systematic, reliable migration across 5 phases covering different mod categories.

## Technical Requirements

### 1. Create `scripts/migrateMod.js`

**Purpose**: Parse existing test files, extract configuration, generate new infrastructure-based tests

**Key Functionality**:
- AST parsing of existing JavaScript test files
- Configuration extraction from test patterns
- Template generation using new infrastructure patterns
- File I/O utilities for backup and file management
- Progress reporting and logging

**Required Capabilities**:
```javascript
// Usage pattern
node scripts/migrateMod.js --category exercise --file show_off_biceps_action.test.js --dry-run
node scripts/migrateMod.js --category violence --batch --validate
```

**Core Functions**:
```javascript
class ModMigrator {
  /**
   * Parse existing test file and extract configuration
   */
  static parseTestFile(filePath) {
    // Extract:
    // - Test descriptions and structure
    // - Entity setup patterns
    // - Assertion patterns
    // - Import statements
    // - Configuration data
  }

  /**
   * Generate new infrastructure-based test
   */
  static generateMigratedTest(config, templatePath) {
    // Generate using ModActionTestBase patterns
    // Apply category-specific templates
    // Preserve test behavior and structure
  }

  /**
   * Backup original files before migration
   */
  static createBackup(filePath) {
    // Create timestamped backups
    // Maintain directory structure
  }
}
```

### 2. Create `scripts/validateMigration.js`

**Purpose**: Compare original vs migrated test behavior and generate validation reports

**Key Functionality**:
- Execute original and migrated tests
- Compare test results, event sequences, entity states
- Performance measurement and comparison
- Detailed reporting of differences

**Required Capabilities**:
```javascript
// Usage pattern  
node scripts/validateMigration.js --original tests/integration/mods/exercise/show_off_biceps_action.test.js --migrated tests/integration/mods/exercise/show_off_biceps_action.migrated.test.js
```

**Core Functions**:
```javascript
class MigrationValidator {
  /**
   * Execute tests and capture detailed results
   */
  static async executeTestWithCapture(testPath) {
    // Capture:
    // - Test execution results (pass/fail)
    // - Performance metrics (execution time)
    // - Event sequences
    // - Entity states
    // - Error scenarios and messages
  }

  /**
   * Compare original vs migrated test results
   */
  static compareResults(originalResults, migratedResults) {
    // Compare:
    // - Test outcomes (pass/fail status)
    // - Event sequences and timing
    // - Final entity states
    // - Error handling behavior
    // - Performance within thresholds
  }
}
```

### 3. Create `scripts/compareMigrationResults.js`

**Purpose**: Compare JSON test outputs before/after migration with detailed analysis

**Key Functionality**:
- JSON diff analysis of test results
- Performance metric comparison
- Test result parsing and analysis
- Report generation with recommendations

**Required Capabilities**:
```javascript
// Usage pattern
node scripts/compareMigrationResults.js baseline.json migrated.json --threshold 20
```

**Core Functions**:
```javascript
class ResultComparator {
  /**
   * Parse JSON test result files
   */
  static parseResults(resultPath) {
    // Parse Jest JSON output
    // Extract test metrics
    // Normalize data for comparison
  }

  /**
   * Generate detailed comparison report
   */
  static generateReport(baseline, migrated, options) {
    // Report sections:
    // - Test result differences
    // - Performance impact analysis
    // - Code reduction metrics
    // - Migration recommendations
    // - Risk assessment
  }
}
```

## Implementation Specifications

### File Structure
```
scripts/
├── migrateMod.js                    # Main migration script
├── validateMigration.js             # Migration validation
├── compareMigrationResults.js       # Result comparison
└── lib/
    └── migration/                   # Migration utilities
        ├── astParser.js             # AST parsing utilities
        ├── configExtractor.js       # Configuration extraction
        ├── templateGenerator.js     # Template generation
        ├── fileManager.js           # File I/O utilities
        └── reporter.js              # Progress reporting
```

### Dependencies

**Required npm packages**:
- `@babel/parser` - AST parsing
- `@babel/traverse` - AST traversal
- `@babel/generator` - Code generation
- `fs-extra` - Enhanced file operations
- `chalk` - Console output formatting
- `yargs` - Command line argument parsing
- `deep-diff` - Object comparison
- `lodash` - Utility functions

### Error Handling and Validation

**Input Validation**:
- Validate file paths exist
- Check file permissions
- Verify test file structure
- Validate migration targets

**Error Recovery**:
- Graceful failure handling
- Detailed error logging
- Rollback capability
- Progress state preservation

## Acceptance Criteria

### Functional Requirements
- [ ] `scripts/migrateMod.js` successfully parses existing test files
- [ ] Script generates valid infrastructure-based test files
- [ ] `scripts/validateMigration.js` compares test behavior accurately
- [ ] `scripts/compareMigrationResults.js` produces detailed comparison reports
- [ ] All scripts handle edge cases and errors gracefully
- [ ] Backup and rollback functionality works correctly

### Quality Requirements
- [ ] Scripts follow project coding standards and conventions
- [ ] Comprehensive error handling and logging
- [ ] Command-line interface is user-friendly
- [ ] Performance is acceptable for batch operations
- [ ] Code is well-documented and maintainable

### Testing Requirements
- [ ] Unit tests for core migration functions
- [ ] Integration tests with sample test files
- [ ] Validation against known good migrations
- [ ] Performance benchmarks established

## Dependencies

**Prerequisites**:
- None (this is the foundation for all migration work)

**Enables**:
- EXEPHAMIG-002 (Migration Templates)
- EXEPHAMIG-003 (Validation Framework)
- All migration phase tickets (005-019)

## Risk Mitigation

### Technical Risks
- **AST Parsing Complexity**: Start with simple test files, build complexity gradually
- **Template Generation Issues**: Create extensive test cases with known inputs/outputs
- **Performance Problems**: Implement benchmarking and optimization from start

### Process Risks
- **Incomplete Requirements**: Test scripts with real files from each category early
- **Integration Issues**: Validate against actual test infrastructure components
- **Usability Problems**: Create comprehensive CLI help and documentation

## Success Metrics

### Quantitative Metrics
- **Parsing Success Rate**: 100% of valid test files parsed without errors
- **Generation Accuracy**: Generated tests pass on first run (>95% success rate)
- **Performance**: Scripts handle batch operations within reasonable time (<5 min for 10 files)

### Qualitative Metrics
- **Developer Experience**: Scripts are intuitive and well-documented
- **Reliability**: Scripts handle edge cases and provide clear error messages
- **Maintainability**: Code is modular and extensible for future enhancements

## Timeline

**Estimated Duration**: 3-4 days

**Milestones**:
- Day 1: Core script structure and basic AST parsing
- Day 2: Template generation and file management
- Day 3: Validation and comparison utilities
- Day 4: Testing, documentation, and refinement

## Next Steps

Upon completion, this ticket enables:
1. EXEPHAMIG-002: Create Migration Templates and Utilities
2. EXEPHAMIG-003: Create Migration Validation Framework
3. Testing and validation of migration tooling (EXEPHAMIG-004)

**Critical Success Factor**: These scripts are foundational to the entire migration strategy. Quality and reliability here directly impact all subsequent migration phases.