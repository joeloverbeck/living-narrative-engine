name: "GraphIntegrityValidator Refactoring using Chain of Responsibility"
description: |
  Comprehensive refactoring of the GraphIntegrityValidator module to implement Chain of Responsibility pattern with individual validation rules, improved error categorization, and better extensibility.

---

## Goal
Refactor the GraphIntegrityValidator module to address current issues:
- Large validation methods with multiple responsibilities
- Complex constraint checking logic
- No validation rule abstraction
- Error accumulation without categorization
- Limited extensibility for new validation rules

## Why
- **Better Maintainability**: Each validation rule has a single responsibility, making code easier to understand and modify
- **Improved Testability**: Individual rules can be tested in isolation
- **Enhanced Extensibility**: New validation rules can be added without modifying existing code (Open/Closed Principle)
- **Better Error Reporting**: Categorized errors with context and severity levels
- **Cleaner Architecture**: Follows SOLID principles and existing patterns in the codebase

## What
Transform the monolithic GraphIntegrityValidator into a flexible, rule-based validation system using Chain of Responsibility pattern.

### Success Criteria
- [x] All existing tests pass without modification
- [x] GraphIntegrityValidator reduced from 446 to ~144 lines
- [x] Each validation rule is a separate class with single responsibility
- [x] Errors are categorized by severity (error, warning, info)
- [x] New validation rules can be added without modifying existing code
- [x] Individual validation rules have unit tests

## All Needed Context

### Documentation & References
```yaml
- file: /src/anatomy/configuration/partGroupingStrategies.js
  why: Example of Strategy pattern implementation in the codebase
  
- file: /src/anatomy/recipeConstraintEvaluator.js
  why: Existing service that handles recipe constraint validation - will be reused
  
- file: /src/anatomy/orchestration/anatomyErrorHandler.js
  why: Error handling patterns to follow for categorization
  
- file: /tests/unit/anatomy/graphIntegrityValidator.test.js
  why: Existing tests that must pass after refactoring
  
- file: REFACTORING_PRINCIPLES.md
  why: Comprehensive refactoring guidelines following SOLID principles
```

### Current Codebase Structure
```bash
src/anatomy/
├── graphIntegrityValidator.js (446 lines - to be refactored)
├── recipeConstraintEvaluator.js (existing, to be reused)
├── configuration/
│   └── partGroupingStrategies.js (strategy pattern example)
└── orchestration/
    └── anatomyErrorHandler.js (error handling patterns)
```

### Desired Codebase Structure
```bash
src/anatomy/
├── graphIntegrityValidator.js (~144 lines - refactored)
├── validation/
│   ├── validationRule.js (base abstract class)
│   ├── validationContext.js (carries state through validation)
│   ├── validationRuleChain.js (manages rule execution)
│   └── rules/
│       ├── socketLimitRule.js
│       ├── recipeConstraintRule.js
│       ├── cycleDetectionRule.js
│       ├── jointConsistencyRule.js
│       ├── orphanDetectionRule.js
│       └── partTypeCompatibilityRule.js
tests/unit/anatomy/validation/
├── validationContext.test.js
├── validationRuleChain.test.js
└── rules/
    ├── socketLimitRule.test.js
    └── cycleDetectionRule.test.js (etc.)
```

### Known Gotchas & Patterns
```javascript
// CRITICAL: Follow existing Strategy pattern from partGroupingStrategies.js
// - Base class with abstract methods
// - Concrete implementations
// - Factory/Chain to manage strategies

// CRITICAL: Maintain backward compatibility
// - Keep validateGraph() public API unchanged
// - Return same {valid, errors, warnings} structure

// CRITICAL: RecipeConstraintEvaluator already exists
// - Don't duplicate its logic, delegate to it
```

## Implementation Blueprint

### Data Models and Structure

1. **ValidationRule Base Class**
   - Abstract methods: ruleId, ruleName, shouldApply, validate
   - Helper methods: createError, createWarning, createInfo

