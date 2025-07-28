/**
 * @file Unit tests for CharacterConceptsManagerController event dispatch patterns
 * Tests the fix for event dispatch issues identified in error logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

describe('CharacterConceptsManagerController - Event Dispatch Patterns Fix', () => {
  let mockEventBus;

  beforeEach(() => {
    // Mock event bus to test dispatch patterns
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Dispatch Code Pattern Analysis', () => {
    it('should verify correct event dispatch pattern is used in source code', async () => {
      // Import the source file as text to analyze
      const fs = await import('fs');
      const path = await import('path');

      const controllerPath = path.resolve(
        'src/domUI/characterConceptsManagerController.js'
      );
      const sourceCode = fs.readFileSync(controllerPath, 'utf8');

      // Verify the old pattern is NOT present
      const oldPattern = /this\.#eventBus\.dispatch\(\s*\{\s*type:/g;
      const oldMatches = sourceCode.match(oldPattern);

      expect(oldMatches).toBeNull();

      // Verify the new pattern IS present
      const newPattern = /this\.#eventBus\.dispatch\(['"]\w+:[^"']+['"],\s*\{/g;
      const newMatches = sourceCode.match(newPattern);

      expect(newMatches).not.toBeNull();
      expect(newMatches.length).toBeGreaterThan(0);
    });

    it('should verify no object with type property is passed to dispatch', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const controllerPath = path.resolve(
        'src/domUI/characterConceptsManagerController.js'
      );
      const sourceCode = fs.readFileSync(controllerPath, 'utf8');

      // Check that no dispatch calls use the old {type: 'event', payload: data} pattern
      const badPattern = /dispatch\(\s*\{\s*type:\s*['"][^'"]+['"]/g;
      const badMatches = sourceCode.match(badPattern);

      expect(badMatches).toBeNull();
    });

    it('should verify all event names use colon-separated format', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const controllerPath = path.resolve(
        'src/domUI/characterConceptsManagerController.js'
      );
      const sourceCode = fs.readFileSync(controllerPath, 'utf8');

      // Extract all event names from dispatch calls
      const dispatchPattern = /this\.#eventBus\.dispatch\(['"]([\w:-]+)['"]/g;
      const matches = [...sourceCode.matchAll(dispatchPattern)];

      expect(matches.length).toBeGreaterThan(0);

      matches.forEach((match) => {
        const eventName = match[1];
        // Verify event name format is namespace:category:action or category:action
        expect(eventName).toMatch(/^([a-z]+:)?[a-z]+:[a-z-]+$/);
      });
    });

    it('should verify specific expected events are dispatched with correct names', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const controllerPath = path.resolve(
        'src/domUI/characterConceptsManagerController.js'
      );
      const sourceCode = fs.readFileSync(controllerPath, 'utf8');

      const expectedEvents = [
        'core:statistics_updated',
        'core:ui_modal_opened',
        'core:ui_modal_closed',
        'core:ui_search_performed',
        'core:ui_search_cleared',
      ];

      expectedEvents.forEach((eventName) => {
        const eventPattern = new RegExp(
          `this\\.#eventBus\\.dispatch\\(['"']${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"']`,
          'g'
        );
        const matches = sourceCode.match(eventPattern);

        expect(matches).not.toBeNull();
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('should verify event dispatch follows proper parameter structure', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const controllerPath = path.resolve(
        'src/domUI/characterConceptsManagerController.js'
      );
      const sourceCode = fs.readFileSync(controllerPath, 'utf8');

      // Check for dispatch calls with two parameters: string eventName, object payload
      const correctPattern =
        /this\.#eventBus\.dispatch\(['"]\w+:[^"']+['"],\s*[{[][\s\S]*?[}\]]\s*\);/g;
      const correctMatches = sourceCode.match(correctPattern);

      expect(correctMatches).not.toBeNull();
      expect(correctMatches.length).toBeGreaterThan(0);

      // Each correct match should have exactly 2 parameters
      correctMatches.forEach((match) => {
        // Extract parameters within the dispatch call
        const paramsMatch = match.match(/dispatch\((.*)\)/s);
        if (paramsMatch) {
          const params = paramsMatch[1];
          // Should have a comma separating the event name and payload
          expect(params).toMatch(/['"][^'"]+['"],\s*[{[][\s\S]*[}\]]/);
        }
      });
    });
  });
});
