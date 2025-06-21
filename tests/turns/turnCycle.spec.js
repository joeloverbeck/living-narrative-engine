import TurnCycle from '../../src/turns/turnCycle.js';

describe('TurnCycle', () => {
  let mockService;
  let mockLogger;
  let turnCycle;

  beforeEach(() => {
    mockService = {
      isEmpty: jest.fn(),
      getNextEntity: jest.fn(),
      clearCurrentRound: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    turnCycle = new TurnCycle(mockService, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with service and logger', () => {
      expect(turnCycle).toBeInstanceOf(TurnCycle);
    });
  });

  describe('nextActor', () => {
    it('should return null when queue is empty', async () => {
      mockService.isEmpty.mockResolvedValue(true);

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      expect(mockService.isEmpty).toHaveBeenCalledOnce();
      expect(mockService.getNextEntity).not.toHaveBeenCalled();
    });

    it('should return next entity when queue is not empty', async () => {
      const mockEntity = { id: 'test-entity' };
      mockService.isEmpty.mockResolvedValue(false);
      mockService.getNextEntity.mockResolvedValue(mockEntity);

      const result = await turnCycle.nextActor();

      expect(result).toBe(mockEntity);
      expect(mockService.isEmpty).toHaveBeenCalledOnce();
      expect(mockService.getNextEntity).toHaveBeenCalledOnce();
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Service error');
      mockService.isEmpty.mockRejectedValue(error);

      await expect(turnCycle.nextActor()).rejects.toThrow('Service error');
      expect(mockService.isEmpty).toHaveBeenCalledOnce();
    });
  });

  describe('clear', () => {
    it('should call clearCurrentRound on service', async () => {
      mockService.clearCurrentRound.mockResolvedValue();

      await turnCycle.clear();

      expect(mockService.clearCurrentRound).toHaveBeenCalledOnce();
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Clear error');
      mockService.clearCurrentRound.mockRejectedValue(error);

      await expect(turnCycle.clear()).rejects.toThrow('Clear error');
      expect(mockService.clearCurrentRound).toHaveBeenCalledOnce();
    });
  });
}); 