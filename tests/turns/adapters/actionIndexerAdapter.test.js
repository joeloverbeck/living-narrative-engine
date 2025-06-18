// tests/turns/adapters/actionIndexerAdapter.test.js

import { describe, it, expect, jest } from '@jest/globals';
import { ActionIndexerAdapter } from '../../../src/turns/adapters/actionIndexerAdapter.js';
import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';

describe('ActionIndexerAdapter', () => {
  describe('when delegating to the underlying service', () => {
    it('calls indexActions on the injected service with the correct arguments', () => {
      // Arrange: create a mock service with a spy on indexActions
      const mockService = {
        indexActions: jest
          .fn()
          .mockReturnValue([{ actionId: 'a', params: {} }]),
        resolve: jest.fn(),
        beginTurn: jest.fn(),
      };
      const adapter = new ActionIndexerAdapter(mockService);

      const rawActions = [{ actionId: 'foo', params: { x: 1 } }];
      const actorId = 'actor123';

      // Act
      const result = adapter.index(rawActions, actorId);

      // Assert
      expect(mockService.indexActions).toHaveBeenCalledTimes(1);
      expect(mockService.indexActions).toHaveBeenCalledWith(
        actorId,
        rawActions
      );
      expect(result).toEqual([{ actionId: 'a', params: {} }]);
    });
  });

  describe('smoke test against the real ActionIndexingService', () => {
    it('returns the same output as calling indexActions directly', () => {
      // Arrange: real service and adapter
      let logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const service = new ActionIndexingService({ logger });
      const adapter = new ActionIndexerAdapter(service);

      // Prepare some raw actions (now including required description)
      const rawActions = [
        {
          actionId: 'move',
          commandString: 'move',
          params: { x: 1, y: 2 },
          description: 'Move to coordinates',
        },
        {
          actionId: 'attack',
          commandString: 'attack',
          params: { target: 'enemy' },
          description: 'Attack the enemy',
        },
      ];
      const actorId = 'actorXYZ';

      // Act
      const direct = service.indexActions(actorId, rawActions);
      const viaAdapter = adapter.index(rawActions, actorId);

      // Assert: deep equality
      expect(viaAdapter).toEqual(direct);

      // And ensure idempotence: subsequent calls in the same turn with an
      // empty array should return the *same* cached array instance.
      const secondViaAdapter = adapter.index([], actorId);
      expect(secondViaAdapter).toBe(viaAdapter);
    });
  });

  describe('error handling', () => {
    it('propagates errors thrown by the underlying service', () => {
      // Arrange: service throws
      const error = new Error('something went wrong');
      const mockService = {
        indexActions: jest.fn().mockImplementation(() => {
          throw error;
        }),
        resolve: jest.fn(),
        beginTurn: jest.fn(),
      };
      const adapter = new ActionIndexerAdapter(mockService);

      // Act & Assert
      expect(() => adapter.index([], 'anyActor')).toThrow(error);
    });
  });
});
