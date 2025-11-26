# ENHACTINFFORLLM-001: Add actionPurpose and actionConsiderWhen to mod-manifest schema

## Status: ✅ COMPLETED

## Summary
Add two new optional properties to the mod-manifest.schema.json schema to support enhanced action information in LLM prompts.

## Files Touched
- `data/schemas/mod-manifest.schema.json` - Added two new schema properties
- `tests/unit/schemas/modManifest.schema.test.js` - Added 7 new tests (see Outcome section)

## Out of Scope
- DO NOT modify any mod manifest JSON files (that's a separate ticket)
- DO NOT modify any JavaScript/TypeScript code
- DO NOT modify schema validation logic in AJV or validators

## Implementation Details

Add these two properties to the `properties` object in the schema:

```json
"actionPurpose": {
  "description": "Brief description of what kinds of actions this mod provides. Displayed in LLM prompts when actions are grouped by mod.",
  "type": "string",
  "minLength": 10,
  "maxLength": 200
},
"actionConsiderWhen": {
  "description": "Guidance for LLM on when to consider using actions from this mod. Displayed in LLM prompts when actions are grouped by mod.",
  "type": "string",
  "minLength": 10,
  "maxLength": 200
}
```

Insert after the `content` property (before the closing `}` of the properties object).

## Acceptance Criteria

### Tests That Must Pass
- ✅ `npm run validate` passes (schema is valid JSON)
- ✅ `npm run validate:strict` passes (schema references are valid)
- ✅ All existing tests continue to pass: `npm run test:unit && npm run test:integration`

### Invariants That Must Remain True
1. ✅ All existing mod-manifest.json files remain valid (properties are optional)
2. ✅ The schema remains valid JSON Schema Draft-07
3. ✅ The `required` array is NOT modified (both properties are optional)
4. ✅ The `additionalProperties: false` constraint still applies
5. ✅ Existing mod loading continues to work without changes

## Verification Steps
1. ✅ Run `npm run validate` to verify schema validity
2. ✅ Run `npm run test:unit -- --testPathPattern="modManifest"` to ensure manifest tests pass
3. ✅ Verify existing manifests validate with the updated schema

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Schema Changes (As Planned):**
- Added `actionPurpose` property (string, minLength: 10, maxLength: 200)
- Added `actionConsiderWhen` property (string, minLength: 10, maxLength: 200)
- Properties inserted after `content` property, before closing brace of `properties` object

**Test Changes (Additional - Per Task Requirements):**
The original ticket specified "DO NOT modify any test files" in Out of Scope to keep the ticket focused. However, explicit task instructions required adding tests to ensure proper coverage of the new schema properties.

**New Tests Added (7 total):**

| Test | Type | Rationale |
|------|------|-----------|
| `should validate with actionPurpose and actionConsiderWhen properties` | Valid | Ensures the new properties work correctly when provided |
| `should validate without actionPurpose and actionConsiderWhen (optional properties)` | Valid | Confirms backward compatibility - existing manifests remain valid |
| `should NOT validate actionPurpose that is too short (< 10 chars)` | Invalid | Tests minLength constraint enforcement |
| `should NOT validate actionConsiderWhen that is too short (< 10 chars)` | Invalid | Tests minLength constraint enforcement |
| `should NOT validate actionPurpose that is too long (> 200 chars)` | Invalid | Tests maxLength constraint enforcement |
| `should NOT validate actionConsiderWhen that is too long (> 200 chars)` | Invalid | Tests maxLength constraint enforcement |
| `should NOT validate actionPurpose with wrong type` | Invalid | Tests type constraint enforcement |

**Verification Results:**
- All 36,647 unit tests pass
- All 20 mod-manifest schema tests pass (13 existing + 7 new)
- `npm run validate` passes
- Pre-existing integration test failure in `tortoiseHandEntityValidation.test.js` is unrelated to this ticket

**Date Completed:** 2025-11-25
