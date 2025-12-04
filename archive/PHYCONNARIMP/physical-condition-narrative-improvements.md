# Physical Condition Narrative Improvements Specification

## Document Information

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-12-04
**Author:** System Architect
**Dependencies:** `anatomy` mod (v1.0.0+)

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Detailed Specifications](#detailed-specifications)
4. [Implementation Details](#implementation-details)
5. [Testing Strategy](#testing-strategy)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Risk Assessment](#risk-assessment)

---

## Overview

### Purpose

The Physical Condition Narrative system generates first-person sensory descriptions of an actor's physical state. These descriptions appear in:

1. **Physical Condition UI Panel** (`game.html`) - Real-time player status display
2. **LLM Prompt Context** - Character state information for AI-driven NPCs

### Current Architecture

```
InjuryAggregationService
    ↓ (aggregates all injury data)
InjurySummaryDTO
    ↓ (passed to formatter)
InjuryNarrativeFormatterService.formatFirstPerson()
    ↓ (generates text)
First-Person Narrative String
    ↓
InjuryStatusPanel (UI) + ActorDataExtractor (LLM)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Text generation logic |
| `src/anatomy/services/injuryAggregationService.js` | Injury data collection |
| `src/anatomy/registries/healthStateRegistry.js` | Health state definitions |
| `src/domUI/injuryStatusPanel.js` | UI integration |
| `src/turns/services/actorDataExtractor.js` | LLM integration |

---

## Problem Statement

### Example of Current Problematic Output

Given an actor with:
- Right ear dismembered
- Torso at critical health (bleeding)
- Upper head at wounded health (bleeding)
- Brain at scratched health

**Current Output:**
```
My right ear and right ear is completely numb. My torso screams with agony.
My upper head throbs painfully. My brain stings slightly. My right ear is missing.
Blood flows steadily from my torso. Blood flows steadily from my upper head.
```

**Expected Output:**
```
My right ear is missing. My torso screams with agony. My upper head throbs painfully.
My brain stings slightly. Blood flows steadily from my torso and my upper head.
```

### Issue Summary

| # | Issue | Example | Severity |
|---|-------|---------|----------|
| 1 | Duplicate part counting | "My right ear and right ear is completely numb" | High |
| 2 | Dismembered parts show health state | Missing ear shows "is completely numb" | High |
| 3 | Missing parts not prioritized | "is missing" appears after health states | Medium |
| 4 | Bleeding parts not grouped | Separate sentences for each bleeding part | Medium |

---

## Detailed Specifications

### SPEC-001: Fix Duplicate Part Counting

#### Current Behavior

In `injuryNarrativeFormatterService.js` lines 129-136:

```javascript
if (state === 'destroyed') {
  parts = [...(summary.destroyedParts || [])];
  if (summary.injuredParts) {
    parts.push(
      ...summary.injuredParts.filter((p) => p.state === 'destroyed')
    );
  }
}
```

The `destroyedParts` array contains all parts with `state === 'destroyed'`. The code then adds parts from `injuredParts` with `state === 'destroyed'`, which creates duplicates since `injuredParts` is derived from the same source.

#### Root Cause

In `injuryAggregationService.js` lines 151-161:

```javascript
const injuredParts = allPartInfos.filter(
  (part) => part.state !== HEALTH_STATE_REGISTRY.healthy.id
);
// ...
const destroyedParts = allPartInfos.filter(
  (part) => part.state === HEALTH_STATE_REGISTRY.destroyed.id
);
```

Both arrays are filtered from the same `allPartInfos` source. A destroyed part appears in both `injuredParts` (state !== healthy) AND `destroyedParts` (state === destroyed).

#### Required Fix

**Option A (Recommended):** Remove the redundant filter in formatter:

```javascript
if (state === 'destroyed') {
  parts = [...(summary.destroyedParts || [])];
  // Remove: no longer add from injuredParts
}
```

**Option B:** Deduplicate using Set by `partEntityId`:

```javascript
if (state === 'destroyed') {
  const partIdSet = new Set();
  const combined = [...(summary.destroyedParts || [])];
  if (summary.injuredParts) {
    combined.push(...summary.injuredParts.filter((p) => p.state === 'destroyed'));
  }
  parts = combined.filter(p => {
    if (partIdSet.has(p.partEntityId)) return false;
    partIdSet.add(p.partEntityId);
    return true;
  });
}
```

#### Impact

- **File:** `src/anatomy/services/injuryNarrativeFormatterService.js`
- **Lines:** 129-136
- **Risk:** Low (isolated change)

---

### SPEC-002: Filter Dismembered Parts from Health State Descriptions

#### Current Behavior

A dismembered part (e.g., right ear) has two relevant attributes:
1. `state: 'destroyed'` - Health state at 0%
2. `isDismembered: true` - Physical status (severed from body)

The current code processes both:
- Health state loop outputs: "My right ear is completely numb."
- Effects loop outputs: "My right ear is missing."

This is semantically incorrect - a missing body part cannot be "numb" because it's no longer attached.

#### Required Fix

When processing health states, **exclude parts that are dismembered**:

```javascript
// Before processing health states, create exclusion set
const dismemberedPartIds = new Set(
  (summary.dismemberedParts || []).map(p => p.partEntityId)
);

for (const state of states) {
  if (state === 'healthy') continue;

  let parts = [];
  if (state === 'destroyed') {
    // Only include destroyed parts that are NOT dismembered
    parts = (summary.destroyedParts || []).filter(
      p => !dismemberedPartIds.has(p.partEntityId)
    );
  } else {
    // Filter out dismembered parts from other states
    parts = (summary.injuredParts || []).filter(
      p => p.state === state && !dismemberedPartIds.has(p.partEntityId)
    );
  }
  // ...
}
```

#### Business Rule

| Part State | Has `isDismembered` | Output |
|------------|---------------------|--------|
| destroyed | No | "My X is completely numb." |
| destroyed | Yes | "My X is missing." (from effects section only) |
| other | No | Health state description |
| other | Yes | "My X is missing." (from effects section only) |

#### Impact

- **File:** `src/anatomy/services/injuryNarrativeFormatterService.js`
- **Lines:** 120-144
- **Risk:** Low (filter addition)

---

### SPEC-003: Prioritize Dismemberment at Top of Report

#### Current Behavior

Output order in `formatFirstPerson()`:
1. Health states by severity (destroyed → critical → injured → wounded → scratched)
2. Effects (dismembered → bleeding → burning → poisoned → fractured)

Dismemberment appears near the end, after all health state descriptions.

#### Required Fix

Reorder output to prioritize dismemberment:

1. **Dismemberment** (most severe - body part loss)
2. **Health states** by severity (destroyed → critical → ...)
3. **Other effects** (bleeding → burning → poisoned → fractured)

```javascript
formatFirstPerson(summary) {
  // ... dead/dying checks ...

  const narrativeParts = [];

  // 1. FIRST: Dismemberment descriptions
  const dismembermentDescriptions = this.#formatDismembermentFirstPerson(summary);
  if (dismembermentDescriptions) {
    narrativeParts.push(dismembermentDescriptions);
  }

  // 2. Health state descriptions (excluding dismembered parts)
  const stateDescriptions = this.#formatHealthStatesFirstPerson(summary);
  if (stateDescriptions) {
    narrativeParts.push(stateDescriptions);
  }

  // 3. Other effect descriptions (excluding dismembered parts)
  const otherEffectDescriptions = this.#formatOtherEffectsFirstPerson(summary);
  if (otherEffectDescriptions) {
    narrativeParts.push(otherEffectDescriptions);
  }

  return narrativeParts.join(' ') || 'I feel fine.';
}
```

#### Rationale

- Losing a body part is the most severe and immediately noticeable condition
- Players/AI should prioritize understanding what's missing before other injuries
- Follows principle: most important information first

#### Impact

- **File:** `src/anatomy/services/injuryNarrativeFormatterService.js`
- **Lines:** 92-153
- **Risk:** Low (reorganization)

---

### SPEC-004: Group Bleeding Parts by Severity

#### Current Behavior

In `#formatEffectsFirstPerson()` lines 294-303:

```javascript
const bleedingParts = summary.bleedingParts || [];
for (const part of bleedingParts) {
  const partName = this.#formatPartName(part.partType, part.orientation);
  const severity = part.bleedingSeverity || 'moderate';
  const bleedingDesc =
    BLEEDING_SEVERITY_FIRST_PERSON[severity] ||
    FIRST_PERSON_EFFECT_MAP.bleeding;
  effectParts.push(`${this.#capitalizeFirst(bleedingDesc)} my ${partName}.`);
}
```

Each part produces a separate sentence:
- "Blood flows steadily from my torso."
- "Blood flows steadily from my upper head."

#### Required Fix

Group bleeding parts by severity, then format each group as a combined sentence:

```javascript
#formatBleedingEffectsFirstPerson(bleedingParts) {
  if (!bleedingParts || bleedingParts.length === 0) {
    return '';
  }

  // Group by severity
  const bySeverity = {};
  for (const part of bleedingParts) {
    const severity = part.bleedingSeverity || 'moderate';
    if (!bySeverity[severity]) {
      bySeverity[severity] = [];
    }
    bySeverity[severity].push(part);
  }

  const sentences = [];

  // Process in severity order: severe → moderate → minor
  const severityOrder = ['severe', 'moderate', 'minor'];
  for (const severity of severityOrder) {
    const parts = bySeverity[severity];
    if (!parts || parts.length === 0) continue;

    const bleedingDesc = BLEEDING_SEVERITY_FIRST_PERSON[severity] ||
      FIRST_PERSON_EFFECT_MAP.bleeding;
    const partNames = parts.map(p =>
      `my ${this.#formatPartName(p.partType, p.orientation)}`
    );

    const combinedParts = this.#formatListWithOxfordComma(partNames);
    sentences.push(`${this.#capitalizeFirst(bleedingDesc)} ${combinedParts}.`);
  }

  return sentences.join(' ');
}

#formatListWithOxfordComma(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  const lastItem = items.pop();
  return `${items.join(', ')}, and ${lastItem}`;
}
```

#### Output Examples

| Input Parts | Severity | Output |
|-------------|----------|--------|
| torso | moderate | "Blood flows steadily from my torso." |
| torso, upper head | moderate | "Blood flows steadily from my torso and my upper head." |
| torso, upper head, right leg | moderate | "Blood flows steadily from my torso, my upper head, and my right leg." |
| torso (moderate), arm (severe) | mixed | "Blood pours freely from my arm. Blood flows steadily from my torso." |

#### Impact

- **File:** `src/anatomy/services/injuryNarrativeFormatterService.js`
- **Lines:** 294-303 (replace)
- **Risk:** Low (isolated change)

---

## Implementation Details

### Method Refactoring

The `formatFirstPerson()` method should be refactored into smaller, focused methods:

```javascript
formatFirstPerson(summary) {
  if (!summary) {
    this.#logger.warn('formatFirstPerson called with null/undefined summary');
    return 'I feel fine.';
  }

  if (summary.isDead) {
    return 'Everything fades to black...';
  }

  if (summary.isDying) {
    return this.#formatDyingMessage(summary.dyingTurnsRemaining);
  }

  if (!summary.injuredParts || summary.injuredParts.length === 0) {
    return 'I feel fine.';
  }

  // Build exclusion set for dismembered parts
  const dismemberedPartIds = this.#buildDismemberedPartIdSet(summary);

  const narrativeParts = [];

  // 1. Dismemberment (highest priority)
  const dismemberment = this.#formatDismembermentFirstPerson(summary);
  if (dismemberment) narrativeParts.push(dismemberment);

  // 2. Health states (excluding dismembered)
  const healthStates = this.#formatHealthStatesFirstPerson(summary, dismemberedPartIds);
  if (healthStates) narrativeParts.push(healthStates);

  // 3. Other effects (excluding dismembered)
  const effects = this.#formatOtherEffectsFirstPerson(summary, dismemberedPartIds);
  if (effects) narrativeParts.push(effects);

  return narrativeParts.join(' ') || 'I feel fine.';
}
```

### New Helper Methods

```javascript
#buildDismemberedPartIdSet(summary) {
  return new Set(
    (summary.dismemberedParts || []).map(p => p.partEntityId)
  );
}

