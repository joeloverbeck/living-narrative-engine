# ENHACTINFFORLLM-007: Integration Tests for Action Formatting with Metadata

## Summary
Create integration tests that verify the end-to-end behavior of action metadata formatting using the real DI container and data registry.

## Prerequisites
- All previous tickets (001-006) must be completed

## Files to Touch
- `tests/integration/prompting/actionFormattingWithMetadata.integration.test.js` (NEW FILE)

## Out of Scope
- DO NOT modify any source implementation files
- DO NOT modify existing test files
- DO NOT modify mod manifest JSON files

## Implementation Details

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Action Formatting with Metadata - Integration', () => {
  let container;
  let mockDataRegistry;
  let aiPromptContentProvider;

  // Sample manifest data for testing
  const positioningManifest = {
    id: 'positioning',
    version: '1.0.0',
    name: 'Positioning System',
    actionPurpose: 'Change body position and spatial relationships relative to others.',
    actionConsiderWhen: 'Getting closer or farther, changing posture, adjusting facing direction.',
  };

  const itemsManifest = {
    id: 'items',
    version: '1.0.0',
    name: 'Items System',
    actionPurpose: 'Interact with objects through pickup, examination, use, and transfer.',
    actionConsiderWhen: 'Managing inventory, examining objects, sharing items, using functional items.',
  };

  const coreManifest = {
    id: 'core',
    version: '1.0.0',
    name: 'Core System',
    // No actionPurpose or actionConsiderWhen - tests graceful degradation
  };

  beforeEach(async () => {
    // Create mock data registry that returns our test manifests
    mockDataRegistry = {
      get: jest.fn((type, id) => {
        if (type === 'mod_manifests') {
          const manifests = {
            positioning: positioningManifest,
            items: itemsManifest,
            core: coreManifest,
          };
          return manifests[id.toLowerCase()];
        }
        return undefined;
      }),
      store: jest.fn(),
      getAll: jest.fn(() => [positioningManifest, itemsManifest, coreManifest]),
    };

    // Set up minimal container with mocked data registry
    // Note: Actual implementation may require different setup based on existing test patterns
    container = new AppContainer();
    // ... container setup with mocked registry
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full integration with data registry', () => {
    it('should format actions with metadata from manifests', async () => {
      // This test verifies the full pipeline:
      // Actions → AIPromptContentProvider → ModActionMetadataProvider → DataRegistry → Manifest

      const sampleActions = [
        {
          id: 'positioning:sit_down',
          command: 'sit down on bench',
          description: 'Take a seat on available furniture',
        },
        {
          id: 'positioning:stand_up',
          command: 'stand up',
          description: 'Rise to standing position',
        },
      ];

      // The formatted output should include the metadata from positioningManifest
      const result = aiPromptContentProvider._formatCategorizedActions(sampleActions);

      expect(result).toContain('POSITIONING');
      expect(result).toContain('**Purpose:**');
      expect(result).toContain('Change body position');
      expect(result).toContain('**Consider when:**');
      expect(result).toContain('Getting closer or farther');
    });

    it('should verify output format matches expected LLM prompt structure', () => {
      const sampleActions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit down' },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(sampleActions);

      // Verify structure matches spec
      expect(result).toMatch(/^## Available Actions/);
      expect(result).toMatch(/### [A-Z]+ Actions \(\d+ actions?\)/);
      expect(result).toMatch(/\*\*Purpose:\*\*/);
      expect(result).toMatch(/\*\*Consider when:\*\*/);
    });

    it('should handle mixed scenario: some mods have metadata, others do not', () => {
      const mixedActions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
        { id: 'core:wait', command: 'wait', description: 'Wait' },
        { id: 'items:pickup', command: 'pick up', description: 'Pick up' },
      ];

      const result = aiPromptContentProvider._formatCategorizedActions(mixedActions);

      // Positioning and items should have metadata
      expect(result).toContain('**Purpose:**');

      // Core section should exist but without metadata
      const sections = result.split('###');
      const coreSection = sections.find(s => s.includes('CORE'));
      expect(coreSection).toBeDefined();
      // The core section specifically should not have Purpose after the header
      // (This is a more complex assertion - adjust based on actual output structure)
    });
  });

  describe('Performance', () => {
    it('should format 100 actions from multiple mods within acceptable time', () => {
      const manyActions = [];
      const mods = ['positioning', 'items', 'core'];

      for (let i = 0; i < 100; i++) {
        const mod = mods[i % mods.length];
        manyActions.push({
          id: `${mod}:action_${i}`,
          command: `action ${i}`,
          description: `Description for action ${i}`,
        });
      }

      const startTime = performance.now();
      const result = aiPromptContentProvider._formatCategorizedActions(manyActions);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should cache metadata lookups (verify single registry call per mod)', () => {
      const actions = [
        { id: 'positioning:sit', command: 'sit', description: 'Sit' },
        { id: 'positioning:stand', command: 'stand', description: 'Stand' },
        { id: 'positioning:walk', command: 'walk', description: 'Walk' },
      ];

      aiPromptContentProvider._formatCategorizedActions(actions);

      // Even with 3 positioning actions, metadata should only be fetched once
      const positioningCalls = mockDataRegistry.get.mock.calls.filter(
        call => call[0] === 'mod_manifests' && call[1] === 'positioning'
      );
      expect(positioningCalls.length).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty actions array', () => {
      const result = aiPromptContentProvider._formatCategorizedActions([]);

      expect(result).toBeDefined();
      // Should fall back to flat format or return empty
    });

    it('should handle actions from unknown mods gracefully', () => {
      const unknownModActions = [
        { id: 'unknown_mod:action1', command: 'action1', description: 'Test' },
      ];

      // Should not throw
      expect(() => {
        aiPromptContentProvider._formatCategorizedActions(unknownModActions);
      }).not.toThrow();
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:integration -- tests/integration/prompting/actionFormattingWithMetadata.integration.test.js` passes
- All test cases pass
- Performance test completes within time limit

### Invariants That Must Remain True
1. Tests use real (or properly mocked) DI container where feasible
2. Tests verify actual output format matches spec
3. Tests cover both happy path and edge cases
4. Performance tests have reasonable thresholds
5. Cache verification ensures efficiency

## Verification Steps
1. Run `npm run test:integration -- tests/integration/prompting/actionFormattingWithMetadata.integration.test.js --verbose`
2. Verify tests integrate with existing test infrastructure
3. Ensure no flaky tests (run multiple times)
