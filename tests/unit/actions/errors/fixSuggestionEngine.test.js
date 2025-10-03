/**
 * @file Unit tests for the FixSuggestionEngine.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { FIX_TYPES } from '../../../../src/actions/errors/actionErrorTypes.js';

/**
 * Helper to create a standard action definition for tests.
 *
 * @param {Partial<import('../../../../src/data/gameDataRepository.js').ActionDefinition>} overrides
 * @returns {import('../../../../src/data/gameDataRepository.js').ActionDefinition}
 */
function createActionDefinition(overrides = {}) {
  return {
    id: 'core:test-action',
    name: 'Test Action',
    scope: 'adjacent',
    prerequisites: [],
    ...overrides,
  };
}

/**
 * Helper to create a standard actor snapshot for tests.
 *
 * @param {Partial<import('../../../../src/actions/errors/actionErrorTypes.js').ActorSnapshot>} overrides
 * @returns {import('../../../../src/actions/errors/actionErrorTypes.js').ActorSnapshot}
 */
function createActorSnapshot(overrides = {}) {
  const base = {
    id: 'actor-1',
    components: {},
    location: 'station',
    metadata: {},
  };

  return {
    ...base,
    ...overrides,
    components: {
      ...base.components,
      ...(overrides.components || {}),
    },
  };
}