#formatDyingMessage(turnsRemaining) {
  const turnsText = turnsRemaining === 1 ? 'moment' : `${turnsRemaining} moments`;
  return `I am dying. Without help, I have only ${turnsText} left...`;
}

#formatDismembermentFirstPerson(summary) {
  const dismemberedParts = summary.dismemberedParts || [];
  if (dismemberedParts.length === 0) return '';

  return dismemberedParts
    .map(p => `My ${this.#formatPartName(p.partType, p.orientation)} is missing.`)
    .join(' ');
}

#formatHealthStatesFirstPerson(summary, excludePartIds) {
  const states = getStateOrder(false); // Descending severity
  const sentences = [];

  for (const state of states) {
    if (state === 'healthy') continue;

    let parts;
    if (state === 'destroyed') {
      parts = (summary.destroyedParts || []).filter(
        p => !excludePartIds.has(p.partEntityId)
      );
    } else {
      parts = (summary.injuredParts || []).filter(
        p => p.state === state && !excludePartIds.has(p.partEntityId)
      );
    }

    if (parts.length > 0) {
      sentences.push(this.#formatPartGroupFirstPerson(parts, state));
    }
  }

  return sentences.join(' ');
}

#formatOtherEffectsFirstPerson(summary, excludePartIds) {
  const effectParts = [];

  // Bleeding (grouped by severity)
  const bleedingParts = (summary.bleedingParts || []).filter(
    p => !excludePartIds.has(p.partEntityId)
  );
  const bleedingText = this.#formatBleedingEffectsFirstPerson(bleedingParts);
  if (bleedingText) effectParts.push(bleedingText);

  // Burning
  const burningParts = (summary.burningParts || []).filter(
    p => !excludePartIds.has(p.partEntityId)
  );
  for (const part of burningParts) {
    const partName = this.#formatPartName(part.partType, part.orientation);
    effectParts.push(`${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.burning)} my ${partName}.`);
  }

  // Poisoned
  const poisonedParts = (summary.poisonedParts || []).filter(
    p => !excludePartIds.has(p.partEntityId)
  );
  for (const part of poisonedParts) {
    const partName = this.#formatPartName(part.partType, part.orientation);
    effectParts.push(`${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.poisoned)} my ${partName}.`);
  }

  // Fractured
  const fracturedParts = (summary.fracturedParts || []).filter(
    p => !excludePartIds.has(p.partEntityId)
  );
  for (const part of fracturedParts) {
    const partName = this.#formatPartName(part.partType, part.orientation);
    effectParts.push(`${this.#capitalizeFirst(FIRST_PERSON_EFFECT_MAP.fractured)} my ${partName}.`);
  }

  return effectParts.join(' ');
}
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`

#### Test Suite: Deduplication (SPEC-001)

```javascript
describe('duplicate part deduplication', () => {
  it('should not duplicate destroyed parts in output', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    const armCount = (result.match(/left arm/g) || []).length;
    expect(armCount).toBe(1);
  });

  it('should handle multiple destroyed parts without duplication', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' },
        { partEntityId: 'part-2', partType: 'arm', orientation: 'right', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' },
        { partEntityId: 'part-2', partType: 'arm', orientation: 'right', state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('left arm');
    expect(result).toContain('right arm');
    // Each arm should appear exactly once
    const leftCount = (result.match(/left arm/g) || []).length;
    const rightCount = (result.match(/right arm/g) || []).length;
    expect(leftCount).toBe(1);
    expect(rightCount).toBe(1);
  });
});
```

#### Test Suite: Dismemberment Filtering (SPEC-002)

```javascript
describe('dismembered parts filtering', () => {
  it('should not show health state for dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', isDismembered: true }
      ],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is missing');
    expect(result).not.toContain('is completely numb');
  });

  it('should show health state for destroyed but non-dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'torso', orientation: null, state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'torso', orientation: null, state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is completely numb');
    expect(result).not.toContain('is missing');
  });

  it('should not show bleeding for dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      bleedingParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' }
      ],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', isDismembered: true }
      ],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is missing');
    expect(result).not.toContain('Blood');
    expect(result).not.toContain('blood');
  });
});
```

#### Test Suite: Dismemberment Priority (SPEC-003)

```javascript
describe('dismemberment priority', () => {
  it('should show dismemberment before health states', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' },
        { partEntityId: 'part-2', partType: 'torso', orientation: null, state: 'critical' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', isDismembered: true }
      ],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    const missingPos = result.indexOf('is missing');
    const agonyPos = result.indexOf('screams with agony');

    expect(missingPos).toBeGreaterThan(-1);
    expect(agonyPos).toBeGreaterThan(-1);
    expect(missingPos).toBeLessThan(agonyPos);
  });
});
```

#### Test Suite: Bleeding Grouping (SPEC-004)

```javascript
describe('bleeding grouping', () => {
  it('should format single bleeding part correctly', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', orientation: null, bleedingSeverity: 'moderate' }
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('Blood flows steadily from my torso.');
  });

  it('should format two bleeding parts with same severity using "and"', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', orientation: null, bleedingSeverity: 'moderate' },
      { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' }
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toMatch(/Blood flows steadily from my torso and my upper head\./);
  });

  it('should format three+ bleeding parts with Oxford comma', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', orientation: null, bleedingSeverity: 'moderate' },
      { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
      { partType: 'leg', orientation: 'right', bleedingSeverity: 'moderate' }
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toMatch(/Blood flows steadily from my torso, my upper head, and my right leg\./);
  });

  it('should create separate sentences for different severities', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'torso', orientation: null, bleedingSeverity: 'moderate' },
      { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' }
    ]);

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('Blood pours freely from my left arm.');
    expect(result).toContain('Blood flows steadily from my torso.');
  });

  it('should process severe before moderate before minor', () => {
    const summary = createSummaryWithBleedingParts([
      { partType: 'leg', orientation: 'right', bleedingSeverity: 'minor' },
      { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
      { partType: 'torso', orientation: null, bleedingSeverity: 'moderate' }
    ]);

    const result = service.formatFirstPerson(summary);
    const severePos = result.indexOf('pours freely');
    const moderatePos = result.indexOf('flows steadily');
    const minorPos = result.indexOf('seeps from');

    expect(severePos).toBeLessThan(moderatePos);
    expect(moderatePos).toBeLessThan(minorPos);
  });
});

