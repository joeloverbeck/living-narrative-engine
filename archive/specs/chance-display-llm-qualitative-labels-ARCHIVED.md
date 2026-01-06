# Spec: Qualitative Chance Labels for LLM Prompts

## Overview

**Ticket ID**: CHANCELLM-001
**Status**: Draft
**Author**: Claude Code
**Created**: 2026-01-05

## Problem Statement

Actions with `{chance}` templates currently display numerical percentages like `"restrain Alicia Western (54% chance)"` to both human players (UI) and LLMs (prompts). Research has shown that LLMs exhibit problematic behaviors when presented with numerical probabilities:

1. **Meta-awareness**: LLMs interpret the percentage as "the system says I have X% chance", breaking immersion and creating unnatural reasoning patterns
2. **Poor risk assessment**: Low probabilities like 24% are often interpreted as "worth trying" when they should be understood as unfavorable odds
3. **Mechanistic reasoning**: LLMs focus on the number rather than the narrative context of the action

Studies demonstrate that replacing numerical values with qualitative labels improves LLM decision-making and produces more natural, story-appropriate reasoning.

## Requirements

### Functional Requirements

1. **UI Display (game.html Actions panel)**: MUST continue showing numerical percentages (e.g., "54% chance") - **no change**
2. **LLM Prompts**: MUST replace numerical percentages with qualitative text labels (e.g., "decent chance", "excellent chance")
3. **Granularity**: MUST support at least 10 distinct levels of assessment
4. **Modifier Tags**: MUST preserve modifier tags like `[target downed]` after the qualitative label
5. **Backward Compatibility**: MUST not break existing action templates or schema

### Non-Functional Requirements

1. **Performance**: Translation must add negligible overhead to prompt generation
2. **Maintainability**: Granularity scale must be easily configurable
3. **Testability**: All translation logic must be covered by unit and integration tests

## Current Architecture

### Data Flow

```
ChanceCalculationService.calculateForDisplay()
    └── Returns { chance: 55, displayText: '55%', activeTags: [] }
         │
         ├── ActionFormattingStage.#injectChanceIntoTemplates()
         │   └── Replaces {chance} with "55" (removes % since template has it)
         │
         └── MultiTargetActionFormatter.#applyChanceAndTags()
             └── Same replacement, appends modifier tags
                  │
                  └── Result: "punch Goblin (55% chance) [flanking]"
                       │
                       ├── UI: Renders commandString directly
                       │
                       └── LLM: AIPromptContentProvider._formatSingleAction()
                            └── Uses commandString as-is
```

### Key Files

| File | Purpose |
|------|---------|
| `src/combat/services/ChanceCalculationService.js` | Calculates chance, returns `displayText` |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | Pre-injects `{chance}` for simple actions |
| `src/actions/formatters/MultiTargetActionFormatter.js` | Injects `{chance}` for multi-target actions |
| `src/prompting/AIPromptContentProvider.js` | Formats actions for LLM prompts |
| `src/dependencyInjection/registrations/aiRegistrations.js` | DI registration for AI services |
| `src/dependencyInjection/tokens/tokens-ai.js` | DI tokens for AI services |

## Solution Design

### Approach: Transform at LLM Prompt Generation

Create a **ChanceTextTranslator** service that converts percentage strings to qualitative labels at the point where actions are formatted for LLM prompts.

**Rationale:**
1. **Non-invasive**: Does not modify the existing action formatting pipeline
2. **Single responsibility**: UI code remains completely unchanged
3. **Testable**: Pure transformation function, easily unit-tested
4. **Maintainable**: Granularity scale centralized in one location
5. **Reversible**: Easy to disable if needed

### Granularity Scale (12 Levels)

| Percentage Range | Qualitative Label | Semantic Meaning |
|-----------------|-------------------|------------------|
| 95-100% | "certain" | Near-guaranteed success |
| 85-94% | "excellent chance" | Very favorable odds |
| 75-84% | "very good chance" | Strongly favorable |
| 65-74% | "good chance" | Favorable |
| 55-64% | "decent chance" | Slightly favorable |
| 45-54% | "fair chance" | Neutral / coin flip |
| 35-44% | "uncertain chance" | Slightly unfavorable |
| 25-34% | "poor chance" | Unfavorable |
| 15-24% | "unlikely" | Strongly unfavorable |
| 5-14% | "very unlikely" | Very unfavorable |
| 1-4% | "desperate" | Near-certain failure |
| 0% | "impossible" | No chance of success |

