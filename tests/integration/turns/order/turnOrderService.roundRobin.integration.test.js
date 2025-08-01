/**
 * @file Integration tests for TurnOrderService with SimpleRoundRobinQueue
 * Tests the round-robin turn order strategy in a real service context
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';
import {
  createMockActor,
  createMockEntity,
} from '../../../common/mockFactories/entities.js';

describe('TurnOrderService - Round Robin Strategy Integration', () => {
  let turnOrderService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    turnOrderService = new TurnOrderService({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Round-robin queue initialization', () => {
    it('should initialize SimpleRoundRobinQueue when strategy is round-robin', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
        createMockEntity('entity3'),
      ];

      // Act
      turnOrderService.startNewRound(entities, 'round-robin');

      // Assert
      expect(turnOrderService.isEmpty()).toBe(false);
      expect(turnOrderService.peekNextEntity()).toEqual(entities[0]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: Initialized SimpleRoundRobinQueue.'
      );
    });

    it('should add all entities to the queue in the order provided', () => {
      // Arrange
      const entities = [
        createMockActor('player1', { name: 'Player One' }),
        createMockActor('npc1', { name: 'NPC One' }),
        createMockActor('npc2', { name: 'NPC Two' }),
      ];

      // Act
      turnOrderService.startNewRound(entities, 'round-robin');
      const currentOrder = turnOrderService.getCurrentOrder();

      // Assert
      expect(currentOrder).toHaveLength(3);
      expect(currentOrder[0].id).toBe('player1');
      expect(currentOrder[1].id).toBe('npc1');
      expect(currentOrder[2].id).toBe('npc2');
    });
  });

  describe('Turn order progression', () => {
    it('should return entities in FIFO order when calling getNextEntity', () => {
      // Arrange
      const entities = [
        createMockEntity('first'),
        createMockEntity('second'),
        createMockEntity('third'),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act & Assert
      expect(turnOrderService.getNextEntity()).toEqual(entities[0]);
      expect(turnOrderService.getNextEntity()).toEqual(entities[1]);
      expect(turnOrderService.getNextEntity()).toEqual(entities[2]);
      expect(turnOrderService.getNextEntity()).toBe(null);
    });

    it('should handle multiple rounds of turns correctly', () => {
      // Arrange
      const entities = [createMockActor('player1'), createMockActor('player2')];

      // First round
      turnOrderService.startNewRound(entities, 'round-robin');
      expect(turnOrderService.getNextEntity().id).toBe('player1');
      expect(turnOrderService.getNextEntity().id).toBe('player2');
      expect(turnOrderService.isEmpty()).toBe(true);

      // Second round with same entities
      turnOrderService.startNewRound(entities, 'round-robin');
      expect(turnOrderService.getNextEntity().id).toBe('player1');
      expect(turnOrderService.getNextEntity().id).toBe('player2');
      expect(turnOrderService.isEmpty()).toBe(true);
    });

    it('should remove entities from queue after their turn', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
        createMockEntity('entity3'),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      turnOrderService.getNextEntity(); // Remove entity1
      const remainingOrder = turnOrderService.getCurrentOrder();

      // Assert
      expect(remainingOrder).toHaveLength(2);
      expect(remainingOrder[0].id).toBe('entity2');
      expect(remainingOrder[1].id).toBe('entity3');
    });
  });

  describe('Queue state management', () => {
    it('should correctly report isEmpty state throughout turn progression', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
      ];

      // Initially empty
      expect(turnOrderService.isEmpty()).toBe(true);

      // After starting round
      turnOrderService.startNewRound(entities, 'round-robin');
      expect(turnOrderService.isEmpty()).toBe(false);

      // After first entity's turn
      turnOrderService.getNextEntity();
      expect(turnOrderService.isEmpty()).toBe(false);

      // After all entities have had their turn
      turnOrderService.getNextEntity();
      expect(turnOrderService.isEmpty()).toBe(true);
    });

    it('should allow peeking without modifying the queue', () => {
      // Arrange
      const entities = [
        createMockActor('player1', { name: 'Player One' }),
        createMockActor('player2', { name: 'Player Two' }),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      const peeked1 = turnOrderService.peekNextEntity();
      const peeked2 = turnOrderService.peekNextEntity();
      const actualNext = turnOrderService.getNextEntity();

      // Assert
      expect(peeked1).toEqual(peeked2);
      expect(peeked1).toEqual(actualNext);
      expect(peeked1.id).toBe('player1');
    });

    it('should return frozen array from getCurrentOrder', () => {
      // Arrange
      const entities = [createMockEntity('entity1')];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      const order = turnOrderService.getCurrentOrder();

      // Assert
      expect(Object.isFrozen(order)).toBe(true);
      expect(() => {
        order.push(createMockEntity('entity2'));
      }).toThrow();
    });
  });

  describe('Entity removal', () => {
    it('should remove specific entity from turn order', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
        createMockEntity('entity3'),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      turnOrderService.removeEntity('entity2');
      const remainingOrder = turnOrderService.getCurrentOrder();

      // Assert
      expect(remainingOrder).toHaveLength(2);
      expect(remainingOrder[0].id).toBe('entity1');
      expect(remainingOrder[1].id).toBe('entity3');
    });

    it('should continue turn order correctly after entity removal', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
        createMockEntity('entity3'),
        createMockEntity('entity4'),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      expect(turnOrderService.getNextEntity().id).toBe('entity1');
      turnOrderService.removeEntity('entity3'); // Remove future entity
      expect(turnOrderService.getNextEntity().id).toBe('entity2');
      expect(turnOrderService.getNextEntity().id).toBe('entity4');
      expect(turnOrderService.getNextEntity()).toBe(null);
    });

    it('should log warning when removing non-existent entity', () => {
      // Arrange
      const entities = [createMockEntity('entity1')];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      turnOrderService.removeEntity('non-existent');

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnOrderService.removeEntity: Entity "non-existent" not found in the current turn order queue.'
      );
      expect(turnOrderService.getCurrentOrder()).toHaveLength(1);
    });
  });

  describe('Round management', () => {
    it('should clear previous round state when starting new round', () => {
      // Arrange
      const firstRoundEntities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
      ];
      const secondRoundEntities = [
        createMockEntity('entity3'),
        createMockEntity('entity4'),
        createMockEntity('entity5'),
      ];

      // First round
      turnOrderService.startNewRound(firstRoundEntities, 'round-robin');
      turnOrderService.getNextEntity(); // Partially consume queue

      // Second round
      turnOrderService.startNewRound(secondRoundEntities, 'round-robin');
      const newOrder = turnOrderService.getCurrentOrder();

      // Assert
      expect(newOrder).toHaveLength(3);
      expect(newOrder[0].id).toBe('entity3');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: Current round state cleared.'
      );
    });

    it('should handle clearCurrentRound correctly', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
      ];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Act
      turnOrderService.clearCurrentRound();

      // Assert
      expect(turnOrderService.isEmpty()).toBe(true);
      expect(turnOrderService.peekNextEntity()).toBe(null);
      expect(turnOrderService.getCurrentOrder()).toHaveLength(0);
    });

    it('should allow switching between strategies', () => {
      // Arrange
      const entities = [
        createMockEntity('entity1'),
        createMockEntity('entity2'),
      ];
      const initiativeData = new Map([
        ['entity1', 10],
        ['entity2', 20],
      ]);

      // Start with round-robin
      turnOrderService.startNewRound(entities, 'round-robin');
      expect(turnOrderService.peekNextEntity().id).toBe('entity1');

      // Switch to initiative (entity2 has higher initiative)
      turnOrderService.startNewRound(entities, 'initiative', initiativeData);
      expect(turnOrderService.peekNextEntity().id).toBe('entity2');

      // Switch back to round-robin
      turnOrderService.startNewRound(entities, 'round-robin');
      expect(turnOrderService.peekNextEntity().id).toBe('entity1');
    });
  });

  describe('Error handling', () => {
    it('should throw error when starting round with empty entity list', () => {
      // Act & Assert
      expect(() => {
        turnOrderService.startNewRound([], 'round-robin');
      }).toThrow('Entities array must be provided and non-empty.');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnOrderService.startNewRound: Failed - entities array must be a non-empty array.'
      );
    });

    it('should throw error when entities have invalid structure', () => {
      // Arrange
      const invalidEntities = [
        { id: 'valid' },
        { name: 'missing-id' }, // Missing id
        { id: '' }, // Empty id
        null, // Null entity
      ];

      // Act & Assert
      expect(() => {
        turnOrderService.startNewRound(invalidEntities, 'round-robin');
      }).toThrow('Entities array contains invalid entities.');
    });

    it('should throw error for unsupported strategy', () => {
      // Arrange
      const entities = [createMockEntity('entity1')];

      // Act & Assert
      expect(() => {
        turnOrderService.startNewRound(entities, 'unsupported-strategy');
      }).toThrow('Unsupported turn order strategy: unsupported-strategy');
    });

    it('should handle operations on empty/uninitialized service gracefully', () => {
      // No round started
      expect(turnOrderService.isEmpty()).toBe(true);
      expect(turnOrderService.peekNextEntity()).toBe(null);
      expect(turnOrderService.getNextEntity()).toBe(null);
      expect(turnOrderService.getCurrentOrder()).toHaveLength(0);

      // removeEntity returns void, just verify it doesn't throw
      expect(() => turnOrderService.removeEntity('any')).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnOrderService.removeEntity: Called for entity "any" when no round is active. No action taken.'
      );
    });
  });

  describe('Complex scenarios', () => {
    it('should handle large number of entities efficiently', () => {
      // Arrange
      const largeEntitySet = Array.from({ length: 100 }, (_, i) =>
        createMockEntity(`entity${i}`)
      );

      // Act
      turnOrderService.startNewRound(largeEntitySet, 'round-robin');

      // Assert
      expect(turnOrderService.getCurrentOrder()).toHaveLength(100);

      // Verify FIFO order maintained
      for (let i = 0; i < 100; i++) {
        expect(turnOrderService.getNextEntity().id).toBe(`entity${i}`);
      }
      expect(turnOrderService.isEmpty()).toBe(true);
    });

    it('should maintain entity object integrity throughout turn cycle', () => {
      // Arrange
      const complexEntity = createMockActor('player1', {
        name: 'Complex Player',
        isPlayer: true,
        playerType: 'human',
        health: 100,
        inventory: ['sword', 'shield'],
      });
      const entities = [complexEntity, createMockEntity('npc1')];

      // Act
      turnOrderService.startNewRound(entities, 'round-robin');
      const peeked = turnOrderService.peekNextEntity();
      const retrieved = turnOrderService.getNextEntity();

      // Assert - Verify full entity structure is preserved
      expect(retrieved).toEqual(complexEntity);
      expect(retrieved.components).toBeDefined();
      expect(peeked).toEqual(retrieved);
    });
  });
});
