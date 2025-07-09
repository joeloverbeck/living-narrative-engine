import {
  getBodyComponent,
  extractRootId,
  getRootIdFromEntity,
} from '../../../../src/logic/utils/bodyComponentUtils.js';

describe('bodyComponentUtils', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };
  });

  describe('getBodyComponent', () => {
    it('should return body component when it has direct root', () => {
      const bodyComponent = { root: 'entity123' };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'testEntity',
        'anatomy:body'
      );
      expect(result).toBe(bodyComponent);
    });

    it('should return body component when it has nested root', () => {
      const bodyComponent = { body: { root: 'entity123' } };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(result).toBe(bodyComponent);
    });

    it('should return body component when it has both formats', () => {
      const bodyComponent = {
        root: 'entity123',
        body: { root: 'entity456' },
      };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(result).toBe(bodyComponent);
    });

    it('should return null when entityId is null', () => {
      const result = getBodyComponent(mockEntityManager, null);

      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when entityId is undefined', () => {
      const result = getBodyComponent(mockEntityManager, undefined);

      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when entityId is empty string', () => {
      const result = getBodyComponent(mockEntityManager, '');

      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when component does not exist', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(result).toBeNull();
    });

    it('should return null when component has no root', () => {
      const bodyComponent = { someOtherProperty: 'value' };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(result).toBeNull();
    });

    it('should return null when component has empty body object', () => {
      const bodyComponent = { body: {} };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getBodyComponent(mockEntityManager, 'testEntity');

      expect(result).toBeNull();
    });
  });

  describe('extractRootId', () => {
    it('should extract root from direct root format', () => {
      const bodyComponent = { root: 'entity123' };
      const result = extractRootId(bodyComponent);

      expect(result).toBe('entity123');
    });

    it('should extract root from nested format', () => {
      const bodyComponent = { body: { root: 'entity456' } };
      const result = extractRootId(bodyComponent);

      expect(result).toBe('entity456');
    });

    it('should prefer nested format when both exist', () => {
      const bodyComponent = {
        root: 'direct123',
        body: { root: 'nested456' },
      };
      const result = extractRootId(bodyComponent);

      expect(result).toBe('nested456');
    });

    it('should return null for null component', () => {
      const result = extractRootId(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined component', () => {
      const result = extractRootId(undefined);

      expect(result).toBeNull();
    });

    it('should return null when no root exists', () => {
      const bodyComponent = { someOtherProperty: 'value' };
      const result = extractRootId(bodyComponent);

      expect(result).toBeNull();
    });

    it('should return null when body exists but has no root', () => {
      const bodyComponent = { body: { otherProp: 'value' } };
      const result = extractRootId(bodyComponent);

      expect(result).toBeNull();
    });

    it('should handle root with falsy but valid values', () => {
      const bodyComponent = { root: 0 };
      const result = extractRootId(bodyComponent);

      expect(result).toBe(0);
    });
  });

  describe('getRootIdFromEntity', () => {
    it('should return rootId and hasBody true when body component exists', () => {
      const bodyComponent = { root: 'entity123' };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getRootIdFromEntity(mockEntityManager, 'testEntity');

      expect(result).toEqual({
        rootId: 'entity123',
        hasBody: true,
      });
    });

    it('should return null rootId and hasBody false when no body component', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = getRootIdFromEntity(mockEntityManager, 'testEntity');

      expect(result).toEqual({
        rootId: null,
        hasBody: false,
      });
    });

    it('should return null rootId and hasBody true when body component has no root', () => {
      const bodyComponent = { someOtherProperty: 'value' };
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);

      const result = getRootIdFromEntity(mockEntityManager, 'testEntity');

      expect(result).toEqual({
        rootId: null,
        hasBody: false,
      });
    });
  });
});
