import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TargetContextBuilder from '../../../../src/scopeDsl/utils/targetContextBuilder.js';

describe('TargetContextBuilder - Dependent Resolution', () => {
  let builder;
  let mockEntityManager;
  let mockGameStateManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockGameStateManager = {
      getCurrentTurn: jest.fn(() => 1),
      getTimeOfDay: jest.fn(() => 'morning'),
      getWeather: jest.fn(() => 'clear'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    builder = new TargetContextBuilder({
      entityManager: mockEntityManager,
      gameStateManager: mockGameStateManager,
      logger: mockLogger,
    });
  });

  describe('Base Context Building', () => {
    it('should build base context with actor and location', () => {
      const mockActor = {
        id: 'player_001',
        getAllComponents: jest.fn(() => ({ 'core:stats': { health: 100 } })),
      };
      const mockLocation = {
        id: 'room_001',
        getAllComponents: jest.fn(() => ({
          'core:location': { name: 'Test Room' },
        })),
      };

      mockEntityManager.getEntityInstance
        .mockReturnValueOnce(mockActor)
        .mockReturnValueOnce(mockLocation);

      const result = builder.buildBaseContext('player_001', 'room_001');

      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result).toHaveProperty('game');
      expect(result.actor.id).toBe('player_001');
      expect(result.location.id).toBe('room_001');
      expect(result.game.turnNumber).toBe(1);
    });

    it('should throw if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      expect(() => {
        builder.buildBaseContext('invalid_id', 'room_001');
      }).toThrow('Entity not found: invalid_id');
    });
  });

  describe('Dependent Context Building', () => {
    it('should build dependent context with resolved targets', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const resolvedTargets = {
        primary: [{ id: 'npc_001', displayName: 'Alice' }],
        secondary: [{ id: 'item_001', displayName: 'Sword' }],
      };

      const targetDef = {
        scope: 'target.inventory',
        placeholder: 'item',
        contextFrom: 'primary',
      };

      mockEntityManager.getEntityInstance.mockReturnValue({
        id: 'npc_001',
        getAllComponents: jest.fn(() => ({})),
      });

      const result = builder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );

      expect(result.targets).toEqual(resolvedTargets);
      expect(result.target).toBeDefined();
      expect(result.target.id).toBe('npc_001');
    });

    it('should handle missing contextFrom gracefully', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const resolvedTargets = {};
      const targetDef = { scope: 'test', placeholder: 'test' };

      const result = builder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );

      expect(result.targets).toEqual({});
      expect(result.target).toBeUndefined();
    });
  });
});
