# SCHVALTESINT-014: Integrate Enhanced Errors into ajvAnyOfErrorFormatter

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: SCHVALTESINT-012, SCHVALTESINT-013
**Blocks**: None

---

## Objective

Integrate `validationErrorContext.js` and `suggestionUtils.js` into `ajvAnyOfErrorFormatter.js` to provide rich error context and suggestions for all validation failures.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `src/utils/ajvAnyOfErrorFormatter.js` | Integrate enhanced error context and suggestions |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/validation/validationErrorContext.js` | Created in SCHVALTESINT-012 |
| `src/utils/suggestionUtils.js` | Created in SCHVALTESINT-013 |
| `src/utils/preValidationUtils.js` | KNOWN_OPERATION_TYPES for suggestions |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/validation/validationErrorContext.js` - Already done in SCHVALTESINT-012
- `src/utils/suggestionUtils.js` - Already done in SCHVALTESINT-013
- `src/validation/ajvSchemaValidator.js` - Core validator unchanged
- Any schema files

**DO NOT:**

- Change the core error formatting logic fundamentally
- Break backward compatibility with existing error consumers
- Add file I/O to the formatter (content passed as parameter)

---

## Implementation Details

### Current Error Format

```
Unknown or invalid operation type
Valid types: [list of 62 types]
```

### Enhanced Error Format

```
Validation Error in rule "handle_wield_threateningly"
  File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
  Line: 23

  Context:
    21 |       {
    22 |         "type": "LOCK_GRABB",
  > 23 |         "parameters": { "count": "invalid" }
    24 |       }

  Error: Unknown operation type "LOCK_GRABB"
  Did you mean "LOCK_GRABBING"?
  Path: /actions/2/type
```

### Required Changes

1. **Accept optional file context** in formatting functions
2. **Integrate validationErrorContext** for rich formatting when context available
3. **Integrate suggestionUtils** for "Did you mean?" on unknown types/params
4. **Maintain backward compatibility** when no context provided

### Suggested Implementation

