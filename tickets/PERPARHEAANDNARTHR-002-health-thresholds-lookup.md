# PERPARHEAANDNARTHR-002: Health Thresholds Lookup File

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.25 days
**Dependencies:** None

---

## Objective

Create the health thresholds lookup file that defines the mapping between health percentages and narrative state labels. This file serves as reference data for modders and future extensibility (per-part-type thresholds).

---

## Files to Touch

### New Files
- `data/mods/anatomy/lookups/part_health_thresholds.json`

### Modified Files
- None (will need `lookups` directory created if it doesn't exist)

---

## Out of Scope

**DO NOT modify:**
- Any component files
- Any entity definition files
- Any operation handler source code
- Any DI registration files
- The mod manifest (covered in PERPARHEAANDNARTHR-011)
- Any test files

**DO NOT implement:**
- Per-part-type threshold overrides (hook only)
- Creature-type threshold overrides (hook only)
- Dynamic threshold loading in handlers (handler reads thresholds in its ticket)

---

## Implementation Details

### Directory Setup

If `data/mods/anatomy/lookups/` does not exist, create it.

### Lookup File Structure

Create `data/mods/anatomy/lookups/part_health_thresholds.json`:

```json
{
  "description": "Reference data for part health state thresholds. Actual logic in UPDATE_PART_HEALTH_STATE operation handler.",
  "defaultThresholds": [
    {
      "state": "healthy",
      "minPercentage": 76,
      "maxPercentage": 100,
      "description": "Part is fully functional, no visible damage"
    },
    {
      "state": "bruised",
      "minPercentage": 51,
      "maxPercentage": 75,
      "description": "Minor damage, slight discoloration or tenderness"
    },
    {
      "state": "wounded",
      "minPercentage": 26,
      "maxPercentage": 50,
      "description": "Moderate damage, visible injury affecting function"
    },
    {
      "state": "badly_damaged",
      "minPercentage": 1,
      "maxPercentage": 25,
      "description": "Severe damage, significantly impaired function"
    },
    {
      "state": "destroyed",
      "minPercentage": 0,
      "maxPercentage": 0,
      "description": "Part is non-functional (narrative label only, no automatic effects)"
    }
  ],
  "extensionPoints": {
    "partTypeOverrides": {
      "_comment": "Future: Per-part-type thresholds (e.g., head might have different thresholds)",
      "_example": {
        "head": [
          { "state": "healthy", "minPercentage": 81, "maxPercentage": 100 }
        ]
      }
    },
    "creatureTypeOverrides": {
      "_comment": "Future: Creature-specific thresholds (e.g., undead might not bruise)",
      "_example": {
        "undead": [
          { "state": "healthy", "minPercentage": 51, "maxPercentage": 100 }
        ]
      }
    }
  }
}
```

### Design Rationale

1. **Follows hunger_thresholds.json pattern**: Same structure with thresholds array
2. **Extension points documented**: Future iteration hooks are visible but unused
3. **Description field**: Self-documenting for modders
4. **Boundary semantics**: minPercentage/maxPercentage clearly define ranges
5. **Destroyed at exactly 0**: Not a range, exactly zero health = destroyed

---

## Acceptance Criteria

### Tests That Must Pass

1. **JSON validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/lookups/part_health_thresholds.json'))"
   ```

2. **Full validation:**
   - `npm run validate` passes without errors

3. **Data integrity checks:**
   - All states from component enum are represented
   - Thresholds cover full range 0-100 without gaps
   - minPercentage <= maxPercentage for each entry

### Invariants That Must Remain True

1. All existing anatomy files remain unchanged
2. `npm run test:ci` passes (no regressions)
3. File is valid JSON
4. States match exactly: `healthy`, `bruised`, `wounded`, `badly_damaged`, `destroyed`

---

## Verification Steps

```bash
# 1. Create lookups directory if needed
mkdir -p data/mods/anatomy/lookups

# 2. Verify file is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/lookups/part_health_thresholds.json'))"

# 3. Verify states cover full range
node -e "
  const data = JSON.parse(require('fs').readFileSync('data/mods/anatomy/lookups/part_health_thresholds.json'));
  const states = data.defaultThresholds.map(t => t.state);
  const expected = ['healthy', 'bruised', 'wounded', 'badly_damaged', 'destroyed'];
  console.log('States present:', states);
  console.log('All states covered:', expected.every(s => states.includes(s)));
"

# 4. Run full validation
npm run validate

# 5. Run test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/metabolism/lookups/hunger_thresholds.json`
- Component states: `data/mods/anatomy/components/part_health.component.json` (from ticket 001)
