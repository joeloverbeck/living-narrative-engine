import path from 'path';
import InputSanitizer from '../../../cli/validation/inputSanitizer.js';
import { ModSecurityError } from '../../../src/errors/modSecurityError.js';

describe('InputSanitizer', () => {
  const createLogger = () => ({
    error: jest.fn(),
  });

  const createSanitizer = (config = {}, logger = createLogger()) =>
    new InputSanitizer({ config, logger });

  describe('sanitizeFilePath', () => {
    it('normalizes safe file paths', () => {
      const sanitizer = createSanitizer();
      const rawPath = 'mods/example/./module/config.json';
      expect(sanitizer.sanitizeFilePath(rawPath)).toBe(path.normalize(rawPath));
    });

    it('rejects non-string inputs', () => {
      const sanitizer = createSanitizer();
      expect(() => sanitizer.sanitizeFilePath(null)).toThrow(ModSecurityError);
    });

    it('flags traversal attempts and reports through logger', () => {
      const logger = createLogger();
      const sanitizer = createSanitizer({}, logger);

      expect(() => sanitizer.sanitizeFilePath('mods/../secrets.json')).toThrow(
        ModSecurityError
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('blocks access to configured directories', () => {
      const sanitizer = createSanitizer({ blockedPaths: ['secrets'] });

      expect(() =>
        sanitizer.sanitizeFilePath('data/mods/demo/secrets/file.json')
      ).toThrow(ModSecurityError);
    });

    it('rejects disallowed file extensions', () => {
      const sanitizer = createSanitizer({ allowedExtensions: ['.json'] });

      expect(() =>
        sanitizer.sanitizeFilePath('data/mods/demo/config.exe')
      ).toThrow(ModSecurityError);
    });

    it('detects attempts to escape the mod directory', () => {
      const sanitizer = createSanitizer({
        blockedPaths: [],
        allowedExtensions: ['.json'],
        pathTraversalPatterns: [],
      });

      expect(() =>
        sanitizer.sanitizeFilePath('data/mods/demo/../outside.json')
      ).toThrow(ModSecurityError);
    });

    it('allows temporary files in test environments', () => {
      const sanitizer = createSanitizer();
      const tempPath = '/tmp/mod-work/config.scope';

      expect(sanitizer.sanitizeFilePath(tempPath)).toBe(
        path.normalize(tempPath)
      );
    });
  });

  describe('sanitizeJsonContent', () => {
    it('returns primitive values without modification', () => {
      const sanitizer = createSanitizer();
      expect(sanitizer.sanitizeJsonContent(42)).toBe(42);
    });

    it('passes through safe objects', () => {
      const sanitizer = createSanitizer();
      const payload = { name: 'demo', items: [1, 2, 3] };

      expect(sanitizer.sanitizeJsonContent(payload)).toBe(payload);
    });

    it('throws when nesting depth exceeds the limit', () => {
      const sanitizer = createSanitizer({ maxDepth: 1 });
      const payload = { level1: { level2: {} } };

      expect(() => sanitizer.sanitizeJsonContent(payload, 'deep.json')).toThrow(
        ModSecurityError
      );
    });

    it('throws when object has too many keys', () => {
      const sanitizer = createSanitizer({ maxKeys: 1 });
      const payload = { first: 'value', second: 'value' };

      expect(() => sanitizer.sanitizeJsonContent(payload, 'keys.json')).toThrow(
        ModSecurityError
      );
    });

    it('throws when array exceeds allowed length', () => {
      const sanitizer = createSanitizer({ maxArrayLength: 1 });
      const payload = { array: [1, 2] };

      expect(() =>
        sanitizer.sanitizeJsonContent(payload, 'array.json')
      ).toThrow(ModSecurityError);
    });

    it('throws when string exceeds allowed length', () => {
      const sanitizer = createSanitizer({ maxStringLength: 2 });
      const payload = { long: 'toolong' };

      expect(() =>
        sanitizer.sanitizeJsonContent(payload, 'string.json')
      ).toThrow(ModSecurityError);
    });

    it('detects dangerous keys even inside nested structures', () => {
      const sanitizer = createSanitizer();
      const payload = { wrapper: [{ constructor: {} }] };

      expect(() =>
        sanitizer.sanitizeJsonContent(payload, 'danger.json')
      ).toThrow(ModSecurityError);
    });

    it('honors custom dangerous key configuration', () => {
      const sanitizer = createSanitizer({ dangerousKeys: ['evil'] });
      const payload = { evil: true };

      expect(() =>
        sanitizer.sanitizeJsonContent(payload, 'config.json')
      ).toThrow(ModSecurityError);
    });

    it('wraps unexpected analysis errors in security errors', () => {
      const sanitizer = createSanitizer();
      const payload = {};

      Object.defineProperty(payload, 'problem', {
        enumerable: true,
        get() {
          throw new Error('unexpected access');
        },
      });

      expect(() =>
        sanitizer.sanitizeJsonContent(payload, 'failure.json')
      ).toThrow(ModSecurityError);
    });
  });

  describe('sanitizeScopeDslContent', () => {
    it('returns non-string input unchanged', () => {
      const sanitizer = createSanitizer();
      const data = { raw: true };

      expect(sanitizer.sanitizeScopeDslContent(data)).toBe(data);
    });

    it('allows valid expressions', () => {
      const sanitizer = createSanitizer();
      const expression = 'actor:hero target:villain';

      expect(sanitizer.sanitizeScopeDslContent(expression)).toBe(expression);
    });

    it('rejects overly long expressions', () => {
      const sanitizer = createSanitizer({ maxExpressionLength: 5 });

      expect(() =>
        sanitizer.sanitizeScopeDslContent('abcdef', 'long.scope')
      ).toThrow(ModSecurityError);
    });

    it('detects dangerous regex patterns', () => {
      const sanitizer = createSanitizer({ dangerousRegexPatterns: ['(.*)*'] });

      expect(() =>
        sanitizer.sanitizeScopeDslContent('pattern (.*)*', 'pattern.scope')
      ).toThrow(ModSecurityError);
    });

    it('enforces maximum nesting depth', () => {
      const sanitizer = createSanitizer({ maxNestingLevel: 1 });

      expect(() =>
        sanitizer.sanitizeScopeDslContent('((actor:hero))', 'depth.scope')
      ).toThrow(ModSecurityError);
    });

    it('limits reference counts', () => {
      const sanitizer = createSanitizer({ maxReferences: 1 });

      expect(() =>
        sanitizer.sanitizeScopeDslContent(
          'actor:hero target:villain',
          'refs.scope'
        )
      ).toThrow(ModSecurityError);
    });
  });

  describe('validateFileSize', () => {
    it('allows files within the configured limit', () => {
      const sanitizer = createSanitizer({ maxFileSize: 100 });

      expect(() => sanitizer.validateFileSize(50, 'file.json')).not.toThrow();
    });

    it('rejects files larger than allowed', () => {
      const sanitizer = createSanitizer({ maxFileSize: 100 });

      expect(() => sanitizer.validateFileSize(101, 'file.json')).toThrow(
        ModSecurityError
      );
    });
  });
});
