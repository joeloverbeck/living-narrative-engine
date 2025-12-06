# PHYCONNARIMP-004: Group Bleeding Parts by Severity

**Status: ✅ COMPLETED**

## Summary

Combine bleeding part descriptions into grouped sentences by severity level, instead of generating a separate sentence for each bleeding part. This improves narrative readability.

## Problem Statement

**Current output (separate sentences):**

```
Blood flows steadily from my torso. Blood flows steadily from my upper head.
```

**Expected output (grouped):**

```
Blood flows steadily from my torso and my upper head.
```

**Mixed severity example:**

```
Current:  Blood pours freely from my arm. Blood flows steadily from my torso. Blood flows steadily from my head.
Expected: Blood pours freely from my arm. Blood flows steadily from my torso and my head.
```

## Root Cause

In `#formatEffectsFirstPerson()` (lines ~304-315 in the method body, starting at line 298), each bleeding part generates its own sentence:

```javascript
for (const part of bleedingParts) {
  const partName = this.#formatPartName(part.partType, part.orientation);
  const severity = part.bleedingSeverity || 'moderate';
  const bleedingDesc =
    BLEEDING_SEVERITY_FIRST_PERSON[severity] ||
    FIRST_PERSON_EFFECT_MAP.bleeding;
  effectParts.push(`${this.#capitalizeFirst(bleedingDesc)} my ${partName}.`);
}
```

## Solution

1. Group bleeding parts by severity
2. Format each severity group as a single sentence with Oxford comma support

```javascript
#formatBleedingEffectsFirstPerson(bleedingParts) {
  if (!bleedingParts || bleedingParts.length === 0) return '';

  // Group by severity
  const bySeverity = {};
  for (const part of bleedingParts) {
    const severity = part.bleedingSeverity || 'moderate';
    if (!bySeverity[severity]) bySeverity[severity] = [];
    bySeverity[severity].push(part);
  }

  const sentences = [];
  const severityOrder = ['severe', 'moderate', 'minor'];

  for (const severity of severityOrder) {
    const parts = bySeverity[severity];
    if (!parts || parts.length === 0) continue;

    const bleedingDesc = BLEEDING_SEVERITY_FIRST_PERSON[severity] || FIRST_PERSON_EFFECT_MAP.bleeding;
    const partNames = parts.map(p => `my ${this.#formatPartName(p.partType, p.orientation)}`);
    const combined = this.#formatListWithOxfordComma(partNames);
    sentences.push(`${this.#capitalizeFirst(bleedingDesc)} ${combined}.`);
  }

  return sentences.join(' ');
}

#formatListWithOxfordComma(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  // Use slice to avoid mutating the input array
  const allButLast = items.slice(0, -1);
  const lastItem = items[items.length - 1];
  return `${allButLast.join(', ')}, and ${lastItem}`;
}
```

---

## Files to Touch

| File                                                                  | Change Type | Lines                                                                |
| --------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `src/anatomy/services/injuryNarrativeFormatterService.js`             | Modify/Add  | Bleeding loop in `#formatEffectsFirstPerson`, add new helper methods |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Add tests   | New test cases                                                       |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/injuryAggregationService.js` - Data source unchanged
- `src/anatomy/registries/healthStateRegistry.js` - No changes
- `src/domUI/injuryStatusPanel.js` - UI integration separate
- `src/turns/services/actorDataExtractor.js` - LLM integration separate
- Grouping other effects (burning, poisoned, fractured) - only bleeding
- Duplicate deduplication (PHYCONNARIMP-001)
- Dismemberment filtering (PHYCONNARIMP-002)
- Output ordering (PHYCONNARIMP-003)

---

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests

1. **`should format single bleeding part correctly`**
   - Input: One bleeding part (torso, moderate)
   - Assert: Output is `"Blood flows steadily from my torso."`

2. **`should format two bleeding parts with same severity using "and"`**
   - Input: Two parts (torso + upper head), both moderate
   - Assert: Output matches `Blood flows steadily from my torso and my upper head.`

3. **`should format three+ bleeding parts with Oxford comma`**
   - Input: Three parts (torso + upper head + right leg), all moderate
   - Assert: Output matches `Blood flows steadily from my torso, my upper head, and my right leg.`

4. **`should create separate sentences for different severities`**
   - Input: One severe (arm) + one moderate (torso)
   - Assert: Output contains both `"Blood pours freely from my left arm."` AND `"Blood flows steadily from my torso."`

5. **`should process severe before moderate before minor`**
   - Input: One of each severity
   - Assert: "pours freely" appears before "flows steadily" appears before "seeps from"

6. **`should handle empty bleeding parts array`**
   - Input: Empty array
   - Assert: Returns empty string

#### Existing Tests

All existing tests must continue to pass.

### Invariants That Must Remain True

1. **Severity Ordering**: Severe → Moderate → Minor
2. **Grammar Rules**:
   - 1 item: "from my X."
   - 2 items: "from my X and my Y."
   - 3+ items: "from my X, my Y, and my Z." (Oxford comma)