**Design Notes:**
- 12 levels provides granularity without overwhelming complexity
- Labels are common English phrases LLMs understand contextually
- Boundary values use ≥ for upper bound and < for lower bound
- Labels avoid game-specific jargon

## Implementation Plan

### Step 1: Create ChanceTextTranslator Service

**File**: `src/prompting/services/ChanceTextTranslator.js`

```javascript
/**
 * @file Translates numerical chance percentages to qualitative labels for LLM prompts
 * @description Converts patterns like "(55% chance)" to "(decent chance)" to improve
 * LLM reasoning by avoiding numerical probability interpretation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} ChanceLevel
 * @property {number} min - Minimum percentage (inclusive)
 * @property {number} max - Maximum percentage (inclusive)
 * @property {string} label - Qualitative label
 */

/**
 * Translates numerical chance percentages to qualitative labels.
 * Used to format action commands for LLM prompts where numerical
 * probabilities cause undesirable meta-reasoning behaviors.
 */
class ChanceTextTranslator {
  #logger;

  /** @type {ChanceLevel[]} */
  static CHANCE_LEVELS = [
    { min: 95, max: 100, label: 'certain' },
    { min: 85, max: 94, label: 'excellent chance' },
    { min: 75, max: 84, label: 'very good chance' },
    { min: 65, max: 74, label: 'good chance' },
    { min: 55, max: 64, label: 'decent chance' },
    { min: 45, max: 54, label: 'fair chance' },
    { min: 35, max: 44, label: 'uncertain chance' },
    { min: 25, max: 34, label: 'poor chance' },
    { min: 15, max: 24, label: 'unlikely' },
    { min: 5, max: 14, label: 'very unlikely' },
    { min: 1, max: 4, label: 'desperate' },
    { min: 0, max: 0, label: 'impossible' },
  ];

  /**
   * Pattern to match chance expressions in action commands.
   * Matches: "(55% chance)", "(100% chance)", etc.
   * Captures the percentage number for transformation.
   */
  static CHANCE_PATTERN = /\((\d+)%\s*chance\)/gi;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn'],
    });
    this.#logger = logger;
    this.#logger.debug('ChanceTextTranslator: Initialized');
  }

  /**
   * Translate all chance percentage patterns in text to qualitative labels.
   *
   * @param {string} text - Text potentially containing chance percentages
   * @returns {string} - Text with percentages replaced by qualitative labels
   *
   * @example
   * translateForLlm("punch Goblin (55% chance)")
   * // Returns: "punch Goblin (decent chance)"
   *
   * @example
   * translateForLlm("attack (75% chance) [flanking]")
   * // Returns: "attack (very good chance) [flanking]"
   */
  translateForLlm(text) {
    if (!text || typeof text !== 'string') {
      return text ?? '';
    }

    return text.replace(ChanceTextTranslator.CHANCE_PATTERN, (match, percentStr) => {
      const percentage = parseInt(percentStr, 10);
      const label = this.getQualitativeLabel(percentage);
      return `(${label})`;
    });
  }

  /**
   * Convert a numeric percentage to its qualitative label.
   *
   * @param {number} percentage - Value from 0-100
   * @returns {string} - Qualitative label
   *
   * @example
   * getQualitativeLabel(55) // Returns: "decent chance"
   * getQualitativeLabel(95) // Returns: "certain"
   */
  getQualitativeLabel(percentage) {
    // Handle edge cases
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      this.#logger.warn('ChanceTextTranslator: Invalid percentage, defaulting to fair chance', {
        percentage,
      });
      return 'fair chance';
    }

    // Clamp to valid range
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

    // Find matching level
    for (const level of ChanceTextTranslator.CHANCE_LEVELS) {
      if (clamped >= level.min && clamped <= level.max) {
        return level.label;
      }
    }

    // Fallback (should never reach here with valid input)
    this.#logger.warn('ChanceTextTranslator: No matching level found, defaulting to fair chance', {
      percentage: clamped,
    });
    return 'fair chance';
  }
}

export { ChanceTextTranslator };
export default ChanceTextTranslator;
```

