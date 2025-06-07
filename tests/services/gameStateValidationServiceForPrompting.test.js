// test/services/GameStateValidationServiceForPrompting.test.js
// --- FILE START ---
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GameStateValidationServiceForPrompting } from '../../src/validation/gameStateValidationServiceForPrompting.js';
import { ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING } from '../../src/constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../src/constants/eventIds.js';

// Mock ILogger dependency
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock AIGameStateDTO structure for tests
// Helper function to create mock AIGameStateDTO objects
const createMockGameStateDto = ({
  hasActorState = true,
  hasActorPromptData = true,
} = {}) => {
  const dto = {};
  if (hasActorState) {
    dto.actorState = {}; // Presence of the object is enough for these tests
  }
  if (hasActorPromptData) {
    dto.actorPromptData = {}; // Presence of the object is enough
  }
  // Add other essential fields if your validation checks them as merely present
  // For current GameStateValidationServiceForPrompting, only actorState and actorPromptData presence is specifically checked for warnings.
  return dto;
};

describe('GameStateValidationServiceForPrompting', () => {
  let service;
  let stubDispatcher;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
    stubDispatcher = { dispatch: jest.fn() };
    service = new GameStateValidationServiceForPrompting({
      logger: mockLogger,
      dispatcher: stubDispatcher,
    });
  });

  describe('Constructor', () => {
    it('should initialize with a logger', () => {
      expect(service).toBeDefined();
      // The constructor of GameStateValidationServiceForPrompting calls logger.debug
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GameStateValidationServiceForPrompting initialized.'
      );
    });

    it('should throw an error if logger is not provided', () => {
      expect(() => new GameStateValidationServiceForPrompting({})).toThrow(
        'GameStateValidationServiceForPrompting: Logger dependency is required.'
      );
      expect(
        () => new GameStateValidationServiceForPrompting({ logger: null })
      ).toThrow(
        'GameStateValidationServiceForPrompting: Logger dependency is required.'
      );
    });
  });

  describe('validate', () => {
    it('should return invalid if gameStateDto is null', () => {
      const result = service.validate(null);
      expect(result.isValid).toBe(false);
      expect(result.errorContent).toBe(
        ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING
      );
      expect(stubDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'GameStateValidationServiceForPrompting.validate: AIGameStateDTO is null or undefined.',
        })
      );
    });

    it('should return invalid if gameStateDto is undefined', () => {
      const result = service.validate(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errorContent).toBe(
        ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING
      );
      expect(stubDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'GameStateValidationServiceForPrompting.validate: AIGameStateDTO is null or undefined.',
        })
      );
    });

    it('should return valid and warn if actorState is missing', () => {
      const dto = createMockGameStateDto({
        hasActorState: false,
        hasActorPromptData: true,
      });
      const result = service.validate(dto);
      expect(result.isValid).toBe(true); // Service logic considers this valid but warns
      expect(result.errorContent).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly."
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning
      expect(stubDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should return valid and warn if actorPromptData is missing', () => {
      const dto = createMockGameStateDto({
        hasActorState: true,
        hasActorPromptData: false,
      });
      const result = service.validate(dto);
      expect(result.isValid).toBe(true); // Service logic considers this valid but warns
      expect(result.errorContent).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks."
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Ensure only this warning
      expect(stubDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should return valid and warn if both actorState and actorPromptData are missing', () => {
      const dto = createMockGameStateDto({
        hasActorState: false,
        hasActorPromptData: false,
      });
      const result = service.validate(dto);
      expect(result.isValid).toBe(true); // Service logic considers this valid but warns
      expect(result.errorContent).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly."
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks."
      );
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Expect two separate warnings
      expect(stubDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should return valid if gameStateDto is valid and complete (has actorState and actorPromptData)', () => {
      const dto = createMockGameStateDto({
        hasActorState: true,
        hasActorPromptData: true,
      });
      const result = service.validate(dto);
      expect(result.isValid).toBe(true);
      expect(result.errorContent).toBeNull();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(stubDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
// --- FILE END ---