3. **Bleeding Text Map**: Uses `BLEEDING_SEVERITY_FIRST_PERSON` mapping
4. **Public API Stability**: `formatFirstPerson(summary)` signature unchanged

### Output Examples

| Input Parts      | Severities                   | Expected Output                                                                               |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| torso            | moderate                     | "Blood flows steadily from my torso."                                                         |
| torso, head      | moderate, moderate           | "Blood flows steadily from my torso and my upper head."                                       |
| torso, head, leg | moderate, moderate, moderate | "Blood flows steadily from my torso, my upper head, and my right leg."                        |
| arm, torso       | severe, moderate             | "Blood pours freely from my arm. Blood flows steadily from my torso."                         |
| arm, leg, head   | severe, minor, moderate      | "Blood pours freely from my arm. Blood flows steadily from my head. Blood seeps from my leg." |

---

## Implementation Notes

- Create new private method `#formatBleedingEffectsFirstPerson(bleedingParts)`
- Create new helper `#formatListWithOxfordComma(items)`
- Replace the bleeding loop in `#formatEffectsFirstPerson()` with call to new method
- **CORRECTED**: `#formatListWithOxfordComma` uses `.slice()` to avoid mutating the input array (original proposal used `.pop()` which would mutate)

---

## Test Code Template

```javascript
describe('bleeding grouping', () => {
  // Helper function
  function createSummaryWithBleedingParts(bleedingConfigs) {
    const bleedingParts = bleedingConfigs.map((config, index) => ({
      partEntityId: `part-${index}`,
      partType: config.partType,
      orientation: config.orientation || null,
      bleedingSeverity: config.bleedingSeverity,
    }));

    const injuredParts = bleedingConfigs.map((config, index) => ({
      partEntityId: `part-${index}`,
      partType: config.partType,
      orientation: config.orientation || null,
      state: 'wounded',
    }));

    return {
      entityId: 'entity-1',
      injuredParts,
      bleedingParts,
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      destroyedParts: [],
      dismemberedParts: [],
      isDying: false,
      isDead: false,
    };
  }

  it('should format single bleeding part correctly', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', bleedingSeverity: 'moderate' },
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('Blood flows steadily from my torso.');
  });

  it('should format two bleeding parts with same severity using "and"', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', bleedingSeverity: 'moderate' },
      { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toMatch(
      /Blood flows steadily from my torso and my upper head\./
    );
  });

  it('should format three+ bleeding parts with Oxford comma', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', bleedingSeverity: 'moderate' },
      { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
      { partType: 'leg', orientation: 'right', bleedingSeverity: 'moderate' },
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toMatch(
      /Blood flows steadily from my torso, my upper head, and my right leg\./
    );
  });

  it('should create separate sentences for different severities', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', bleedingSeverity: 'moderate' },
      { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('Blood pours freely from my left arm.');
    expect(result).toContain('Blood flows steadily from my torso.');
  });

  it('should process severe before moderate before minor', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'leg', orientation: 'right', bleedingSeverity: 'minor' },
      { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
      { partType: 'torso', bleedingSeverity: 'moderate' },
    ]);

    const result = service.formatFirstPerson(summary);
    const severePos = result.indexOf('pours freely');
    const moderatePos = result.indexOf('flows steadily');
    const minorPos = result.indexOf('seeps from');

    expect(severePos).toBeLessThan(moderatePos);
    expect(moderatePos).toBeLessThan(minorPos);
  });
});
```

---

## Dependencies

- Recommended: PHYCONNARIMP-002 (filtering dismembered parts from bleeding)

## Blocked By

- None (can be worked independently)

## Blocks

- PHYCONNARIMP-005 (helper methods should be included in refactoring)
- PHYCONNARIMP-006 (integration tests verify final output)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made Before Implementation:**

1. **Line number references**: Original said lines 294-303, actual code was at lines ~304-315 within `#formatEffectsFirstPerson` method starting at line 298
2. **Array mutation bug**: Original `#formatListWithOxfordComma` proposal used `.pop()` which mutates the input array. Changed to `.slice(0, -1)` and direct index access to avoid mutation

**Implementation Changes:**

- ✅ Created `#formatBleedingEffectsFirstPerson(bleedingParts)` method as planned
- ✅ Created `#formatListWithOxfordComma(items)` helper as planned (with slice fix)
- ✅ Replaced bleeding loop in `#formatEffectsFirstPerson()` with call to new method
- ✅ Public API `formatFirstPerson(summary)` unchanged

**Test Coverage:**

- 7 new unit tests added covering all acceptance criteria
- All 64 unit tests pass (57 existing + 7 new)
- All 142 anatomy integration tests pass

**Files Modified:**

- `src/anatomy/services/injuryNarrativeFormatterService.js` - Added 2 private methods, modified bleeding handling
- `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` - Added bleeding grouping test suite

**Completed:** 2025-12-04
