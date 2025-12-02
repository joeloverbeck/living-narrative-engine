# ENTRESROB-002: Data Validation Script for Socket Consistency

**Priority:** P1
**Effort:** Medium (3-4 hours)
**Status:** Completed
**Dependencies:** None

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

There is no automated way to verify that all entities with the same `subType` (e.g., all "head" entities) have identical socket IDs. This led to `humanoid_face_bearded_full_trimmed` missing `brain_socket` while other head entities had it, causing validation failures.

## Objective

Create a standalone validation script that checks socket consistency across entities with the same `anatomy:part.subType`, preventing future data inconsistencies at the source.

## Files to Touch

- `scripts/validateSocketConsistency.js` (CREATE)
- `package.json` (MODIFY - add `validate:socket-consistency` script)

## Out of Scope

- **DO NOT** modify `src/anatomy/validation/socketExtractor.js`
- **DO NOT** modify entity definition files in `data/mods/`
- **DO NOT** modify the existing `validateMods.js` script
- **DO NOT** change any schema files
- **DO NOT** add this to CI (that would be a separate ticket if needed)

## Acceptance Criteria

### Specific Tests That Must Pass

Manual verification commands:

```bash
# Script runs successfully with no errors
node scripts/validateSocketConsistency.js

# Script produces JSON output
node scripts/validateSocketConsistency.js --format=json

# npm script works
npm run validate:socket-consistency

# Strict mode exits with code 1 if inconsistencies exist
node scripts/validateSocketConsistency.js --strict
echo $?  # Should be 0 if consistent, 1 if not
```

### Functional Requirements

1. **Detection**: Script detects if a head entity is missing `brain_socket`
2. **Completeness**: Script reports ALL socket mismatches in a single run (not just first)
3. **Exit Codes**:
   - Exit 0 when all entities are consistent
   - Exit 1 with `--strict` when inconsistencies exist
4. **Output Formats**:
   - Console output (default): Human-readable table/list
   - JSON output (`--format=json`): Machine-parseable

### Invariants That Must Remain True

1. Script does not modify any files (read-only)
2. Script follows existing CLI script patterns from `scripts/` directory
3. Script loads entities from `data/mods/anatomy/entities/definitions/`
4. Script groups entities by `anatomy:part.subType`
5. Script compares socket IDs from `anatomy:sockets.sockets` array

## Implementation Notes

### Algorithm

```javascript
// Pseudocode
1. Load all entity definitions from data/mods/anatomy/entities/definitions/
2. Filter to entities with anatomy:part component
3. Group by anatomy:part.subType
4. For each group:
   a. Extract socket IDs from each entity's anatomy:sockets.sockets
   b. Find the "reference" socket set (union of all sockets, or first entity)
   c. Compare each entity's sockets against reference
   d. Report any missing sockets
5. Output results
6. Exit with appropriate code
```

### CLI Options

```bash
node scripts/validateSocketConsistency.js [options]

Options:
  --format=console|json   Output format (default: console)
  --strict                Exit with code 1 if inconsistencies found
  --help                  Show help
```

### Example Output (Console)

```
Socket Consistency Validation
=============================

Checking entities by subType...

✓ head: 13 entities, all consistent (8 sockets each)
✓ arm: 4 entities, all consistent (3 sockets each)
✗ torso: 15 entities, INCONSISTENT
  - anatomy:human_male_torso_variant missing: heart_socket

Summary: 2 subTypes consistent, 1 with issues
```

### Example Output (JSON)

```json
{
  "consistent": false,
  "subTypes": {
    "head": { "consistent": true, "entityCount": 13, "socketCount": 8 },
    "arm": { "consistent": true, "entityCount": 4, "socketCount": 3 },
    "torso": {
      "consistent": false,
      "entityCount": 15,
      "issues": [
        {
          "entityId": "anatomy:human_male_torso_variant",
          "missingSockets": ["heart_socket"]
        }
      ]
    }
  }
}
```

### Package.json Addition

```json
{
  "scripts": {
    "validate:socket-consistency": "node scripts/validateSocketConsistency.js"
  }
}
```

## Verification Commands

```bash
# Basic run
node scripts/validateSocketConsistency.js

# JSON output
node scripts/validateSocketConsistency.js --format=json | jq .

# Strict mode
node scripts/validateSocketConsistency.js --strict; echo "Exit code: $?"

# Via npm
npm run validate:socket-consistency
```

## Success Metrics

- [x] Script created at `scripts/validateSocketConsistency.js`
- [x] npm script `validate:socket-consistency` added to package.json
- [x] Script correctly identifies socket inconsistencies
- [x] Console output is human-readable
- [x] JSON output is valid and parseable
- [x] Exit codes work correctly (0 for consistent, 1 for strict mode failures)

## Outcome

- Created `scripts/validateSocketConsistency.js` which validates socket consistency across entities sharing the same `anatomy:part.subType`.
- Added `validate:socket-consistency` to `package.json`.
- Verified correct functionality: the script correctly identifies inconsistencies in `torso`, `head`, and `eldritch_tentacle` subTypes.
- Verified exit codes (0 for normal run, 1 for strict mode with inconsistencies).
- Verified regression tests (`recipeValidationComparison.regression.test.js`) pass, ensuring no regressions in recipe validation logic.