import RoundManager from '../../../src/turns/roundManager.js';

describe('RoundManager', () => {
  let roundManager;
  let mockTurnOrderService;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockTurnOrderService = {
      startNewRound: jest.fn().mockResolvedValue(undefined),
    };

    mockEntityManager = {
      entities: [],
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    roundManager = new RoundManager(
      mockTurnOrderService,
      mockEntityManager,
      mockLogger
    );
  });

  describe('startRound', () => {
    it('should start round with 2 actors', async () => {
      // Arrange
      const mockActor1 = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const mockActor2 = {
        id: 'actor2',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor1, mockActor2];

      // Act
      await roundManager.startRound();

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor1, mockActor2],
        'round-robin',
        undefined
      );
      expect(roundManager.inProgress).toBe(true);
      expect(roundManager.hadSuccess).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RoundManager.startRound() initiating...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Found 2 actors to start the round: actor1, actor2'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Successfully started a new round with 2 actors using the 'round-robin' strategy."
      );
    });

    it('should throw error when zero actors', async () => {
      // Arrange
      mockEntityManager.entities = [];

      // Act & Assert
      await expect(roundManager.startRound()).rejects.toThrow(
        'Cannot start a new round: No active entities with an Actor component found.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot start a new round: No active entities with an Actor component found.'
      );
      expect(roundManager.inProgress).toBe(false);
    });

    it('should reset hadSuccess at startRound', async () => {
      // Arrange
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      // Set hadSuccess to true first
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Act
      await roundManager.startRound();

      // Assert
      expect(roundManager.hadSuccess).toBe(false);
    });

    it('should preserve hadSuccess when a new round cannot be started', async () => {
      // Arrange
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await roundManager.startRound();
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Remove all actors to force startRound failure
      mockEntityManager.entities = [];

      await expect(roundManager.startRound()).rejects.toThrow(
        'Cannot start a new round: No active entities with an Actor component found.'
      );

      // hadSuccess should still reflect the previous successful round
      expect(roundManager.hadSuccess).toBe(true);
    });

    it('should clear inProgress flag if a new round fails to start', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await roundManager.startRound();
      expect(roundManager.inProgress).toBe(true);

      mockEntityManager.entities = [];

      await expect(roundManager.startRound()).rejects.toThrow(
        'Cannot start a new round: No active entities with an Actor component found.'
      );

      expect(roundManager.inProgress).toBe(false);
    });

    it('should use initiative strategy when provided with initiative data', async () => {
      // Arrange
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeData = new Map([[mockActor.id, 5]]);

      // Act
      await roundManager.startRound('initiative', initiativeData);

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'initiative',
        initiativeData
      );
    });

    it('should accept options object for initiative configuration', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeData = new Map([[mockActor.id, 10]]);

      await roundManager.startRound({
        strategy: 'initiative',
        initiativeData,
      });

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'initiative',
        initiativeData
      );
    });

    it('should infer initiative strategy when options provide initiativeData without explicit strategy', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeData = new Map([[mockActor.id, 8]]);

      await roundManager.startRound({
        initiativeData,
      });

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'initiative',
        initiativeData
      );
    });

    it('should treat null initiative data in options as absent and default to round-robin', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await roundManager.startRound({
        initiativeData: null,
      });

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );
    });

    it('should throw when initiative strategy lacks initiative data', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await expect(roundManager.startRound('initiative')).rejects.toThrow(
        'Cannot start an initiative round: initiativeData Map is required.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot start an initiative round: initiativeData Map is required.'
      );
    });

    it('should normalise plain object initiative data into a Map', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { [mockActor.id]: 12 };

      await roundManager.startRound('initiative', initiativeDataObject);

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative).toBeInstanceOf(Map);
      expect(normalisedInitiative.get(mockActor.id)).toBe(12);
    });

    it('should coerce initiative scores from string inputs into numbers', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { [mockActor.id]: '34' };

      await roundManager.startRound('initiative', initiativeDataObject);

      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative.get(mockActor.id)).toBe(34);
    });

    it('should fall back to round-robin when unknown strategy provided without initiative data', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await roundManager.startRound('priority');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "RoundManager.startRound(): Unknown strategy 'priority'. Falling back to 'round-robin'."
      );
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );
    });

    it('should default to round-robin when provided non-string or blank strategy input', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await roundManager.startRound(42);

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );

      mockTurnOrderService.startNewRound.mockClear();

      await roundManager.startRound('   ');

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );
    });

    it('should fall back to initiative when unknown strategy provided with initiative data', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeData = new Map([[mockActor.id, 3]]);

      await roundManager.startRound('priority', initiativeData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "RoundManager.startRound(): Unknown strategy 'priority'. Falling back to 'initiative' because initiative data was provided."
      );
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
      const [, strategy, normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(strategy).toBe('initiative');
      expect(normalisedInitiative).toBeInstanceOf(Map);
      expect(normalisedInitiative.get(mockActor.id)).toBe(3);
    });

    it('should drop invalid initiative scores after coercion attempts', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { [mockActor.id]: 'not-a-number' };

      await expect(
        roundManager.startRound('initiative', initiativeDataObject)
      ).rejects.toThrow(
        'Cannot start an initiative round: initiativeData Map is required.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        expect.objectContaining({
          entityId: mockActor.id,
          receivedType: 'string',
        })
      );
    });

    it('should throw when initiative strategy receives an empty object', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      await expect(roundManager.startRound('initiative', {})).rejects.toThrow(
        'Cannot start an initiative round: initiativeData Map is required.'
      );
    });

    it('should throw when all object initiative entries are discarded during normalisation', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      const initiativeDataObject = {
        '   ': '  ',
        actor1: '   ',
        actor2: null,
      };

      await expect(
        roundManager.startRound('initiative', initiativeDataObject)
      ).rejects.toThrow(
        'Cannot start an initiative round: initiativeData Map is required.'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from object input after trimming whitespace.',
        { entityId: '   ' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
        { entityId: 'actor1' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        { entityId: 'actor2' }
      );
    });

    it('should normalise plain object initiative data when provided via options', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { [mockActor.id]: 7 };

      await roundManager.startRound({
        strategy: 'initiative',
        initiativeData: initiativeDataObject,
      });

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative).toBeInstanceOf(Map);
      expect(normalisedInitiative.get(mockActor.id)).toBe(7);
    });

    it('should normalise initiative data when strategy is inferred from options', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { [mockActor.id]: 11 };

      await roundManager.startRound({
        initiativeData: initiativeDataObject,
      });

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative).toBeInstanceOf(Map);
      expect(normalisedInitiative.get(mockActor.id)).toBe(11);
    });

    it('should trim whitespace around entity ids when normalising initiative data', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataObject = { ' actor1 ': '21' };

      await roundManager.startRound('initiative', initiativeDataObject);

      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative.get(mockActor.id)).toBe(21);
      expect(normalisedInitiative.has(' actor1 ')).toBe(false);
    });

    it('should log duplicates and keep the latest score when ids collide after trimming', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeDataMap = new Map([
        ['actor1', 5],
        [' actor1 ', 7],
      ]);

      await roundManager.startRound('initiative', initiativeDataMap);

      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative.get(mockActor.id)).toBe(7);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actor1" after normalisation. Using latest value.',
        expect.objectContaining({ entityId: ' actor1 ' })
      );
    });

    it('should ignore invalid initiative entries from Maps while normalising scores', async () => {
      const primaryActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const secondaryActor = {
        id: 'actor2',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [primaryActor, secondaryActor];

      const initiativeData = new Map([
        [123, 10],
        ['   ', '  '],
        ['actorEmpty', '   '],
        ['actorMissing', null],
        [' actor1 ', true],
        ['actorNan', {}],
        ['actor1', 12],
        ['actor2', 4],
      ]);

      await roundManager.startRound('initiative', initiativeData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from Map input.',
        { entityId: 123 }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from Map input after trimming whitespace.',
        { entityId: '   ' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
        { entityId: 'actorEmpty' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        { entityId: 'actorMissing' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        expect.objectContaining({ entityId: 'actorNan', receivedType: 'object' })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actor1" after normalisation. Using latest value.',
        expect.objectContaining({ entityId: 'actor1' })
      );

      const [, , normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(normalisedInitiative).toBeInstanceOf(Map);
      expect(Array.from(normalisedInitiative.entries())).toEqual([
        ['actor1', 12],
        ['actor2', 4],
      ]);
    });

    it('should normalise strategy strings by trimming whitespace and casing', async () => {
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      const initiativeData = new Map([[mockActor.id, 15]]);

      await roundManager.startRound(' Initiative ', initiativeData);

      expect(mockTurnOrderService.startNewRound).toHaveBeenLastCalledWith(
        [mockActor],
        'initiative',
        initiativeData
      );

      mockTurnOrderService.startNewRound.mockClear();

      await roundManager.startRound('ROUND-ROBIN');

      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );
    });

    it('should normalise initiative data provided as arrays while filtering invalid entries', async () => {
      const primaryActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const supportingActor = {
        id: 'actor4',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const tertiaryActor = {
        id: 'actor6',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [primaryActor, supportingActor, tertiaryActor];

      const initiativeArray = [
        'invalid-entry',
        [42, 11],
        ['   ', 2],
        [' actor1 ', '5'],
        ['actor1', ' 7 '],
        ['actor2', null],
        ['actor3', {}],
        ['actor4', true],
        ['actor5', '   '],
        ['actor6', 9],
      ];

      await roundManager.startRound('mystery', initiativeArray);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring malformed initiative entry from array input.',
        { entry: 'invalid-entry' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from array input.',
        { entityId: 42 }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from array input after trimming whitespace.',
        { entityId: '   ' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        { entityId: 'actor2' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        expect.objectContaining({ entityId: 'actor3', receivedType: 'object' })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
        { entityId: 'actor5' }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actor1" after normalisation. Using latest value.',
        expect.objectContaining({ entityId: 'actor1' })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "RoundManager.startRound(): Unknown strategy 'mystery'. Falling back to 'initiative' because initiative data was provided."
      );

      const [, usedStrategy, normalisedInitiative] =
        mockTurnOrderService.startNewRound.mock.calls[0];
      expect(usedStrategy).toBe('initiative');
      expect(Array.from(normalisedInitiative.entries())).toEqual([
        ['actor1', 7],
        ['actor4', 1],
        ['actor6', 9],
      ]);
    });

    it('should filter out non-actor entities', async () => {
      // Arrange
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      const mockNonActor = {
        id: 'nonActor',
        hasComponent: jest.fn().mockReturnValue(false),
      };
      mockEntityManager.entities = [mockActor, mockNonActor];

      // Act
      await roundManager.startRound();

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
        [mockActor],
        'round-robin',
        undefined
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Found 1 actors to start the round: actor1'
      );
    });
  });

  describe('endTurn', () => {
    it('should set hadSuccess to true when success is true', () => {
      // Act
      roundManager.endTurn(true);

      // Assert
      expect(roundManager.hadSuccess).toBe(true);
    });

    it('should not change hadSuccess when success is false', () => {
      // Arrange
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Act
      roundManager.endTurn(false);

      // Assert
      expect(roundManager.hadSuccess).toBe(true);
    });

    it('should not change hadSuccess when success is undefined', () => {
      // Arrange
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Act
      roundManager.endTurn(undefined);

      // Assert
      expect(roundManager.hadSuccess).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return inProgress status', () => {
      // Act & Assert
      expect(roundManager.inProgress).toBe(false);

      // Test that it can be set to true via startRound
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];

      return roundManager.startRound().then(() => {
        expect(roundManager.inProgress).toBe(true);
      });
    });

    it('should return hadSuccess status', () => {
      // Act & Assert
      expect(roundManager.hadSuccess).toBe(false);

      // Test that it can be set to true via endTurn
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);
    });
  });

  describe('resetFlags', () => {
    it('should reset both inProgress and hadSuccess flags', async () => {
      // Arrange - set both flags to true
      const mockActor = {
        id: 'actor1',
        hasComponent: jest.fn().mockReturnValue(true),
      };
      mockEntityManager.entities = [mockActor];
      await roundManager.startRound(); // This sets inProgress to true
      roundManager.endTurn(true); // This sets hadSuccess to true

      expect(roundManager.inProgress).toBe(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Act
      roundManager.resetFlags();

      // Assert
      expect(roundManager.inProgress).toBe(false);
      expect(roundManager.hadSuccess).toBe(false);
    });
  });
});
