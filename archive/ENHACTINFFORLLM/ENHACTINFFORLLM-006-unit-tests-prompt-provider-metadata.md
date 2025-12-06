# ENHACTINFFORLLM-006: Unit Tests for AIPromptContentProvider Action Metadata

## Summary

Create unit tests specifically for the action metadata formatting functionality added to AIPromptContentProvider.

## Prerequisites

- ENHACTINFFORLLM-004 must be completed (integration into AIPromptContentProvider)

## Files to Touch

- `tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify AIPromptContentProvider implementation
- DO NOT modify existing AIPromptContentProvider tests
- DO NOT create integration tests (that's ENHACTINFFORLLM-007)

## Implementation Details

### Test File Structure

**Note**: The mock structures below were corrected to match the actual interface requirements
discovered during implementation. Key corrections:

- `promptStaticContentService` method names match the actual interface
- `gameStateValidationService` uses `validate` method
- `characterDataXmlBuilder` uses `buildCharacterDataXml` method
- `actionCategorizationService` includes all required methods

```javascript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('AIPromptContentProvider - Action Metadata Formatting', () => {
  let provider;
  let mockLogger;
  let mockPromptStaticContentService;
  let mockPerceptionLogFormatter;
  let mockGameStateValidationService;
  let mockActionCategorizationService;
  let mockCharacterDataXmlBuilder;
  let mockModActionMetadataProvider;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    // Note: Method names must match actual IPromptStaticContentService interface
    mockPromptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn().mockReturnValue(''),
      getNc21ContentPolicyText: jest.fn().mockReturnValue(''),
      getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(''),
      getFinalLlmInstructionText: jest.fn().mockReturnValue(''),
    };

    mockPerceptionLogFormatter = {
      format: jest.fn().mockReturnValue([]),
    };

    // Note: Uses single `validate` method per actual interface
    mockGameStateValidationService = {
      validate: jest
        .fn()
        .mockReturnValue({ isValid: true, errorContent: null }),
    };

    // Note: All required methods from IActionCategorizationService
    mockActionCategorizationService = {
      extractNamespace: jest.fn(
        (actionId) => actionId.split(':')[0] || 'unknown'
      ),
      shouldUseGrouping: jest.fn(() => true),
      groupActionsByNamespace: jest.fn(),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
    };

    // Note: Method is `buildCharacterDataXml` not `build`
    mockCharacterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn().mockReturnValue('<character/>'),
    };

    mockModActionMetadataProvider = {
      getMetadataForMod: jest.fn(),
    };

    provider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: mockPromptStaticContentService,
      perceptionLogFormatter: mockPerceptionLogFormatter,
      gameStateValidationService: mockGameStateValidationService,
      actionCategorizationService: mockActionCategorizationService,
      characterDataXmlBuilder: mockCharacterDataXmlBuilder,
      modActionMetadataProvider: mockModActionMetadataProvider,
    });
  });

  describe('_formatCategorizedActions with metadata', () => {
    test('should include purpose and consider when in formatted output', () => {
      const actions = [
        {
          id: 'positioning:sit_down',
          command: 'sit down',
          description: 'Take a seat',
        },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'positioning',
        actionPurpose: 'Change body position and spatial relationships.',
        actionConsiderWhen: 'Getting closer or farther from someone.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Change body position');
      expect(result).toContain('**Consider when:** Getting closer');
    });

    test('should handle missing metadata gracefully (no Purpose/Consider lines)', () => {
      const actions = [
        { id: 'core:wait', command: 'wait', description: 'Wait' },
      ];
      const groupedMap = new Map([['core', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).not.toContain('**Consider when:**');
      expect(result).toContain('### CORE Actions');
    });

    test('should handle partial metadata (only purpose)', () => {
      const actions = [
        { id: 'items:pickup', command: 'pick up', description: 'Pick up item' },
      ];
      const groupedMap = new Map([['items', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'items',
        actionPurpose: 'Object manipulation.',
        actionConsiderWhen: undefined,
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Object manipulation.');
      expect(result).not.toContain('**Consider when:**');
    });

    test('should handle partial metadata (only consider when)', () => {
      const actions = [
        { id: 'affection:hug', command: 'hug', description: 'Hug someone' },
      ];
      const groupedMap = new Map([['affection', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'affection',
        actionPurpose: undefined,
        actionConsiderWhen: 'Showing tenderness.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).toContain('**Consider when:** Showing tenderness.');
    });

    test('should maintain backward compatibility when provider returns null', () => {
      // Note: Use `commandString` and `index` as required by _formatSingleAction
      const actions = [
        {
          id: 'test:action1',
          commandString: 'action1',
          description: 'Test action',
          index: 0,
        },
        {
          id: 'test:action2',
          commandString: 'action2',
          description: 'Another test',
          index: 1,
        },
      ];
      const groupedMap = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('### TEST Actions');
      expect(result).toContain('Command: "action1"');
      expect(result).toContain('Command: "action2"');
    });

    test('should include action count in header', () => {
      const actions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
        { id: 'positioning:stand', command: 'stand', description: 'Stand' },
        { id: 'positioning:walk', command: 'walk', description: 'Walk' },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('(3 actions)');
    });

    test('should format multiple namespaces with different metadata states', () => {
      const positioningActions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
      ];
      const coreActions = [
        { id: 'core:wait', command: 'wait', description: 'Wait' },
      ];
      const allActions = [...positioningActions, ...coreActions];

      const groupedMap = new Map([
        ['positioning', positioningActions],
        ['core', coreActions],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(
        groupedMap
      );
      mockModActionMetadataProvider.getMetadataForMod
        .mockReturnValueOnce({
          modId: 'positioning',
          actionPurpose: 'Position yourself.',
          actionConsiderWhen: 'When moving.',
        })
        .mockReturnValueOnce(null);

      const result = provider._formatCategorizedActions(allActions);

      expect(result).toContain('**Purpose:** Position yourself.');
      expect(result).toContain('### CORE Actions');
      // Core section should not have Purpose/Consider lines
      const coreSection = result.split('### CORE')[1];
      expect(coreSection).not.toContain('**Purpose:**');
    });
  });

  describe('constructor validation', () => {
    test('should throw when modActionMetadataProvider is missing', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLogger,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatter,
            gameStateValidationService: mockGameStateValidationService,
            actionCategorizationService: mockActionCategorizationService,
            characterDataXmlBuilder: mockCharacterDataXmlBuilder,
            modActionMetadataProvider: null,
          })
      ).toThrow();
    });

    test('should throw when modActionMetadataProvider lacks required method', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLogger,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatter,
            gameStateValidationService: mockGameStateValidationService,
            actionCategorizationService: mockActionCategorizationService,
            characterDataXmlBuilder: mockCharacterDataXmlBuilder,
            modActionMetadataProvider: {}, // Missing getMetadataForMod
          })
      ).toThrow();
    });
  });
});
```

## Status

**COMPLETED** - 2025-01-25

## Acceptance Criteria

### Tests That Must Pass

- `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js` passes ✅
- All 11 test cases pass ✅ (2 additional edge case tests added during implementation)
- No regression in existing AIPromptContentProvider tests ✅ (124 total tests pass)

### Invariants That Must Remain True

1. Tests are isolated from other AIPromptContentProvider tests
2. All mocks follow existing patterns in the codebase
3. Test naming follows "should..." convention
4. Tests verify both presence and absence of metadata lines
5. Constructor validation tests included

## Verification Steps

1. Run `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js --verbose`
2. Run `npm run test:unit -- --testPathPatterns="AIPromptContentProvider"` to verify no regression
3. Verify test file follows project conventions

## Outcome

### What was actually changed vs originally planned

**Originally Planned (9 tests)**:

- Tests for `_formatCategorizedActions` with metadata (7 tests)
- Constructor validation tests (2 tests)

**Actually Implemented (11 tests)**:

- All 9 originally planned tests ✅
- 2 additional edge case tests:
  - `should handle empty actionPurpose string as missing` - tests empty string handling
  - `should handle empty actionConsiderWhen string as missing` - tests empty string handling

### Discrepancies corrected in ticket

Before implementation, the following assumptions in the ticket template were corrected:

1. **Mock method names for `promptStaticContentService`**:
   - Old: `getTaskDefinition`, `getContentPolicy`, `getFinalInstructions`
   - Corrected: `getCoreTaskDescriptionText`, `getNc21ContentPolicyText`, `getFinalLlmInstructionText`

2. **Mock method for `gameStateValidationService`**:
   - Old: `validateEntity`, `validateActorData`
   - Corrected: `validate` (single method)

3. **Mock method for `characterDataXmlBuilder`**:
   - Old: `build`
   - Corrected: `buildCharacterDataXml`

4. **Missing methods in `actionCategorizationService` mock**:
   - Added: `extractNamespace`, `shouldUseGrouping`, `getSortedNamespaces`

5. **Action object properties**:
   - Old: `command` property
   - Corrected: `commandString` and `index` properties

6. **Test keyword convention**:
   - Old: `it()`
   - Corrected: `test()` (project convention)

### Files created

- `tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js` (NEW)

### Test results

- 11 tests pass
- 124 total AIPromptContentProvider tests pass (no regression)
