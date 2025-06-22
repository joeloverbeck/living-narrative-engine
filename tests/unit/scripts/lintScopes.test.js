import { jest } from '@jest/globals';
// Remove global fs and path mocks
// import fs from 'fs/promises';
// import path from 'path';

// Mock the scope DSL parser
jest.mock('../../../src/scopeDsl/parser.js', () => ({
  parseInlineExpr: jest.fn()
}));

describe('lintScopes', () => {
  let mockParser;
  let processExitSpy;
  let consoleLogSpy;
  let consoleErrorSpy;
  let lintScopesModule;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParser = require('../../../src/scopeDsl/parser.js');
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
        '/mock-mods': ['mod1', 'mod2', 'other.txt'],
        '/mock-mods/mod1': ['scopes'],
        '/mock-mods/mod1/scopes': ['inventory.scope', 'equipment.scope'],
        '/mock-mods/mod2': ['scopes'],
        '/mock-mods/mod2/scopes': ['followers.scope']
      };
      const files = {
        '/mock-mods': true,
        '/mock-mods/mod1': true,
        '/mock-mods/mod2': true,
        '/mock-mods/mod1/scopes': true,
        '/mock-mods/mod2/scopes': true,
        '/mock-mods/mod1/scopes/inventory.scope': false,
        '/mock-mods/mod1/scopes/equipment.scope': false,
        '/mock-mods/mod2/scopes/followers.scope': false,
        '/mock-mods/other.txt': false
      };
      const mockFs = {
        readdir: async (dir) => dirs[dir] || [],
        stat: async (p) => ({ isDirectory: () => files[p] === true })
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: (file) => file.endsWith('.scope') ? '.scope' : ''
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.findScopeFiles('/mock-mods', mockFs, mockPath);
      expect(result).toEqual([
        '/mock-mods/mod1/scopes/inventory.scope',
        '/mock-mods/mod1/scopes/equipment.scope',
        '/mock-mods/mod2/scopes/followers.scope'
      ]);
    });
    test('should skip non-directory items', async () => {
      const mockFs = {
        readdir: async (dir) => (dir === '/mock-mods' ? ['file.txt'] : []),
        stat: async (p) => ({ isDirectory: () => false })
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: (file) => ''
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.findScopeFiles('/mock-mods', mockFs, mockPath);
      expect(result).toEqual([]);
    });
  });

  describe('validateScopeFile', () => {
    test('should parse valid scope files successfully', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('actor.inventory.items[]')
      };
      mockParser.parseInlineExpr.mockReturnValueOnce({ type: 'Step', field: 'items', isArray: true });
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.validateScopeFile('test.scope', mockFs);
      expect(result).toBeNull();
      expect(mockParser.parseInlineExpr).toHaveBeenCalledWith('actor.inventory.items[]');
    });
    test('should fail on invalid DSL syntax', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('invalid syntax here')
      };
      mockParser.parseInlineExpr.mockImplementationOnce(() => {
        throw new Error('Unexpected token');
      });
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.validateScopeFile('invalid.scope', mockFs);
      expect(result).toEqual({ file: 'invalid.scope', error: 'Unexpected token' });
    });
    test('should fail on invalid scope file format', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('actor -> inventory.items[]')
      };
      mockParser.parseInlineExpr.mockImplementationOnce(() => {
        throw new Error('Expected dot but found arrow');
      });
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.validateScopeFile('badformat.scope', mockFs);
      expect(result).toEqual({ file: 'badformat.scope', error: 'Expected dot but found arrow' });
    });
    test('should handle empty scope files', async () => {
      const mockFs = {
        readFile: jest.fn().mockResolvedValue('')
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.validateScopeFile('empty.scope', mockFs);
      expect(result).toEqual({ file: 'empty.scope', error: 'Empty scope file' });
    });
    test('should handle file read errors', async () => {
      const mockFs = {
        readFile: jest.fn().mockRejectedValue(new Error('Permission denied'))
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      const result = await lintScopesModule.validateScopeFile('unreadable.scope', mockFs);
      expect(result).toEqual({ file: 'unreadable.scope', error: 'Permission denied' });
    });
  });

  describe('lintScopes', () => {
    test('should handle multiple valid scope files', async () => {
      const dirs = {
        '/mock-mods': ['core'],
        '/mock-mods/core': ['scopes'],
        '/mock-mods/core/scopes': ['inventory.scope', 'equipment.scope']
      };
      const files = {
        '/mock-mods': true,
        '/mock-mods/core': true,
        '/mock-mods/core/scopes': true,
        '/mock-mods/core/scopes/inventory.scope': false,
        '/mock-mods/core/scopes/equipment.scope': false
      };
      const mockFs = {
        readdir: async (dir) => dirs[dir] || [],
        stat: async (p) => ({ isDirectory: () => files[p] === true }),
        readFile: jest.fn()
          .mockResolvedValueOnce('actor.inventory.items[]')
          .mockResolvedValueOnce('actor.equipment.equipped[]')
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: (file) => file.endsWith('.scope') ? '.scope' : ''
      };
      mockParser.parseInlineExpr.mockReturnValueOnce({ type: 'Step', field: 'items', isArray: true });
      mockParser.parseInlineExpr.mockReturnValueOnce({ type: 'Step', field: 'equipped', isArray: true });
      lintScopesModule = require('../../../scripts/lintScopes.js');
      await lintScopesModule.lintScopes('/mock-mods', mockFs, mockPath);
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ 2 scope files valid');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
    test('should fail on any invalid scope file', async () => {
      const dirs = {
        '/mock-mods': ['core'],
        '/mock-mods/core': ['scopes'],
        '/mock-mods/core/scopes': ['invalid.scope']
      };
      const files = {
        '/mock-mods': true,
        '/mock-mods/core': true,
        '/mock-mods/core/scopes': true,
        '/mock-mods/core/scopes/invalid.scope': false
      };
      const mockFs = {
        readdir: async (dir) => dirs[dir] || [],
        stat: async (p) => ({ isDirectory: () => files[p] === true }),
        readFile: jest.fn().mockResolvedValue('bad syntax')
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: (file) => file.endsWith('.scope') ? '.scope' : ''
      };
      mockParser.parseInlineExpr.mockImplementationOnce(() => {
        throw new Error('Syntax error');
      });
      lintScopesModule = require('../../../scripts/lintScopes.js');
      await lintScopesModule.lintScopes('/mock-mods', mockFs, mockPath);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('/mock-mods/core/scopes/invalid.scope')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
    test('should handle no scope files found', async () => {
      const mockFs = {
        readdir: async () => []
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: () => ''
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      await lintScopesModule.lintScopes('/mock-mods', mockFs, mockPath);
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ 0 scope files valid');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
    test('should handle fatal errors', async () => {
      const mockFs = {
        readdir: async () => { throw new Error('Fatal system error'); }
      };
      const mockPath = {
        join: (...args) => args.join('/'),
        extname: () => ''
      };
      lintScopesModule = require('../../../scripts/lintScopes.js');
      await lintScopesModule.lintScopes('/mock-mods', mockFs, mockPath);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read directory /mock-mods: Fatal system error')
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
}); 