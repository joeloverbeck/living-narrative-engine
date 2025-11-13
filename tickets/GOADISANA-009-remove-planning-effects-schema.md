# GOADISANA-009: Remove Planning Effects Schema

## Context

The `planning-effects.schema.json` defined the structure for auto-generated planning effects - the core flaw in the GOAP system. This schema attempted to formalize effects that couldn't be accurately generated from execution rules.

**Fatal Flaw Context**: The schema defined structure for planning effects auto-generated from rule operations. The approach was fundamentally flawed because planning-time assumptions didn't match execution-time reality.

## Objective

Remove the `planning-effects.schema.json` schema file that defined the structure for auto-generated effects.

## Files Affected

**To be REMOVED**:
- `data/schemas/planning-effects.schema.json`

**Expected Schema Structure** (for documentation):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "planning-effects",
  "type": "object",
  "properties": {
    "operation": { "type": "string" },
    "entity": { "type": "string" },
    "component": { "type": "string" },
    "conditional": { "type": "boolean" }
  }
}
```

## Detailed Steps

1. **Verify schema exists**:
   ```bash
   test -f data/schemas/planning-effects.schema.json && echo "File exists" || echo "File not found"
   ```

2. **Back up schema** (for reference):
   ```bash
   cp data/schemas/planning-effects.schema.json tickets/removed-planning-effects-schema.json
   ```

3. **Remove the schema file**:
   ```bash
   rm data/schemas/planning-effects.schema.json
   ```

4. **Verify removal**:
   ```bash
   test -f data/schemas/planning-effects.schema.json && echo "ERROR: File still exists" || echo "OK: File removed"
   ```

5. **Check for schema references** in code:
   ```bash
   grep -r "planning-effects" src/ data/
   ```

## Acceptance Criteria

- [ ] `data/schemas/planning-effects.schema.json` removed completely
- [ ] Schema backed up to `tickets/removed-planning-effects-schema.json`
- [ ] File removal verified (file does not exist)
- [ ] No remaining `planning-effects` references in codebase (or documented if found)
- [ ] Schema validation system still works for other schemas
- [ ] Commit message documents schema removal reason

## Dependencies

**Requires**:
- GOADISANA-008 (provider stub implemented)

**Can run in PARALLEL with**:
- GOADISANA-010 (action schema cleanup)
- GOADISANA-011 (goal schema verification)

## Verification Commands

```bash
# Verify file removed
test -f data/schemas/planning-effects.schema.json && echo "FAIL" || echo "PASS"

# Verify backup created
cat tickets/removed-planning-effects-schema.json

# Search for remaining references
grep -r "planning-effects" src/ data/ || echo "No references found"

# Verify other schemas still validate
npm run validate || echo "Check schema validation"
```

## Expected Findings

**No remaining references expected** because:
- Effects generation code removed (GOADISANA-004)
- No actions should have `planningEffects` properties (checked in GOADISANA-010)

**If references found**, document them and determine if cleanup needed.

## Notes

- This schema was specific to the GOAP system's effects generation
- No mod content should reference this schema
- Schema remains in git history for reference
- This removal doesn't affect action, rule, or other core schemas
