# SCHVALTESINT-006: Create common.schema.json with Template Definitions

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 3 - Template String Standardization
**Dependencies**: None
**Blocks**: SCHVALTESINT-007, SCHVALTESINT-008, SCHVALTESINT-009

---

## Objective

Create a shared `common.schema.json` file with reusable template string pattern definitions that all operation schemas can reference, establishing a single source of truth for template validation.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `data/schemas/common.schema.json` | Shared template string definitions |
| `tests/unit/schemas/common.schema.test.js` | Unit tests for common schema definitions |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `data/schemas/operations/lockGrabbing.schema.json` | Current local oneOf pattern to extract |
| `data/schemas/operations/unlockGrabbing.schema.json` | Similar pattern reference |

---

## Out of Scope

**DO NOT MODIFY:**

- `data/schemas/operations/lockGrabbing.schema.json` - Separate ticket (SCHVALTESINT-007)
- `data/schemas/operations/unlockGrabbing.schema.json` - Separate ticket (SCHVALTESINT-008)
- Any other existing schema files
- Any source code files in `src/`
- Any test infrastructure files

**DO NOT:**

- Add definitions beyond what's specified in the spec
- Change existing schema validation behavior
- Modify the schema loader to auto-load common.schema.json (AJV handles $ref resolution)

---

## Implementation Details

### Template String Pattern

From spec Appendix B:

```
Pattern: ^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$

Valid Examples:
  {context.value}
  {event.payload.actorId}
  {context.targetGrabbingReqs.handsRequired}
  {actor_stats.strength}

Invalid Examples:
  {}                    # Empty
  { context.value }     # Spaces
  {{context.value}}     # Double braces
  {context.}            # Trailing dot
  {.value}              # Leading dot
  {123abc}              # Starts with number
  {context-value}       # Hyphen not allowed
```

### Required Definitions

Create these definitions in `common.schema.json`:

1. **templateString** - Base template pattern
2. **integerOrTemplate** - Integer or template resolving to integer
3. **stringOrTemplate** - String or template resolving to string
4. **booleanOrTemplate** - Boolean or template resolving to boolean
5. **entityIdOrTemplate** - Entity ID format or template
6. **positiveIntegerOrTemplate** - Positive integer (≥1) or template

### File Content

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/common.schema.json",
  "title": "Common Schema Definitions",
  "description": "Shared definitions for template strings and composite types used across operation schemas",
  "definitions": {
    "templateString": {
      "description": "A runtime template string resolved at execution. Format: {path.to.value}",
      "type": "string",
      "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$",
      "examples": [
        "{context.value}",
        "{event.payload.actorId}",
        "{context.targetGrabbingReqs.handsRequired}"
      ]
    },
    "integerOrTemplate": {
      "description": "Either a literal integer or a template string that resolves to integer at runtime",
      "oneOf": [
        { "type": "integer" },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "positiveIntegerOrTemplate": {
      "description": "Either a positive integer (≥1) or a template string that resolves to positive integer at runtime",
      "oneOf": [
        { "type": "integer", "minimum": 1 },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "stringOrTemplate": {
      "description": "Either a literal string or a template string",
      "oneOf": [
        {
          "type": "string",
          "minLength": 1,
          "not": { "pattern": "^\\{.*\\}$" }
        },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "booleanOrTemplate": {
      "description": "Either a literal boolean or a template string that resolves to boolean at runtime",
      "oneOf": [
        { "type": "boolean" },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "entityIdOrTemplate": {
      "description": "Either a literal entity ID (modId:identifier) or a template string",
      "oneOf": [
        {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$"
        },
        { "$ref": "#/definitions/templateString" }
      ]
    }
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/schemas/common.schema.test.js`

```javascript
describe('common.schema.json', () => {
  describe('templateString definition', () => {
    it('should accept valid template strings', () => {
      // {context.value}, {event.payload.actorId}, etc.
    });

    it('should reject empty template {}', () => {});
    it('should reject template with spaces { context.value }', () => {});
    it('should reject double braces {{context.value}}', () => {});
    it('should reject trailing dot {context.}', () => {});
    it('should reject leading dot {.value}', () => {});
    it('should reject starting with number {123abc}', () => {});
    it('should reject hyphen {context-value}', () => {});
  });

  describe('integerOrTemplate definition', () => {
    it('should accept integer values', () => {});
    it('should accept template strings', () => {});
    it('should reject plain strings', () => {});
  });

  describe('positiveIntegerOrTemplate definition', () => {
    it('should accept positive integers', () => {});
    it('should reject zero', () => {});
    it('should reject negative integers', () => {});
    it('should accept template strings', () => {});
  });

  describe('stringOrTemplate definition', () => {
    it('should accept plain strings', () => {});
    it('should accept template strings', () => {});
    it('should reject empty strings', () => {});
  });

  describe('booleanOrTemplate definition', () => {
    it('should accept true', () => {});
    it('should accept false', () => {});
    it('should accept template strings', () => {});
    it('should reject string "true"', () => {});
  });

  describe('entityIdOrTemplate definition', () => {
    it('should accept valid entity IDs like "core:actor"', () => {});
    it('should accept template strings', () => {});
    it('should reject IDs without namespace', () => {});
  });
});
```

### Schema Validation

1. **Valid JSON Schema**: `common.schema.json` passes JSON Schema Draft 07 meta-schema validation
2. **$id Correct**: Uses project's schema URI convention
3. **All definitions present**: templateString, integerOrTemplate, positiveIntegerOrTemplate, stringOrTemplate, booleanOrTemplate, entityIdOrTemplate

### Invariants That Must Remain True

1. **INV-2 (Template Pattern Consistency)**: This file establishes the single source of truth for template patterns
2. **AJV Compatibility**: Schema works with project's AJV v8.x configuration
3. **$ref Resolution**: Other schemas can reference definitions via `$ref`

### Manual Verification Steps

1. **Validate schema syntax**:
   ```bash
   npm run validate:strict
   ```

2. **Test $ref resolution**:
   Create temporary test schema:
   ```json
   {
     "type": "object",
     "properties": {
       "count": { "$ref": "../common.schema.json#/definitions/positiveIntegerOrTemplate" }
     }
   }
   ```
   Validate that both `{ "count": 5 }` and `{ "count": "{context.value}" }` pass.

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Low-Medium - straightforward schema creation, pattern must be precise
- **Risk**: Low - new file, no existing code changes

## Review Checklist

- [ ] JSON is valid and follows Draft 07
- [ ] $id uses correct project convention
- [ ] All 6 definitions present and documented
- [ ] templateString pattern matches spec exactly
- [ ] Unit tests cover all valid/invalid cases from spec
- [ ] Schema validates successfully with `npm run validate:strict`
- [ ] Examples in schema are correct
