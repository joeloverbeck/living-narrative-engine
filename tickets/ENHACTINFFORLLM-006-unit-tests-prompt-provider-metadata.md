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

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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

    mockPromptStaticContentService = {
      getTaskDefinition: jest.fn().mockReturnValue(''),
      getContentPolicy: jest.fn().mockReturnValue(''),
      getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(''),
      getFinalInstructions: jest.fn().mockReturnValue(''),
    };

    mockPerceptionLogFormatter = {
      format: jest.fn().mockReturnValue([]),
    };

    mockGameStateValidationService = {
      validateEntity: jest.fn().mockReturnValue({ isValid: true }),
      validateActorData: jest.fn().mockReturnValue({ isValid: true }),
    };

    mockActionCategorizationService = {
      groupActionsByNamespace: jest.fn(),
      formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
    };

    mockCharacterDataXmlBuilder = {
      build: jest.fn().mockReturnValue('<character/>'),
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
    it('should include purpose and consider when in formatted output', () => {
      const actions = [
        { id: 'positioning:sit_down', command: 'sit down', description: 'Take a seat' },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'positioning',
        actionPurpose: 'Change body position and spatial relationships.',
        actionConsiderWhen: 'Getting closer or farther from someone.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Change body position');
      expect(result).toContain('**Consider when:** Getting closer');
    });

    it('should handle missing metadata gracefully (no Purpose/Consider lines)', () => {
      const actions = [
        { id: 'core:wait', command: 'wait', description: 'Wait' },
      ];
      const groupedMap = new Map([['core', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).not.toContain('**Consider when:**');
      expect(result).toContain('### CORE Actions');
    });

    it('should handle partial metadata (only purpose)', () => {
      const actions = [
        { id: 'items:pickup', command: 'pick up', description: 'Pick up item' },
      ];
      const groupedMap = new Map([['items', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'items',
        actionPurpose: 'Object manipulation.',
        actionConsiderWhen: undefined,
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('**Purpose:** Object manipulation.');
      expect(result).not.toContain('**Consider when:**');
    });

    it('should handle partial metadata (only consider when)', () => {
      const actions = [
        { id: 'affection:hug', command: 'hug', description: 'Hug someone' },
      ];
      const groupedMap = new Map([['affection', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue({
        modId: 'affection',
        actionPurpose: undefined,
        actionConsiderWhen: 'Showing tenderness.',
      });

      const result = provider._formatCategorizedActions(actions);

      expect(result).not.toContain('**Purpose:**');
      expect(result).toContain('**Consider when:** Showing tenderness.');
    });

    it('should maintain backward compatibility when provider returns null', () => {
      const actions = [
        { id: 'test:action1', command: 'action1', description: 'Test action' },
        { id: 'test:action2', command: 'action2', description: 'Another test' },
      ];
      const groupedMap = new Map([['test', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('### TEST Actions');
      expect(result).toContain('action1');
      expect(result).toContain('action2');
    });

    it('should include action count in header', () => {
      const actions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
        { id: 'positioning:stand', command: 'stand', description: 'Stand' },
        { id: 'positioning:walk', command: 'walk', description: 'Walk' },
      ];
      const groupedMap = new Map([['positioning', actions]]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
      mockModActionMetadataProvider.getMetadataForMod.mockReturnValue(null);

      const result = provider._formatCategorizedActions(actions);

      expect(result).toContain('(3 actions)');
    });

    it('should format multiple namespaces with different metadata states', () => {
      const positioningActions = [{ id: 'positioning:sit', command: 'sit', description: 'Sit' }];
      const coreActions = [{ id: 'core:wait', command: 'wait', description: 'Wait' }];
      const allActions = [...positioningActions, ...coreActions];

      const groupedMap = new Map([
        ['positioning', positioningActions],
        ['core', coreActions],
      ]);
      mockActionCategorizationService.groupActionsByNamespace.mockReturnValue(groupedMap);
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
    it('should throw when modActionMetadataProvider is missing', () => {
      expect(() => new AIPromptContentProvider({
        logger: mockLogger,
        promptStaticContentService: mockPromptStaticContentService,
        perceptionLogFormatter: mockPerceptionLogFormatter,
        gameStateValidationService: mockGameStateValidationService,
        actionCategorizationService: mockActionCategorizationService,
        characterDataXmlBuilder: mockCharacterDataXmlBuilder,
        modActionMetadataProvider: null,
      })).toThrow();
    });

    it('should throw when modActionMetadataProvider lacks required method', () => {
      expect(() => new AIPromptContentProvider({
        logger: mockLogger,
        promptStaticContentService: mockPromptStaticContentService,
        perceptionLogFormatter: mockPerceptionLogFormatter,
        gameStateValidationService: mockGameStateValidationService,
        actionCategorizationService: mockActionCategorizationService,
        characterDataXmlBuilder: mockCharacterDataXmlBuilder,
        modActionMetadataProvider: {}, // Missing getMetadataForMod
      })).toThrow();
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js` passes
- All 9 test cases pass
- No regression in existing AIPromptContentProvider tests

### Invariants That Must Remain True
1. Tests are isolated from other AIPromptContentProvider tests
2. All mocks follow existing patterns in the codebase
3. Test naming follows "should..." convention
4. Tests verify both presence and absence of metadata lines
5. Constructor validation tests included

## Verification Steps
1. Run `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js --verbose`
2. Run `npm run test:unit -- --testPathPattern="AIPromptContentProvider"` to verify no regression
3. Verify test file follows project conventions
