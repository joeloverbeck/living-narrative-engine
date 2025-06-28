import errorFactory from '../../src/scopeDsl/core/errorFactory.js';
import { ScopeDslError } from '../../src/scopeDsl/errors/scopeDslError.js';

describe('errorFactory', () => {
  describe('unknown', () => {
    it('should create ScopeDslError with correct message for simple kind', () => {
      const error = errorFactory.unknown('invalidKind', {
        type: 'Test',
        kind: 'invalidKind',
      });

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toBe(
        'Unknown node kind: \'invalidKind\'. Full node: {"type":"Test","kind":"invalidKind"}'
      );
      expect(error.name).toBe('ScopeDslError');
    });

    it('should handle complex node values', () => {
      const complexNode = {
        type: 'Step',
        kind: 'unknownStep',
        param: 'someParam',
        nested: {
          foo: 'bar',
          array: [1, 2, 3],
        },
      };

      const error = errorFactory.unknown('unknownStep', complexNode);

      expect(error).toBeInstanceOf(ScopeDslError);
      expect(error.message).toContain("Unknown node kind: 'unknownStep'");
      expect(error.message).toContain(JSON.stringify(complexNode));
    });

    it('should handle null and undefined values', () => {
      const errorNull = errorFactory.unknown('nullKind', null);
      expect(errorNull.message).toBe(
        "Unknown node kind: 'nullKind'. Full node: null"
      );

      const errorUndefined = errorFactory.unknown('undefinedKind', undefined);
      expect(errorUndefined.message).toBe(
        "Unknown node kind: 'undefinedKind'. Full node: undefined"
      );
    });

    it('should handle circular references in node value', () => {
      const circularNode = { type: 'Test', kind: 'circular' };
      circularNode.self = circularNode;

      // JSON.stringify will throw on circular references
      expect(() => errorFactory.unknown('circular', circularNode)).toThrow();
    });

    it('should handle string values', () => {
      const error = errorFactory.unknown('stringKind', 'just a string');
      expect(error.message).toBe(
        'Unknown node kind: \'stringKind\'. Full node: "just a string"'
      );
    });

    it('should handle number values', () => {
      const error = errorFactory.unknown('numberKind', 42);
      expect(error.message).toBe(
        "Unknown node kind: 'numberKind'. Full node: 42"
      );
    });

    it('should handle boolean values', () => {
      const error = errorFactory.unknown('boolKind', true);
      expect(error.message).toBe(
        "Unknown node kind: 'boolKind'. Full node: true"
      );
    });

    it('should handle array values', () => {
      const error = errorFactory.unknown('arrayKind', ['a', 'b', 'c']);
      expect(error.message).toBe(
        'Unknown node kind: \'arrayKind\'. Full node: ["a","b","c"]'
      );
    });

    it('should escape special characters in kind parameter', () => {
      const error = errorFactory.unknown('kind\'with"quotes', { type: 'Test' });
      expect(error.message).toContain("Unknown node kind: 'kind'with\"quotes'");
    });
  });
});
