/**
 * @file Integration tests for prototype key fail-fast behavior.
 *
 * Validates that missing or empty prototype lookups produce clear,
 * actionable errors at the EmotionCalculatorService level.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Creates a minimal mock logger for testing
 *
 * @returns {object} Mock logger instance
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
});

/**
 * Creates a minimal mock data registry for testing
 *
 * @returns {object} Mock data registry instance
 */
const createMockDataRegistry = () => {
  const storage = new Map();
  return {
    get: jest.fn((category, id) => {
      const key = `${category}:${id}`;
      return storage.get(key);
    }),
    store: jest.fn((category, id, data) => {
      const key = `${category}:${id}`;
      storage.set(key, data);
    }),
    has: jest.fn((category, id) => {
      const key = `${category}:${id}`;
      return storage.has(key);
    }),
  };
};

describe('Prototype Key Fail-Fast Behavior', () => {
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDataRegistry = createMockDataRegistry();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when emotion_prototypes lookup is missing', () => {
    it('should throw InvalidArgumentError with lookup ID', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getEmotionPrototypeKeys()).toThrow(
        InvalidArgumentError
      );

      expect(() => service.getEmotionPrototypeKeys()).toThrow(
        /core:emotion_prototypes/
      );
    });

    it('should include guidance about mod loading', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getEmotionPrototypeKeys()).toThrow(
        /mods.*loaded/i
      );
    });
  });

  describe('when sexual_prototypes lookup is missing', () => {
    it('should throw InvalidArgumentError with lookup ID', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getSexualPrototypeKeys()).toThrow(
        InvalidArgumentError
      );

      expect(() => service.getSexualPrototypeKeys()).toThrow(
        /core:sexual_prototypes/
      );
    });

    it('should include guidance about mod loading', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getSexualPrototypeKeys()).toThrow(
        /mods.*loaded/i
      );
    });
  });

  describe('when emotion_prototypes lookup is empty', () => {
    it('should throw InvalidArgumentError mentioning empty entries', () => {
      // Store an empty emotion_prototypes lookup
      mockDataRegistry.store('lookups', 'core:emotion_prototypes', {
        id: 'core:emotion_prototypes',
        entries: {},
      });

      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getEmotionPrototypeKeys()).toThrow(
        InvalidArgumentError
      );

      expect(() => service.getEmotionPrototypeKeys()).toThrow(
        /empty/i
      );
    });
  });

  describe('when sexual_prototypes lookup is empty', () => {
    it('should throw InvalidArgumentError mentioning empty entries', () => {
      // Store an empty sexual_prototypes lookup
      mockDataRegistry.store('lookups', 'core:sexual_prototypes', {
        id: 'core:sexual_prototypes',
        entries: {},
      });

      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      expect(() => service.getSexualPrototypeKeys()).toThrow(
        InvalidArgumentError
      );

      expect(() => service.getSexualPrototypeKeys()).toThrow(
        /empty/i
      );
    });
  });

  describe('error message quality', () => {
    it('should include lookup ID in error message', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      let errorMessage = '';
      try {
        service.getEmotionPrototypeKeys();
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('core:emotion_prototypes');
    });

    it('should include actionable guidance', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      let errorMessage = '';
      try {
        service.getEmotionPrototypeKeys();
      } catch (err) {
        errorMessage = err.message;
      }

      // Should mention mods or loading as actionable guidance
      expect(errorMessage).toMatch(/mods|load/i);
    });

    it('should not expose internal implementation details', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      let errorMessage = '';
      try {
        service.getEmotionPrototypeKeys();
      } catch (err) {
        errorMessage = err.message;
      }

      // Should not mention private method names or internal cache variables
      expect(errorMessage).not.toMatch(/#ensureEmotionPrototypes/);
      expect(errorMessage).not.toMatch(/#emotionPrototypes/);
    });
  });

  describe('error occurs at EmotionCalculatorService level', () => {
    it('should throw from getEmotionPrototypeKeys not from downstream consumers', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      let caughtError = null;
      try {
        service.getEmotionPrototypeKeys();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(InvalidArgumentError);
      // Error message should reference EmotionCalculatorService, not ExpressionContextBuilder
      expect(caughtError.message).toContain('EmotionCalculatorService');
    });

    it('should throw from getSexualPrototypeKeys not from downstream consumers', () => {
      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      let caughtError = null;
      try {
        service.getSexualPrototypeKeys();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(InvalidArgumentError);
      expect(caughtError.message).toContain('EmotionCalculatorService');
    });
  });

  describe('successful case with valid prototypes', () => {
    it('should return emotion prototype keys when lookup is valid', () => {
      mockDataRegistry.store('lookups', 'core:emotion_prototypes', {
        id: 'core:emotion_prototypes',
        entries: {
          anger: { name: 'anger', intensity: 0.5 },
          joy: { name: 'joy', intensity: 0.3 },
          fear: { name: 'fear', intensity: 0.2 },
        },
      });

      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const keys = service.getEmotionPrototypeKeys();

      expect(keys).toBeInstanceOf(Array);
      expect(keys.length).toBe(3);
      expect(keys).toContain('anger');
      expect(keys).toContain('joy');
      expect(keys).toContain('fear');
    });

    it('should return sexual prototype keys when lookup is valid', () => {
      mockDataRegistry.store('lookups', 'core:sexual_prototypes', {
        id: 'core:sexual_prototypes',
        entries: {
          sex_excitation: { name: 'sex_excitation', value: 0 },
          sex_inhibition: { name: 'sex_inhibition', value: 0 },
          baseline_libido: { name: 'baseline_libido', value: 0.5 },
        },
      });

      const service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });

      const keys = service.getSexualPrototypeKeys();

      expect(keys).toBeInstanceOf(Array);
      expect(keys.length).toBe(3);
      expect(keys).toContain('sex_excitation');
      expect(keys).toContain('sex_inhibition');
      expect(keys).toContain('baseline_libido');
    });
  });
});
