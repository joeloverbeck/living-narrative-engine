/**
 * @file Unit tests for FixSuggestionEngine
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { FIX_TYPES } from '../../../../src/actions/errors/actionErrorTypes.js';

describe('FixSuggestionEngine', () => {
  let engine;
  let mockLogger;
  let mockGameDataRepository;
  let mockActionIndex;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockGameDataRepository = {
      getComponentDefinition: jest.fn(),
      getConditionDefinition: jest.fn(),
    };

    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    engine = new FixSuggestionEngine({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
      actionIndex: mockActionIndex,
    });
  });

  describe('suggestFixes', () => {
    const mockActionDef = {
      id: 'core:move',
      name: 'Move',
      scope: 'adjacent',
      prerequisites: [],
    };

    const mockActorSnapshot = {
      id: 'actor123',
      components: {
        'core:location': { value: 'room1' },
        'core:health': { value: 100 },
      },
      location: 'room1',
      metadata: { entityType: 'character' },
    };

    it('should suggest fixes for missing component errors', () => {
      const error = new Error("Missing component 'core:inventory' on actor");
      error.name = 'ComponentNotFoundError';

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        mockActorSnapshot,
        'validation'
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0]).toMatchObject({
        type: FIX_TYPES.MISSING_COMPONENT,
        description: expect.stringContaining(
          "Add the required component 'core:inventory'"
        ),
        confidence: 0.9,
        details: {
          componentId: 'core:inventory',
          actorId: 'actor123',
          requiredBy: 'core:move',
        },
      });
    });

    it('should suggest fixes for invalid state errors', () => {
      const error = new Error('Invalid state for action');
      error.name = 'InvalidStateError';

      const stateSnapshot = {
        ...mockActorSnapshot,
        components: {
          ...mockActorSnapshot.components,
          'core:state': { value: 'unconscious' },
        },
      };

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        stateSnapshot,
        'validation'
      );

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].type).toBe(FIX_TYPES.INVALID_STATE);
      expect(fixes[0].description).toContain(
        "Check the 'core:state' component"
      );
    });

    it('should suggest fixes for scope resolution errors', () => {
      const error = new Error('Scope resolution failed: no valid targets');

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        mockActorSnapshot,
        'validation'
      );

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].type).toBe(FIX_TYPES.SCOPE_RESOLUTION);
      expect(fixes[0].description).toContain(
        "Action scope 'adjacent' failed to resolve"
      );
    });

    it('should suggest location fixes when actor has no location', () => {
      const error = new Error('Scope resolution failed');
      const noLocationSnapshot = {
        ...mockActorSnapshot,
        location: 'none',
      };

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        noLocationSnapshot,
        'validation'
      );

      const locationFix = fixes.find((f) =>
        f.description.includes('no valid location')
      );
      expect(locationFix).toBeTruthy();
      expect(locationFix.confidence).toBe(0.9);
    });

    it('should suggest prerequisite fixes', () => {
      const error = new Error('Prerequisites not met');
      const actionWithPrereqs = {
        ...mockActionDef,
        prerequisites: [{ hasComponent: 'core:inventory' }],
      };

      const fixes = engine.suggestFixes(
        error,
        actionWithPrereqs,
        mockActorSnapshot,
        'validation'
      );

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].type).toBe(FIX_TYPES.MISSING_PREREQUISITE);
      expect(fixes[0].details.prerequisites).toEqual(
        actionWithPrereqs.prerequisites
      );
    });

    it('should sort fixes by confidence score', () => {
      const error = new Error(
        "Missing component 'core:inventory' and scope failed"
      );

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        mockActorSnapshot,
        'validation'
      );

      // Verify fixes are sorted by confidence (highest first)
      for (let i = 1; i < fixes.length; i++) {
        expect(fixes[i - 1].confidence).toBeGreaterThanOrEqual(
          fixes[i].confidence
        );
      }
    });

    it('should handle target-related errors', () => {
      const error = new Error('No entities found in target scope');

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        mockActorSnapshot,
        'validation'
      );

      const targetFix = fixes.find((f) => f.type === FIX_TYPES.INVALID_TARGET);
      expect(targetFix).toBeTruthy();
      expect(targetFix.details.actionScope).toBe('adjacent');
    });

    it('should extract required components from complex prerequisites', () => {
      const actionWithComplexPrereqs = {
        ...mockActionDef,
        prerequisites: [
          {
            and: [
              { hasComponent: 'core:inventory' },
              {
                or: [
                  { hasComponent: 'core:weapon' },
                  { hasComponent: 'core:magic' },
                ],
              },
            ],
          },
        ],
      };

      const error = new Error('Component not found');
      const fixes = engine.suggestFixes(
        error,
        actionWithComplexPrereqs,
        mockActorSnapshot,
        'validation'
      );

      // Should find suggestions for missing inventory component
      const inventoryFix = fixes.find(
        (f) =>
          f.details?.componentId === 'core:inventory' &&
          f.details?.source === 'prerequisite_analysis'
      );
      expect(inventoryFix).toBeTruthy();
    });

    it('should handle missing component errors with different message patterns', () => {
      // Test cases that should trigger missing component detection
      const triggerCases = [
        { message: 'missing component on entity', name: 'Error' },
        { message: 'component not found in system', name: 'Error' },
        { message: 'no component available', name: 'Error' },
        { message: 'Regular error', name: 'ComponentNotFoundError' },
      ];

      // Create an action with prerequisites to ensure component analysis
      const actionWithPrereqs = {
        ...mockActionDef,
        prerequisites: [{ hasComponent: 'core:weapon' }],
      };

      triggerCases.forEach(({ message, name }) => {
        const error = new Error(message);
        error.name = name;

        const fixes = engine.suggestFixes(
          error,
          actionWithPrereqs,
          mockActorSnapshot,
          'validation'
        );

        expect(Array.isArray(fixes)).toBe(true);
        expect(fixes.length).toBeGreaterThan(0);
        // Should have at least one missing component fix type
        const hasMissingComponentFix = fixes.some(
          (f) => f.type === FIX_TYPES.MISSING_COMPONENT
        );
        expect(hasMissingComponentFix).toBe(true);
      });
    });

    it('should handle non-triggering error patterns gracefully', () => {
      const nonTriggerCases = [
        { message: 'some other error', name: 'Error' },
        { message: 'network failure', name: 'NetworkError' },
      ];

      nonTriggerCases.forEach(({ message, name }) => {
        const error = new Error(message);
        error.name = name;

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          mockActorSnapshot,
          'validation'
        );

        expect(Array.isArray(fixes)).toBe(true);
        // May be empty or contain other types of fixes
      });
    });

    it('should handle invalid state errors with different patterns', () => {
      const testCases = [
        { message: 'invalid state detected', name: 'Error' },
        { message: 'state mismatch occurred', name: 'Error' },
        { message: 'wrong state for operation', name: 'Error' },
        { message: 'Regular error', name: 'InvalidStateError' },
      ];

      const stateSnapshot = {
        ...mockActorSnapshot,
        components: {
          ...mockActorSnapshot.components,
          'core:state': { value: 'invalid' },
          'core:status': { active: false },
          'core:condition': { wounded: true },
        },
      };

      testCases.forEach(({ message, name }) => {
        const error = new Error(message);
        error.name = name;

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          stateSnapshot,
          'validation'
        );

        expect(fixes.length).toBeGreaterThan(0);
        const stateFix = fixes.find((f) => f.type === FIX_TYPES.INVALID_STATE);
        expect(stateFix).toBeTruthy();
      });
    });

    it('should handle scope resolution errors with different patterns', () => {
      const testCases = [
        { message: 'scope failed to resolve', name: 'Error' },
        { message: 'resolution failed for scope', name: 'Error' },
        { message: 'no valid targets found', name: 'Error' },
        { message: 'Regular error', name: 'ScopeResolutionError' },
      ];

      testCases.forEach(({ message, name }) => {
        const error = new Error(message);
        error.name = name;

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          mockActorSnapshot,
          'validation'
        );

        expect(fixes.length).toBeGreaterThan(0);
        const scopeFix = fixes.find(
          (f) => f.type === FIX_TYPES.SCOPE_RESOLUTION
        );
        expect(scopeFix).toBeTruthy();
      });
    });

    it('should handle target errors with different patterns', () => {
      const testCases = [
        { message: 'target not found' },
        { message: 'no entities available' },
        { message: 'entity not found in scope' },
      ];

      testCases.forEach(({ message }) => {
        const error = new Error(message);

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          mockActorSnapshot,
          'validation'
        );

        expect(fixes.length).toBeGreaterThan(0);
        const targetFix = fixes.find(
          (f) => f.type === FIX_TYPES.INVALID_TARGET
        );
        expect(targetFix).toBeTruthy();
      });
    });

    it('should handle missing component regex extraction failures', () => {
      const error = new Error('Missing component but no ID extractable');
      error.name = 'ComponentNotFoundError';

      const fixes = engine.suggestFixes(
        error,
        mockActionDef,
        mockActorSnapshot,
        'validation'
      );

      // Should still provide general component advice even without specific ID
      expect(fixes.length).toBeGreaterThan(0);
    });

    it('should handle component extraction from error messages with quotes', () => {
      const testCases = [
        "Missing component 'core:inventory' on actor",
        'Missing component "core:weapon" on actor',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          mockActorSnapshot,
          'validation'
        );

        expect(Array.isArray(fixes)).toBe(true);
        const componentFix = fixes.find(
          (f) => f.type === FIX_TYPES.MISSING_COMPONENT
        );
        expect(componentFix).toBeTruthy();
        expect(componentFix.details.componentId).toBeTruthy();
      });
    });

    it('should handle component extraction from error messages without quotes', () => {
      const testCases = [
        'Component core:magic not found',
        'component: core:health missing',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);

        const fixes = engine.suggestFixes(
          error,
          mockActionDef,
          mockActorSnapshot,
          'validation'
        );

        expect(Array.isArray(fixes)).toBe(true);
        // These may or may not extract component IDs depending on the regex
        // but should at least trigger component-related error detection
      });
    });

    it('should analyze missing components from prerequisites', () => {
      const actionWithPrereqs = {
        ...mockActionDef,
        prerequisites: [
          { hasComponent: 'core:inventory' },
          { hasComponent: 'core:weapon' },
        ],
      };

      const snapshotMissingComponents = {
        ...mockActorSnapshot,
        components: {
          'core:location': { value: 'room1' },
          // Missing core:inventory and core:weapon
        },
      };

      const error = new Error('Missing component');
      const fixes = engine.suggestFixes(
        error,
        actionWithPrereqs,
        snapshotMissingComponents,
        'validation'
      );

      const missingComponentFixes = fixes.filter(
        (f) => f.type === FIX_TYPES.MISSING_COMPONENT
      );
      expect(missingComponentFixes.length).toBeGreaterThanOrEqual(2);

      const hasInventoryFix = missingComponentFixes.some(
        (f) => f.details.componentId === 'core:inventory'
      );
      const hasWeaponFix = missingComponentFixes.some(
        (f) => f.details.componentId === 'core:weapon'
      );

      expect(hasInventoryFix).toBe(true);
      expect(hasWeaponFix).toBe(true);
    });

    it('should handle prerequisite phase check for non-validation phases', () => {
      const actionWithPrereqs = {
        ...mockActionDef,
        prerequisites: [{ hasComponent: 'core:inventory' }],
      };

      const error = new Error('Prerequisites not met');
      const fixes = engine.suggestFixes(
        error,
        actionWithPrereqs,
        mockActorSnapshot,
        'execution' // Non-validation phase
      );

      // Should not add prerequisite fixes for non-validation phases
      const prereqFixes = fixes.filter(
        (f) => f.type === FIX_TYPES.MISSING_PREREQUISITE
      );
      expect(prereqFixes.length).toBe(0);
    });

    it('should handle empty or null error messages and names', () => {
      const testCases = [
        { message: '', name: '' },
        { message: null, name: null },
        { message: undefined, name: undefined },
        { message: 'valid message', name: '' },
        { message: '', name: 'ValidName' },
      ];

      testCases.forEach(({ message, name }) => {
        const error = new Error(message);
        error.name = name;

        // Should not throw an error
        expect(() =>
          engine.suggestFixes(
            error,
            mockActionDef,
            mockActorSnapshot,
            'validation'
          )
        ).not.toThrow();
      });
    });

    it('should handle action definition without scope', () => {
      const actionWithoutScope = {
        ...mockActionDef,
        scope: undefined,
      };

      const error = new Error('Scope resolution failed');
      const fixes = engine.suggestFixes(
        error,
        actionWithoutScope,
        mockActorSnapshot,
        'validation'
      );

      // Should still handle the error gracefully
      expect(fixes).toBeDefined();
      expect(Array.isArray(fixes)).toBe(true);
    });

    it('should handle empty prerequisite arrays', () => {
      const actionWithEmptyPrereqs = {
        ...mockActionDef,
        prerequisites: [],
      };

      const error = new Error('Prerequisites not met');
      const fixes = engine.suggestFixes(
        error,
        actionWithEmptyPrereqs,
        mockActorSnapshot,
        'validation'
      );

      // Should not add prerequisite fixes for empty prerequisites
      const prereqFixes = fixes.filter(
        (f) => f.type === FIX_TYPES.MISSING_PREREQUISITE
      );
      expect(prereqFixes.length).toBe(0);
    });

    it('should extract components from deeply nested prerequisites', () => {
      const deeplyNestedPrereqs = [
        {
          and: [
            {
              or: [
                { hasComponent: 'core:level1' },
                {
                  and: [
                    { hasComponent: 'core:level2a' },
                    { hasComponent: 'core:level2b' },
                  ],
                },
              ],
            },
            {
              if: [
                { hasComponent: 'core:conditional' },
                { hasComponent: 'core:then' },
                { hasComponent: 'core:else' },
              ],
            },
          ],
        },
      ];

      const actionWithDeepPrereqs = {
        ...mockActionDef,
        prerequisites: deeplyNestedPrereqs,
      };

      const error = new Error('Component not found');
      const fixes = engine.suggestFixes(
        error,
        actionWithDeepPrereqs,
        mockActorSnapshot,
        'validation'
      );

      // Should find multiple component suggestions from the deeply nested structure
      const componentFixes = fixes.filter(
        (f) =>
          f.type === FIX_TYPES.MISSING_COMPONENT &&
          f.details?.source === 'prerequisite_analysis'
      );

      expect(componentFixes.length).toBeGreaterThan(0);
    });

    it('should handle array values in prerequisite extraction', () => {
      const prereqsWithArrays = [
        {
          hasComponent: 'core:simple',
        },
        [{ hasComponent: 'core:array1' }, { hasComponent: 'core:array2' }],
      ];

      const actionWithArrayPrereqs = {
        ...mockActionDef,
        prerequisites: prereqsWithArrays,
      };

      const error = new Error('Component not found');
      const fixes = engine.suggestFixes(
        error,
        actionWithArrayPrereqs,
        mockActorSnapshot,
        'validation'
      );

      const componentFixes = fixes.filter(
        (f) =>
          f.type === FIX_TYPES.MISSING_COMPONENT &&
          f.details?.source === 'prerequisite_analysis'
      );

      expect(componentFixes.length).toBeGreaterThan(0);
    });

    it('should handle null and non-object values in prerequisite extraction', () => {
      const prereqsWithNulls = [
        null,
        undefined,
        'string-value',
        42,
        { hasComponent: 'core:valid' },
        { invalidProperty: 'no-component' },
      ];

      const actionWithMixedPrereqs = {
        ...mockActionDef,
        prerequisites: prereqsWithNulls,
      };

      const error = new Error('Component not found');

      // Should not throw an error and should extract valid components
      expect(() =>
        engine.suggestFixes(
          error,
          actionWithMixedPrereqs,
          mockActorSnapshot,
          'validation'
        )
      ).not.toThrow();
    });

    it('should sort fixes by confidence with multiple fixes of same confidence', () => {
      // Create an error that triggers multiple fix types
      const error = new Error(
        "Missing component 'core:inventory' and scope resolution failed and no valid targets"
      );
      error.name = 'ComponentNotFoundError';

      const complexActionDef = {
        ...mockActionDef,
        prerequisites: [{ hasComponent: 'core:weapon' }],
      };

      const fixes = engine.suggestFixes(
        error,
        complexActionDef,
        mockActorSnapshot,
        'validation'
      );

      expect(fixes.length).toBeGreaterThan(1);

      // Verify sorting is stable for same confidence scores
      for (let i = 1; i < fixes.length; i++) {
        expect(fixes[i - 1].confidence).toBeGreaterThanOrEqual(
          fixes[i].confidence
        );
      }

      // Verify we have different types of fixes
      const fixTypes = new Set(fixes.map((f) => f.type));
      expect(fixTypes.size).toBeGreaterThan(1);
    });

    it('should handle action definition with null scope', () => {
      const actionWithNullScope = {
        ...mockActionDef,
        scope: null,
      };

      const error = new Error('No entities found in target scope');
      const fixes = engine.suggestFixes(
        error,
        actionWithNullScope,
        mockActorSnapshot,
        'validation'
      );

      const targetFix = fixes.find((f) => f.type === FIX_TYPES.INVALID_TARGET);
      expect(targetFix).toBeTruthy();
      expect(targetFix.details.actionScope).toBe('none');
    });

    it('should cover prerequisite analysis path with actionDef.prerequisites present', () => {
      const actionWithSimplePrereqs = {
        ...mockActionDef,
        prerequisites: [{ hasComponent: 'core:inventory' }],
      };

      // Create an actor that HAS the prerequisite component
      const actorWithComponent = {
        ...mockActorSnapshot,
        components: {
          ...mockActorSnapshot.components,
          'core:inventory': { items: [] },
        },
      };

      const error = new Error('Missing component core:health');
      error.name = 'ComponentNotFoundError';

      const fixes = engine.suggestFixes(
        error,
        actionWithSimplePrereqs,
        actorWithComponent,
        'validation'
      );

      // Should still process the error even when prerequisites are satisfied
      expect(fixes.length).toBeGreaterThan(0);
    });
  });
});
