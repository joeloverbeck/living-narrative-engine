# SCHVALTESINT-009: Create Schema Pattern Linting Script

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: LOW
**Phase**: 3 - Template String Standardization
**Dependencies**: SCHVALTESINT-007, SCHVALTESINT-008
**Blocks**: None

---

## Objective

Create a linting script that detects operation schemas using local `oneOf` patterns for template strings instead of `$ref` to `common.schema.json`, ensuring future operations follow the standardized pattern.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `scripts/lintSchemaPatterns.js` | Schema pattern linting script |
| `tests/unit/scripts/lintSchemaPatterns.test.js` | Unit tests for linting script |

### Files to Modify

| File | Change Type |
|------|-------------|
| `package.json` | Add `lint:schema-patterns` npm script |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `data/schemas/operations/*.schema.json` | All operation schemas to lint |
| `data/schemas/common.schema.json` | Expected $ref target |

---

## Out of Scope

**DO NOT MODIFY:**

- Any schema files in `data/schemas/` (this ticket detects problems, doesn't fix them)
- Any source code files in `src/`
- CI workflow (optional integration can be added later)

**DO NOT:**

- Auto-fix detected issues (report only)
- Modify existing schemas
- Add complex pattern matching beyond local oneOf detection

---

## Implementation Details

### Detection Logic

The script should detect schemas that:

1. Have a local `oneOf` containing a `templateString`-like pattern
2. Could be replaced with `$ref` to `common.schema.json#/definitions/*`

### Pattern to Detect

```json
// LOCAL PATTERN (should be flagged)
{
  "count": {
    "oneOf": [
      { "type": "integer" },
      {
        "type": "string",
        "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
      }
    ]
  }
}

// CORRECT PATTERN (should NOT be flagged)
{
  "count": { "$ref": "../common.schema.json#/definitions/integerOrTemplate" }
}
```

### Suggested Implementation

```javascript
#!/usr/bin/env node

/**
 * @file scripts/lintSchemaPatterns.js
 * Detects operation schemas using local oneOf patterns instead of $ref to common.schema.json
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const OPERATIONS_DIR = 'data/schemas/operations';
const TEMPLATE_PATTERN_REGEX = /\^\\\\\{.*\}$/; // Detects template string regex patterns

async function lintSchemas() {
  const files = await readdir(OPERATIONS_DIR);
  const schemaFiles = files.filter(f => f.endsWith('.schema.json'));

  const violations = [];

  for (const file of schemaFiles) {
    const content = await readFile(join(OPERATIONS_DIR, file), 'utf8');
    const schema = JSON.parse(content);

    const localOneOfs = findLocalOneOfPatterns(schema, []);

    if (localOneOfs.length > 0) {
      violations.push({
        file,
        paths: localOneOfs,
        suggestion: 'Replace with $ref to common.schema.json#/definitions/*'
      });
    }
  }

  return violations;
}

function findLocalOneOfPatterns(obj, path) {
  const found = [];

  if (obj && typeof obj === 'object') {
    if (obj.oneOf && Array.isArray(obj.oneOf)) {
      // Check if oneOf contains a template string pattern
      const hasTemplatePattern = obj.oneOf.some(branch =>
        branch.type === 'string' &&
        branch.pattern &&
        TEMPLATE_PATTERN_REGEX.test(branch.pattern)
      );

      if (hasTemplatePattern) {
        found.push(path.join('.'));
      }
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (key !== '$ref') { // Don't recurse into $ref
        found.push(...findLocalOneOfPatterns(value, [...path, key]));
      }
    }
  }

  return found;
}

// Main execution
lintSchemas().then(violations => {
  if (violations.length === 0) {
    console.log('✅ All operation schemas use $ref patterns correctly');
    process.exit(0);
  } else {
    console.error('❌ Found schemas with local oneOf patterns:\n');
    for (const v of violations) {
      console.error(`  ${v.file}:`);
      for (const p of v.paths) {
        console.error(`    - ${p}`);
      }
      console.error(`    Suggestion: ${v.suggestion}\n`);
    }
    process.exit(1);
  }
});

export { lintSchemas, findLocalOneOfPatterns };
```

### NPM Script Addition

```json
{
  "scripts": {
    "lint:schema-patterns": "node scripts/lintSchemaPatterns.js"
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/scripts/lintSchemaPatterns.test.js`
   - `should detect local oneOf with template pattern`
   - `should NOT flag $ref patterns`
   - `should report correct file and path`
   - `should exit 0 when no violations`
   - `should exit 1 when violations found`

### Script Behavior

1. **After SCHVALTESINT-007/008**:
   ```bash
   npm run lint:schema-patterns
   # Output: ✅ All operation schemas use $ref patterns correctly
   # Exit code: 0
   ```

2. **If local patterns reintroduced**:
   ```bash
   npm run lint:schema-patterns
   # Output: ❌ Found schemas with local oneOf patterns:
   #   newOperation.schema.json:
   #     - allOf.1.properties.parameters.properties.count
   #     Suggestion: Replace with $ref to common.schema.json#/definitions/*
   # Exit code: 1
   ```

### Manual Verification Steps

1. Create test schema with local oneOf pattern
2. Run `npm run lint:schema-patterns`
3. Verify violation is detected
4. Remove test schema
5. Run again, verify clean output

### Invariants That Must Remain True

1. **INV-2 (Template Pattern Consistency)**: Script enforces use of shared definitions
2. **No False Positives**: Valid $ref patterns not flagged
3. **Actionable Output**: Suggestions point to correct common.schema.json definition

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - straightforward JSON traversal
- **Risk**: Very Low - new tooling, no production impact

## Review Checklist

- [ ] Script runs without errors on current schemas
- [ ] Correctly detects local oneOf template patterns
- [ ] Does not flag $ref patterns
- [ ] Output format is clear and actionable
- [ ] Exit codes are correct (0=success, 1=violations)
- [ ] NPM script added to package.json
- [ ] Unit tests cover main scenarios
- [ ] JSDoc documentation present
