# CHADISLLMQUALAB-005: Integration Tests for Chance Text Translation

## Overview

**Ticket ID**: CHADISLLMQUALAB-005
**Status**: Completed
**Priority**: Medium
**Depends On**: CHADISLLMQUALAB-001, CHADISLLMQUALAB-002, CHADISLLMQUALAB-003
**Blocks**: None

## Objective

Create integration tests that verify the prompt-formatting path from action command strings into LLM prompt output (via `AIPromptContentProvider` + `ChanceTextTranslator`), ensuring that:
1. UI-facing `commandString` retains numeric percentages
2. LLM prompt output uses qualitative labels
3. Modifier tags are preserved throughout

## File List

| File | Action | Description |
|------|--------|-------------|
| `tests/integration/prompting/chanceTextTranslation.integration.test.js` | **CREATE** | End-to-end integration tests |

## Out of Scope

- **DO NOT** modify any source code files (the translator and DI wiring already exist)
- **DO NOT** modify unit tests for ChanceTextTranslator (CHADISLLMQUALAB-004)
- **DO NOT** modify AIPromptContentProvider tests (CHADISLLMQUALAB-006)
- **DO NOT** create new test fixtures or helpers unless absolutely necessary
- **DO NOT** test ChanceCalculationService internals (only its output format)

## Implementation Details

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import necessary modules from tests/common/ and actual services

describe('Chance Text Translation Integration', () => {
  describe('Prompt Formatting Pipeline', () => { ... });
  describe('UI vs LLM Output Divergence', () => { ... });
  describe('Edge Cases', () => { ... });
});
```

### Test Suites Required

#### 1. Prompt Formatting Pipeline Tests

These tests verify the full prompt-formatting path using a real `ChanceTextTranslator`
and a real `AIPromptContentProvider` with mocked dependencies. Action discovery is
out of scope; actions are supplied as already-formatted composites.

```javascript
describe('Prompt Formatting Pipeline', () => {
  let fixture;
  let aiPromptContentProvider;

  beforeEach(async () => {
    // Setup using existing test infrastructure
    // May need container or mock setup from tests/common/
  });

  afterEach(() => {
    // Cleanup
  });

  it('should show numeric chance in source commandString', async () => {
    // Given: An action with {chance} already injected (e.g., 55%)
    // When: Action is formatted for LLM
    // Then: action.commandString contains "(55% chance)"
  });

  it('should show qualitative label when formatted for LLM', async () => {
    // Given: An action with commandString "(55% chance)"
    // When: Formatted through AIPromptContentProvider
    // Then: Output contains "(decent chance)" not "(55% chance)"
  });

  it('should preserve modifier tags in LLM prompt format', async () => {
    // Given: An action with "(55% chance) [flanking]"
    // When: Formatted for LLM
    // Then: Output contains "(decent chance) [flanking]"
  });
});
```

#### 2. UI vs LLM Divergence Tests

Verify that UI and LLM receive different formats:

```javascript
describe('UI vs LLM Output Divergence', () => {
  it('should produce different output for UI vs LLM', async () => {
    // Given: Same action object
    // When: Used for UI display vs LLM prompt
    // Then: UI shows "(55% chance)", LLM shows "(decent chance)"
  });

  it('should not mutate the original action object', async () => {
    // Given: Action with commandString "(55% chance)"
    // When: Formatted for LLM
    // Then: Original action.commandString still "(55% chance)"
  });
});
```

#### 3. Boundary and Edge Cases

```javascript
describe('Edge Cases', () => {
  it('should handle action without chance template', async () => {
    // Given: Action like "walk to tavern" (no {chance})
    // When: Formatted for LLM
    // Then: Output unchanged
  });

  it('should handle 0% chance actions', async () => {
    // Given: Action that calculates to 0%
    // When: Formatted for LLM
    // Then: Shows "(impossible)"
  });

  it('should handle 100% chance actions', async () => {
    // Given: Action that calculates to 100%
    // When: Formatted for LLM
    // Then: Shows "(certain)"
  });

  it('should handle multiple targets with different chances', async () => {
    // Given: Action commandString containing multiple chance patterns
    // When: Formatted for LLM
    // Then: Each chance translated independently
  });
});
```

#### 4. Regression Tests

```javascript
describe('Regression: Existing Functionality', () => {
  it('should not affect actions without chance in template', async () => {
    // Non-chance actions should be completely unchanged
  });

  it('should preserve action index in LLM format', async () => {
    // [Index: X] prefix must still appear
  });

  it('should preserve action description in LLM format', async () => {
    // Description portion unchanged
  });

  it('should preserve terminal punctuation behavior', async () => {
    // Description should still get terminal punctuation
  });
});
```

### Test Setup Patterns

Use existing test infrastructure from the project:

```javascript
// Direct service instantiation with mocks
import { ChanceTextTranslator } from '../../../src/prompting/ChanceTextTranslator.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
```

### Mock Data for Tests

```javascript
const mockActionWithChance = {
  index: 0,
  actionId: 'test:attack',
  commandString: 'attack Goblin (55% chance)',
  description: 'Attack the goblin with your weapon',
};

