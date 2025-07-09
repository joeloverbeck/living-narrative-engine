import {
  resolveEntityPath,
  hasValidEntityId,
} from '../../../../src/logic/utils/entityPathResolver.js';

describe('entityPathResolver', () => {
  describe('resolveEntityPath', () => {
    it('should resolve simple path successfully', () => {
      const context = { actor: { id: 'actor123' } };
      const result = resolveEntityPath(context, 'actor');

      expect(result).toEqual({
        entity: { id: 'actor123' },
        isValid: true,
      });
    });

    it('should resolve nested path successfully', () => {
      const context = {
        event: {
          target: {
            id: 'target456',
          },
        },
      };
      const result = resolveEntityPath(context, 'event.target');

      expect(result).toEqual({
        entity: { id: 'target456' },
        isValid: true,
      });
    });

    it('should resolve deep nested path successfully', () => {
      const context = {
        event: {
          source: {
            parent: {
              id: 'parent789',
            },
          },
        },
      };
      const result = resolveEntityPath(context, 'event.source.parent');

      expect(result).toEqual({
        entity: { id: 'parent789' },
        isValid: true,
      });
    });

    it('should handle special "." path for current entity', () => {
      const context = { entity: { id: 'current123' } };
      const result = resolveEntityPath(context, '.');

      expect(result).toEqual({
        entity: { id: 'current123' },
        isValid: true,
      });
    });

    it('should return invalid for null context', () => {
      const result = resolveEntityPath(null, 'actor');

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should return invalid for undefined path', () => {
      const context = { actor: { id: 'actor123' } };
      const result = resolveEntityPath(context, undefined);

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should return invalid for empty string path', () => {
      const context = { actor: { id: 'actor123' } };
      const result = resolveEntityPath(context, '');

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should return invalid for non-string path', () => {
      const context = { actor: { id: 'actor123' } };
      const result = resolveEntityPath(context, 123);

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should return invalid when path does not exist', () => {
      const context = { actor: { id: 'actor123' } };
      const result = resolveEntityPath(context, 'nonexistent');

      expect(result).toEqual({
        entity: undefined,
        isValid: false,
      });
    });

    it('should return invalid when intermediate path is null', () => {
      const context = { event: null };
      const result = resolveEntityPath(context, 'event.target');

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should return invalid when intermediate path is not an object', () => {
      const context = { event: 'string' };
      const result = resolveEntityPath(context, 'event.target');

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });

    it('should handle "." path when entity is null', () => {
      const context = { entity: null };
      const result = resolveEntityPath(context, '.');

      expect(result).toEqual({
        entity: null,
        isValid: false,
      });
    });
  });

  describe('hasValidEntityId', () => {
    it('should return true for entity with id property', () => {
      expect(hasValidEntityId({ id: 'test123' })).toBe(true);
    });

    it('should return true for entity with numeric id', () => {
      expect(hasValidEntityId({ id: 0 })).toBe(true);
    });

    it('should return false for null entity', () => {
      expect(hasValidEntityId(null)).toBe(false);
    });

    it('should return false for undefined entity', () => {
      expect(hasValidEntityId(undefined)).toBe(false);
    });

    it('should return false for entity without id', () => {
      expect(hasValidEntityId({ name: 'test' })).toBe(false);
    });

    it('should return false for entity with null id', () => {
      expect(hasValidEntityId({ id: null })).toBe(false);
    });

    it('should return false for entity with undefined id', () => {
      expect(hasValidEntityId({ id: undefined })).toBe(false);
    });
  });
});
