import { HasPartWithComponentValueOperator } from '../../../../src/logic/operators/hasPartWithComponentValueOperator.js';

describe('HasPartWithComponentValueOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      bodyGraphService: {
        hasPartWithComponentValue: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    operator = new HasPartWithComponentValueOperator(mockDependencies);
    mockContext = {};
  });

  describe('evaluate', () => {
    it('should find entity with matching component value', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        bodyComponent
      );
      mockDependencies.bodyGraphService.hasPartWithComponentValue.mockReturnValue(
        { found: true }
      );
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('actor123', 'anatomy:body');
      expect(
        mockDependencies.bodyGraphService.hasPartWithComponentValue
      ).toHaveBeenCalledWith(
        bodyComponent,
        'descriptors:build',
        'build',
        'muscular'
      );
      expect(result).toBe(true);
    });

    it('should handle legacy body format', () => {
      const bodyComponent = { body: { root: 'root456' } };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        bodyComponent
      );
      mockDependencies.bodyGraphService.hasPartWithComponentValue.mockReturnValue(
        { found: false }
      );
      mockContext.target = { id: 'target789' };

      const result = operator.evaluate(
        ['target', 'descriptors:color', 'value', 'red'],
        mockContext
      );

      expect(
        mockDependencies.bodyGraphService.hasPartWithComponentValue
      ).toHaveBeenCalledWith(
        bodyComponent,
        'descriptors:color',
        'value',
        'red'
      );
      expect(result).toBe(false);
    });

    it('should handle special "." path', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        bodyComponent
      );
      mockDependencies.bodyGraphService.hasPartWithComponentValue.mockReturnValue(
        { found: true }
      );
      mockContext.entity = { id: 'current123' };

      const result = operator.evaluate(
        ['.', 'descriptors:state', 'active', true],
        mockContext
      );

      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('current123', 'anatomy:body');
      expect(result).toBe(true);
    });

    it('should return false when entity not found', () => {
      mockContext.actor = null;

      const result = operator.evaluate(
        ['actor', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartWithComponentValue: No entity found at path actor'
      );
      expect(result).toBe(false);
    });

    it('should return false when entity has no body component', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(
        ['actor', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartWithComponentValue: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should return false with invalid parameters', () => {
      const result = operator.evaluate(['actor'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartWithComponentValue: Invalid parameters'
      );
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(
        ['actor', 'descriptors:build', 'build', 'muscular'],
        mockContext
      );

      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'hasPartWithComponentValue: Error during evaluation',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });
  });
});
