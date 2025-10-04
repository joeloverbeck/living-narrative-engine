import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import {
  FIX_TYPES,
  ERROR_PHASES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

/**
 * Lightweight game data repository used by the FixSuggestionEngine during integration tests.
 */
class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: componentId };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

/**
 * Creates a fully wired UnifiedErrorHandler harness using real collaborators.
 */
function createHarness() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const ritualAction = {
    id: 'ritual:invoke',
    name: 'Invoke Ritual',
    description: 'Summon arcane powers with a ritual circle.',
    scope: 'ritual:circle',
    template: 'invoke ritual with {target}',
    prerequisites: [
      { hasComponent: 'core:ritual_knowledge' },
      {
        and: [
          { hasComponent: 'core:focus' },
          {
            or: [
              { hasComponent: 'core:amulet' },
              { hasComponent: 'core:ring' },
            ],
          },
        ],
      },
    ],
    required_components: {
      actor: ['core:ritualist'],
    },
  };

  const actions = [...TestDataFactory.createBasicActions(), ritualAction];

  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-ritual',
      components: {
        'core:location': { value: 'moon-sanctum' },
        'core:state': { stance: 'kneeling' },
        'core:status': { mood: 'focused', stamina: 2 },
        'core:condition': { corruption: 'low' },
        'core:inventory': { items: ['silver dagger'] },
      },
    },
    {
      id: 'wanderer',
      components: {
        'core:status': { mood: 'lost' },
        'core:condition': { fatigue: 'extreme' },
      },
    },
  ]);

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new TestGameDataRepository(),
    actionIndex,
  });

  const actionErrorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const handler = new UnifiedErrorHandler({
    actionErrorContextBuilder,
    logger,
  });

  return {
    handler,
    logger,
    actions,
    entityManager,
  };
}

describe('UnifiedErrorHandler suggestion matrix integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('produces layered suggestions for validation errors with missing prerequisites', () => {
    const { handler, logger, actions } = harness;
    const actionDef = actions.find((action) => action.id === 'ritual:invoke');

    const validationError = new Error(
      "Missing component 'core:ritualist' on actor hero-ritual"
    );
    validationError.name = 'InvalidStateError';

    const trace = new TraceContext();
    trace.step('Validating ritual components', 'PrerequisiteService', {
      actorId: 'hero-ritual',
    });

    const context = handler.handleValidationError(validationError, {
      actorId: 'hero-ritual',
      actionDef,
      trace,
      additionalContext: { ritual: 'moonlight vigil' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error in validation phase',
      expect.objectContaining({
        actorId: 'hero-ritual',
        actionId: 'ritual:invoke',
        ritual: 'moonlight vigil',
      })
    );

    // Suggestions should include the missing ritualist component and prerequisite analysis
    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: FIX_TYPES.MISSING_COMPONENT,
          details: expect.objectContaining({ componentId: 'core:ritualist' }),
        }),
        expect.objectContaining({ type: FIX_TYPES.MISSING_PREREQUISITE }),
      ])
    );

    // Prerequisite analysis should flag the nested component requirements
    const prerequisiteFixes = context.suggestedFixes.filter(
      (fix) => fix.details?.source === 'prerequisite_analysis'
    );
    expect(prerequisiteFixes.length).toBeGreaterThan(0);
    const prerequisiteComponentIds = prerequisiteFixes.map(
      (fix) => fix.details.componentId
    );
    expect(prerequisiteComponentIds).toEqual(
      expect.arrayContaining(['core:focus'])
    );

    // Invalid state suggestions should be produced from the actor snapshot
    expect(
      context.suggestedFixes.filter(
        (fix) => fix.type === FIX_TYPES.INVALID_STATE
      ).length
    ).toBeGreaterThan(0);

    // Suggestions should be sorted by confidence descending
    const confidences = context.suggestedFixes.map((fix) => fix.confidence);
    const sorted = [...confidences].sort((a, b) => b - a);
    expect(confidences).toEqual(sorted);

    expect(context.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(context.actorSnapshot.id).toBe('hero-ritual');
    expect(context.environmentContext.phase).toBe(ERROR_PHASES.VALIDATION);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Analyzing error for fixes: Missing component')
    );
  });

  it('highlights scope and target issues for discovery errors without actor location', () => {
    const { handler, actions } = harness;
    const movementAction = actions.find(
      (action) => action.id === 'movement:go'
    );

    const discoveryError = new Error(
      'Scope resolution failed: target entity not found; no entities matched target filters'
    );
    discoveryError.name = 'ScopeResolutionError';

    const context = handler.handleDiscoveryError(discoveryError, {
      actorId: 'wanderer',
      actionDef: movementAction,
      additionalContext: { region: 'misty-halls' },
    });

    expect(context.phase).toBe(ERROR_PHASES.DISCOVERY);
    expect(context.additionalContext.stage).toBe('discovery');
    expect(context.environmentContext).toEqual(
      expect.objectContaining({
        phase: ERROR_PHASES.DISCOVERY,
        region: 'misty-halls',
      })
    );
    expect(context.actorSnapshot.location).toBe('none');

    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: FIX_TYPES.SCOPE_RESOLUTION }),
        expect.objectContaining({
          type: FIX_TYPES.INVALID_STATE,
          details: expect.objectContaining({
            suggestion: expect.stringContaining('valid location'),
          }),
        }),
        expect.objectContaining({ type: FIX_TYPES.INVALID_TARGET }),
      ])
    );
  });

  it('logs manual errors and builds fallback context when action data is missing', () => {
    const { handler, logger } = harness;
    const runtimeError = new Error('Unexpected issue with target selection');

    const context = handler.createContext({
      error: runtimeError,
      phase: ERROR_PHASES.EXECUTION,
      actionDef: null,
      actorId: 'hero-ritual',
      targetId: 'friend-1',
      additionalContext: { severity: 'critical' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error in execution phase',
      expect.objectContaining({
        actorId: 'hero-ritual',
        targetId: 'friend-1',
        severity: 'critical',
      })
    );

    expect(context.actionDefinition).toEqual({
      id: 'unknown',
      name: 'Unknown Action',
    });

    handler.logError('Custom diagnostics', new Error('manual failure'), {
      severity: 'low',
    });
    expect(logger.error).toHaveBeenCalledWith('Custom diagnostics', {
      error: 'manual failure',
      stack: expect.any(String),
      severity: 'low',
    });

    const simpleResponse = handler.createSimpleErrorResponse(
      new Error('fatal issue'),
      'User-facing message'
    );
    expect(simpleResponse).toEqual({
      success: false,
      error: 'User-facing message',
      details: 'fatal issue',
    });
  });
});