const mockActionWithChanceAndTags = {
  index: 1,
  actionId: 'test:flanking_attack',
  commandString: 'attack Goblin (75% chance) [flanking] [backstab]',
  description: 'Attack from behind for bonus damage',
};

const mockActionWithoutChance = {
  index: 2,
  actionId: 'test:walk',
  commandString: 'walk to tavern',
  description: 'Walk to the local tavern',
};
```

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:integration -- --runInBand tests/integration/prompting/chanceTextTranslation.integration.test.js
```

All tests in this file must pass.

### Integration Verification

1. **Pipeline integrity**: Prompt formatting pipeline from action command string to LLM output works correctly
2. **Format divergence**: UI and LLM outputs are genuinely different
3. **No mutation**: Source data not modified
4. **Backward compatibility**: Non-chance actions unchanged

### Invariants That Must Remain True

1. **UI unchanged**: Any test simulating UI display shows numeric %
2. **LLM changed**: Any test simulating LLM format shows qualitative labels
3. **Tags preserved**: Modifier tags appear in both UI and LLM formats
4. **Index preserved**: `[Index: X]` format in LLM output unchanged
5. **Description preserved**: Action description formatting unchanged
6. **No side effects**: Original action objects not mutated

### Update Existing Tests

No updates required; existing unit tests already cover `ChanceTextTranslator`.

## Technical Notes

- Integration tests may be slower than unit tests - optimize where possible
- Use minimal fixtures - don't over-engineer test infrastructure
- Check existing tests in `tests/integration/prompting/` for patterns
- May need to mock some services while using real ChanceTextTranslator

### Checking Existing Test Infrastructure

Before creating new helpers, check:
- `tests/common/testBed.js`
- `tests/common/prompting/` directory
- `tests/integration/prompting/` for existing patterns

## Definition of Done

- [x] Test file created at `tests/integration/prompting/chanceTextTranslation.integration.test.js`
- [x] Full pipeline test verifies numeric → qualitative translation
- [x] Test confirms UI output retains numeric percentages
- [x] Test confirms LLM output uses qualitative labels
- [x] Modifier tag preservation tested
- [x] Edge cases tested (0%, 100%, no chance, multi-target)
- [x] Regression tests verify existing functionality unchanged
- [x] All tests pass: `npm run test:integration -- --runInBand tests/integration/prompting/chanceTextTranslation.integration.test.js`
- [x] No flaky tests (single run is acceptable for this ticket)

## Outcome

Added integration coverage for `AIPromptContentProvider` + `ChanceTextTranslator` using mocked dependencies, verifying UI/LLM divergence, tag preservation, and boundary labels. Action discovery was not exercised; actions were supplied as preformatted composites, and no source code changes were required.
