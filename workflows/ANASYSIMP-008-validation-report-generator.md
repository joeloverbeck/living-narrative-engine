# ANASYSIMP-008: Validation Report Generator

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1-2 days)
**Impact:** Medium - Batch error discovery
**Status:** Not Started

## Context

Multiple validation errors require multiple reload cycles to discover all issues. A comprehensive validation report generator enables batch discovery of all issues in a single validation pass.

## Problem Statement

Current workflow:
1. Fix one error
2. Reload
3. Discover next error
4. Repeat

This serial discovery process wastes time and creates frustration.

## Solution Overview

Generate comprehensive validation reports that aggregate all errors, warnings, and suggestions with statistics and fixable issue identification.

## Implementation

**Current State:** ValidationReport class and RecipePreflightValidator have been implemented with core functionality:
- ✅ ValidationReport exists in `src/anatomy/validation/ValidationReport.js`
- ✅ RecipePreflightValidator exists in `src/anatomy/validation/RecipePreflightValidator.js` (ANASYSIMP-003 implementation)
- ✅ Console output with colors and symbols (✓, ✗, ⚠, 💡) already implemented
- ✅ JSON export (toJSON method) already implemented
- ✅ Statistics summary already implemented
- ✅ Error/warning/suggestion categorization already implemented
- ✅ Registered in DI system with token `IRecipePreflightValidator`

**This Ticket Extends With:**

1. **Enhanced Report Formatting**
   - ✅ Console output with colors/symbols (DONE)
   - ✅ JSON export for tooling (DONE)
   - 🔲 HTML report generation (optional - NEW)
   - 🔲 Markdown report for documentation (NEW)
   - 🔲 CSV export for batch analysis (NEW)

2. **Fixable Issue Detection** (NEW)
   - Identify auto-fixable issues
   - Suggest batch fix operations
   - Generate fix scripts when possible

3. **Related Files Discovery** (NEW)
   - Link to all files mentioned in errors
   - Show file paths for manual inspection
   - Suggest file creation commands

## File Structure

**Existing Files:**
```
src/anatomy/validation/
├── ValidationReport.js              # ✅ Core report (IMPLEMENTED)
├── RecipePreflightValidator.js      # ✅ Orchestrates validation (IMPLEMENTED)
├── patternMatchingValidator.js      # ✅ Pattern validation (IMPLEMENTED)
├── socketSlotCompatibilityValidator.js  # ✅ Socket/slot checks (IMPLEMENTED)
└── rules/                           # ✅ Validation rules (IMPLEMENTED)
    ├── componentExistenceValidationRule.js
    └── propertySchemaValidationRule.js
```

**New Files to Create:**
```
src/anatomy/validation/
├── ReportFormatter.js               # 🔲 Format for different outputs (NEW)
├── FixableIssueDetector.js          # 🔲 Auto-fix detection (NEW)
└── RelatedFileFinder.js             # 🔲 File discovery (NEW)

scripts/
└── formatValidationReport.js        # 🔲 CLI report formatter (NEW)
```

**Note:** Project uses `scripts/` directory for CLI tools, not `tools/`.

## Implementation Guidance

### 1. ReportFormatter Class

**Purpose:** Extend ValidationReport with multiple output formats

**Location:** `src/anatomy/validation/ReportFormatter.js`

**Design:**
```javascript
/**
 * @file Report formatter for multiple output formats
 */
export class ReportFormatter {
  #report;

  constructor(report) {
    this.#report = report; // ValidationReport instance
  }

  toHTML() { /* Generate HTML report */ }
  toMarkdown() { /* Generate Markdown report */ }
  toCSV() { /* Generate CSV for batch analysis */ }
}
```

**Integration:** ValidationReport can return a ReportFormatter instance via `.formatter()` method

### 2. FixableIssueDetector Class

**Purpose:** Analyze validation errors to identify auto-fixable issues

**Location:** `src/anatomy/validation/FixableIssueDetector.js`

