/**
 * @file Additional coverage tests for contextAssembler utilities.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as contextAssembler from '../../../src/logic/contextAssembler.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

// Extract functions under test for convenience
const {
  createEntityContext,
  populateParticipant,
  createJsonLogicContext,
  createNestedExecutionContext,
  createEvaluationContext,
} = contextAssembler;

jest.mock('../../../src/logic/componentAccessor.js', () => ({
  createComponentAccessor: jest.fn(),
}));

/**
 * Creates a mock logger implementing the subset of ILogger methods used by the module.
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
}

/**
 * Creates a mock entity manager with optional behaviour overrides.
 *
 * @param {object} overrides
 */
function createEntityManagerMock(overrides = {}) {
  return {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
    ...overrides,
  };
}

describe('contextAssembler utility helpers', () => {
  const accessorFactory = /** @type {jest.Mock} */ (createComponentAccessor);

  beforeEach(() => {
    accessorFactory.mockImplementation((entityId) => ({ accessorFor: entityId }));
  });

  describe('createEntityContext', () => {
    it('builds an entity context using the component accessor factory', () => {
      const entityManager = createEntityManagerMock();
      const logger = createLoggerMock();

      const context = createEntityContext('actor-1', entityManager, logger);

      expect(context).toEqual({
        id: 'actor-1',
        components: { accessorFor: 'actor-1' },
      });
      expect(accessorFactory).toHaveBeenCalledWith('actor-1', entityManager, logger);
    });
  });

  describe('populateParticipant', () => {
    it('populates the requested field when the entity exists', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn().mockReturnValue({ id: 'a-1' }),
      });
      const evaluationContext = { actor: null };

      populateParticipant('actor', 'a-1', evaluationContext, entityManager, logger);

      expect(evaluationContext.actor).toEqual({
        id: 'a-1',
        components: { accessorFor: 'a-1' },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Found actor entity [a-1]. Creating context entry.'
      );
    });

    it('logs a warning when an entity is not found', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn().mockReturnValue(undefined),
      });
      const evaluationContext = { target: null };

      populateParticipant('target', 'missing', evaluationContext, entityManager, logger);

      expect(evaluationContext.target).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Target entity not found for ID [missing]. Setting target context to null.'
      );
    });

    it('re-throws errors from the entity manager after logging them', () => {
      const failure = new Error('lookup failed');
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn(() => {
          throw failure;
        }),
      });
      const evaluationContext = { actor: null };

      expect(() =>
        populateParticipant('actor', 'broken', evaluationContext, entityManager, logger)
      ).toThrow(failure);
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing actor ID [broken] in createJsonLogicContext:',
        failure
      );
    });

    it('logs a warning when an invalid identifier type is provided', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const evaluationContext = { actor: null };

      populateParticipant('actor', { bad: true }, evaluationContext, entityManager, logger);

      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid actorId type provided: [object]. Setting actor context to null.'
      );
      expect(evaluationContext.actor).toBeNull();
    });

    it('logs a debug message when target information is absent', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const evaluationContext = { target: null };

      populateParticipant('target', undefined, evaluationContext, entityManager, logger);

      expect(logger.debug).toHaveBeenCalledWith(
        'No targetId provided, target context remains null.'
      );
    });
  });

  describe('createJsonLogicContext', () => {
    it('populates multi-target participant fields when payload includes identifiers', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn((requestedId) => ({ id: requestedId })),
      });
      const serviceSetup = {
        setupService: jest.fn(() => logger),
      };
      const event = {
        type: 'COMBO',
        payload: {
          primaryId: 'primary-1',
          secondaryId: 'secondary-1',
          tertiaryId: 'tertiary-1',
        },
      };

      const context = createJsonLogicContext(
        event,
        undefined,
        undefined,
        entityManager,
        logger,
        serviceSetup
      );

      expect(serviceSetup.setupService).toHaveBeenCalledWith(
        'createJsonLogicContext',
        logger,
        expect.objectContaining({
          entityManager: expect.objectContaining({ value: entityManager }),
        })
      );
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('primary-1');
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('secondary-1');
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('tertiary-1');
      expect(context.primary).toEqual({
        id: 'primary-1',
        components: { accessorFor: 'primary-1' },
      });
      expect(context.secondary).toEqual({
        id: 'secondary-1',
        components: { accessorFor: 'secondary-1' },
      });
      expect(context.tertiary).toEqual({
        id: 'tertiary-1',
        components: { accessorFor: 'tertiary-1' },
      });
      expect(context.actor).toBeNull();
      expect(context.target).toBeNull();
    });
  });

  describe('createNestedExecutionContext', () => {
    it('wraps createJsonLogicContext output with the expected structure', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn().mockReturnValue({}),
      });
      const serviceSetup = {
        setupService: jest.fn(() => logger),
      };
      const event = { type: 'EVENT', payload: { actorId: 'actor-1', targetId: 'target-1' } };

      const nested = createNestedExecutionContext(
        event,
        'actor-1',
        'target-1',
        entityManager,
        logger,
        serviceSetup
      );

      expect(serviceSetup.setupService).toHaveBeenCalledWith(
        'createJsonLogicContext',
        logger,
        expect.any(Object)
      );
      expect(nested.event).toBe(event);
      expect(nested.logger).toBe(logger);
      expect(nested.evaluationContext).toEqual(
        expect.objectContaining({
          event: { type: 'EVENT', payload: event.payload },
        })
      );
      expect(nested.actor).toEqual(nested.evaluationContext.actor);
      expect(nested.target).toEqual(nested.evaluationContext.target);
    });

    it('attaches trace objects directly on the execution context when provided', () => {
      const logger = createLoggerMock();
      const trace = {
        captureOperationStart: jest.fn(),
        captureOperationEnd: jest.fn(),
      };
      const entityManager = createEntityManagerMock({
        getEntityInstance: jest.fn((requestedId) => ({ id: requestedId })),
      });
      const event = { type: 'TRACE_EVENT', payload: { actorId: 'actor-1' } };

      const executionContext = createNestedExecutionContext(
        event,
        'actor-1',
        undefined,
        entityManager,
        logger,
        trace
      );

      expect(executionContext.trace).toBe(trace);
      expect(executionContext.evaluationContext.actor).toEqual({
        id: 'actor-1',
        components: { accessorFor: 'actor-1' },
      });
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('actor-1');
    });
  });

  describe('createEvaluationContext', () => {
    it('throws when event metadata is missing', () => {
      expect(() => createEvaluationContext(null, {}, createLoggerMock())).toThrow(
        "createEvaluationContext: Missing or invalid 'event' object."
      );
    });

    it('builds actor and target contexts from payload identifiers', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const event = {
        type: 'ACTION',
        payload: {
          actorId: 'actor-9',
          targetId: 'target-4',
          extra: 'details',
        },
      };

      const context = createEvaluationContext(event, entityManager, logger);

      expect(context).toEqual({
        event,
        actor: { id: 'actor-9', components: { accessorFor: 'actor-9' } },
        target: { id: 'target-4', components: { accessorFor: 'target-4' } },
        extra: 'details',
      });
      expect(accessorFactory).toHaveBeenCalledWith('actor-9', entityManager, logger);
      expect(accessorFactory).toHaveBeenCalledWith('target-4', entityManager, logger);
    });

    it('ignores actor/target keys while copying additional payload data', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const event = {
        type: 'ACTION',
        payload: {
          actorId: 'actor-only',
          targetId: 'target-only',
          notes: ['keep'],
        },
      };

      const context = createEvaluationContext(event, entityManager, logger);

      expect(context.notes).toEqual(['keep']);
      expect(Object.keys(context)).not.toContain('actorId');
      expect(Object.keys(context)).not.toContain('targetId');
    });

    it('handles payloads that are not plain objects', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const event = { type: 'EVENT', payload: null };

      const context = createEvaluationContext(event, entityManager, logger);

      expect(context).toEqual({ event });
    });

    it('treats zero-valued identifiers as valid actor/target references', () => {
      const logger = createLoggerMock();
      const entityManager = createEntityManagerMock();
      const event = {
        type: 'ACTION',
        payload: { actorId: 0, targetId: 0 },
      };

      const context = createEvaluationContext(event, entityManager, logger);

      expect(context.actor).toEqual({
        id: 0,
        components: { accessorFor: 0 },
      });
      expect(context.target).toEqual({
        id: 0,
        components: { accessorFor: 0 },
      });
      expect(accessorFactory).toHaveBeenCalledWith(0, entityManager, logger);
    });
  });
});
