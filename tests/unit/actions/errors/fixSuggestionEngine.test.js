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
  });
});