### Step 2: Add DI Token

**File**: `src/dependencyInjection/tokens/tokens-ai.js`

Add token:
```javascript
ChanceTextTranslator: 'ChanceTextTranslator',
```

### Step 3: Register Service

**File**: `src/dependencyInjection/registrations/aiRegistrations.js`

Add import at top:
```javascript
import { ChanceTextTranslator } from '../../prompting/services/ChanceTextTranslator.js';
```

Add registration in `registerAITurnPipeline` function (before AIPromptContentProvider):
```javascript
registrar.singletonFactory(tokens.ChanceTextTranslator, (c) => {
  return new ChanceTextTranslator({
    logger: c.resolve(tokens.ILogger),
  });
});
logger.debug(
  `AI Systems Registration: Registered ${tokens.ChanceTextTranslator}.`
);
```

### Step 4: Inject into AIPromptContentProvider

**File**: `src/prompting/AIPromptContentProvider.js`

#### 4.1 Add private field
```javascript
#chanceTextTranslator;
```

#### 4.2 Update constructor
```javascript
constructor({
  logger,
  promptStaticContentService,
  perceptionLogFormatter,
  gameStateValidationService,
  actionCategorizationService,
  characterDataXmlBuilder,
  modActionMetadataProvider,
  chanceTextTranslator,  // NEW
}) {
  // ... existing validations ...

  validateDependency(chanceTextTranslator, 'ChanceTextTranslator', logger, {
    requiredMethods: ['translateForLlm'],
  });

  this.#chanceTextTranslator = chanceTextTranslator;
}
```

#### 4.3 Update _formatSingleAction method
```javascript
_formatSingleAction(action) {
  if (!action) {
    this.#logger.warn(
      'AIPromptContentProvider: Attempted to format null/undefined action'
    );
    return '';
  }

  // Get command string and translate chance for LLM
  let commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
  commandStr = this.#chanceTextTranslator.translateForLlm(commandStr);

  let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
  description = ensureTerminalPunctuation(description);

  return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
}
```

### Step 5: Update DI Registration for AIPromptContentProvider

**File**: `src/dependencyInjection/registrations/aiRegistrations.js`

Update the AIPromptContentProvider factory:
```javascript
registrar.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
  return new AIPromptContentProvider({
    logger: c.resolve(tokens.ILogger),
    promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
    perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
    gameStateValidationService: c.resolve(
      tokens.IGameStateValidationServiceForPrompting
    ),
    actionCategorizationService: c.resolve(
      tokens.IActionCategorizationService
    ),
    characterDataXmlBuilder: c.resolve(tokens.CharacterDataXmlBuilder),
    modActionMetadataProvider: c.resolve(tokens.IModActionMetadataProvider),
    chanceTextTranslator: c.resolve(tokens.ChanceTextTranslator),  // NEW
  });
});
```

## Testing Strategy

### Unit Tests