**Design:**
```javascript
/**
 * @file Detects auto-fixable validation issues
 */
export class FixableIssueDetector {
  static analyze(report) {
    const fixable = [];
    // Analyze report.errors for patterns like:
    // - Missing component references → can suggest component ID
    // - Invalid property values → can suggest valid values
    // - Blueprint mismatches → can suggest correct blueprint
    return fixable;
  }
}
```

**Integration:** Called by ValidationReport or CLI tool to augment report with fix suggestions

### 3. RelatedFileFinder Class

**Purpose:** Extract and list all file references from validation results

**Location:** `src/anatomy/validation/RelatedFileFinder.js`

**Design:**
```javascript
/**
 * @file Finds all files related to validation errors
 */
export class RelatedFileFinder {
  static extractFiles(report) {
    const files = new Set();
    // Extract from:
    // - report.errors (blueprintId → blueprint file path)
    // - report.warnings (componentId → component file path)
    // - recipe.recipePath
    return Array.from(files);
  }
}
```

**Integration:** Used by CLI tool or report formatter to create file lists

### 4. CLI Report Formatter Script

**Purpose:** Standalone CLI tool for formatting validation reports

**Location:** `scripts/formatValidationReport.js`

**Usage:**
```bash
# Format existing JSON report
npm run format-report report.json --format html
npm run format-report report.json --format markdown
npm run format-report report.json --format csv
```

**Design:** Reads JSON report, applies ReportFormatter, writes output file

## Acceptance Criteria

**Already Complete:**
- [x] Report aggregates all validation results (ValidationReport class)
- [x] Console output uses colors/symbols (✓, ✗, ⚠, 💡) (toString method)
- [x] JSON export available (toJSON method)
- [x] Statistics summary included (summary property)
- [x] Error/warning/suggestion categorization (errors, warnings, suggestions properties)

**New Requirements:**
- [ ] HTML report generation (ReportFormatter)
- [ ] Markdown report generation (ReportFormatter)
- [ ] CSV export for batch analysis (ReportFormatter)
- [ ] Report identifies fixable issues (FixableIssueDetector)
- [ ] Report lists all related files (RelatedFileFinder)
- [ ] CLI tool can format reports in multiple formats (formatValidationReport.js)

## Dependencies

**Depends On:**
- ✅ ANASYSIMP-003 Pre-flight Recipe Validator (COMPLETED - implemented as RecipePreflightValidator)
  - Implementation: `src/anatomy/validation/RecipePreflightValidator.js`
  - Includes: ValidationReport class, pattern matching, socket/slot compatibility
  - DI Token: `IRecipePreflightValidator`
  - Status: Fully integrated and registered in DI system

**Integrates With:**
- ANASYSIMP-009 (CLI Tool will use enhanced reporting features)

**Note:** ANASYSIMP-003 workflow file was never created, but the implementation exists and is complete.

## Existing ValidationReport API Reference

For implementation reference, the existing ValidationReport class provides:

**File:** `/home/user/living-narrative-engine/src/anatomy/validation/ValidationReport.js`

**Properties:**
- `.isValid` - Boolean, true if no errors
- `.hasWarnings` - Boolean, true if warnings exist
- `.hasSuggestions` - Boolean, true if suggestions exist
- `.errors` - Array of error objects
- `.warnings` - Array of warning objects
- `.suggestions` - Array of suggestion objects
- `.summary` - Statistics object with counts and metadata

**Methods:**
- `.toString()` - Formatted console output with symbols
- `.toJSON()` - Raw results object for programmatic use

**Used By:**
- `RecipePreflightValidator.validate()` - Returns ValidationReport instance
- Registered in DI as `IRecipePreflightValidator`

**Example Usage:**
```javascript
const validator = container.resolve(tokens.IRecipePreflightValidator);
const report = await validator.validate(recipe, { recipePath: 'path/to/recipe.json' });

if (!report.isValid) {
  console.log(report.toString()); // Formatted output
  const json = report.toJSON();   // For tooling
}
```

## References

- **Report Section:** Recommendation 2.3
- **Report Pages:** Lines 763-791
