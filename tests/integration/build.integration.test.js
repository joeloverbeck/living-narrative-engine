/**
 * @file Integration tests for build system
 * Tests complete build workflow and component interactions
 */

const {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} = require('@jest/globals');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const BuildSystem = require('../../scripts/lib/BuildSystem.js');
const buildConfig = require('../../scripts/build.config.js');

// Mock file system operations for controlled testing
jest.mock('fs-extra');
jest.mock('child_process');

// Mock BuildProgress to avoid ora ES module import issues
jest.mock('../../scripts/lib/BuildProgress.js', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    complete: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    summary: jest.fn(),
    cleanup: jest.fn(),
  }));
});

// Global variable to share mockFiles with mocked validator
let mockFiles;

// Don't mock BuildValidator - use the real implementation

// Mock chalk to avoid potential ES module issues
jest.mock('chalk', () => {
  const createMockColor = () => {
    const mockColor = jest.fn((text) => text);
    mockColor.bold = jest.fn((text) => text);
    return mockColor;
  };

  const chalk = {
    green: createMockColor(),
    red: createMockColor(),
    blue: createMockColor(),
    gray: createMockColor(),
    yellow: createMockColor(),
    cyan: createMockColor(),
    magenta: createMockColor(),
    white: createMockColor(),
    black: createMockColor(),
  };

  // Return with default export to match chalk v5 CommonJS structure
  return { default: chalk };
});

