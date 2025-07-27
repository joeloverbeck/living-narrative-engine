/**
 * @file Integration tests for build system
 * Tests complete build workflow and component interactions
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
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
    cleanup: jest.fn()
  }));
});

// Global variable to share mockFiles with mocked validator
let mockFiles;

// Mock BuildValidator with realistic validation logic
jest.mock('../../scripts/lib/BuildValidator.js', () => {
  return jest.fn().mockImplementation((config) => ({
    validate: jest.fn().mockImplementation(async function() {
      const errors = [];
      const warnings = [];
      const stats = { totalFiles: 0, totalSize: 0, largestFile: null, smallestFile: null };
      
      // Access mockFiles from global scope
      if (!mockFiles) {
        return {
          success: true,
          warnings: [],
          errors: [],
          stats,
          summary: 'Build validation passed'
        };
      }
      
      // Check JavaScript bundles
      for (const bundle of config.bundles) {
        const outputPath = `${config.distDir}/${bundle.output}`;
        if (!mockFiles.has(outputPath)) {
          errors.push({
            type: 'missing_file',
            file: outputPath,
            message: `Required javascript file missing`
          });
        } else {
          const file = mockFiles.get(outputPath);
          stats.totalFiles++;
          stats.totalSize += file.size;
          
          // File size warnings
          if (file.size > 10000000) { // 10MB
            warnings.push({
              type: 'large_file',
              file: outputPath,
              size: file.size,
              message: `javascript file very large (${(file.size / 1024 / 1024).toFixed(1)} MB)`
            });
          } else if (file.size < 100) { // Very small
            warnings.push({
              type: 'small_file', 
              file: outputPath,
              size: file.size,
              message: `javascript file very small (${file.size} bytes)`
            });
          }
        }
      }
      
      // Check HTML files
      for (const htmlFile of config.htmlFiles) {
        const outputPath = `${config.distDir}/${htmlFile}`;
        if (!mockFiles.has(outputPath)) {
          errors.push({
            type: 'missing_file',
            file: outputPath,
            message: `Required html file missing`
          });
        }
      }
      
      // Check static directories
      for (const dir of config.staticDirs) {
        const outputPath = `${config.distDir}/${dir.target}`;
        if (!mockFiles.has(outputPath)) {
          errors.push({
            type: 'missing_directory',
            file: outputPath,
            message: `Required directory missing`
          });
        }
      }
      
      return {
        success: errors.length === 0,
        warnings,
        errors,
        stats,
        summary: errors.length === 0 ? 'Build validation passed' : 'Build validation failed'
      };
    })
  }));
});

// Mock chalk to avoid potential ES module issues
jest.mock('chalk', () => {
  const mockColor = jest.fn(text => text);
  mockColor.bold = jest.fn(text => text);
  
  return {
    green: mockColor,
    red: mockColor,
    blue: mockColor,
    gray: mockColor,
    yellow: mockColor,
    cyan: mockColor,
    magenta: mockColor,
    white: mockColor,
    black: mockColor
  };
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
    
    // Mock fs.stat
    fs.stat = jest.fn().mockImplementation((filePath) => {
      if (!mockFiles.has(filePath)) {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      }
      const file = mockFiles.get(filePath);
      return Promise.resolve({
        size: file.size || 1024,
        isFile: () => file.type === 'file',
        isDirectory: () => file.type === 'directory'
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
      const files = Array.from(mockFiles.keys())
        .filter(key => key.startsWith(dirPath + '/'))
        .map(key => path.basename(key));
      return Promise.resolve(files);
    });
    
    // Setup required source files
    mockFiles.set('src/main.js', { type: 'file', size: 2048 });
    mockFiles.set('src/anatomy-visualizer.js', { type: 'file', size: 1536 });
    mockFiles.set('src/thematic-direction-main.js', { type: 'file', size: 1024 });
    mockFiles.set('src/thematicDirectionsManager/thematicDirectionsManagerMain.js', { type: 'file', size: 1024 });
    mockFiles.set('src/character-concepts-manager-main.js', { type: 'file', size: 1024 });
    
    // Setup HTML files
    mockFiles.set('index.html', { type: 'file', size: 512 });
    mockFiles.set('game.html', { type: 'file', size: 768 });
    mockFiles.set('anatomy-visualizer.html', { type: 'file', size: 640 });
    mockFiles.set('character-concepts-manager.html', { type: 'file', size: 512 });
    mockFiles.set('thematic-direction-generator.html', { type: 'file', size: 480 });
    mockFiles.set('thematic-directions-manager.html', { type: 'file', size: 560 });
    
    // Setup static directories
    mockFiles.set('css', { type: 'directory' });
    mockFiles.set('css/main.css', { type: 'file', size: 2048 });
    mockFiles.set('data', { type: 'directory' });
    mockFiles.set('data/config.json', { type: 'file', size: 256 });
    mockFiles.set('config', { type: 'directory' });
    mockFiles.set('config/settings.json', { type: 'file', size: 128 });
    
    // Mock successful esbuild execution
    const mockProcess = {
      on: jest.fn(),
      stderr: { on: jest.fn() }
    };
    spawn.mockReturnValue(mockProcess);
    
    // Simulate successful build - extract output file from current call and create it
    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        setTimeout(() => {
          // Extract output file from the current esbuild call arguments
          const spawnCalls = spawn.mock.calls;
          if (spawnCalls.length > 0) {
            const currentCall = spawnCalls[spawnCalls.length - 1];
            const args = currentCall[1];
            const outfileArg = args.find(arg => arg.startsWith('--outfile='));
            if (outfileArg) {
              const outputPath = outfileArg.replace('--outfile=', '');
              mockFiles.set(outputPath, { type: 'file', size: 2048 });
            }
          }
          
          callback(0); // Exit code 0 = success
        }, 10);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Build Workflow', () => {
    it('should execute full build successfully', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        mode: 'development',
        parallel: true,
        verbose: false
      });
      
      await buildSystem.build();
      
      // Verify JavaScript bundles were built
      expect(spawn).toHaveBeenCalledWith('npx', expect.arrayContaining(['esbuild']), expect.any(Object));
      expect(spawn).toHaveBeenCalledTimes(5); // 5 bundles
      
      // Verify HTML files were copied
      expect(fs.copy).toHaveBeenCalledWith('index.html', 'dist/index.html', { overwrite: true });
      expect(fs.copy).toHaveBeenCalledWith('character-concepts-manager.html', 'dist/character-concepts-manager.html', { overwrite: true });
      
      // Verify output files exist
      expect(mockFiles.has('dist/bundle.js')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.js')).toBe(true);
    });

    it('should handle production build mode', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        mode: 'production',
        parallel: true,
        verbose: false
      });
      
      await buildSystem.build();
      
      // Verify minify flag is passed to esbuild
      const esbuildCalls = spawn.mock.calls;
      expect(esbuildCalls.some(call => 
        call[1].includes('--minify')
      )).toBe(true);
      
      // Verify no sourcemap flag in production
      expect(esbuildCalls.some(call => 
        call[1].includes('--sourcemap')
      )).toBe(false);
    });

    it('should handle missing source files gracefully', async () => {
      // Remove a required source file
      mockFiles.delete('src/main.js');
      
      const buildSystem = new BuildSystem(buildConfig);
      
      await expect(buildSystem.build()).rejects.toThrow(/Initialization failed/);
    });
  });

  describe('Parallel vs Sequential Building', () => {
    it('should build bundles in parallel by default', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        parallel: true
      });
      
      await buildSystem.build();
      
      // All bundles should be processed (parallel execution)
      expect(spawn).toHaveBeenCalledTimes(5);
    });

    it('should build bundles sequentially when parallel disabled', async () => {
      const buildSystem = new BuildSystem(buildConfig, {
        parallel: false
      });
      
      await buildSystem.build();
      
      // Still processes all bundles, but with concurrency of 1
      expect(spawn).toHaveBeenCalledTimes(5);
    });
  });

  describe('Build Validation', () => {
    it('should validate successful build output', async () => {
      const buildSystem = new BuildSystem(buildConfig);
      
      await buildSystem.build();
      
      // Verify all expected output files were created
      expect(mockFiles.has('dist/bundle.js')).toBe(true);
      expect(mockFiles.has('dist/anatomy-visualizer.js')).toBe(true);
      expect(mockFiles.has('dist/thematic-direction.js')).toBe(true);
      expect(mockFiles.has('dist/thematic-directions-manager.js')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.js')).toBe(true);
      
      // Verify HTML files were copied
      expect(mockFiles.has('dist/index.html')).toBe(true);
      expect(mockFiles.has('dist/character-concepts-manager.html')).toBe(true);
    });

    it('should detect missing output files', async () => {
      // Mock esbuild failure for one bundle
      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      };
      
      spawn.mockReturnValue(mockProcess);
      
      let callCount = 0;
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => {
            callCount++;
            if (callCount === 1) {
              // First bundle fails - don't create output file
              callback(1); // Exit code 1 = failure
            } else {
              // Other bundles succeed but won't be reached due to first failure
              callback(0);
            }
          }, 10);
        }
      });
      
      const buildSystem = new BuildSystem(buildConfig);
      
      await expect(buildSystem.build()).rejects.toThrow();
    });
  });

  describe('File Size Validation', () => {
    it('should warn about large bundle sizes', async () => {
      // Create a very large bundle
      mockFiles.set('dist/bundle.js', { type: 'file', size: 15000000 }); // 15MB
      
      const buildSystem = new BuildSystem(buildConfig);
      const validator = buildSystem.validator;
      
      const result = await validator.validate();
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => 
        w.message.includes('very large')
      )).toBe(true);
    });

    it('should warn about suspiciously small files', async () => {
      // Create a very small bundle
      mockFiles.set('dist/bundle.js', { type: 'file', size: 10 }); // 10 bytes
      
      const buildSystem = new BuildSystem(buildConfig);
      const validator = buildSystem.validator;
      
      const result = await validator.validate();
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => 
        w.message.includes('very small')
      )).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle esbuild errors gracefully', async () => {
      // Mock esbuild failure - all processes fail
      const mockProcess = {
        on: jest.fn(),
        stderr: { on: jest.fn() }
      };
      
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Exit code 1 = failure
        }
      });
      
      const buildSystem = new BuildSystem(buildConfig);
      
      await expect(buildSystem.build()).rejects.toThrow();
    });

    it('should handle file system errors', async () => {
      // Mock file copy failure
      fs.copy.mockRejectedValue(new Error('Permission denied'));
      
      const buildSystem = new BuildSystem(buildConfig);
      
      await expect(buildSystem.build()).rejects.toThrow();
    });
  });

  describe('Configuration Variants', () => {
    it('should handle custom build configuration', async () => {
      const customConfig = {
        ...buildConfig,
        bundles: [
          { name: 'custom', entry: 'src/custom.js', output: 'custom.js' }
        ],
        htmlFiles: [], // No HTML files expected 
        staticDirs: [] // No static dirs expected
      };
      
      // Add custom source file
      mockFiles.set('src/custom.js', { type: 'file', size: 1024 });
      
      const buildSystem = new BuildSystem(customConfig);
      
      await buildSystem.build();
      
      // Verify custom bundle was processed
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['esbuild', 'src/custom.js']),
        expect.any(Object)
      );
    });

    it('should handle missing static directories gracefully', async () => {
      // Remove static directory
      mockFiles.delete('css');
      
      const buildSystem = new BuildSystem(buildConfig);
      const validator = buildSystem.validator;
      
      const result = await validator.validate();
      
      expect(result.errors.some(e => 
        e.type === 'missing_directory'
      )).toBe(true);
    });
  });

  describe('Performance Verification', () => {
    it('should complete build within reasonable time', async () => {
      const startTime = Date.now();
      
      const buildSystem = new BuildSystem(buildConfig, {
        parallel: true
      });
      
      await buildSystem.build();
      
      const buildTime = Date.now() - startTime;
      
      // Should complete quickly in test environment
      expect(buildTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should show performance improvement calculation', async () => {
      const buildSystem = new BuildSystem(buildConfig);
      
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
        'src/character-concepts-manager-main.js'
      ];
      
      const expectedHtmlFiles = [
        'index.html',
        'game.html',
        'anatomy-visualizer.html',
        'character-concepts-manager.html',
        'thematic-direction-generator.html',
        'thematic-directions-manager.html'
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
        parallel: true
      });
      
      await buildSystem.build();
      
      // Verify all bundles were created
      const expectedOutputFiles = [
        'dist/bundle.js',
        'dist/anatomy-visualizer.js',
        'dist/thematic-direction.js',
        'dist/thematic-directions-manager.js',
        'dist/character-concepts-manager.js'
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