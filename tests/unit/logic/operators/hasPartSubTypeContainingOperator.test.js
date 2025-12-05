import { HasPartSubTypeContainingOperator } from '../../../../src/logic/operators/hasPartSubTypeContainingOperator.js';

describe('HasPartSubTypeContainingOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      bodyGraphService: {
        buildAdjacencyCache: jest.fn(),
        getAllParts: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    operator = new HasPartSubTypeContainingOperator(mockDependencies);
    mockContext = {};
  });

  describe('evaluate', () => {
    it('should return true when body part subType contains substring exactly', () => {
      // subType: 'beak', substring: 'beak' → true
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'beak' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.entityManager.getComponentData).toHaveBeenCalledWith('actor123', 'anatomy:body');
      expect(mockDependencies.bodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith('root123');
      expect(mockDependencies.bodyGraphService.getAllParts).toHaveBeenCalledWith('root123');
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining(actor123, beak) = true (found 1 parts)'
      );
      expect(result).toBe(true);
    });

    it('should return true when body part subType contains substring as part of larger string', () => {
      // subType: 'chicken_beak', substring: 'beak' → true
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'chicken_beak' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(true);
    });

    it('should return true for tortoise_beak with substring beak', () => {
      // subType: 'tortoise_beak', substring: 'beak' → true
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'tortoise_beak' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(true);
    });

    it('should return false when no body parts contain substring', () => {
      // subType: 'arm', substring: 'beak' → false
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'arm' },
        { subType: 'leg' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining(actor123, beak) = false (found 0 parts)'
      );
      expect(result).toBe(false);
    });

    it('should return false when entity has no body parts', () => {
      // empty body parts array → false
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(false);
    });

    it('should be case-insensitive', () => {
      // subType: 'CHICKEN_BEAK', substring: 'beak' → true
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'CHICKEN_BEAK' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(true);
    });

    it('should be case-insensitive for the search substring', () => {
      // subType: 'chicken_beak', substring: 'BEAK' → true
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'chicken_beak' }
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'BEAK'], mockContext);

      expect(result).toBe(true);
    });

    it('should return false for missing entityPath', () => {
      // null entityPath → false with warning
      mockContext.actor = undefined;

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: No entity found at path actor'
      );
      expect(result).toBe(false);
    });

    it('should return false for missing substring', () => {
      // null substring → false with warning
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', null], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Invalid substring parameter'
      );
      expect(result).toBe(false);
    });

    it('should return false for undefined substring', () => {
      // undefined substring → false with warning
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', undefined], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Invalid substring parameter'
      );
      expect(result).toBe(false);
    });

    it('should return false for non-string substring', () => {
      // substring: 123 → false with warning
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 123], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Invalid substring parameter'
      );
      expect(result).toBe(false);
    });

    it('should return false when entity has no body component', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should return false when body component has no root', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue({
        otherProp: 'value',
      });

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Error during evaluation',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });

    it('should return false with invalid parameters (missing substring)', () => {
      const result = operator.evaluate(['actor'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartSubTypeContaining: Invalid parameters'
      );
      expect(result).toBe(false);
    });

    it('should handle nested entity paths', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'beak' },
      ]);
      mockContext.event = { actor: { id: 'eventActor123' } };

      const result = operator.evaluate(['event.actor', 'beak'], mockContext);

      expect(mockDependencies.entityManager.getComponentData).toHaveBeenCalledWith('eventActor123', 'anatomy:body');
      expect(result).toBe(true);
    });

    it('should skip body parts without subType property', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { type: 'root' }, // No subType
        { subType: null }, // Null subType
        { subType: 'beak' }, // Valid
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining(actor123, beak) = true (found 1 parts)'
      );
    });

    it('should skip body parts with non-string subType', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 123 }, // Number, not string
        { subType: {} }, // Object, not string
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(false);
    });

    it('should match multiple beaks of different types', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.getAllParts.mockReturnValue([
        { subType: 'beak' },
        { subType: 'chicken_beak' },
        { subType: 'tortoise_beak' },
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'beak'], mockContext);

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartSubTypeContaining(actor123, beak) = true (found 3 parts)'
      );
    });
  });
});