// Helper function for bleeding tests
function createSummaryWithBleedingParts(bleedingConfigs) {
  const bleedingParts = bleedingConfigs.map((config, index) => ({
    partEntityId: `part-${index}`,
    partType: config.partType,
    orientation: config.orientation,
    bleedingSeverity: config.bleedingSeverity
  }));

  const injuredParts = bleedingConfigs.map((config, index) => ({
    partEntityId: `part-${index}`,
    partType: config.partType,
    orientation: config.orientation,
    state: 'wounded'
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
```

### Integration Tests

**File:** `tests/integration/anatomy/physicalConditionNarrativeImprovements.integration.test.js`

```javascript
describe('Physical Condition Narrative Improvements', () => {
  describe('comprehensive injury scenario', () => {
    it('should format complex injury state correctly', async () => {
      // Setup: Entity with multiple injury types
      const entity = await createTestEntityWithInjuries({
        dismemberedParts: [{ partType: 'ear', orientation: 'right' }],
        destroyedParts: [{ partType: 'finger', orientation: 'left' }],
        criticalParts: [{ partType: 'torso', orientation: null }],
        woundedParts: [{ partType: 'head', orientation: 'upper' }],
        bleedingParts: [
          { partType: 'torso', orientation: null, severity: 'moderate' },
          { partType: 'head', orientation: 'upper', severity: 'moderate' }
        ]
      });

      const summary = injuryAggregationService.aggregateInjuries(entity.id);
      const narrative = injuryNarrativeFormatterService.formatFirstPerson(summary);

      // Verify output order
      const missingPos = narrative.indexOf('is missing');
      const numbPos = narrative.indexOf('is completely numb');
      const agonyPos = narrative.indexOf('screams with agony');
      const throbsPos = narrative.indexOf('throbs painfully');
      const bloodPos = narrative.indexOf('Blood');

      // Dismemberment first
      expect(missingPos).toBeLessThan(numbPos);
      // Destroyed before critical
      expect(numbPos).toBeLessThan(agonyPos);
      // Critical before wounded
      expect(agonyPos).toBeLessThan(throbsPos);
      // Health states before effects
      expect(throbsPos).toBeLessThan(bloodPos);

      // Verify no duplicates
      expect(narrative.match(/right ear/g)?.length || 0).toBe(1);

      // Verify bleeding grouped
      expect(narrative).toMatch(/Blood flows steadily from my torso and my upper head\./);
    });
  });

  describe('UI integration', () => {
    it('should display formatted narrative in injury panel', async () => {
      // Integration test with actual UI component
      // Verify InjuryStatusPanel receives and displays correct text
    });
  });

  describe('LLM integration', () => {
    it('should include narrative in actor prompt data', async () => {
      // Integration test with ActorDataExtractor
      // Verify firstPersonNarrative field populated correctly
    });
  });
});
```

---

## Acceptance Criteria

### Functional Requirements

| ID | Requirement | Verification Method |
|----|-------------|---------------------|
| AC-001 | No body part appears more than once in output | Unit test + manual verification |
| AC-002 | Dismembered parts show only "is missing" text | Unit test |
| AC-003 | Non-dismembered destroyed parts show "is completely numb" | Unit test |
| AC-004 | Dismemberment descriptions appear before health states | Unit test + integration test |
| AC-005 | Bleeding parts with same severity are grouped | Unit test |
| AC-006 | Grouped bleeding uses Oxford comma for 3+ items | Unit test |
| AC-007 | Different bleeding severities produce separate sentences | Unit test |
| AC-008 | Dismembered parts excluded from bleeding descriptions | Unit test |

### Non-Functional Requirements

| ID | Requirement | Verification Method |
|----|-------------|---------------------|
| NFR-001 | All existing tests continue to pass | CI pipeline |
| NFR-002 | No performance regression in formatFirstPerson() | Performance test (< 1ms) |
| NFR-003 | UI panel displays updated narrative correctly | Manual verification |
| NFR-004 | LLM prompts receive updated narrative format | Integration test |

---

## Risk Assessment

### Low Risk

- **Isolated Changes**: All modifications in single service file
- **Well-Tested**: Existing test coverage provides safety net
- **Interface Stability**: Public API unchanged (same method signature)

### Medium Risk

- **Edge Cases**: Parts with multiple effects (dismembered + bleeding) need careful handling
- **State Combinations**: Many possible combinations of health states and effects

### Mitigation

1. Comprehensive test suite covering all combinations
2. Manual testing in game UI before merge
3. Integration tests verifying end-to-end flow
4. Code review with focus on edge cases

---

## Appendix A: Test Data Scenarios

### Scenario 1: Basic Dismemberment
```json
{
  "dismemberedParts": [{ "partType": "ear", "orientation": "right" }],
  "injuredParts": [{ "partType": "ear", "orientation": "right", "state": "destroyed" }],
  "destroyedParts": [{ "partType": "ear", "orientation": "right" }]
}
```
**Expected:** "My right ear is missing."

### Scenario 2: Dismemberment + Other Injuries
```json
{
  "dismemberedParts": [{ "partType": "arm", "orientation": "left" }],
  "injuredParts": [
    { "partType": "arm", "orientation": "left", "state": "destroyed" },
    { "partType": "torso", "orientation": null, "state": "critical" }
  ],
  "destroyedParts": [{ "partType": "arm", "orientation": "left" }]
}
```
**Expected:** "My left arm is missing. My torso screams with agony."

### Scenario 3: Multiple Bleeding Same Severity
```json
{
  "injuredParts": [
    { "partType": "torso", "orientation": null, "state": "wounded" },
    { "partType": "head", "orientation": "upper", "state": "wounded" }
  ],
  "bleedingParts": [
    { "partType": "torso", "bleedingSeverity": "moderate" },
    { "partType": "head", "orientation": "upper", "bleedingSeverity": "moderate" }
  ]
}
```
**Expected:** "My torso throbs painfully. My upper head throbs painfully. Blood flows steadily from my torso and my upper head."

### Scenario 4: Dismembered Part with Bleeding (Edge Case)
```json
{
  "dismemberedParts": [{ "partType": "arm", "orientation": "left" }],
  "bleedingParts": [{ "partType": "arm", "orientation": "left", "bleedingSeverity": "severe" }],
  "destroyedParts": [{ "partType": "arm", "orientation": "left" }]
}
```
**Expected:** "My left arm is missing." (NO bleeding description for dismembered part)

### Scenario 5: Complex Realistic Scenario
```json
{
  "dismemberedParts": [{ "partType": "ear", "orientation": "right" }],
  "injuredParts": [
    { "partType": "ear", "orientation": "right", "state": "destroyed" },
    { "partType": "torso", "orientation": null, "state": "critical" },
    { "partType": "head", "orientation": "upper", "state": "wounded" },
    { "partType": "brain", "orientation": null, "state": "scratched" }
  ],
  "destroyedParts": [{ "partType": "ear", "orientation": "right" }],
  "bleedingParts": [
    { "partType": "torso", "bleedingSeverity": "moderate" },
    { "partType": "head", "orientation": "upper", "bleedingSeverity": "moderate" }
  ]
}
```
**Expected:** "My right ear is missing. My torso screams with agony. My upper head throbs painfully. My brain stings slightly. Blood flows steadily from my torso and my upper head."
