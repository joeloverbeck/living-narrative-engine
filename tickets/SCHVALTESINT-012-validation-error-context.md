# SCHVALTESINT-012: Create validationErrorContext.js

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 5 - Enhanced Error Messages
**Dependencies**: None (can proceed in parallel)
**Blocks**: SCHVALTESINT-014

---

## Objective

Create `validationErrorContext.js` that provides rich error context for validation failures, including file path, line number extraction from JSON path, and code snippet generation.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `src/validation/validationErrorContext.js` | Rich error context generation |
| `tests/unit/validation/validationErrorContext.test.js` | Unit tests |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/utils/ajvAnyOfErrorFormatter.js` | Current error formatting approach |
| AJV error object structure | Understand error.instancePath format |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/utils/ajvAnyOfErrorFormatter.js` - Separate ticket (SCHVALTESINT-014)
- `src/validation/ajvSchemaValidator.js` - Core validator unchanged
- Any schema files in `data/schemas/`

**DO NOT:**

- Integrate with existing error formatters (that's SCHVALTESINT-014)
- Read files synchronously (use passed file content)
- Make this dependent on file system access at runtime

---

## Implementation Details

### Desired Error Format

From spec section 4.1:

```
Validation Error in rule "handle_wield_threateningly"
  File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
  Line: 23

  Context:
    21 |       {
    22 |         "type": "LOCK_GRABBING",
  > 23 |         "parameters": { "count": "invalid" }
    24 |       }

  Error: "count" must be integer or template string (e.g., "{context.value}")
  Path: /actions/2/parameters/count
```

### Suggested Implementation

```javascript
/**
 * @file src/validation/validationErrorContext.js
 * Provides rich error context for validation failures
 */

/**
 * Extracts line number from JSON path in original content
 * @param {string} jsonContent - Original JSON file content
 * @param {string} jsonPath - AJV instance path (e.g., "/actions/2/parameters/count")
 * @returns {number|null} Line number (1-indexed) or null if not found
 */
export function extractLineNumber(jsonContent, jsonPath) {
  if (!jsonPath || jsonPath === '') return 1; // Root level

  const pathParts = jsonPath.split('/').filter(Boolean);
  const lines = jsonContent.split('\n');

  // Build regex pattern to find the path in JSON
  // This is heuristic-based - exact matching is complex for JSON
  let currentDepth = 0;
  let targetDepth = pathParts.length;
  let lastMatchLine = 1;

  // Simple approach: count array indices and object keys
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track the final property name we're looking for
    const lastPart = pathParts[pathParts.length - 1];

    // If it's an array index, look for array elements
    if (/^\d+$/.test(lastPart)) {
      // Count array elements - this is approximate
      if (line.includes('[') || line.includes('{')) {
        lastMatchLine = i + 1;
      }
    } else {
      // Look for property name
      const propPattern = new RegExp(`"${lastPart}"\\s*:`);
      if (propPattern.test(line)) {
        lastMatchLine = i + 1;
      }
    }
  }

  return lastMatchLine;
}

/**
 * Generates a code snippet around the error location
 * @param {string} jsonContent - Original JSON file content
 * @param {number} lineNumber - Line number of error (1-indexed)
 * @param {number} [contextLines=2] - Number of lines before/after to include
 * @returns {string} Formatted code snippet with line numbers
 */
export function generateCodeSnippet(jsonContent, lineNumber, contextLines = 2) {
  const lines = jsonContent.split('\n');
  const startLine = Math.max(1, lineNumber - contextLines);
  const endLine = Math.min(lines.length, lineNumber + contextLines);

  const snippetLines = [];
  const maxLineNumWidth = String(endLine).length;

  for (let i = startLine; i <= endLine; i++) {
    const lineNum = String(i).padStart(maxLineNumWidth, ' ');
    const prefix = i === lineNumber ? '>' : ' ';
    const content = lines[i - 1]; // 0-indexed array

    snippetLines.push(`${prefix} ${lineNum} | ${content}`);
  }

  return snippetLines.join('\n');
}

/**
 * Creates a rich validation error context object
 * @param {Object} options - Context options
 * @param {string} options.filePath - Path to the file being validated
 * @param {string} options.fileContent - Content of the file
 * @param {string} options.instancePath - AJV error instancePath
 * @param {string} options.message - Error message
 * @param {string} [options.ruleId] - Optional rule/action ID
 * @returns {Object} Rich error context
 */
export function createValidationErrorContext({
  filePath,
  fileContent,
  instancePath,
  message,
  ruleId = null
}) {
  const lineNumber = extractLineNumber(fileContent, instancePath);
  const codeSnippet = generateCodeSnippet(fileContent, lineNumber);

  return {
    filePath,
    lineNumber,
    instancePath,
    message,
    ruleId,
    codeSnippet,

    /**
     * Formats the error context as a string
     * @returns {string}
     */
    toString() {
      const header = ruleId
        ? `Validation Error in rule "${ruleId}"`
        : 'Validation Error';

      return [
        header,
        `  File: ${filePath}`,
        `  Line: ${lineNumber}`,
        '',
        '  Context:',
        codeSnippet.split('\n').map(l => '    ' + l).join('\n'),
        '',
        `  Error: ${message}`,
        `  Path: ${instancePath}`
      ].join('\n');
    }
  };
}

/**
 * Formats multiple AJV errors with rich context
 * @param {Object[]} errors - AJV validation errors
 * @param {string} filePath - Path to validated file
 * @param {string} fileContent - Content of validated file
 * @param {string} [ruleId] - Optional rule ID
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors, filePath, fileContent, ruleId = null) {
  const contexts = errors.map(error =>
    createValidationErrorContext({
      filePath,
      fileContent,
      instancePath: error.instancePath || '',
      message: error.message || 'Unknown validation error',
      ruleId
    })
  );

  return contexts.map(ctx => ctx.toString()).join('\n\n---\n\n');
}

export default {
  extractLineNumber,
  generateCodeSnippet,
  createValidationErrorContext,
  formatValidationErrors
};
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/validation/validationErrorContext.test.js`

```javascript
describe('validationErrorContext', () => {
  describe('extractLineNumber', () => {
    it('should find line number for simple property path', () => {
      const json = '{\n  "name": "test",\n  "value": 123\n}';
      expect(extractLineNumber(json, '/value')).toBe(3);
    });

    it('should find line number for nested array path', () => {
      const json = '{\n  "items": [\n    { "id": 1 },\n    { "id": 2 }\n  ]\n}';
      expect(extractLineNumber(json, '/items/1/id')).toBe(4);
    });

    it('should return 1 for root path', () => {
      expect(extractLineNumber('{}', '')).toBe(1);
    });
  });

  describe('generateCodeSnippet', () => {
    it('should generate snippet with context lines', () => {
      const json = 'line1\nline2\nline3\nline4\nline5';
      const snippet = generateCodeSnippet(json, 3, 1);
      expect(snippet).toContain('line2');
      expect(snippet).toContain('> 3 | line3');
      expect(snippet).toContain('line4');
    });

    it('should handle first line errors', () => {
      const json = 'line1\nline2';
      const snippet = generateCodeSnippet(json, 1, 2);
      expect(snippet).toContain('> 1 | line1');
    });

    it('should handle last line errors', () => {
      const json = 'line1\nline2';
      const snippet = generateCodeSnippet(json, 2, 2);
      expect(snippet).toContain('> 2 | line2');
    });
  });

  describe('createValidationErrorContext', () => {
    it('should create complete context object', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{\n  "type": "INVALID"\n}',
        instancePath: '/type',
        message: 'Invalid type',
        ruleId: 'test_rule'
      });

      expect(ctx.filePath).toBe('/path/to/file.json');
      expect(ctx.lineNumber).toBe(2);
      expect(ctx.message).toBe('Invalid type');
      expect(ctx.ruleId).toBe('test_rule');
    });

    it('should format toString correctly', () => {
      const ctx = createValidationErrorContext({
        filePath: '/path/to/file.json',
        fileContent: '{\n  "type": "INVALID"\n}',
        instancePath: '/type',
        message: 'Invalid type',
        ruleId: 'test_rule'
      });

      const str = ctx.toString();
      expect(str).toContain('Validation Error in rule "test_rule"');
      expect(str).toContain('File: /path/to/file.json');
      expect(str).toContain('Line: 2');
      expect(str).toContain('Error: Invalid type');
    });
  });
});
```

### Error Format Requirements

1. **Includes file path**: Full path to invalid file
2. **Includes line number**: Approximate line of error
3. **Includes code snippet**: 2-3 lines context around error
4. **Includes error message**: Human-readable description
5. **Includes JSON path**: AJV instancePath for precise location

### Invariants That Must Remain True

1. **No File I/O**: Module accepts file content as parameter, doesn't read files
2. **Graceful Degradation**: Returns reasonable output even if line detection fails
3. **Pure Functions**: All functions are side-effect free

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - line number extraction from JSON path is heuristic
- **Risk**: Low - new module, no existing code changes

## Review Checklist

- [ ] Line number extraction works for common paths
- [ ] Code snippet generation handles edge cases (first/last line)
- [ ] Error format matches specification
- [ ] No file I/O in module (content passed as parameter)
- [ ] Unit tests cover main scenarios
- [ ] JSDoc documentation complete
- [ ] toString() output is clear and actionable