describe('FixSuggestionEngine', () => {
  let engine;
  let mockLogger;
  let mockRepository;
  let mockActionIndex;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockRepository = {
      getComponentDefinition: jest.fn(),
      getConditionDefinition: jest.fn(),
    };

    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    engine = new FixSuggestionEngine({
      logger: mockLogger,
      gameDataRepository: mockRepository,
      actionIndex: mockActionIndex,
    });
  });

  it('collects missing component suggestions from error details and prerequisites', () => {
    const actionDef = createActionDefinition({
      prerequisites: [
        { hasComponent: 'core:inventory' },
        {
          all: [
            { hasComponent: 'core:equipment' },
            { any: [{ hasComponent: 'core:focus' }] },
          ],
        },
        {
          wrapper: { hasComponent: 'core:resilience' },
        },
        'core:manual',
      ],
    });

    const actorSnapshot = createActorSnapshot({
      components: {
        'core:equipment': { equipped: true },
      },
    });

    const error = new Error("Missing component 'core:inventory' on actor");

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions.length).toBeGreaterThan(0);

    // Highest confidence suggestion should come from the direct error message match.
    expect(suggestions[0]).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      confidence: 0.9,
      details: expect.objectContaining({
        componentId: 'core:inventory',
        requiredBy: actionDef.id,
      }),
    });

    const prerequisiteFixes = suggestions.filter(
      (fix) => fix.details?.source === 'prerequisite_analysis'
    );

    expect(prerequisiteFixes).toHaveLength(3);
    expect(prerequisiteFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          confidence: 0.8,
          details: expect.objectContaining({ componentId: 'core:inventory' }),
        }),
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          confidence: 0.8,
          details: expect.objectContaining({ componentId: 'core:focus' }),
        }),
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          confidence: 0.8,
          details: expect.objectContaining({ componentId: 'core:resilience' }),
        }),
      ])
    );

    // Ensure components that are present are not suggested as missing.
    const componentIds = prerequisiteFixes.map((fix) => fix.details.componentId);
    expect(componentIds).not.toContain('core:equipment');

    // Verify confidence sorting order (highest confidence first).
    for (let i = 1; i < suggestions.length; i += 1) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
        suggestions[i].confidence
      );
    }
  });

  it('falls back to dependency analysis when error name indicates a missing component', () => {
    const actionDef = createActionDefinition({
      prerequisites: [{ hasComponent: 'core:mind' }],
    });

    const actorSnapshot = createActorSnapshot();

    const error = new Error('Action failed unexpectedly');
    error.name = 'ComponentNotFoundError';

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          confidence: 0.8,
          details: expect.objectContaining({
            componentId: 'core:mind',
            source: 'prerequisite_analysis',
          }),
        }),
      ])
    );
  });

  it('creates invalid state suggestions for available state components', () => {
    const actionDef = createActionDefinition({ scope: undefined });
    const actorSnapshot = createActorSnapshot({
      components: {
        'core:state': { status: 'knocked_out' },
        'core:status': { mood: 'angry' },
      },
    });

    const error = new Error('State mismatch occurred');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    const invalidStateFixes = suggestions.filter(
      (fix) => fix.type === FIX_TYPES.INVALID_STATE
    );

    expect(invalidStateFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: 0.7,
          details: expect.objectContaining({
            componentId: 'core:state',
            currentValue: actorSnapshot.components['core:state'],
          }),
        }),
        expect.objectContaining({
          confidence: 0.7,
          details: expect.objectContaining({ componentId: 'core:status' }),
        }),
      ])
    );

    const inspectedComponents = invalidStateFixes.map(
      (fix) => fix.details.componentId
    );
    expect(inspectedComponents).not.toContain('core:condition');
  });

  it('adds scope resolution and location guidance when targets cannot be resolved', () => {
    const actionDef = createActionDefinition({ scope: 'adjacent' });
    const actorSnapshot = createActorSnapshot({ location: 'none' });

    const error = new Error('Resolution failed: no valid targets available');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.SCOPE_RESOLUTION,
          confidence: 0.8,
          details: expect.objectContaining({ scope: 'adjacent' }),
        }),
        expect.objectContaining({
          type: FIX_TYPES.INVALID_STATE,
          confidence: 0.9,
          details: expect.objectContaining({
            suggestion: 'Ensure actor has a valid location component',
          }),
        }),
        expect.objectContaining({
          type: FIX_TYPES.INVALID_TARGET,
          confidence: 0.7,
          details: expect.objectContaining({ actionScope: 'adjacent' }),
        }),
      ])
    );

    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(
      suggestions[1].confidence
    );
    expect(suggestions[1].confidence).toBeGreaterThanOrEqual(
      suggestions[2].confidence
    );
  });

  it('omits scope-specific fixes when the action definition lacks scope information', () => {
    const actionDef = createActionDefinition({ scope: undefined });
    const actorSnapshot = createActorSnapshot();

    const error = new Error('Scope resolution failed');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual([]);
  });

  it('provides prerequisite guidance during validation failures', () => {
    const prerequisites = [{ check: 'custom_validation_step' }];
    const actionDef = createActionDefinition({
      scope: undefined,
      prerequisites,
    });

    const actorSnapshot = createActorSnapshot({
      components: {
        'core:state': { value: 'ready' },
      },
    });

    const error = new Error('Validation phase failed');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_PREREQUISITE,
          confidence: 0.75,
          details: expect.objectContaining({
            prerequisites,
            actorComponents: ['core:state'],
          }),
        }),
      ])
    );
  });

  it('offers guidance for target resolution errors', () => {
    const actionDef = createActionDefinition({ scope: 'global' });
    const actorSnapshot = createActorSnapshot({ location: 'plaza' });

    const error = new Error('Entity not found for target selection');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        type: FIX_TYPES.INVALID_TARGET,
        confidence: 0.7,
        details: expect.objectContaining({
          actionScope: 'global',
          actorLocation: 'plaza',
        }),
      }),
    ]);
  });

  it('handles missing error messages by relying on error names', () => {
    const actionDef = createActionDefinition({ scope: undefined });
    const actorSnapshot = createActorSnapshot({
      components: {
        'core:state': { value: 'asleep' },
      },
    });

    const error = new Error();
    error.message = undefined;
    error.name = 'InvalidStateError';

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.INVALID_STATE,
          details: expect.objectContaining({ componentId: 'core:state' }),
        }),
      ])
    );
  });

  it('returns fallback identifiers when the action definition is missing', () => {
    const error = new Error('Missing component: core:inventory');
    error.name = undefined;

    const actorSnapshot = createActorSnapshot();

    const suggestions = engine.suggestFixes(
      error,
      undefined,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        type: FIX_TYPES.MISSING_COMPONENT,
        confidence: 0.9,
        details: expect.objectContaining({
          componentId: 'core:inventory',
          requiredBy: 'unknown',
        }),
      }),
    ]);
  });

  it('returns scope resolution guidance without location warnings when location is valid', () => {
    const actionDef = createActionDefinition();
    const actorSnapshot = createActorSnapshot({ location: 'market' });

    const error = new Error('Scope resolution failed');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        type: FIX_TYPES.SCOPE_RESOLUTION,
        details: expect.objectContaining({
          scope: actionDef.scope,
          actorLocation: 'market',
        }),
      }),
    ]);
  });

  it('uses a default scope label when resolving target errors without scope information', () => {
    const actionDef = createActionDefinition({ scope: undefined });
    const actorSnapshot = createActorSnapshot({ location: 'forest' });

    const error = new Error('Target entity not found');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        type: FIX_TYPES.INVALID_TARGET,
        details: expect.objectContaining({
          actionScope: 'none',
          actorLocation: 'forest',
        }),
      }),
    ]);
  });

  it('reports unknown identifiers when prerequisite validation lacks an action id', () => {
    const actionDef = createActionDefinition({
      id: undefined,
      scope: undefined,
      prerequisites: [{ hasComponent: 'core:inventory' }],
    });

    const actorSnapshot = createActorSnapshot();
    const error = new Error('Prerequisites failed');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    const prereqFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.MISSING_PREREQUISITE
    );

    expect(prereqFix).toBeDefined();
    expect(prereqFix.description).toContain("Action 'unknown' has prerequisites");
  });

  it('does not add prerequisite fixes when no prerequisites are defined', () => {
    const actionDef = createActionDefinition({ scope: undefined, prerequisites: [] });
    const actorSnapshot = createActorSnapshot();

    const error = new Error('Validation failed');

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    expect(suggestions).toEqual([]);
  });
});