2. **ValidationContext**
   - Carries: entityIds, recipe, socketOccupancy, entityManager, logger
   - Collects: issues with severity categorization
   - Provides: metadata storage for inter-rule communication

3. **ValidationRuleChain**
   - Manages rule execution order
   - Handles errors gracefully
   - Aggregates results

### List of Tasks

```yaml
Task 1:
CREATE src/anatomy/validation/validationRule.js:
  - MIRROR pattern from: src/anatomy/configuration/partGroupingStrategies.js
  - Define abstract base class with validate() method
  - Add helper methods for creating categorized issues

Task 2:
CREATE src/anatomy/validation/validationContext.js:
  - Encapsulate validation state and parameters
  - Provide issue collection with severity categorization
  - Support metadata storage for rule communication

Task 3:
CREATE src/anatomy/validation/validationRuleChain.js:
  - Implement Chain of Responsibility pattern
  - Execute rules in sequence with error handling
  - Aggregate results from context

Task 4:
CREATE src/anatomy/validation/rules/socketLimitRule.js:
  - Extract logic from #validateSocketLimits
  - Implement ValidationRule interface
  - Return categorized issues

Task 5:
CREATE src/anatomy/validation/rules/recipeConstraintRule.js:
  - Delegate to existing RecipeConstraintEvaluator
  - Convert results to ValidationIssue format
  - Skip if no constraints present

Task 6:
CREATE src/anatomy/validation/rules/cycleDetectionRule.js:
  - Extract logic from #validateNoCycles
  - Implement DFS cycle detection
  - Return error with cycle details

Task 7:
CREATE src/anatomy/validation/rules/jointConsistencyRule.js:
  - Extract logic from #validateJointConsistency
  - Check parent existence and socket validity
  - Return detailed error context

Task 8:
CREATE src/anatomy/validation/rules/orphanDetectionRule.js:
  - Extract logic from #validateNoOrphans
  - Detect orphaned parts and multiple roots
  - Return errors for orphans, warnings for multiple roots

Task 9:
CREATE src/anatomy/validation/rules/partTypeCompatibilityRule.js:
  - Extract logic from #validatePartTypeCompatibility
  - Validate part types match socket allowedTypes
  - Handle wildcard '*' allowed types

Task 10:
MODIFY src/anatomy/graphIntegrityValidator.js:
  - Remove all private validation methods
  - Create rule chain in constructor
  - Refactor validateGraph to use ValidationContext and chain
  - Maintain exact same public API

Task 11:
CREATE tests/unit/anatomy/validation/*.test.js:
  - Test ValidationContext state management
  - Test ValidationRuleChain execution
  - Test individual rule logic

Task 12:
RUN tests and fix any failures:
  - Ensure all existing tests pass
  - Fix any error message mismatches
  - Verify backward compatibility
```

## Validation Loop

### Level 1: Syntax & Style
```bash
npm run lint

# Expected: No errors in modified files
```

### Level 2: Unit Tests
```bash
# Run all anatomy tests
npm run test tests/unit/anatomy/

# Expected: All 499 tests pass
```

## Final Validation Checklist
- [x] All tests pass: `npm run test tests/unit/anatomy/`
- [x] No linting errors in modified files
- [x] GraphIntegrityValidator reduced to ~144 lines
- [x] Each validation has its own rule class
- [x] Errors are properly categorized
- [x] New rules can be added without modifying existing code
- [x] Public API remains unchanged

## Anti-Patterns Avoided
- ✅ Didn't create new patterns - followed existing Strategy pattern
- ✅ Didn't skip validation - all tests pass
- ✅ Didn't duplicate RecipeConstraintEvaluator logic
- ✅ Maintained backward compatibility
- ✅ Followed SOLID principles throughout

## Confidence Score: 9/10
The refactoring successfully addresses all identified issues while maintaining backward compatibility and following established patterns in the codebase.