```javascript
// src/utils/ajvAnyOfErrorFormatter.js - enhanced

import { createValidationErrorContext } from '../validation/validationErrorContext.js';
import { suggestOperationType, suggestParameterName } from './suggestionUtils.js';
import { KNOWN_OPERATION_TYPES } from './preValidationUtils.js';

/**
 * Formats AJV anyOf errors with rich context and suggestions
 * @param {Object[]} errors - AJV validation errors
 * @param {Object} [context] - Optional context for enhanced formatting
 * @param {string} [context.filePath] - Path to the validated file
 * @param {string} [context.fileContent] - Content of the validated file
 * @param {string} [context.ruleId] - Rule or action ID being validated
 * @returns {string} Formatted error message
 */
export function formatAjvErrors(errors, context = null) {
  if (!errors || errors.length === 0) {
    return 'Unknown validation error';
  }

  // Group errors by path for deduplication
  const errorsByPath = groupErrorsByPath(errors);

  const formattedErrors = [];

  for (const [path, pathErrors] of Object.entries(errorsByPath)) {
    const primaryError = selectPrimaryError(pathErrors);
    let message = formatSingleError(primaryError);

    // Add suggestions for unknown types/params
    message = enhanceWithSuggestions(message, primaryError, path);

    // Add rich context if available
    if (context?.filePath && context?.fileContent) {
      const richContext = createValidationErrorContext({
        filePath: context.filePath,
        fileContent: context.fileContent,
        instancePath: path,
        message,
        ruleId: context.ruleId
      });
      formattedErrors.push(richContext.toString());
    } else {
      // Fall back to basic formatting
      formattedErrors.push(`${message}\n  Path: ${path}`);
    }
  }

  return formattedErrors.join('\n\n---\n\n');
}

/**
 * Enhances error message with "Did you mean?" suggestions
 * @param {string} message - Original error message
 * @param {Object} error - AJV error object
 * @param {string} path - Error path
 * @returns {string} Enhanced message
 */
function enhanceWithSuggestions(message, error, path) {
  // Check if this is an operation type error
  if (path.endsWith('/type') && error.params?.allowedValues) {
    const unknownType = error.data;
    if (typeof unknownType === 'string') {
      const suggestion = suggestOperationType(unknownType, KNOWN_OPERATION_TYPES);
      if (suggestion) {
        message += `\n  ${suggestion}`;
      }
    }
  }

  // Check if this is an unknown parameter error
  if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
    const unknownParam = error.params.additionalProperty;
    // Would need known params from schema - could pass in context
    // For now, just note the unknown parameter
    message += `\n  Unknown parameter: "${unknownParam}"`;
  }

  return message;
}

/**
 * Groups errors by their instance path for deduplication
 * @param {Object[]} errors - AJV errors
 * @returns {Object} Errors grouped by path
 */
function groupErrorsByPath(errors) {
  const groups = {};
  for (const error of errors) {
    const path = error.instancePath || '';
    if (!groups[path]) {
      groups[path] = [];
    }
    groups[path].push(error);
  }
  return groups;
}

/**
 * Selects the most relevant error from a group
 * @param {Object[]} errors - Errors at same path
 * @returns {Object} Primary error
 */
function selectPrimaryError(errors) {
  // Prefer errors with specific keywords
  const priority = ['const', 'enum', 'type', 'required', 'additionalProperties'];
  for (const keyword of priority) {
    const match = errors.find(e => e.keyword === keyword);
    if (match) return match;
  }
  return errors[0];
}

/**
 * Formats a single error into a message
 * @param {Object} error - AJV error
 * @returns {string} Error message
 */
function formatSingleError(error) {
  switch (error.keyword) {
    case 'const':
      return `Invalid value. Expected: "${error.params.allowedValue}", got: "${error.data}"`;
    case 'enum':
      return `Invalid value. Expected one of: ${error.params.allowedValues.join(', ')}`;
    case 'type':
      return `Type mismatch. Expected: ${error.params.type}, got: ${typeof error.data}`;
    case 'required':
      return `Missing required property: "${error.params.missingProperty}"`;
    case 'additionalProperties':
      return `Unknown property: "${error.params.additionalProperty}"`;
    case 'pattern':
      return `Value does not match pattern: ${error.params.pattern}`;
    default:
      return error.message || 'Validation failed';
  }
}

export default formatAjvErrors;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Update existing tests**: `tests/unit/utils/ajvAnyOfErrorFormatter.test.js`
   - All existing tests must continue to pass (backward compatibility)

2. **Add new tests**:
   - `should include file context when provided`
   - `should include line number in context`
   - `should include code snippet in context`
   - `should suggest similar operation types`
   - `should format without context when not provided`
   - `should deduplicate errors by path`

### Error Format Verification

1. **With Context**:
   ```
   Validation Error in rule "test_rule"
     File: /path/to/file.json
     Line: 5

     Context:
       3 |   "actions": [
       4 |     {
     > 5 |       "type": "LOCK_GRABB"
       6 |     }

     Error: Invalid value. Expected one of: LOCK_GRABBING, UNLOCK_GRABBING, ...
     Did you mean "LOCK_GRABBING"?
     Path: /actions/0/type
   ```

2. **Without Context** (backward compatible):
   ```
   Invalid value. Expected one of: LOCK_GRABBING, UNLOCK_GRABBING, ...
   Did you mean "LOCK_GRABBING"?
   Path: /actions/0/type
   ```

### Invariants That Must Remain True

1. **Backward Compatibility**: Calling without context produces valid output
2. **Suggestion Quality**: Only suggests when Levenshtein distance is reasonable
3. **No File I/O**: All content passed as parameters

### Manual Verification Steps

1. Trigger validation error with typo in operation type
2. Verify "Did you mean?" appears in error message
3. Verify code snippet shows correct lines when context provided
4. Verify existing error handling still works

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - integration of multiple new modules
- **Risk**: Low-Medium - modifies error formatting but maintains compatibility

## Review Checklist

- [ ] All existing formatter tests pass
- [ ] New context integration tests pass
- [ ] Suggestions appear for typos
- [ ] Backward compatibility maintained (no context = basic format)
- [ ] Error messages are clear and actionable
- [ ] Code snippets display correctly
- [ ] Line numbers are approximately correct
- [ ] JSDoc documentation updated