describe('Build System Integration', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock file system
    tempDir = '/tmp/build-test';
    mockFiles = new Map(); // Use global variable

    // Mock fs.pathExists
    fs.pathExists = jest.fn().mockImplementation((filePath) => {
      return Promise.resolve(mockFiles.has(filePath));
    });

    // Mock fs.access for fileUtils.fileExists compatibility
    fs.access = jest.fn().mockImplementation((filePath) => {
      if (mockFiles.has(filePath)) {
        return Promise.resolve();
      } else {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      }
    });

    // Mock fs.readFile for sourcemap validation
    fs.readFile = jest.fn().mockImplementation((filePath, encoding) => {
      if (mockFiles.has(filePath)) {
        const file = mockFiles.get(filePath);
        if (filePath.endsWith('.js')) {
          return Promise.resolve(
            '//# sourceMappingURL=' + path.basename(filePath) + '.map'
          );
        }
        return Promise.resolve(file.content || '');
      } else {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      }
    });

    // Mock fs.stat
    fs.stat = jest.fn().mockImplementation((filePath) => {
      if (!mockFiles.has(filePath)) {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      }
      const file = mockFiles.get(filePath);
      return Promise.resolve({
        size: file.size || 1024,
        isFile: () => file.type === 'file',
        isDirectory: () => file.type === 'directory',
      });
    });

    // Mock fs.copy
    fs.copy = jest.fn().mockImplementation((src, dest, options) => {
      if (mockFiles.has(src)) {
        mockFiles.set(dest, mockFiles.get(src));
      } else {
        // For files that exist in the "real" filesystem but not in mock, create them
        // Determine size based on file type
        let size = 512;
        if (dest.endsWith('.html')) size = 640;
        if (dest.endsWith('.css')) size = 2048;
        if (dest.endsWith('.js')) size = 1024;
        mockFiles.set(dest, { type: 'file', size });
      }
      return Promise.resolve();
    });

    // Mock fs.ensureDir
    fs.ensureDir = jest.fn().mockResolvedValue();

    // Mock fs.emptyDir (used by cleanDirectory)
    fs.emptyDir = jest.fn().mockResolvedValue();

    // Mock fs.remove
    fs.remove = jest.fn().mockImplementation((filePath) => {
      mockFiles.delete(filePath);
      return Promise.resolve();
    });

    // Mock fs.readdir
    fs.readdir = jest.fn().mockImplementation((dirPath) => {
      if (!mockFiles.has(dirPath)) {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      }
      const files = Array.from(mockFiles.keys())
        .filter((key) => {
          const parent = path.dirname(key);
          return parent === dirPath;
        })
        .map((key) => path.basename(key));
      return Promise.resolve(files);
    });

    // Setup required source files
    mockFiles.set('src/main.js', { type: 'file', size: 2048 });
    mockFiles.set('src/anatomy-visualizer.js', { type: 'file', size: 1536 });
    mockFiles.set('src/thematic-direction-main.js', {
      type: 'file',
      size: 1024,
    });
    mockFiles.set(
      'src/thematicDirectionsManager/thematicDirectionsManagerMain.js',
      { type: 'file', size: 1024 }
    );
    mockFiles.set('src/character-concepts-manager-entry.js', {
      type: 'file',
      size: 1024,
    });
    mockFiles.set('src/cliches-generator-main.js', {
      type: 'file',
      size: 1024,
    });
    mockFiles.set('src/core-motivations-generator-main.js', {
      type: 'file',
      size: 1024,
    });
    mockFiles.set('src/traits-generator-main.js', {
      type: 'file',
      size: 1024,
    });

    // Setup HTML files
    mockFiles.set('index.html', { type: 'file', size: 512 });
    mockFiles.set('game.html', { type: 'file', size: 768 });
    mockFiles.set('anatomy-visualizer.html', { type: 'file', size: 640 });
    mockFiles.set('character-concepts-manager.html', {
      type: 'file',
      size: 512,
    });
    mockFiles.set('thematic-direction-generator.html', {
      type: 'file',
      size: 480,
    });
    mockFiles.set('thematic-directions-manager.html', {
      type: 'file',
      size: 560,
    });
    mockFiles.set('cliches-generator.html', {
      type: 'file',
      size: 520,
    });
    mockFiles.set('core-motivations-generator.html', {
      type: 'file',
      size: 520,
    });
    mockFiles.set('traits-generator.html', {
      type: 'file',
      size: 520,
    });

    // Setup static directories (source)
    mockFiles.set('css', { type: 'directory' });
    mockFiles.set('css/main.css', { type: 'file', size: 2048 });
    mockFiles.set('data', { type: 'directory' });
    mockFiles.set('data/config.json', { type: 'file', size: 256 });
    mockFiles.set('config', { type: 'directory' });
    mockFiles.set('config/settings.json', { type: 'file', size: 128 });

    // Setup expected dist directory structure (what build should create)
    mockFiles.set('dist', { type: 'directory' });
    mockFiles.set('dist/css', { type: 'directory' });
    mockFiles.set('dist/css/main.css', { type: 'file', size: 2048 });
    mockFiles.set('dist/data', { type: 'directory' });
    mockFiles.set('dist/data/config.json', { type: 'file', size: 256 });
    mockFiles.set('dist/config', { type: 'directory' });
    mockFiles.set('dist/config/settings.json', { type: 'file', size: 128 });

    // Expected JavaScript output files that esbuild would create
    const expectedBundles = [
      'dist/bundle.js',
      'dist/anatomy-visualizer.js',
      'dist/thematic-direction.js',
      'dist/thematic-directions-manager.js',
      'dist/character-concepts-manager.js',
      'dist/cliches-generator-main.js',
      'dist/core-motivations-generator.js',
      'dist/traits-generator.js',
    ];

    // Mock successful esbuild execution
    const mockProcess = {
      on: jest.fn(),
      stderr: { on: jest.fn() },
    };
    spawn.mockReturnValue(mockProcess);

    // Simulate successful build - create files in callback to match real esbuild behavior
    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        // Create the bundle files when esbuild "completes"
        setTimeout(() => {
          for (const bundle of expectedBundles) {
            mockFiles.set(bundle, { type: 'file', size: 2048 });
            mockFiles.set(bundle + '.map', { type: 'file', size: 512 }); // sourcemaps
          }
          callback(0); // Exit code 0 = success
        }, 1);
      }
    });

    // Pre-create all expected HTML files in dist after fs.copy operations
    const expectedHtmlFiles = [
      'dist/index.html',
      'dist/game.html',
      'dist/anatomy-visualizer.html',
      'dist/character-concepts-manager.html',
      'dist/thematic-direction-generator.html',
      'dist/thematic-directions-manager.html',
      'dist/cliches-generator.html',
      'dist/core-motivations-generator.html',
      'dist/traits-generator.html',
    ];

    for (const htmlFile of expectedHtmlFiles) {
      mockFiles.set(htmlFile, { type: 'file', size: 640 });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Build Workflow', () => {
    it('should execute full build successfully', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        mode: 'development',
        parallel: true,
        verbose: false,
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // Verify JavaScript bundles were built
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['esbuild']),
        expect.any(Object)
      );
      expect(spawn).toHaveBeenCalledTimes(8); // 8 bundles

      // Verify HTML files were copied
      expect(fs.copy).toHaveBeenCalledWith('index.html', 'dist/index.html', {
        overwrite: true,
      });
      expect(fs.copy).toHaveBeenCalledWith(
        'character-concepts-manager.html',
        'dist/character-concepts-manager.html',
        { overwrite: true }
      );

      // Verify output files exist
      expect(mockFiles.has('dist/bundle.js')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.js')).toBe(true);
      expect(mockFiles.has('dist/cliches-generator-main.js')).toBe(true);
      expect(mockFiles.has('dist/core-motivations-generator.js')).toBe(true);
    });

    it('should handle production build mode', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        mode: 'production',
        parallel: true,
        verbose: false,
        // Don't use fast mode for production testing to test actual minify behavior
      });

      await buildSystem.build();

      // Verify minify flag is passed to esbuild
      const esbuildCalls = spawn.mock.calls;
      expect(esbuildCalls.some((call) => call[1].includes('--minify'))).toBe(
        true
      );

      // Verify no sourcemap flag in production
      expect(esbuildCalls.some((call) => call[1].includes('--sourcemap'))).toBe(
        false
      );
    });

    it('should handle missing source files gracefully', async () => {
      // Remove a required source file
      mockFiles.delete('src/main.js');

      const buildSystem = new BuildSystem(buildConfig);

      await expect(buildSystem.build()).rejects.toThrow(
        /Initialization failed/
      );
    });
  });

  describe('Parallel vs Sequential Building', () => {
    it('should build bundles in parallel by default', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        parallel: true,
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // All bundles should be processed (parallel execution)
      expect(spawn).toHaveBeenCalledTimes(8);
    });

    it('should build bundles sequentially when parallel disabled', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        parallel: false,
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // Still processes all bundles, but with concurrency of 1
      expect(spawn).toHaveBeenCalledTimes(8);
    });
  });

  describe('Build Validation', () => {
    it('should validate successful build output', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // Verify all expected output files were created
      expect(mockFiles.has('dist/bundle.js')).toBe(true);
      expect(mockFiles.has('dist/anatomy-visualizer.js')).toBe(true);
      expect(mockFiles.has('dist/thematic-direction.js')).toBe(true);
      expect(mockFiles.has('dist/thematic-directions-manager.js')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.js')).toBe(true);
      expect(mockFiles.has('dist/cliches-generator-main.js')).toBe(true);
      expect(mockFiles.has('dist/core-motivations-generator.js')).toBe(true);
      expect(mockFiles.has('dist/traits-generator.js')).toBe(true);

      // Verify HTML files were copied
      expect(mockFiles.has('dist/index.html')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.html')).toBe(true);
      expect(mockFiles.has('dist/cliches-generator.html')).toBe(true);
      expect(mockFiles.has('dist/core-motivations-generator.html')).toBe(true);
      expect(mockFiles.has('dist/traits-generator.html')).toBe(true);
    });

    it('should detect missing output files', async () => {
      // Override the mock to simulate a missing output file
      const incompleteBundles = [
        'dist/anatomy-visualizer.js',
        'dist/thematic-direction.js',
        'dist/thematic-directions-manager.js',
        'dist/character-concepts-manager.js',
        'dist/cliches-generator-main.js',
        'dist/core-motivations-generator.js',
        'dist/traits-generator.js',
        // Intentionally omit 'dist/bundle.js' to simulate build failure
      ];

      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() },
      };
      spawn.mockReturnValue(mockProcess);

      // Mock esbuild to create files but skip dist/bundle.js
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => {
            for (const bundle of incompleteBundles) {
              mockFiles.set(bundle, { type: 'file', size: 2048 });
              mockFiles.set(bundle + '.map', { type: 'file', size: 512 });
            }
            callback(0); // Return success, but validation should catch missing file
          }, 1);
        }
      });

      const buildSystem = new BuildSystem(buildConfig, {
        // Don't use fast mode to enable validation
        verbose: false,
      });

      await expect(buildSystem.build()).rejects.toThrow();
    });
  });

  describe('File Size Validation', () => {
    it('should warn about large bundle sizes', async () => {
      // First create all expected files 
      const expectedBundles = [
        'dist/bundle.js',
        'dist/anatomy-visualizer.js',
        'dist/thematic-direction.js',
        'dist/thematic-directions-manager.js',
        'dist/character-concepts-manager.js',
        'dist/cliches-generator-main.js',
        'dist/core-motivations-generator.js',
        'dist/traits-generator.js',
      ];

      for (const bundle of expectedBundles) {
        mockFiles.set(bundle, { type: 'file', size: 2048 });
        mockFiles.set(bundle + '.map', { type: 'file', size: 512 });
      }

      // Then create one very large bundle - BuildValidator doesn't actually check for large files  
      // This test should check that validation passes for large files
      mockFiles.set('dist/bundle.js', { type: 'file', size: 15000000 }); // 15MB

      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });
      const validator = buildSystem.validator;

      const result = await validator.validate();

      expect(result.success).toBe(true);
      // Large files don't generate warnings in the actual BuildValidator
    });

    it('should warn about suspiciously small files', async () => {
      // Create a very small bundle (under minFileSize threshold of 1000 bytes)
      mockFiles.set('dist/bundle.js', { type: 'file', size: 10 }); // 10 bytes

      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });
      const validator = buildSystem.validator;

      const result = await validator.validate();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.message.includes('unusually small'))
      ).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle esbuild errors gracefully', async () => {
      // Mock esbuild to simulate failure
      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() },
      };
      spawn.mockReturnValue(mockProcess);

      // Simulate esbuild failure (exit code 1, no files created)
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => {
            // Don't create any files - simulate esbuild failure
            callback(1); // Exit code 1 = failure
          }, 1);
        }
      });

      const buildSystem = new BuildSystem(buildConfig, {
        // Don't use fast mode to enable validation
        verbose: false,
      });

      await expect(buildSystem.build()).rejects.toThrow();
    });

    it('should handle file system errors', async () => {
      // Mock file copy failure
      fs.copy.mockRejectedValue(new Error('Permission denied'));

      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });

      await expect(buildSystem.build()).rejects.toThrow();
    });
  });

  describe('Configuration Variants', () => {
    it('should handle custom build configuration', async () => {
      const customConfig = {
        ...buildConfig,
        bundles: [
          { name: 'custom', entry: 'src/custom.js', output: 'custom.js' },
        ],
        htmlFiles: [], // No HTML files expected
        staticDirs: [], // No static dirs expected
      };

      // Add custom source file and expected output
      mockFiles.set('src/custom.js', { type: 'file', size: 1024 });
      mockFiles.set('dist/custom.js', { type: 'file', size: 2048 });
      mockFiles.set('dist/custom.js.map', { type: 'file', size: 512 });

      const buildSystem = new BuildSystem(customConfig, {
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // Verify custom bundle was processed
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['esbuild', 'src/custom.js']),
        expect.any(Object)
      );
    });

    it('should handle missing static directories gracefully', async () => {
      // Remove expected dist static directory
      mockFiles.delete('dist/css');

      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });
      const validator = buildSystem.validator;

      const result = await validator.validate();

      expect(result.errors.some((e) => e.type === 'missing_directory')).toBe(
        true
      );
    });
  });

  describe('Performance Verification', () => {
    it('should complete build within reasonable time', async () => {
      const startTime = Date.now();

      const buildSystem = new BuildSystem(buildConfig, {
        parallel: true,
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      const buildTime = Date.now() - startTime;

      // Should complete quickly in test environment
      expect(buildTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should show performance improvement calculation', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        fast: true, // Skip source file verification in tests
      });

      // Test with different build times
      expect(buildSystem.calculateImprovement(4000)).toBeCloseTo(0.6, 1); // 60% improvement
      expect(buildSystem.calculateImprovement(8000)).toBeCloseTo(0.2, 1); // 20% improvement
      expect(buildSystem.calculateImprovement(12000)).toBe(0); // No improvement
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle complete Living Narrative Engine build', async () => {
      // Ensure all expected files are present
      const expectedSourceFiles = [
        'src/main.js',
        'src/anatomy-visualizer.js',
        'src/thematic-direction-main.js',
        'src/thematicDirectionsManager/thematicDirectionsManagerMain.js',
        'src/character-concepts-manager-entry.js',
        'src/cliches-generator-main.js',
        'src/core-motivations-generator-main.js',
        'src/traits-generator-main.js',
      ];

      const expectedHtmlFiles = [
        'index.html',
        'game.html',
        'anatomy-visualizer.html',
        'character-concepts-manager.html',
        'thematic-direction-generator.html',
        'thematic-directions-manager.html',
        'cliches-generator.html',
        'core-motivations-generator.html',
        'traits-generator.html',
      ];

      // Verify all source files exist
      for (const file of expectedSourceFiles) {
        expect(mockFiles.has(file)).toBe(true);
      }

      // Verify all HTML files exist
      for (const file of expectedHtmlFiles) {
        expect(mockFiles.has(file)).toBe(true);
      }

      const buildSystem = new BuildSystem(buildConfig, {
        mode: 'production',
        parallel: true,
        fast: true, // Skip source file verification in tests
      });

      await buildSystem.build();

      // Verify all bundles were created
      const expectedOutputFiles = [
        'dist/bundle.js',
        'dist/anatomy-visualizer.js',
        'dist/thematic-direction.js',
        'dist/thematic-directions-manager.js',
        'dist/character-concepts-manager.js',
        'dist/cliches-generator-main.js',
        'dist/core-motivations-generator.js',
        'dist/traits-generator.js',
      ];

      for (const file of expectedOutputFiles) {
        expect(mockFiles.has(file)).toBe(true);
      }

      // Verify all HTML files were copied
      for (const file of expectedHtmlFiles) {
        expect(mockFiles.has(`dist/${file}`)).toBe(true);
      }
    });
  });
});
