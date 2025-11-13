# GOADISANA-010: Verify Action Schema Has No GOAP References

## Context

The action schema may have been extended to include an optional `planningEffects` property for GOAP planning. This property must be removed if present, as it was part of the flawed effects-generation approach.

**Fatal Flaw Context**: Actions may have been extended with `planningEffects` field to support auto-generated effects. This field is now meaningless and should be removed.

## Objective

Verify and clean the action schema to remove any GOAP-related properties (specifically `planningEffects`).

## Files Affected

**To be CHECKED and POTENTIALLY MODIFIED**:
- `data/schemas/action.schema.json`

## Detailed Steps

1. **Check if planningEffects exists in action schema**:
   ```bash
   grep -n "planningEffects" data/schemas/action.schema.json
   ```

2. **If found, back up the schema**:
   ```bash
   cp data/schemas/action.schema.json tickets/action-schema-before-cleanup.json
   ```

3. **Remove planningEffects property** (if present):
   - Open `data/schemas/action.schema.json`
   - Find the `planningEffects` property definition
   - Remove the entire property block
   - Remove any references to `planning-effects.schema.json`
   - Ensure JSON is still valid (no trailing commas)

4. **Verify schema is valid JSON**:
   ```bash
   npm run validate
   ```

5. **Test that existing actions still validate**:
   ```bash
   # Run action validation
   npm run validate:actions  # or equivalent command
   ```

6. **Document changes** (if any were made)

## Acceptance Criteria

### If `planningEffects` was found:
- [ ] `planningEffects` property removed from action schema
- [ ] Any references to `planning-effects.schema.json` removed
- [ ] Schema is valid JSON (no syntax errors)
- [ ] Existing actions still validate against updated schema
- [ ] Original schema backed up to `tickets/action-schema-before-cleanup.json`
- [ ] Commit message documents property removal

### If `planningEffects` was NOT found:
- [ ] Verification documented (no changes needed)
- [ ] Commit message notes schema was already clean
- [ ] No backup needed (no changes made)

## Dependencies

**Requires**:
- GOADISANA-009 (planning-effects schema removed)

**Can run in PARALLEL with**:
- GOADISANA-011 (goal schema verification)

## Verification Commands

```bash
# Check if planningEffects exists
grep "planningEffects" data/schemas/action.schema.json
# Should return empty if cleaned/absent

# Verify schema is valid JSON
npm run validate 2>&1 | grep -i "schema"

# Check for any remaining planning-effects references
grep -r "planning-effects" data/schemas/

# Verify actions still validate (if applicable)
# npm run validate:actions || npm run validate
```

## Expected Outcomes

**Scenario A: Property Found and Removed**
- Schema modified to remove GOAP-specific property
- All existing actions continue to validate
- JSON structure remains valid

**Scenario B: Property Not Present**
- No modifications needed
- Document verification for completeness
- Proceed to next ticket

## Example Removal

**BEFORE** (if present):
```json
{
  "$schema": "action.schema.json",
  "properties": {
    "id": { "type": "string" },
    "planningEffects": {
      "type": "array",
      "items": { "$ref": "planning-effects.schema.json" }
    }
  }
}
```

**AFTER**:
```json
{
  "$schema": "action.schema.json",
  "properties": {
    "id": { "type": "string" }
    // planningEffects removed
  }
}
```

## Notes

- The action schema is core to the system - verify changes carefully
- Only remove GOAP-specific properties, preserve all other action properties
- If uncertain about a property, check git history to confirm it was GOAP-related
- Actions themselves (in mods) should not have planningEffects data (not part of mod format)