**File**: `tests/unit/prompting/services/ChanceTextTranslator.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ChanceTextTranslator } from '../../../../src/prompting/services/ChanceTextTranslator.js';

describe('ChanceTextTranslator', () => {
  let translator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    translator = new ChanceTextTranslator({ logger: mockLogger });
  });

  describe('getQualitativeLabel', () => {
    describe('boundary conditions', () => {
      it.each([
        [100, 'certain'],
        [95, 'certain'],
        [94, 'excellent chance'],
        [85, 'excellent chance'],
        [84, 'very good chance'],
        [75, 'very good chance'],
        [74, 'good chance'],
        [65, 'good chance'],
        [64, 'decent chance'],
        [55, 'decent chance'],
        [54, 'fair chance'],
        [45, 'fair chance'],
        [44, 'uncertain chance'],
        [35, 'uncertain chance'],
        [34, 'poor chance'],
        [25, 'poor chance'],
        [24, 'unlikely'],
        [15, 'unlikely'],
        [14, 'very unlikely'],
        [5, 'very unlikely'],
        [4, 'desperate'],
        [1, 'desperate'],
        [0, 'impossible'],
      ])('should return "%s" for %d%%', (percentage, expected) => {
        expect(translator.getQualitativeLabel(percentage)).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it('should clamp values above 100 to certain', () => {
        expect(translator.getQualitativeLabel(150)).toBe('certain');
      });

      it('should clamp negative values to impossible', () => {
        expect(translator.getQualitativeLabel(-10)).toBe('impossible');
      });

      it('should round floating point percentages', () => {
        expect(translator.getQualitativeLabel(54.7)).toBe('decent chance');
        expect(translator.getQualitativeLabel(54.4)).toBe('fair chance');
      });

      it('should handle NaN with warning and fallback', () => {
        expect(translator.getQualitativeLabel(NaN)).toBe('fair chance');
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should handle non-number with warning and fallback', () => {
        expect(translator.getQualitativeLabel('fifty')).toBe('fair chance');
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('translateForLlm', () => {
    describe('standard patterns', () => {
      it('should replace "(55% chance)" with "(decent chance)"', () => {
        const input = 'punch Goblin (55% chance)';
        expect(translator.translateForLlm(input)).toBe('punch Goblin (decent chance)');
      });

      it('should replace "(95% chance)" with "(certain)"', () => {
        const input = 'attack target (95% chance)';
        expect(translator.translateForLlm(input)).toBe('attack target (certain)');
      });

      it('should replace "(5% chance)" with "(very unlikely)"', () => {
        const input = 'risky move (5% chance)';
        expect(translator.translateForLlm(input)).toBe('risky move (very unlikely)');
      });
    });

    describe('modifier tags preservation', () => {
      it('should preserve modifier tags after chance', () => {
        const input = 'attack (55% chance) [flanking] [weapon-bonus]';
        expect(translator.translateForLlm(input)).toBe(
          'attack (decent chance) [flanking] [weapon-bonus]'
        );
      });

      it('should handle tags with no space after chance', () => {
        const input = 'attack (55% chance)[flanking]';
        expect(translator.translateForLlm(input)).toBe(
          'attack (decent chance)[flanking]'
        );
      });
    });

    describe('multiple patterns', () => {
      it('should handle multiple chance patterns in one string', () => {
        const input = 'attack (75% chance) or defend (45% chance)';
        expect(translator.translateForLlm(input)).toBe(
          'attack (very good chance) or defend (uncertain chance)'
        );
      });
    });

    describe('no-op cases', () => {
      it('should preserve text without chance patterns', () => {
        const input = 'walk to tavern';
        expect(translator.translateForLlm(input)).toBe('walk to tavern');
      });

      it('should return empty string for null input', () => {
        expect(translator.translateForLlm(null)).toBe('');
      });

      it('should return empty string for undefined input', () => {
        expect(translator.translateForLlm(undefined)).toBe('');
      });

      it('should return input if not a string', () => {
        expect(translator.translateForLlm(123)).toBe('');
      });
    });

    describe('case insensitivity', () => {
      it('should handle "Chance" with capital C', () => {
        const input = 'attack (55% Chance)';
        expect(translator.translateForLlm(input)).toBe('attack (decent chance)');
      });

      it('should handle "CHANCE" in all caps', () => {
        const input = 'attack (55% CHANCE)';
        expect(translator.translateForLlm(input)).toBe('attack (decent chance)');
      });
    });

    describe('whitespace variations', () => {
      it('should handle no space before "chance"', () => {
        const input = 'attack (55%chance)';
        // This won't match due to regex requiring space - document behavior
        expect(translator.translateForLlm(input)).toBe('attack (55%chance)');
      });

      it('should handle multiple spaces before "chance"', () => {
        const input = 'attack (55%  chance)';
        expect(translator.translateForLlm(input)).toBe('attack (decent chance)');
      });
    });
  });
});
```

### Integration Tests

