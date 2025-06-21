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
      error: jest.fn(),
    };

    roundManager = new RoundManager(mockTurnOrderService, mockEntityManager, mockLogger);
  });

  describe('startRound', () => {
    it('should start round with 2 actors', async () => {
      // Arrange
      const mockActor1 = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
      const mockActor2 = { id: 'actor2', hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.entities = [mockActor1, mockActor2];

      // Act
      await roundManager.startRound();

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith([mockActor1, mockActor2], 'round-robin');
      expect(roundManager.inProgress).toBe(true);
      expect(roundManager.hadSuccess).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('RoundManager.startRound() initiating...');
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 2 actors to start the round: actor1, actor2');
      expect(mockLogger.debug).toHaveBeenCalledWith("Successfully started a new round with 2 actors using the 'round-robin' strategy.");
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
      const mockActor = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.entities = [mockActor];
      
      // Set hadSuccess to true first
      roundManager.endTurn(true);
      expect(roundManager.hadSuccess).toBe(true);

      // Act
      await roundManager.startRound();

      // Assert
      expect(roundManager.hadSuccess).toBe(false);
    });

    it('should use custom strategy when provided', async () => {
      // Arrange
      const mockActor = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
      mockEntityManager.entities = [mockActor];

      // Act
      await roundManager.startRound('initiative');

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith([mockActor], 'initiative');
    });

    it('should filter out non-actor entities', async () => {
      // Arrange
      const mockActor = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
      const mockNonActor = { id: 'nonActor', hasComponent: jest.fn().mockReturnValue(false) };
      mockEntityManager.entities = [mockActor, mockNonActor];

      // Act
      await roundManager.startRound();

      // Assert
      expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith([mockActor], 'round-robin');
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 1 actors to start the round: actor1');
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
      const mockActor = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
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
      const mockActor = { id: 'actor1', hasComponent: jest.fn().mockReturnValue(true) };
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