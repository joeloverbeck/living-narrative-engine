import { HasPartOfTypeOperator } from '../../../../src/logic/operators/hasPartOfTypeOperator.js';

describe('HasPartOfTypeOperator', () => {
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
    operator = new HasPartOfTypeOperator(mockDependencies);
    mockContext = {};
  });

  describe('evaluate', () => {
    it('should find parts of specified type', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue(['leg1', 'leg2']);
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'leg'], mockContext);

      expect(mockDependencies.entityManager.getComponentData).toHaveBeenCalledWith(
        'actor123',
        'anatomy:body'
      );
      expect(mockDependencies.bodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith('root123');
      expect(mockDependencies.bodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'root123',
        'leg'
      );
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfType(actor123, leg) = true (found 2 parts)'
      );
      expect(result).toBe(true);
    });

    it('should return false when no parts of type found', () => {
      const bodyComponent = { body: { root: 'root456' } };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue([]);
      mockContext.target = { id: 'target789' };

      const result = operator.evaluate(['target', 'wing'], mockContext);

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfType(target789, wing) = false (found 0 parts)'
      );
      expect(result).toBe(false);
    });

    it('should handle nested entity paths', () => {
      const bodyComponent = { root: 'root123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(bodyComponent);
      mockDependencies.bodyGraphService.findPartsByType.mockReturnValue(['arm1']);
      mockContext.event = { actor: { id: 'eventActor123' } };

      const result = operator.evaluate(['event.actor', 'arm'], mockContext);

      expect(mockDependencies.entityManager.getComponentData).toHaveBeenCalledWith(
        'eventActor123',
        'anatomy:body'
      );
      expect(result).toBe(true);
    });

    it('should return false when entity not found', () => {
      mockContext.actor = undefined;

      const result = operator.evaluate(['actor', 'leg'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartOfType: No entity found at path actor'
      );
      expect(result).toBe(false);
    });

    it('should return false when entity has no body component', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'leg'], mockContext);

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfType: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should return false when body component has no root', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockReturnValue({ otherProp: 'value' });

      const result = operator.evaluate(['actor', 'leg'], mockContext);

      // The getBodyComponent utility returns null for components without root,
      // so the message will be "no anatomy:body component"
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasPartOfType: Entity actor123 has no anatomy:body component'
      );
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockContext.actor = { id: 'actor123' };
      mockDependencies.entityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['actor', 'leg'], mockContext);

      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'hasPartOfType: Error during evaluation',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });

    it('should return false with invalid parameters', () => {
      const result = operator.evaluate(['actor'], mockContext);

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasPartOfType: Invalid parameters'
      );
      expect(result).toBe(false);
    });
  });
});