**File**: `tests/integration/prompting/chanceTextTranslation.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import necessary fixtures and test utilities

describe('Chance Text Translation Integration', () => {
  describe('Full Pipeline: Action Discovery → LLM Prompt', () => {
    it('should show numeric chance in UI commandString', async () => {
      // Setup action with {chance} template
      // Run through action discovery
      // Verify commandString contains "(55% chance)"
    });

    it('should show qualitative label in LLM prompt format', async () => {
      // Setup action with {chance} template
      // Run through action discovery
      // Run through AIPromptContentProvider._formatSingleAction
      // Verify output contains "(decent chance)" not "(55% chance)"
    });

    it('should preserve modifier tags in LLM prompt', async () => {
      // Setup action with modifiers that add tags
      // Verify LLM prompt shows "(decent chance) [flanking]"
    });
  });

  describe('Edge Cases', () => {
    it('should handle action without chance template', async () => {
      // Setup action without {chance}
      // Verify no transformation occurs
    });

    it('should handle 0% chance actions', async () => {
      // Setup guaranteed-fail action
      // Verify LLM prompt shows "(impossible)"
    });

    it('should handle 100% chance actions', async () => {
      // Setup guaranteed-success action
      // Verify LLM prompt shows "(certain)"
    });
  });
});
```

### Update Existing Tests

**Files to update**:
- `tests/unit/prompting/AIPromptContentProvider.test.js` - Add chanceTextTranslator mock to constructor tests
- `tests/integration/combat/chanceCalculationService.integration.test.js` - Verify no regression

## Validation Criteria

### Acceptance Tests

- [ ] **UI Display**: Action buttons in game.html show "(55% chance)" format
- [ ] **LLM Prompt Preview**: "Prompt to LLM" button shows "(decent chance)" format
- [ ] **All 12 Tiers**: Each granularity tier correctly mapped
- [ ] **Boundary Values**: 0%, 5%, 95%, 100% correctly labeled
- [ ] **Modifier Tags**: Tags like `[flanking]` preserved after translation
- [ ] **No Regression**: Existing chance-based tests continue passing

### Quality Gates

- [ ] Unit test coverage ≥ 90% for ChanceTextTranslator
- [ ] All existing tests pass
- [ ] TypeScript types pass (`npm run typecheck`)
- [ ] ESLint passes on modified files
- [ ] Integration tests verify end-to-end flow

## Rollback Plan

If issues arise after deployment:

1. In `AIPromptContentProvider._formatSingleAction()`, remove the `translateForLlm()` call
2. The service can remain registered but unused
3. No schema changes need reverting

## Future Considerations

### Configuration Option

Consider adding a configuration flag:
```javascript
// In llm-config or similar
{
  "promptSettings": {
    "useQualitativeChanceLabels": true  // default true
  }
}
```

### Localization

If multi-language support is needed, the `CHANCE_LEVELS` array could be loaded from a configuration file or localization system.

### Custom Labels

Allow mods to override specific labels if narrative context requires different terminology (e.g., "trivial" instead of "certain" for a horror game).

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/prompting/services/ChanceTextTranslator.js` | **NEW** | Translation service with granularity scale |
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFY | Add `ChanceTextTranslator` token |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY | Register service, inject into AIPromptContentProvider |
| `src/prompting/AIPromptContentProvider.js` | MODIFY | Add dependency, use in `_formatSingleAction()` |
| `tests/unit/prompting/services/ChanceTextTranslator.test.js` | **NEW** | Comprehensive unit tests |
| `tests/integration/prompting/chanceTextTranslation.integration.test.js` | **NEW** | End-to-end integration tests |
| `tests/unit/prompting/AIPromptContentProvider.test.js` | MODIFY | Update constructor mocks |

## Implementation Order

1. Create `ChanceTextTranslator` service with full test coverage
2. Add DI token to `tokens-ai.js`
3. Register service in `aiRegistrations.js`
4. Add dependency to `AIPromptContentProvider` constructor
5. Modify `_formatSingleAction()` to use translator
6. Update existing AIPromptContentProvider tests with new mock
7. Add integration tests
8. Manual testing with "Prompt to LLM" button in game.html
