/**
 * @file High coverage integration tests for UnifiedErrorHandler.
 * @description Wires the handler to real ActionErrorContextBuilder and FixSuggestionEngine
 *              instances to validate end-to-end error context creation without relying on
 *              mocked collaborators.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

class CapturingLogger {
  constructor() {
    this.errorRecords = [];
    this.warnRecords = [];
    this.infoRecords = [];
    this.debugRecords = [];
  }

  error(message, context) {
    this.errorRecords.push({ message, context });
  }

  warn(message, context) {
    this.warnRecords.push({ message, context });
  }

  info(message, context) {
    this.infoRecords.push({ message, context });
  }

  debug(message, context) {
    this.debugRecords.push({ message, context });
  }

  group() {}
  groupCollapsed() {}
  groupEnd() {}
  table() {}
}

class InMemoryEntityManager {
  constructor(entities) {
    this.entities = new Map(entities.map((entity) => [entity.id, entity]));
  }

  getEntityInstance(entityId) {
    return this.entities.get(entityId) || null;
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.entities.get(entityId);
    return entity ? Object.keys(entity.components) : [];
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    return entity ? (entity.components[componentId] ?? null) : null;
  }
}

class InMemoryGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

class StaticActionIndex {
  constructor(actions) {
    this.actions = actions;
  }

  getCandidateActions() {
    return this.actions;
  }
}

describe('UnifiedErrorHandler high coverage integration', () => {
  let logger;
  let entityManager;
  let handler;
  let actionDefinition;
  let actorId;
  let targetId;

  beforeEach(() => {
    logger = new CapturingLogger();

    actorId = 'actor:artisan';
    targetId = 'entity:friend';

    const actorEntity = {
      id: actorId,
      type: 'npc',
      components: {
        'core:location': { value: 'bazaar' },
        'core:inventory': {
          items: Array.from({ length: 150 }, (_, index) => `item-${index}`),
        },
        'core:status': { mood: 'worried', stamina: 3 },
      },
    };

    const targetEntity = {
      id: targetId,
      type: 'npc',
      components: {
        'core:location': { value: 'bazaar' },
        'core:position': { locationId: 'bazaar' },
      },
    };

    entityManager = new InMemoryEntityManager([actorEntity, targetEntity]);

    const actions = [
      {
        id: 'social:befriend',
        name: 'Befriend Ally',
        command: 'befriend',
        prerequisites: [
          {
            all: [
              { hasComponent: 'core:friend' },
              { hasComponent: 'core:trustworthy' },
            ],
          },
        ],
      },
    ];

    const actionIndex = new StaticActionIndex(actions);

    const fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository: new InMemoryGameDataRepository(),
      actionIndex,
    });

    const builder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    handler = new UnifiedErrorHandler({
      actionErrorContextBuilder: builder,
      logger,
    });

    actionDefinition = actions[0];
  });

  it('creates rich validation error context with suggestions and sanitized snapshots', () => {
    const validationError = new Error(
      "Invalid state: missing component 'core:friend' on actor"
    );
    validationError.name = 'ComponentNotFoundError';

    const trace = {
      logs: [
        {
          type: 'step',
          message: 'Validating prerequisites',
          source: 'PrerequisiteEvaluationStage',
          data: { input: { actorId }, output: { success: false } },
          timestamp: 1,
        },
        {
          type: 'failure',
          message: 'Missing component core:friend',
          source: 'ComponentFilteringStage',
          data: { componentId: 'core:friend' },
          timestamp: 5,
        },
      ],
    };

    const additionalContext = { requestId: 'req-42' };

    const context = handler.handleValidationError(validationError, {
      actorId,
      actionDef: actionDefinition,
      targetId,
      trace,
      additionalContext,
    });

    expect(context.actionId).toBe(actionDefinition.id);
    expect(context.actorId).toBe(actorId);
    expect(context.targetId).toBe(targetId);
    expect(context.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(context.additionalContext).toEqual(
      expect.objectContaining(additionalContext)
    );
    expect(context.evaluationTrace.steps).toHaveLength(2);
    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: FIX_TYPES.MISSING_COMPONENT }),
        expect.objectContaining({ type: FIX_TYPES.INVALID_STATE }),
      ])
    );

    const inventorySnapshot =
      context.actorSnapshot.components['core:inventory'];
    expect(Array.isArray(inventorySnapshot.items)).toBe(true);
    const truncationMarker =
      inventorySnapshot.items[inventorySnapshot.items.length - 1];
    expect(truncationMarker).toEqual(
      expect.objectContaining({
        _truncated: true,
        _originalLength: 150,
      })
    );

    expect(logger.errorRecords[0]).toEqual(
      expect.objectContaining({
        message: `Error in ${ERROR_PHASES.VALIDATION} phase`,
        context: expect.objectContaining({
          actionId: actionDefinition.id,
          actorId,
          targetId,
          phase: ERROR_PHASES.VALIDATION,
          requestId: 'req-42',
        }),
      })
    );
  });

  it('supports discovery, execution, processing flows and utility helpers', () => {
    const discoveryContext = handler.handleDiscoveryError(
      new Error('No actions available'),
      { actorId }
    );

    expect(discoveryContext.actionDefinition.name).toBe('Unknown Action');
    expect(discoveryContext.targetId).toBeNull();
    expect(discoveryContext.phase).toBe(ERROR_PHASES.DISCOVERY);

    const executionContext = handler.handleExecutionError(
      new Error('Command failed'),
      {
        actorId,
        actionDef: actionDefinition,
        targetId,
        additionalContext: { step: 'dispatch' },
      }
    );

    expect(executionContext.targetId).toBe(targetId);
    expect(executionContext.additionalContext).toEqual(
      expect.objectContaining({ stage: 'execution', step: 'dispatch' })
    );

    const processingContext = handler.handleProcessingError(
      new Error('Interpreter blew up'),
      {
        actorId,
        stage: 'interpretation',
        actionDef: actionDefinition,
        additionalContext: { subsystem: 'parser' },
      }
    );

    expect(processingContext.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(processingContext.additionalContext).toEqual(
      expect.objectContaining({
        stage: 'command_processing_interpretation',
        subsystem: 'parser',
      })
    );

    handler.logError('Manual log', new Error('Minor issue'), { scope: 'aux' });
    expect(logger.errorRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Manual log' }),
      ])
    );

    const simpleResponse = handler.createSimpleErrorResponse(
      new Error('catastrophic failure'),
      'Unable to complete the request'
    );

    expect(simpleResponse).toEqual({
      success: false,
      error: 'Unable to complete the request',
      details: 'catastrophic failure',
    });
  });
});
