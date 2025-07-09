import { HasPartOfTypeWithComponentValueOperator } from '../../../../src/logic/operators/hasPartOfTypeWithComponentValueOperator.js';

describe('HasPartOfTypeWithComponentValueOperator', () => {
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
        findPartsByType: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    operator = new HasPartOfTypeWithComponentValueOperator(mockDependencies);
    mockContext = {};
  });

  describe('evaluate', () => {
    it('should find part of type with matching component value', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(bodyComponent) // For body component
        .mockReturnValueOnce({ build: 'muscular' }) // For leg1 component
        .mockReturnValueOnce({ build: 'thin' }); // For leg2 component

      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([
        'leg1',
        'leg2',
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'leg', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('actor123', 'anatomy:body');
      expect(
        mockDependencies.bodyGraphService.buildAdjacencyCache
      ).toHaveBeenCalledWith('root123');
      expect(
        mockDependencies.bodyGraphService.findPartsByType
      ).toHaveBeenCalledWith('root123', 'leg');
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('leg1', 'descriptors:build');
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue(actor123, leg, descriptors:build, build, muscular) = true (found in part leg1)'
      );
      expect(result).toBe(true);
    });

    it('should return false when no part has matching value', () => {
      const bodyComponent = { body: { root: 'root456' } };
      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(bodyComponent)
        .mockReturnValueOnce({ build: 'thin' })
        .mockReturnValueOnce({ build: 'average' });

      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([
        'arm1',
        'arm2',
      ]);
      mockContext.target = { id: 'target789' };

      const result = operator.evaluate(
        ['target', 'arm', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue(target789, arm, descriptors:build, build, muscular) = false'
      );
      expect(result).toBe(false);
    });

    it('should handle nested property paths', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(bodyComponent)
        .mockReturnValueOnce({ status: { health: 'damaged' } });

      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([
        'part1',
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'torso', 'status:health', 'status.health', 'damaged'],
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should return false when no parts of type exist', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        bodyComponent
      );
      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'wing', 'descriptors:color', 'color', 'blue'],
        mockContext
      );

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Entity actor123 has no parts of type wing'
      );
      expect(result).toBe(false);
    });

    it('should handle parts without the specified component', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(bodyComponent)
        .mockReturnValueOnce(null) // Part has no component
        .mockReturnValueOnce({ color: 'red' }); // Second part has component

      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([
        'part1',
        'part2',
      ]);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'eye', 'descriptors:color', 'color', 'red'],
        mockContext
      );

      expect(result).toBe(true);
    });

    it('should return false when entity not found', () => {
      mockContext.actor = null;

      const result = operator.evaluate(
        ['actor', 'leg', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue: No entity found at path actor'
      );
      expect(result).toBe(false);
    });

    it('should return false when entity has no body component', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(
        ['actor', 'leg', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(
        ['actor', 'leg', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue: Error during evaluation',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });

    it('should return false with insufficient parameters', () => {
      // When entity is missing in context, it will warn about entity not found
      // rather than invalid parameters
      const result = operator.evaluate(['actor', 'leg'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue: No entity found at path actor'
      );
      expect(result).toBe(false);
    });

    it('should return false with invalid parameters', () => {
      // Test with truly invalid parameters (less than 2)
      const result = operator.evaluate(['actor'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartOfTypeWithComponentValue: Invalid parameters'
      );
      expect(result).toBe(false);
    });
  });
});
