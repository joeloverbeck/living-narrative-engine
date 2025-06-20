/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  createNestedExecutionContext,
  createJsonLogicContext,
} from '../../../src/logic/contextAssembler.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createNestedExecutionContext', () => {
  test('returns structure matching createJsonLogicContext output', () => {
    const event = { type: 'TEST', payload: { a: 1 } };
    const actorId = 'actor1';
    const targetId = 'target1';
    mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

    const expectedEval = createJsonLogicContext(
      event,
      actorId,
      targetId,
      mockEntityManager,
      mockLogger
    );

    const nested = createNestedExecutionContext(
      event,
      actorId,
      targetId,
      mockEntityManager,
      mockLogger
    );

    expect(nested).toEqual({
      event,
      actor: expectedEval.actor,
      target: expectedEval.target,
      logger: mockLogger,
      evaluationContext: expectedEval,
    });
  });

  test('actor and target reference evaluationContext properties', () => {
    const event = { type: 'TEST2' };
    const nested = createNestedExecutionContext(
      event,
      null,
      null,
      mockEntityManager,
      mockLogger
    );

    expect(nested.actor).toBe(nested.evaluationContext.actor);
    expect(nested.target).toBe(nested.evaluationContext.target);
  });
});
