/**
 * @file Targeted integration tests for UnifiedErrorHandler using real collaborator implementations.
 * @description Ensures the handler produces actionable error contexts by exercising
 *              ActionErrorContextBuilder, FixSuggestionEngine, and ActionIndex together.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import {
  FIX_TYPES,
  ERROR_PHASES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, details = undefined) {
    this.debugLogs.push({ message, details });
  }

  info(message, details = undefined) {
    this.infoLogs.push({ message, details });
  }

  warn(message, details = undefined) {
    this.warnLogs.push({ message, details });
  }

  error(message, details = undefined) {
    this.errorLogs.push({ message, details });
  }
}

class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return {
      id: conditionId,
      description: `Condition ${conditionId}`,
      logic: { var: conditionId },
    };
  }
}

describe('UnifiedErrorHandler targeted real-module coverage', () => {
  let logger;
  let entityManager;
  let actionIndex;
  let fixSuggestionEngine;
  let builder;
  let handler;
  let actionDef;

  beforeEach(() => {
    logger = new RecordingLogger();
    entityManager = new SimpleEntityManager([
      {
        id: 'hero-1',
        type: 'character',
        components: {
          'core:location': { value: 'command-center' },
          'core:status': { state: 'wounded', stamina: 2 },
          'core:inventory': { items: [] },
        },
      },
      {
        id: 'friend-1',
        type: 'character',
        components: {
          'core:location': { value: 'command-center' },
          'core:position': { locationId: 'command-center' },
        },
      },
    ]);

    actionDef = {
      id: 'movement:go',
      name: 'Go Somewhere',
      command: 'go to {target}',
      scope: 'core:adjacent',
      prerequisites: [
        {
          hasComponent: 'core:position',
        },
      ],
    };

    const additionalActions = [
      actionDef,
      {
        id: 'support:cheer',
        name: 'Cheer Ally',
        command: 'cheer loudly',
      },
    ];

    actionIndex = new ActionIndex({
      logger,
      entityManager,
    });
    actionIndex.buildIndex(additionalActions);

    fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository: new TestGameDataRepository(),
      actionIndex,
    });

    builder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    handler = new UnifiedErrorHandler({
      actionErrorContextBuilder: builder,
      logger,
    });
  });

  it('builds actionable error context with suggestions when createContext is invoked', () => {
    const error = new Error(
      "Missing component 'core:position' on actor hero-1"
    );
    error.name = 'ComponentNotFoundError';

    const context = handler.createContext({
      error,
      phase: ERROR_PHASES.VALIDATION,
      actionDef,
      actorId: 'hero-1',
      targetId: 'friend-1',
      additionalContext: { severity: 'critical' },
    });

    expect(logger.errorLogs).toHaveLength(1);
    expect(logger.errorLogs[0]).toMatchObject({
      message: 'Error in validation phase',
      details: expect.objectContaining({
        actionId: 'movement:go',
        actorId: 'hero-1',
        targetId: 'friend-1',
        severity: 'critical',
      }),
    });

    expect(context.actionId).toBe('movement:go');
    expect(context.actorSnapshot.components['core:location']).toEqual({
      value: 'command-center',
    });
    expect(context.environmentContext.severity).toBe('critical');

    const fixTypes = context.suggestedFixes.map((fix) => fix.type);
    expect(fixTypes).toContain(FIX_TYPES.MISSING_COMPONENT);
  });

  it('createContext falls back to default metadata when optional fields are omitted', () => {
    const error = new Error('Execution failed');

    const context = handler.createContext({
      error,
      phase: ERROR_PHASES.EXECUTION,
      actionDef: null,
      actorId: 'hero-1',
    });

    expect(context.actionDefinition).toEqual({
      id: 'unknown',
      name: 'Unknown Action',
    });
    expect(context.targetId).toBeNull();
    expect(context).not.toHaveProperty('trace');
    expect(context.additionalContext).toEqual({});
    expect(logger.errorLogs.at(-1)?.details).toEqual(
      expect.objectContaining({
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
      })
    );
  });

  it('handleDiscoveryError enriches context with discovery stage metadata', () => {
    const error = new Error('Scope resolution failed');

    const result = handler.handleDiscoveryError(error, {
      actorId: 'hero-1',
      actionDef,
      trace: null,
      additionalContext: { hint: 'verify scope cache' },
    });

    expect(result.phase).toBe(ERROR_PHASES.DISCOVERY);
    expect(result.environmentContext.stage).toBe('discovery');
    expect(result.environmentContext.hint).toBe('verify scope cache');
  });

  it('handleDiscoveryError supports minimal context payloads', () => {
    const error = new Error('No candidates');

    const result = handler.handleDiscoveryError(error, {
      actorId: 'hero-1',
    });

    expect(result.actionDefinition).toEqual({
      id: 'unknown',
      name: 'Unknown Action',
    });
    expect(result.environmentContext.stage).toBe('discovery');
    expect(result.additionalContext).toEqual({ stage: 'discovery' });
  });

  it('handleExecutionError propagates target information and execution stage', () => {
    const error = new Error('Target command dispatch failed');

    const result = handler.handleExecutionError(error, {
      actorId: 'hero-1',
      actionDef,
      targetId: 'friend-1',
      trace: null,
      additionalContext: { dispatcher: 'command' },
    });

    expect(result.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(result.targetId).toBe('friend-1');
    expect(result.environmentContext.stage).toBe('execution');
    expect(result.environmentContext.dispatcher).toBe('command');
  });

  it('handleExecutionError defaults optional fields when omitted', () => {
    const error = new Error('Dispatch pipeline interrupted');

    const result = handler.handleExecutionError(error, {
      actorId: 'hero-1',
      actionDef,
    });

    expect(result.targetId).toBeNull();
    expect(result.environmentContext.stage).toBe('execution');
    expect(result.additionalContext).toEqual({ stage: 'execution' });
  });

  it('handleValidationError flags validation stage issues', () => {
    const error = new Error('Prerequisite mismatch');

    const result = handler.handleValidationError(error, {
      actorId: 'hero-1',
      actionDef,
      targetId: null,
      trace: null,
      additionalContext: { failedRule: 'hasComponent core:position' },
    });

    expect(result.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(result.environmentContext.stage).toBe('validation');
    expect(result.environmentContext.failedRule).toBe(
      'hasComponent core:position'
    );
  });

  it('handleProcessingError maps processing stages to execution phase', () => {
    const error = new Error('Directive queue overflow');

    const result = handler.handleProcessingError(error, {
      actorId: 'hero-1',
      stage: 'directive',
      actionDef,
      additionalContext: { queueDepth: 5 },
    });

    expect(result.phase).toBe(ERROR_PHASES.EXECUTION);
    expect(result.environmentContext.stage).toBe(
      'command_processing_directive'
    );
    expect(result.environmentContext.queueDepth).toBe(5);
  });

  it('logError forwards diagnostic details without building context', () => {
    const error = new Error('Non-critical failure');
    handler.logError('Transient issue detected', error, {
      component: 'observer',
    });

    expect(logger.errorLogs).toContainEqual({
      message: 'Transient issue detected',
      details: expect.objectContaining({
        error: 'Non-critical failure',
        component: 'observer',
      }),
    });
  });

  it('createSimpleErrorResponse returns a user-friendly payload', () => {
    const error = new Error('Failure detail');
    const simple = handler.createSimpleErrorResponse(
      error,
      'Please retry the command'
    );

    expect(simple).toEqual({
      success: false,
      error: 'Please retry the command',
      details: 'Failure detail',
    });
  });

  it('throws when constructed without an ActionErrorContextBuilder dependency', () => {
    expect(() => {
      return new UnifiedErrorHandler({ logger });
    }).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');
  });

  it('throws when constructed without a logger dependency', () => {
    expect(() => {
      return new UnifiedErrorHandler({
        actionErrorContextBuilder: builder,
      });
    }).toThrow('UnifiedErrorHandler requires logger');
  });
});
