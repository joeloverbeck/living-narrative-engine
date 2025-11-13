# GOADISANA-011: Verify Goal Schema Status

## Context

The goal schema defines structure for goal definitions that were used by the GOAP system. However, the user has specified that `goalLoader` should be KEPT for future mod-based goals. This ticket determines whether the goal schema should be preserved or removed.

**User Requirement**: "We do *not* want to remove goalLoader despite what the report says, as in the future we would also like to store goals in the 'goals/' folder of mods."

**Fatal Flaw Context**: The GOAP system used goals for planning, but the planning approach was flawed. The goal concept itself may still be valuable for future task-based systems.

## Objective

Verify whether `goal.schema.json` is used by `goalLoader` and document the decision to keep or remove it.

## Files Affected

**To be CHECKED**:
- `data/schemas/goal.schema.json`
- `src/loaders/goalLoader.js` (checking if it exists and uses schema)

**POTENTIALLY TO BE REMOVED** (only if unused):
- `data/schemas/goal.schema.json`

## Detailed Steps

1. **Check if goalLoader exists**:
   ```bash
   test -f src/loaders/goalLoader.js && echo "goalLoader exists" || echo "goalLoader not found"
   ```

2. **Check if goal schema is referenced by goalLoader**:
   ```bash
   grep -n "goal\.schema\|goal-schema" src/loaders/goalLoader.js
   ```

3. **Check for goal schema references elsewhere**:
   ```bash
   grep -r "goal\.schema" src/ data/mods/
   ```

4. **Make decision based on findings**:

   **SCENARIO A: goalLoader exists AND uses goal.schema.json**
   - **Decision**: KEEP goal schema
   - **Reason**: Required by preserved goalLoader for future mod-based goals
   - **Action**: Document preservation, no file changes

   **SCENARIO B: goalLoader doesn't exist OR doesn't use schema**
   - **Decision**: REMOVE goal schema (not needed)
   - **Reason**: No active usage, was GOAP-specific
   - **Action**: Back up and remove schema file

5. **Document decision and reasoning**

## Acceptance Criteria

### If KEEPING goal schema:
- [ ] Verification documented: goalLoader exists and uses schema
- [ ] Decision documented: schema preserved for future mod-based goals
- [ ] No file modifications made
- [ ] Commit message notes schema preservation and reason

### If REMOVING goal schema:
- [ ] Schema backed up to `tickets/removed-goal-schema.json`
- [ ] `data/schemas/goal.schema.json` removed
- [ ] Verification documented: no active usage found
- [ ] Decision documented: schema removed as unused
- [ ] Commit message documents removal reason

## Dependencies

**Requires**:
- GOADISANA-009 (planning-effects schema removed)

**Can run in PARALLEL with**:
- GOADISANA-010 (action schema cleanup)

## Verification Commands

```bash
# Check if goalLoader exists
ls -la src/loaders/goalLoader.js

# Check for schema usage in goalLoader
grep "schema" src/loaders/goalLoader.js || echo "No schema references"

# Check for goal schema references in codebase
grep -r "goal\.schema\|goal-schema" src/ data/

# Check for goals in mod directories
find data/mods/ -name "*.goal.json" || echo "No goal files found"

# If removing schema
test -f data/schemas/goal.schema.json && echo "Schema exists" || echo "Schema already removed"
```

## Decision Matrix

| Condition | Decision | Action |
|-----------|----------|---------|
| goalLoader exists + uses schema | KEEP | Document preservation |
| goalLoader exists + no schema ref | REMOVE | Schema not needed |
| goalLoader doesn't exist | REMOVE | Nothing using schema |

## Expected Outcome

Based on user requirement to keep goalLoader:
- **Most Likely**: KEEP schema (goalLoader needs it for validation)
- **Rationale**: Future mod-based goals will use this schema
- **No Removal**: Preserve for future implementation

## Notes

- User explicitly wants goalLoader preserved for future use
- Even if schema is GOAP-specific now, it may be useful for task-based goals
- Decision should prioritize future mod-based goal system
- **If in doubt, KEEP the schema** - easier to remove later than to recreate
- Document the decision clearly for future reference
- The goal schema structure may need revision for task-based system, but that's future work
