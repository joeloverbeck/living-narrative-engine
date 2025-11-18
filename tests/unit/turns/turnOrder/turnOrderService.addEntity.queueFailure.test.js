// src/tests/turns/order/turnOrderService.addEntity.queueFailure.test.js

/**
 * @file Unit tests for the TurnOrderService class focusing on error handling
 * within addEntity when the underlying queue throws.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket: TEST-TURN-ORDER-001.11.12
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js';

jest.mock('../../../../src/turns/order/queues/simpleRoundRobinQueue.js');

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('TurnOrderService - addEntity queue failure handling', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let mockLogger;
  /** @type {TurnOrderService} */
  let service;
  /**
   * @type {{
   *   add: jest.Mock;
   *   clear: jest.Mock;
   *   peek: jest.Mock;
   *   isEmpty: jest.Mock;
   *   toArray: jest.Mock;
   *   getNext: jest.Mock;
   *   remove: jest.Mock;
   *   size: jest.Mock;
    }} */
  let mockQueueInstance;
  const initialEntities = [{ id: 'alpha' }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    mockQueueInstance = {
      add: jest.fn(),
      clear: jest.fn(),
      peek: jest.fn(),
      isEmpty: jest.fn().mockReturnValue(false),
      toArray: jest.fn().mockReturnValue([...initialEntities]),
      getNext: jest.fn(),
      remove: jest.fn(),
      size: jest.fn().mockReturnValue(initialEntities.length),
    };

    SimpleRoundRobinQueue.mockImplementation(() => mockQueueInstance);

    service = new TurnOrderService({ logger: mockLogger });
    service.startNewRound(initialEntities, 'round-robin');

    Object.values(mockLogger).forEach((mockFn) => mockFn.mockClear());
    mockQueueInstance.add.mockClear();
  });

  it('logs and rethrows when the queue rejects a new entity', () => {
    const entityToAdd = { id: 'beta' };
    const queueError = new Error('Queue cannot accept entity');

    mockQueueInstance.add.mockImplementation(() => {
      throw queueError;
    });

    expect(() => service.addEntity(entityToAdd)).toThrow(queueError);

    expect(mockLogger.error).toHaveBeenNthCalledWith(
      1,
      `TurnOrderService.addEntity: Failed to add entity "${entityToAdd.id}": ${queueError.message}`,
      queueError
    );

    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    expect(mockQueueInstance.add).toHaveBeenCalledWith(entityToAdd);
  });
});
