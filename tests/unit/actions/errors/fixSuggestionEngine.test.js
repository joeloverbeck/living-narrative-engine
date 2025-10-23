/**
 * @file Unit tests for FixSuggestionEngine.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { FIX_TYPES } from '../../../../src/actions/errors/actionErrorTypes.js';

describe('FixSuggestionEngine', () => {
  let engine;
  let mockLogger;
  let mockGameDataRepository;
  let mockActionIndex;

  const createActorSnapshot = (overrides = {}) => ({
    id: 'actor-1',
    location: 'room-7',
    components: {},
    ...overrides,
  });

  const createActionDefinition = (overrides = {}) => ({
    id: 'core:testAction',
    scope: 'adjacent',
    prerequisites: [],
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
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

  it('prioritizes missing component suggestions and extracts prerequisites', () => {
    const error = new Error('Missing component: core:inventory');
    const actionDef = createActionDefinition({
      id: undefined,
      prerequisites: [
        {
          all: [
            { hasComponent: 'core:inventory' },
            {
              any: [
                { hasComponent: 'core:amulet' },
                { hasComponent: 'core:inventory' },
                { hasComponent: 'core:shield' },
              ],
            },
            {
              metadata: {
                values: [
                  null,
                  'noop',
                  { nested: { hasComponent: 'core:mask' } },
                ],
              },
            },
          ],
        },
      ],
    });
    const actorSnapshot = createActorSnapshot({
      components: {
        'core:weapon': { equipped: true },
        'core:shield': { reinforced: true },
        'core:mask': { style: 'mystic' },
      },
    });

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    expect(suggestions).not.toHaveLength(0);
    expect(suggestions[0]).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'core:inventory',
        actorId: 'actor-1',
      }),
      confidence: 0.9,
    });

    const missingComponentFixes = suggestions.filter(
      (fix) => fix.type === FIX_TYPES.MISSING_COMPONENT
    );
    const uniqueComponentIds = new Set(
      missingComponentFixes.map((fix) => fix.details.componentId)
    );

    expect(uniqueComponentIds.has('core:inventory')).toBe(true);
    expect(uniqueComponentIds.has('core:amulet')).toBe(true);

    const prerequisiteFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.MISSING_PREREQUISITE
    );
    expect(prerequisiteFix).toMatchObject({
      type: FIX_TYPES.MISSING_PREREQUISITE,
      confidence: 0.75,
      details: expect.objectContaining({
        prerequisites: actionDef.prerequisites,
        actorComponents: ['core:weapon', 'core:shield', 'core:mask'],
      }),
    });

    const confidences = suggestions.map((fix) => fix.confidence);
    const sortedConfidences = [...confidences].sort((a, b) => b - a);
    expect(confidences).toEqual(sortedConfidences);
  });

  it('handles missing component errors without explicit identifiers', () => {
    const error = new Error('Actor missing component');
    const actionDef = createActionDefinition({
      prerequisites: [
        {
          all: [{ hasComponent: 'core:focus' }],
        },
      ],
    });
    const actorSnapshot = createActorSnapshot({
      components: {},
    });

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    const missingComponentFixes = suggestions.filter(
      (fix) => fix.type === FIX_TYPES.MISSING_COMPONENT
    );
    expect(missingComponentFixes).toHaveLength(1);
    expect(missingComponentFixes[0].details).toMatchObject({
      componentId: 'core:focus',
      source: 'prerequisite_analysis',
    });
  });

  it('skips prerequisite guidance when no prerequisites exist', () => {
    const error = new Error('Missing component: core:bag');
    const actionDef = createActionDefinition({
      prerequisites: [],
    });
    const actorSnapshot = createActorSnapshot({
      components: {},
    });

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'validation'
    );

    const prerequisiteFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.MISSING_PREREQUISITE
    );
    expect(prerequisiteFix).toBeUndefined();
  });

  it('combines invalid state, scope, and target guidance', () => {
    const error = new Error(
      'Invalid state detected - scope resolution failed: target missing'
    );
    const actionDef = createActionDefinition({ scope: 'global' });
    const actorSnapshot = createActorSnapshot({
      location: 'none',
      components: {
        'core:state': { status: 'incapacitated' },
        'core:status': { mood: 'angry' },
      },
    });

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    expect(suggestions).toHaveLength(5);

    const [highestConfidence] = suggestions;
    expect(highestConfidence).toMatchObject({
      type: FIX_TYPES.INVALID_STATE,
      details: expect.objectContaining({
        suggestion: 'Ensure actor has a valid location component',
      }),
      confidence: 0.9,
    });

    const scopeFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.SCOPE_RESOLUTION
    );
    expect(scopeFix).toMatchObject({
      details: expect.objectContaining({ scope: 'global' }),
      confidence: 0.8,
    });

    const invalidStateFixes = suggestions.filter(
      (fix) => fix.type === FIX_TYPES.INVALID_STATE
    );
    expect(invalidStateFixes).toHaveLength(3);

    const targetFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.INVALID_TARGET
    );
    expect(targetFix).toBeDefined();
    expect(targetFix.confidence).toBe(0.7);
  });

  it('provides scope guidance without location warnings when actor is positioned', () => {
    const error = new Error('Scope resolution failed - target entity not found');
    const actionDef = createActionDefinition({ scope: 'distant' });
    const actorSnapshot = createActorSnapshot({
      location: 'tower-top',
    });

    const suggestions = engine.suggestFixes(
      error,
      actionDef,
      actorSnapshot,
      'execution'
    );

    const scopeFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.SCOPE_RESOLUTION
    );
    expect(scopeFix).toBeDefined();
    expect(scopeFix.details).toMatchObject({ scope: 'distant' });

    const locationWarnings = suggestions.filter(
      (fix) =>
        fix.type === FIX_TYPES.INVALID_STATE &&
        fix.details?.suggestion === 'Ensure actor has a valid location component'
    );
    expect(locationWarnings).toHaveLength(0);
  });

  it('falls back to unknown action metadata when definitions are absent', () => {
    const error = new Error(
      'Missing component: core:torch - scope resolution failed, target not found'
    );
    const actorSnapshot = createActorSnapshot({
      location: 'tower-top',
      components: {},
    });

    const suggestions = engine.suggestFixes(
      error,
      undefined,
      actorSnapshot,
      'execution'
    );

    const missingComponent = suggestions.find(
      (fix) => fix.type === FIX_TYPES.MISSING_COMPONENT
    );
    expect(missingComponent).toMatchObject({
      details: expect.objectContaining({
        requiredBy: 'unknown',
      }),
    });

    const targetFix = suggestions.find(
      (fix) => fix.type === FIX_TYPES.INVALID_TARGET
    );
    expect(targetFix).toMatchObject({
      details: expect.objectContaining({ actionScope: 'none' }),
    });
  });

  it('returns an empty list when no error patterns match', () => {
    const error = { message: undefined, name: undefined };
    const actionDef = createActionDefinition();
    const actorSnapshot = createActorSnapshot();

    expect(
      engine.suggestFixes(error, actionDef, actorSnapshot, 'execution')
    ).toEqual([]);
  });
});
