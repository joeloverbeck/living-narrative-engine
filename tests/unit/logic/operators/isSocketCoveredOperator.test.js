import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { IsSocketCoveredOperator } from '../../../../src/logic/operators/isSocketCoveredOperator.js';

describe('IsSocketCoveredOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockContext = {
      _currentPath: 'actor',
      actor: { id: 'actor-123' },
    };

    operator = new IsSocketCoveredOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(operator).toBeInstanceOf(IsSocketCoveredOperator);
      expect(operator.operatorName).toBe('isSocketCovered');
    });

    it('should not require anatomyBlueprintRepository dependency', () => {
      expect(operator).toBeInstanceOf(IsSocketCoveredOperator);
      expect(operator.operatorName).toBe('isSocketCovered');
    });
  });

  describe('evaluate', () => {
    it('should return false for invalid parameters', async () => {
      const result = await operator.evaluate([], mockContext);
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid parameters'
      );
    });

    it('should resolve entity path and delegate to evaluateInternal', async () => {
      // Mock the evaluateInternal method
      const evaluateInternalSpy = jest.spyOn(operator, 'evaluateInternal');
      evaluateInternalSpy.mockResolvedValue(true);

      const result = await operator.evaluate(['actor', 'vagina'], mockContext);

      expect(result).toBe(true);
      expect(evaluateInternalSpy).toHaveBeenCalledWith(
        'actor-123',
        ['vagina'],
        expect.objectContaining({
          _currentPath: 'actor',
        })
      );
    });
  });

  describe('evaluateInternal', () => {
    beforeEach(() => {
      // Setup default mocks for successful evaluation
      mockEntityManager.getComponentData.mockReturnValue({
        // clothing:equipment component
        equipped: {
          torso_lower: {
            underwear: ['panties-1'],
          },
        },
      });
    });

    it('should return false for missing socketId parameter', () => {
      const result = operator.evaluateInternal('actor-123', [], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Missing required parameter: socketId'
      );
    });

    it('should return false for invalid socketId parameter', () => {
      const result = operator.evaluateInternal(
        'actor-123',
        [null],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid socketId parameter: null'
      );
    });

    it('should return false when socket is not recognized', () => {
      // Clear the previous mocks from beforeEach
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_lower: {
            underwear: ['panties-1'],
          },
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['unknown_socket'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: No known clothing slots cover socket 'unknown_socket' for entity actor-123"
      );
    });

    it('should return true when socket is covered by equipped clothing', () => {
      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: Socket 'vagina' for entity actor-123 is covered by clothing"
      );
    });

    it('should return false when entity has no equipment component', () => {
      // Clear the previous mocks from beforeEach
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue(null); // No clothing:equipment component

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'isSocketCovered: Entity actor-123 has no clothing:equipment component'
      );
    });

    it('should return false when covering slots have no equipped items', () => {
      // Clear the previous mocks from beforeEach
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_upper: {
            base: ['shirt-1'],
          },
          // torso_lower has no items
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: Socket 'vagina' for entity actor-123 is not covered by clothing"
      );
    });

    it('should return true when socket is covered by multiple slots', () => {
      // Clear the previous mocks from beforeEach
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_lower: {}, // Empty
          torso_upper: {
            underwear: ['bra-1'],
          },
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['left_breast'],
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', () => {
      // Clear the previous mocks from beforeEach
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'isSocketCovered: Error checking socket coverage for entity actor-123, socket vagina',
        expect.any(Error)
      );
    });
  });

  // Note: Private method #findSlotsCoveringSocket is tested through the public interface
  // in the evaluateInternal tests above

  describe('integration scenarios', () => {
    it('should work with male anatomy', () => {
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_lower: {
            underwear: ['boxers-1'],
          },
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['penis'],
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should work with complex layering system', () => {
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_lower: {
            underwear: ['panties-1'],
            base: ['pants-1'],
            outer: ['skirt-1'],
          },
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should work with breast coverage', () => {
      jest.clearAllMocks();

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_upper: {
            underwear: ['bra-1'],
          },
        },
      });

      const result = operator.evaluateInternal(
        'actor-123',
        ['left_breast'],
        mockContext
      );

      expect(result).toBe(true);
    });
  });
});
