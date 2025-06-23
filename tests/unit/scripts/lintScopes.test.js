/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// We no longer need to mock the module file, as we are injecting the dependency.

describe('lintScopes', () => {
  let mockParseScopeDefinitions;
  let mockParserModule;
  let processExitSpy;
  let consoleLogSpy;
  let consoleErrorSpy;
  let lintScopesModule;

  beforeEach(() => {
    jest.clearAllMocks();

    // FIX: Create a mock parser function and a module object to inject it with.
    mockParseScopeDefinitions = jest.fn();
    mockParserModule = { parseScopeDefinitions: mockParseScopeDefinitions };

    lintScopesModule = require('../../../scripts/lintScopes.js');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('findScopeFiles', () => {
    test('should find all .scope files recursively', async () => {
      const dirs = {
        '/mock-mods': ['mod1'],
        '/mock-mods/mod1': ['scopes'],
        '/mock-mods/mod1/scopes': ['inventory.scope'],
      };
      const files = {
        '/mock-mods/mod1': true,
        '/mock-mods/mod1/scopes': true,
        '/mock-mods/mod1/scopes/inventory.scope': false,
      };
      const mockFs = {
        readdir: async (dir) => dirs[dir] || [],
        stat: async (p) => ({ isDirectory: () => files[p] === true }),
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: (file) => (file.endsWith('.scope') ? '.scope' : ''),
      };
      const result = await lintScopesModule.findScopeFiles(
        '/mock-mods',
        mockFs,
        mockPath
      );
      expect(result).toEqual(['/mock-mods/mod1/scopes/inventory.scope']);
    });
  });

  describe('validateScopeFile', () => {
    test('should return null for valid scope files', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('items := actor -> inventory[]'),
      };

      // FIX: Inject the mock parser module when calling the function.
      const result = await lintScopesModule.validateScopeFile(
        'valid.scope',
        mockFs,
        mockParserModule
      );

      expect(result).toBeNull();
      expect(mockParseScopeDefinitions).toHaveBeenCalledWith(
        'items := actor -> inventory[]',
        'valid.scope'
      );
    });

    test('should return an error if the parser throws an error', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('bad-scope-content'),
      };
      mockParseScopeDefinitions.mockImplementation(() => {
        throw new Error('Invalid DSL syntax');
      });

      const result = await lintScopesModule.validateScopeFile(
        'invalid.scope',
        mockFs,
        mockParserModule
      );
      expect(result).toEqual({
        file: 'invalid.scope',
        error: 'Invalid DSL syntax',
      });
    });

    test('should return an error for empty scope files', async () => {
      const mockFs = { readFile: jest.fn().mockResolvedValue(' \n\t\n') };
      const result = await lintScopesModule.validateScopeFile(
        'empty.scope',
        mockFs,
        mockParserModule
      );

      expect(result).toEqual({
        file: 'empty.scope',
        error: 'Empty scope file',
      });
      expect(mockParseScopeDefinitions).not.toHaveBeenCalled();
    });

    test('should return an error for file read errors', async () => {
      const mockFs = {
        readFile: jest.fn().mockRejectedValue(new Error('Permission denied')),
      };
      const result = await lintScopesModule.validateScopeFile(
        'unreadable.scope',
        mockFs,
        mockParserModule
      );
      expect(result).toEqual({
        file: 'unreadable.scope',
        error: 'Permission denied',
      });
    });
  });

  describe('lintScopes', () => {
    test('should handle multiple valid scope files', async () => {
      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['file1.scope', 'file2.scope']),
        stat: jest.fn().mockResolvedValue({ isDirectory: () => false }),
        readFile: jest.fn().mockResolvedValue('valid := content[]'),
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: () => '.scope',
      };

      // FIX: Inject the mock parser into the main linting function.
      await lintScopesModule.lintScopes(
        '/mock-mods',
        mockFs,
        mockPath,
        mockParserModule
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ 2 scope files valid');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('should fail on any invalid scope file', async () => {
      const mockFs = {
        readdir: jest.fn().mockResolvedValue(['invalid.scope']),
        stat: jest.fn().mockResolvedValue({ isDirectory: () => false }),
        readFile: jest.fn().mockResolvedValue('bad syntax'),
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: () => '.scope',
      };
      mockParseScopeDefinitions.mockImplementationOnce(() => {
        throw new Error('Syntax error');
      });

      await lintScopesModule.lintScopes(
        '/mock-mods',
        mockFs,
        mockPath,
        mockParserModule
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid.scope: Syntax error')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should handle no scope files found', async () => {
      const mockFs = { readdir: async () => [] };
      const mockPath = { join: (...args) => args.join('/'), extname: () => '' };

      await lintScopesModule.lintScopes(
        '/mock-mods',
        mockFs,
        mockPath,
        mockParserModule
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ 0 scope files valid');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});
