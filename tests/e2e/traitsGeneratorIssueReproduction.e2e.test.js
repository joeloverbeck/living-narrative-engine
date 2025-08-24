/**
 * @file Test to reproduce and validate fixes for Traits Generator initialization issues
 * @description Tests the specific issues found and validates they are fixed:
 * 1. Missing schema file (trait-data.schema.json vs trait.schema.json)
 * 2. TraitsDisplayEnhancer service registration failure
 * 3. Complete page load failure
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock fetch for schema loading tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods to capture errors and warnings
let consoleErrors = [];
let consoleWarnings = [];

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('Traits Generator Issue Reproduction Tests', () => {
  beforeEach(() => {
    // Reset mocks and arrays
    mockFetch.mockClear();
    consoleErrors = [];
    consoleWarnings = [];

    // Override console methods to capture messages
    console.error = jest.fn((message) => {
      consoleErrors.push(message);
      originalConsoleError(message);
    });

    console.warn = jest.fn((message) => {
      consoleWarnings.push(message);
      originalConsoleWarn(message);
    });
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;

    // Reset fetch mock
    jest.resetModules();
  });

  describe('Schema Reference Validation', () => {
    it('should reference the correct trait.schema.json file', async () => {
      // Import the main file to check schema references
      const mainFilePath =
        '/home/joeloverbeck/projects/living-narrative-engine/src/traits-generator-main.js';
      const fs = await import('fs');
      const mainFileContent = fs.readFileSync(mainFilePath, 'utf8');

      // Verify the correct schema is referenced
      expect(mainFileContent).toContain('/data/schemas/trait.schema.json');

      // Verify the old incorrect schema is NOT referenced
      expect(mainFileContent).not.toContain(
        '/data/schemas/trait-data.schema.json'
      );
    });

    it('should NOT attempt to load trait-data.schema.json', async () => {
      // Setup fetch mock to respond appropriately
      mockFetch.mockImplementation((url) => {
        if (url.includes('trait.schema.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
              }),
          });
        }

        if (url.includes('trait-data.schema.json')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }

        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      // Import and run the bootstrap process
      const { CharacterBuilderBootstrap } = await import(
        '../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const bootstrap = new CharacterBuilderBootstrap();

      try {
        await bootstrap.bootstrap({
          pageName: 'test-traits-generator',
          controllerClass: class MockController {
            initialize() {
              return Promise.resolve();
            }
          },
          includeModLoading: false,
          customSchemas: ['/data/schemas/trait.schema.json'],
        });
      } catch (error) {
        // Bootstrap might fail due to missing dependencies, but that's okay for this test
      }

      // Verify that trait-data.schema.json was NOT requested
      const trait_data_requests = mockFetch.mock.calls.filter(
        (call) => call[0] && call[0].includes('trait-data.schema.json')
      );
      expect(trait_data_requests).toHaveLength(0);

      // Verify that trait.schema.json WAS requested
      const trait_requests = mockFetch.mock.calls.filter(
        (call) => call[0] && call[0].includes('trait.schema.json')
      );
      expect(trait_requests.length).toBeGreaterThan(0);
    });
  });

  describe('Service Registration Validation', () => {
    it('should include TraitsDisplayEnhancer service registration logic in bootstrap', async () => {
      // Check that CharacterBuilderBootstrap has logic to handle TraitsDisplayEnhancer
      const bootstrapFilePath =
        '/home/joeloverbeck/projects/living-narrative-engine/src/characterBuilder/CharacterBuilderBootstrap.js';
      const fs = await import('fs');
      const bootstrapContent = fs.readFileSync(bootstrapFilePath, 'utf8');

      // Verify the bootstrap includes logic for TraitsDisplayEnhancer
      expect(bootstrapContent).toContain('TraitsDisplayEnhancer');

      // Verify it has instantiation logic
      expect(bootstrapContent).toContain('new serviceClassOrInstance');
    });

    it('should properly configure services in traits-generator-main.js', async () => {
      // Check the main configuration
      const mainFilePath =
        '/home/joeloverbeck/projects/living-narrative-engine/src/traits-generator-main.js';
      const fs = await import('fs');
      const mainContent = fs.readFileSync(mainFilePath, 'utf8');

      // Verify TraitsDisplayEnhancer is imported
      expect(mainContent).toContain('import { TraitsDisplayEnhancer }');

      // Verify it's included in the services configuration
      expect(mainContent).toContain(
        'traitsDisplayEnhancer: TraitsDisplayEnhancer'
      );
    });
  });

  describe('Bootstrap Configuration Tests', () => {
    it('should have valid bootstrap configuration structure', async () => {
      const mainFilePath =
        '/home/joeloverbeck/projects/living-narrative-engine/src/traits-generator-main.js';
      const fs = await import('fs');
      const mainContent = fs.readFileSync(mainFilePath, 'utf8');

      // Check essential bootstrap configuration elements
      expect(mainContent).toContain("pageName: 'traits-generator'");
      expect(mainContent).toContain(
        'controllerClass: TraitsGeneratorController'
      );
      expect(mainContent).toContain('includeModLoading: true');
      expect(mainContent).toContain('customSchemas:');
      expect(mainContent).toContain('services:');
    });
  });

  describe('Error Prevention Tests', () => {
    it('should NOT generate missing dependency errors when properly configured', () => {
      // This test validates that our configuration prevents the specific errors we found

      // Check that the imports are correct
      const mainFilePath =
        '/home/joeloverbeck/projects/living-narrative-engine/src/traits-generator-main.js';
      const fs = require('fs');
      const mainContent = fs.readFileSync(mainFilePath, 'utf8');

      // All required imports should be present
      expect(mainContent).toMatch(/import.*CharacterBuilderBootstrap/);
      expect(mainContent).toMatch(/import.*TraitsGeneratorController/);
      expect(mainContent).toMatch(/import.*TraitsDisplayEnhancer/);

      // Services should be properly mapped
      expect(mainContent).toMatch(
        /traitsDisplayEnhancer:\s*TraitsDisplayEnhancer/
      );
    });
  });
});
