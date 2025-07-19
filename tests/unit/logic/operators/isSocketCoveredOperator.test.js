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
  });

  describe('evaluateInternal', () => {
    it('should return false when parameters are missing', () => {
      const result = operator.evaluateInternal('actor-123', [], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Missing required parameter: socketId'
      );
    });

    it('should return false when socketId is invalid', () => {
      const result = operator.evaluateInternal('actor-123', [null], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid socketId parameter: null'
      );
    });

    it('should return false when entity has no equipment component', () => {
      // Mock no equipment component - this is checked first
      mockEntityManager.getComponentData.mockReturnValueOnce(null);

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: Entity actor-123 has no clothing:equipment component"
      );
    });

    it('should return false when socket is not recognized', () => {
      // Mock entity with equipment (checked first) and slot metadata with no matching socket
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              underwear: 'panties-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
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
        "isSocketCovered: No clothing slots cover socket 'unknown_socket' for entity actor-123"
      );
    });

    it('should return true when socket is covered by equipped clothing', () => {
      // Mock entity with equipment (checked first) and slot metadata that covers the socket
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              underwear: 'panties-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
          },
        });

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

    it('should return false when entity has no slot metadata component', () => {
      // Mock entity with equipment but no slot metadata
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              underwear: 'panties-1',
            },
          },
        })
        .mockReturnValueOnce(null); // No clothing:slot_metadata component

      const result = operator.evaluateInternal(
        'actor-123',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: Entity actor-123 has no clothing:slot_metadata component"
      );
    });

    it('should return false when covering slots have no equipped items', () => {
      // Mock entity with equipment (checked first) and slot metadata but no items in the covering slot
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_upper: {
              base: 'shirt-1',
            },
            // Note: torso_lower has no equipped items
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
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
      // Mock entity with equipment (checked first) and slot metadata where socket could be covered by multiple slots
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            full_body: {
              outer: 'dress-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'left_hip', 'right_hip'],
              allowedLayers: ['underwear', 'base', 'outer'],
            },
            full_body: {
              coveredSockets: ['vagina', 'left_breast', 'right_breast'],
              allowedLayers: ['outer'],
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

    it('should handle errors gracefully', () => {
      // Mock an error during getComponentData
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Mock error');
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

  describe('clearCache', () => {
    it('should clear cache for specific entity', () => {
      // First, populate cache by making a call - equipment checked first, then slot metadata
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              underwear: 'panties-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina'],
              allowedLayers: ['underwear'],
            },
          },
        });

      operator.evaluateInternal('actor-123', ['vagina'], mockContext);

      // Clear cache
      operator.clearCache('actor-123');

      // This should work without throwing any errors
      expect(() => operator.clearCache('actor-123')).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should work with male anatomy', () => {
      // Mock male anatomy - equipment checked first, then slot metadata
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              underwear: 'boxers-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['penis', 'left_testicle', 'right_testicle'],
              allowedLayers: ['underwear', 'base', 'outer'],
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
      // Mock entity with multiple layers - equipment checked first, then slot metadata
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_upper: {
              underwear: 'bra-1',
              base: 'shirt-1',
              outer: 'jacket-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_breast', 'right_breast', 'chest_center'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
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

    it('should work with breast coverage', () => {
      // Mock female anatomy with breast coverage - equipment checked first, then slot metadata
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_upper: {
              base: 'shirt-1',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_breast', 'right_breast', 'left_chest', 'right_chest', 'chest_center'],
              allowedLayers: ['underwear', 'base', 'outer', 'armor'],
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