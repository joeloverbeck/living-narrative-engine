# ANASYSIMP-007: Enhanced Error Messages Framework

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (2 days)
**Impact:** High - Dramatically improves troubleshooting speed
**Status:** Not Started

## Context

From the anatomy system improvements analysis, current error messages lack context and remediation guidance, leading to prolonged troubleshooting sessions.

**Current Error Quality Issues:**
- Unclear what went wrong
- No context about where error occurred
- No explanation of why it matters
- No guidance on how to fix
- No references to related files or documentation

## Problem Statement

Error messages are the primary interface for debugging anatomy system issues. Poor error messages result in:
- Extended troubleshooting time (30-45 minutes per error)
- Need to inspect multiple files manually
- Trial-and-error fixes
- Documentation lookup required
- Poor developer experience

## Solution Overview

Create an enhanced error message framework that provides structured, actionable error information with context, problem, impact, fix, and references.

## Implementation Details

### Error Class Hierarchy

```javascript
/**
 * Base error class for anatomy system errors
 */
class AnatomyError extends Error {
  constructor({ context, problem, impact, fix, references, originalError }) {
    super(problem);

    this.name = this.constructor.name;
    this.context = context;      // Where error occurred
    this.problem = problem;       // What went wrong
    this.impact = impact;         // Why it matters
    this.fix = fix;              // How to fix it (string or array)
    this.references = references || []; // Related files/docs
    this.originalError = originalError; // Wrapped error if any
    this.timestamp = new Date().toISOString();
  }

  toString() {
    const lines = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`[${this.name}]`);
    lines.push(`${'='.repeat(80)}`);
    lines.push('');

    if (this.context) {
      lines.push(`Context:  ${this.context}`);
      lines.push('');
    }

    lines.push(`Problem:  ${this.problem}`);
    lines.push('');

    if (this.impact) {
      lines.push(`Impact:   ${this.impact}`);
      lines.push('');
    }

    if (this.fix) {
      if (Array.isArray(this.fix)) {
        lines.push('Fix:');
        for (const step of this.fix) {
          lines.push(`  ${step}`);
        }
      } else {
        lines.push(`Fix:      ${this.fix}`);
      }
      lines.push('');
    }

    if (this.references && this.references.length > 0) {
      lines.push('References:');
      for (const ref of this.references) {
        lines.push(`  - ${ref}`);
      }
      lines.push('');
    }

    if (this.originalError) {
      lines.push('Original Error:');
      lines.push(`  ${this.originalError.message}`);
      lines.push('');
    }

    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }

  toJSON() {
    return {
      name: this.name,
      context: this.context,
      problem: this.problem,
      impact: this.impact,
      fix: this.fix,
      references: this.references,
      originalError: this.originalError?.message,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Error for component not found
 */
class ComponentNotFoundError extends AnatomyError {
  constructor({ recipeId, location, componentId, recipePath }) {
    super({
      context: `Recipe '${recipeId}', ${location.type} '${location.name}'`,
      problem: `Component '${componentId}' does not exist in the component registry`,
      impact: `${location.type} cannot be processed, anatomy generation will fail`,
      fix: [
        `Create component at: data/mods/*/components/${componentId.split(':')[1]}.component.json`,
        '',
        'Example Component Structure:',
        '{',
        `  "$schema": "schema://living-narrative-engine/component.schema.json",`,
        `  "id": "${componentId}",`,
        '  "description": "Component description",',
        '  "dataSchema": {',
        '    "type": "object",',
        '    "properties": { ... }',
        '  }',
        '}',
      ],
      references: [
        'docs/anatomy/components.md',
        'data/mods/anatomy/components/scaled.component.json (example)',
      ],
    });

    this.recipeId = recipeId;
    this.componentId = componentId;
    this.location = location;
    this.recipePath = recipePath;
  }
}

/**
 * Error for invalid property value
 */
class InvalidPropertyError extends AnatomyError {
  constructor({ recipeId, location, componentId, property, currentValue, validValues, suggestion, schemaPath }) {
    const fixes = [
      `Change property value to valid enum option`,
    ];

    if (suggestion) {
      fixes.push('');
      fixes.push('Suggested Fix:');
      fixes.push(`  "${property}": "${suggestion}"  // Changed from "${currentValue}"`);
    }

    super({
      context: `Recipe '${recipeId}', ${location.type} '${location.name}', Component '${componentId}'`,
      problem: `Property '${property}' has invalid value '${currentValue}'`,
      impact: `Runtime validation will fail when entity is instantiated`,
      fix: fixes,
      references: [
        `Component Schema: ${schemaPath}`,
      ],
    });

    this.recipeId = recipeId;
    this.componentId = componentId;
    this.property = property;
    this.currentValue = currentValue;
    this.validValues = validValues;
    this.suggestion = suggestion;

    // Add valid values to fix section
    if (validValues && validValues.length > 0) {
      this.fix.unshift(`Valid Values: [${validValues.map(v => `"${v}"`).join(', ')}]`);
    }
  }
}

/**
 * Error for socket not found
 */
