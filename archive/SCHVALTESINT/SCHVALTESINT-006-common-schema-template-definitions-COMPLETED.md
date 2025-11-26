# SCHVALTESINT-006: Add Template Definitions to common.schema.json

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 3 - Template String Standardization
**Dependencies**: None
**Blocks**: SCHVALTESINT-007, SCHVALTESINT-008, SCHVALTESINT-009
**Status**: COMPLETED ✅
**Completed**: 2025-11-26

---

## Outcome

### What Was Originally Planned
The original ticket proposed creating a new `common.schema.json` file with template string definitions.

### What Was Actually Changed

**Key Discovery**: `common.schema.json` already existed at `data/schemas/common.schema.json` with 6 existing definitions:
- `BaseDefinition`
- `namespacedId`
- `nullableNamespacedId`
- `perceptionType`
- `entityReference`
- `structuredNote`

**Actual Changes Made**:
1. **Updated ticket** to correct the assumption - changed from "Create" to "Add definitions to existing"
2. **Added 6 new template definitions** to existing `common.schema.json`:
   - `templateString` - Base pattern: `^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$`
   - `integerOrTemplate` - Integer OR template string
   - `positiveIntegerOrTemplate` - Positive integer (≥1) OR template string
   - `stringOrTemplate` - Non-empty string OR template string
   - `booleanOrTemplate` - Boolean OR template string
   - `entityIdOrTemplate` - Entity ID pattern OR template string
3. **Created comprehensive unit tests** at `tests/unit/schemas/common.schema.test.js` (71 tests)

**Note on Pattern Strictness**: The new template pattern is stricter than the existing `^\\{.+\\}$` pattern in `lockGrabbing.schema.json`. The new pattern validates:
- Proper identifier format (starts with letter or underscore)
- No spaces
- No empty braces
- No consecutive dots
- No leading/trailing dots

### Files Modified
- `data/schemas/common.schema.json` - Added 6 template definitions

### Files Created
- `tests/unit/schemas/common.schema.test.js` - 71 unit tests for template definitions

### Tests Added
- 71 new unit tests covering:
  - 10 valid template string formats
  - 15 invalid template string formats (edge cases)
  - 8 integerOrTemplate cases
  - 8 positiveIntegerOrTemplate cases
  - 9 stringOrTemplate cases
  - 8 booleanOrTemplate cases
  - 11 entityIdOrTemplate cases
  - 2 cross-definition consistency tests

### Ticket Viability Assessment
- **SCHVALTESINT-006** (this ticket): ✅ VIABLE - Completed successfully with corrected scope
- **SCHVALTESINT-007** (migrate lockGrabbing): ✅ VIABLE - Can now reference `common.schema.json#/definitions/positiveIntegerOrTemplate`
- **SCHVALTESINT-008** (migrate unlockGrabbing): ✅ VIABLE - Can now reference `common.schema.json#/definitions/positiveIntegerOrTemplate`

---

## Original Objective

Add reusable template string pattern definitions to the **existing** `common.schema.json` file that all operation schemas can reference, establishing a single source of truth for template validation.

## Corrected Assumptions (2025-11-26)

The original ticket incorrectly stated "Create a shared `common.schema.json` file". **The file already exists** at `data/schemas/common.schema.json` with the following definitions:
- `BaseDefinition`
- `namespacedId`
- `nullableNamespacedId`
- `perceptionType`
- `entityReference`
- `structuredNote`

This ticket adds **new** template-related definitions to the existing file.

## File List

### Files to Modify

| File | Purpose |
|------|---------|
| `data/schemas/common.schema.json` | Add template string definitions to existing file |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/schemas/common.schema.test.js` | Unit tests for template definitions |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `data/schemas/operations/lockGrabbing.schema.json` | Current local oneOf pattern (uses `^\\{.+\\}$`) |
| `data/schemas/operations/unlockGrabbing.schema.json` | Similar pattern reference |

---

## Out of Scope

**DO NOT MODIFY:**

- `data/schemas/operations/lockGrabbing.schema.json` - Separate ticket (SCHVALTESINT-007)
- `data/schemas/operations/unlockGrabbing.schema.json` - Separate ticket (SCHVALTESINT-008)
- Any other existing schema files
- Any source code files in `src/`
- Any test infrastructure files
- Existing definitions in `common.schema.json` (BaseDefinition, namespacedId, etc.)

**DO NOT:**

- Add definitions beyond what's specified in the spec
- Change existing schema validation behavior
- Modify the schema loader to auto-load common.schema.json (AJV handles $ref resolution)
- Remove or modify existing definitions in common.schema.json

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

**Note**: This is stricter than the existing pattern `^\\{.+\\}$` used in lockGrabbing.schema.json, which accepts any non-empty content in braces.

### Required Definitions to Add

Add these definitions to `common.schema.json` under the existing `definitions` object:

1. **templateString** - Base template pattern
2. **integerOrTemplate** - Integer or template resolving to integer
3. **stringOrTemplate** - String or template resolving to string
4. **booleanOrTemplate** - Boolean or template resolving to boolean
5. **entityIdOrTemplate** - Entity ID format or template
6. **positiveIntegerOrTemplate** - Positive integer (≥1) or template

### Definitions Content

```json
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
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/schemas/common.schema.test.js`

```javascript
describe('common.schema.json - Template Definitions', () => {
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

1. **Valid JSON Schema**: Updated `common.schema.json` passes JSON Schema Draft 07 meta-schema validation
2. **$id Unchanged**: Keeps existing project schema URI convention
3. **All definitions present**: Existing definitions preserved + 6 new template definitions
4. **Existing definitions unchanged**: BaseDefinition, namespacedId, etc. remain identical

### Invariants That Must Remain True

1. **INV-2 (Template Pattern Consistency)**: This file establishes the single source of truth for template patterns
2. **AJV Compatibility**: Schema works with project's AJV v8.x configuration
3. **$ref Resolution**: Other schemas can reference definitions via `$ref`
4. **Backward Compatibility**: Existing references to common.schema.json definitions continue to work

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

- **Size**: Small (S) - Adding definitions to existing file, not creating new file
- **Complexity**: Low - Straightforward definition additions, pattern must be precise
- **Risk**: Low - Additive changes only, no existing code changes

## Review Checklist

- [x] JSON is valid and follows Draft 07
- [x] $id uses correct project convention (preserved)
- [x] All 6 new definitions present and documented
- [x] templateString pattern matches spec exactly
- [x] Unit tests cover all valid/invalid cases from spec
- [x] Schema validates successfully with `npm run validate:strict`
- [x] Examples in schema are correct
- [x] Existing definitions in common.schema.json are unchanged
