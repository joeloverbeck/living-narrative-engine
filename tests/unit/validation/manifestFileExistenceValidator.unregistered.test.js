/**
 * @file Unit tests for ManifestFileExistenceValidator unregistered files validation
 * @description Tests the inverse check: files on disk that are NOT registered in mod manifests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories/index.js';

// We need to test the validator class behavior through direct instantiation
// Since the fs module is used internally, we'll test the public API behavior

describe('ManifestFileExistenceValidator - Unregistered Files Validation', () => {
  let validator;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    // Dynamically import to get fresh instance
    const { default: ManifestFileExistenceValidator } = await import(
      '../../../cli/validation/manifestFileExistenceValidator.js'
    );

    // Use a non-existent path so we can test behavior with empty directories
    validator = new ManifestFileExistenceValidator({
      logger: mockLogger,
      modsBasePath: '/nonexistent/test/mods',
    });
  });

  describe('validateUnregisteredFiles', () => {
    it('should handle missing manifest gracefully', async () => {
      // Act
      const result = await validator.validateUnregisteredFiles('testmod', null);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
      expect(result.modId).toBe('testmod');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle undefined manifest gracefully', async () => {
      // Act
      const result = await validator.validateUnregisteredFiles('testmod', undefined);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
    });

    it('should handle missing content section gracefully', async () => {
      // Arrange - manifest without content section
      const manifest = {};

      // Act
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
    });

    it('should handle empty content section gracefully', async () => {
      // Arrange
      const manifest = { content: {} };

      // Act
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
    });

    it('should handle non-existent directories gracefully (ENOENT)', async () => {
      // Arrange - valid manifest but mod directory doesn't exist
      const manifest = {
        content: {
          actions: ['action1.json'],
          rules: ['rule1.json'],
        },
      };

      // Act - should not throw, should return valid result
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert - non-existent directories mean no unregistered files
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
    });

    it('should return result with correct modId', async () => {
      // Arrange
      const manifest = { content: {} };

      // Act
      const result = await validator.validateUnregisteredFiles('my-test-mod', manifest);

      // Assert
      expect(result.modId).toBe('my-test-mod');
    });

    it('should return result structure with expected properties', async () => {
      // Arrange
      const manifest = { content: {} };

      // Act
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert - verify structure
      expect(result).toHaveProperty('modId');
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('unregisteredFiles');
      expect(Array.isArray(result.unregisteredFiles)).toBe(true);
    });

    it('should handle entities with missing definitions and instances', async () => {
      // Arrange
      const manifest = {
        content: {
          entities: {}, // No definitions or instances arrays
        },
      };

      // Act
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.unregisteredFiles).toHaveLength(0);
    });

    it('should handle entities with empty arrays', async () => {
      // Arrange
      const manifest = {
        content: {
          entities: {
            definitions: [],
            instances: [],
          },
        },
      };

      // Act
      const result = await validator.validateUnregisteredFiles('testmod', manifest);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateAllModsUnregistered', () => {
    it('should validate multiple mods and return results map', async () => {
      // Arrange - empty manifests for non-existent paths
      const manifests = new Map([
        ['mod1', { content: {} }],
        ['mod2', { content: {} }],
      ]);

      // Act
      const results = await validator.validateAllModsUnregistered(manifests);

      // Assert
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.has('mod1')).toBe(true);
      expect(results.has('mod2')).toBe(true);
    });

    it('should return valid results for each mod', async () => {
      // Arrange
      const manifests = new Map([
        ['mod1', { content: {} }],
        ['mod2', { content: {} }],
      ]);

      // Act
      const results = await validator.validateAllModsUnregistered(manifests);

      // Assert
      for (const [modId, result] of results) {
        expect(result.modId).toBe(modId);
        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.unregisteredFiles)).toBe(true);
      }
    });

    it('should log summary after validation', async () => {
      // Arrange
      const manifests = new Map([
        ['mod1', { content: {} }],
      ]);

      // Act
      await validator.validateAllModsUnregistered(manifests);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Validating for unregistered files')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('validation complete'),
        expect.any(Object)
      );
    });

    it('should handle empty manifests map', async () => {
      // Arrange
      const manifests = new Map();

      // Act
      const results = await validator.validateAllModsUnregistered(manifests);

      // Assert
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });
  });

  describe('generateUnregisteredReport', () => {
    it('should generate success message when no issues found', () => {
      // Arrange
      const results = new Map([
        ['mod1', { modId: 'mod1', isValid: true, unregisteredFiles: [] }],
        ['mod2', { modId: 'mod2', isValid: true, unregisteredFiles: [] }],
      ]);

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('✅');
      expect(report).toContain('All content files on disk are registered');
    });

    it('should generate detailed report when issues found', () => {
      // Arrange
      const results = new Map([
        [
          'testmod',
          {
            modId: 'testmod',
            isValid: false,
            unregisteredFiles: [
              { category: 'actions', file: 'unregistered1.json' },
              { category: 'rules', file: 'unregistered2.json' },
            ],
          },
        ],
      ]);

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('⚠️');
      expect(report).toContain('testmod');
      expect(report).toContain('actions/unregistered1.json');
      expect(report).toContain('rules/unregistered2.json');
      expect(report).toContain('Unregistered files');
    });

    it('should report multiple mods with issues', () => {
      // Arrange
      const results = new Map([
        [
          'mod1',
          {
            modId: 'mod1',
            isValid: false,
            unregisteredFiles: [{ category: 'actions', file: 'file1.json' }],
          },
        ],
        [
          'mod2',
          {
            modId: 'mod2',
            isValid: false,
            unregisteredFiles: [{ category: 'rules', file: 'file2.json' }],
          },
        ],
      ]);

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('2 mod(s)');
      expect(report).toContain('mod1');
      expect(report).toContain('mod2');
    });

    it('should handle empty results map', () => {
      // Arrange
      const results = new Map();

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('✅');
    });

    it('should include category path in report', () => {
      // Arrange
      const results = new Map([
        [
          'testmod',
          {
            modId: 'testmod',
            isValid: false,
            unregisteredFiles: [
              { category: 'entities/definitions', file: 'entity.json' },
            ],
          },
        ],
      ]);

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('entities/definitions/entity.json');
    });

    it('should count mods with issues correctly', () => {
      // Arrange - 3 mods, only 2 have issues
      const results = new Map([
        [
          'mod1',
          {
            modId: 'mod1',
            isValid: false,
            unregisteredFiles: [{ category: 'actions', file: 'file1.json' }],
          },
        ],
        [
          'mod2',
          {
            modId: 'mod2',
            isValid: true,
            unregisteredFiles: [],
          },
        ],
        [
          'mod3',
          {
            modId: 'mod3',
            isValid: false,
            unregisteredFiles: [{ category: 'rules', file: 'file2.json' }],
          },
        ],
      ]);

      // Act
      const report = validator.generateUnregisteredReport(results);

      // Assert
      expect(report).toContain('2 mod(s)');
      expect(report).not.toContain('mod2');
    });
  });
});

describe('ManifestFileExistenceValidator - Constructor Validation', () => {
  it('should throw error when logger is missing', async () => {
    // Arrange
    const { default: ManifestFileExistenceValidator } = await import(
      '../../../cli/validation/manifestFileExistenceValidator.js'
    );

    // Act & Assert
    expect(() => {
      new ManifestFileExistenceValidator({});
    }).toThrow('Logger is required');
  });

  it('should throw error when logger lacks required methods', async () => {
    // Arrange
    const { default: ManifestFileExistenceValidator } = await import(
      '../../../cli/validation/manifestFileExistenceValidator.js'
    );

    // Act & Assert
    expect(() => {
      new ManifestFileExistenceValidator({ logger: {} });
    }).toThrow('Logger is required');
  });

  it('should accept valid logger with required methods', async () => {
    // Arrange
    const { default: ManifestFileExistenceValidator } = await import(
      '../../../cli/validation/manifestFileExistenceValidator.js'
    );
    const mockLogger = createMockLogger();

    // Act & Assert
    expect(() => {
      new ManifestFileExistenceValidator({ logger: mockLogger });
    }).not.toThrow();
  });
});