class SocketNotFoundError extends AnatomyError {
  constructor({ blueprintId, slotName, socketId, rootEntityId, availableSockets, entityPath }) {
    const fixes = [
      `Option 1: Add socket to root entity`,
      `  File: ${entityPath}`,
      `  Add to anatomy:sockets.sockets:`,
      '  {',
      `    "id": "${socketId}",`,
      '    "type": "attachment",',
      '    "capacity": 1',
      '  }',
      '',
      `Option 2: Use existing socket`,
      `  Available sockets: [${availableSockets.join(', ')}]`,
      `  Update blueprint additionalSlots.${slotName}.socket`,
    ];

    super({
      context: `Blueprint '${blueprintId}', Slot '${slotName}'`,
      problem: `Socket '${socketId}' not found on root entity '${rootEntityId}'`,
      impact: `Slot processing will fail during anatomy generation`,
      fix: fixes,
      references: [
        'docs/anatomy/blueprints.md',
        'docs/anatomy/sockets.md',
      ],
    });

    this.blueprintId = blueprintId;
    this.slotName = slotName;
    this.socketId = socketId;
    this.rootEntityId = rootEntityId;
    this.availableSockets = availableSockets;
  }
}

/**
 * Error for recipe validation failure
 */
class RecipeValidationError extends AnatomyError {
  constructor(message, { report }) {
    const errorCount = report.errors.length;
    const warningCount = report.warnings.length;

    super({
      context: `Recipe Validation: ${report.summary.recipeId}`,
      problem: message,
      impact: `Recipe cannot be loaded due to ${errorCount} validation error(s)`,
      fix: [
        'Review validation report for details:',
        '',
        `Errors: ${errorCount}`,
        `Warnings: ${warningCount}`,
        '',
        'Run: npm run validate:recipe <recipe-path> for detailed report',
      ],
      references: [
        'docs/anatomy/validation-workflow.md',
        'docs/anatomy/common-errors.md',
      ],
    });

    this.report = report;
  }
}
```

### Error Message Templates

```javascript
/**
 * Error message template registry
 */
const ERROR_TEMPLATES = {
  COMPONENT_NOT_FOUND: ComponentNotFoundError,
  INVALID_PROPERTY: InvalidPropertyError,
  SOCKET_NOT_FOUND: SocketNotFoundError,
  RECIPE_VALIDATION: RecipeValidationError,
};

/**
 * Creates error from template
 */
function createError(type, data) {
  const ErrorClass = ERROR_TEMPLATES[type];

  if (!ErrorClass) {
    throw new Error(`Unknown error type: ${type}`);
  }

  return new ErrorClass(data);
}
```

### Integration with Validators

```javascript
// In componentExistenceValidator.js (ANASYSIMP-001)
function validateComponentExistence(recipe, componentRegistry) {
  const errors = [];

  for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
    for (const componentId of slot.tags || []) {
      if (!componentRegistry.has(componentId)) {
        errors.push(createError('COMPONENT_NOT_FOUND', {
          recipeId: recipe.recipeId,
          location: { type: 'slot', name: slotName },
          componentId: componentId,
          recipePath: recipe.filePath,
        }));
      }
    }
  }

  return errors;
}
```

## File Structure

```
src/anatomy/errors/
├── AnatomyError.js                # Base error class
├── ComponentNotFoundError.js      # Component errors
├── InvalidPropertyError.js        # Property errors
├── SocketNotFoundError.js         # Socket errors
├── RecipeValidationError.js       # Validation errors
├── errorTemplates.js              # Template registry
└── index.js                       # Exports

tests/unit/anatomy/errors/
└── errorClasses.test.js

tests/integration/anatomy/errors/
└── errorFormatting.integration.test.js
```

## Acceptance Criteria

- [ ] Base AnatomyError class with structured fields
- [ ] toString() formats errors consistently and clearly
- [ ] toJSON() serializes errors for programmatic use
- [ ] Specific error classes for each validation type
- [ ] Error templates registry for easy error creation
- [ ] All validators use enhanced error classes
- [ ] Error messages include all fields (context, problem, impact, fix, references)
- [ ] Multi-step fixes formatted as numbered lists
- [ ] Code examples properly formatted in error messages

## Testing Requirements

### Unit Tests

1. **AnatomyError Base Class**
   - toString() formats correctly
   - toJSON() serializes correctly
   - All fields present in output
   - References array handled correctly
   - Original error wrapped if provided

2. **Specific Error Classes**
   - ComponentNotFoundError formats correctly
   - InvalidPropertyError includes valid values
   - SocketNotFoundError lists available sockets
   - RecipeValidationError includes report summary

3. **Error Templates**
   - createError() creates correct error type
   - Unknown error type throws
   - All template types registered

### Integration Tests

1. **Validator Integration**
   - Validators throw enhanced errors
   - Errors format correctly in logs
   - Error JSON serialization works
   - Errors include all contextual information

## Documentation Requirements

- [ ] Document error class hierarchy
- [ ] Provide examples of each error type
- [ ] Document error template system
- [ ] Add to common errors catalog
- [ ] Update troubleshooting guide

## Dependencies

**Required:** None (standalone error framework)
**Integrates With:** All validators (ANASYSIMP-001 through ANASYSIMP-006)

## Success Metrics

- **Error Clarity:** 100% of errors include context, problem, impact, fix
- **Actionability:** >90% of errors fixable without documentation lookup
- **Time Savings:** 20-30 minutes per error (eliminated file inspection and guesswork)

## References

- **Report Section:** Recommendation 2.2
- **Report Pages:** Lines 718-761
- **Example Templates:** Appendix A (lines 1580-1651)
