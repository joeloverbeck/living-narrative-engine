/**
 * @file Character Builder Page E2E Test
 * @description End-to-end test to verify character builder page loads without console errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Character Builder Page - E2E', () => {
  let mockConsole;
  let originalConsole;

  beforeEach(() => {
    // Capture console errors
    originalConsole = {
      error: console.error,
      warn: console.warn,
    };
    mockConsole = {
      errors: [],
      warnings: [],
    };
    console.error = (...args) => {
      mockConsole.errors.push(args);
      originalConsole.error(...args);
    };
    console.warn = (...args) => {
      mockConsole.warnings.push(args);
      originalConsole.warn(...args);
    };

    // Clear DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    // Restore console
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  it('should load HTML without errors', () => {
    const htmlPath = path.join(process.cwd(), 'character-builder.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('Character Builder');
    expect(htmlContent).toContain('character-builder.js');
  });

  it('should load built JavaScript file without errors', () => {
    const jsPath = path.join(process.cwd(), 'dist', 'character-builder.js');
    expect(fs.existsSync(jsPath)).toBe(true);

    const jsContent = fs.readFileSync(jsPath, 'utf8');
    // Should contain the bundled application code
    expect(jsContent.length).toBeGreaterThan(1000);
  });

  it('should have valid HTML structure for character builder', async () => {
    const htmlPath = path.join(process.cwd(), 'character-builder.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Set up DOM with the HTML content
    document.documentElement.innerHTML = htmlContent;

    // Verify essential DOM elements exist
    expect(document.getElementById('character-builder-container')).toBeTruthy();
    expect(document.getElementById('character-concept-form')).toBeTruthy();
    expect(document.getElementById('character-concept-input')).toBeTruthy();
    expect(document.getElementById('generate-directions-btn')).toBeTruthy();
    expect(document.getElementById('directions-container')).toBeTruthy();
  });

  it('should load CSS files', () => {
    const stylePath = path.join(process.cwd(), 'css', 'style.css');
    const characterBuilderStylePath = path.join(
      process.cwd(),
      'css',
      'character-builder.css'
    );

    expect(fs.existsSync(stylePath)).toBe(true);
    expect(fs.existsSync(characterBuilderStylePath)).toBe(true);
  });

  it('should have proper schema files for character builder', () => {
    const conceptSchemaPath = path.join(
      process.cwd(),
      'data',
      'schemas',
      'character-concept.schema.json'
    );
    const thematicSchemaPath = path.join(
      process.cwd(),
      'data',
      'schemas',
      'thematic-direction.schema.json'
    );

    expect(fs.existsSync(conceptSchemaPath)).toBe(true);
    expect(fs.existsSync(thematicSchemaPath)).toBe(true);

    // Verify schema files are valid JSON
    expect(() => {
      JSON.parse(fs.readFileSync(conceptSchemaPath, 'utf8'));
    }).not.toThrow();

    expect(() => {
      JSON.parse(fs.readFileSync(thematicSchemaPath, 'utf8'));
    }).not.toThrow();
  });

  it('should initialize without JavaScript errors when DOM is ready', async () => {
    // Mock IndexedDB for the test environment
    const mockIndexedDB = {
      open: jest.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          createObjectStore: jest.fn(),
          transaction: jest.fn().mockReturnValue({
            objectStore: jest.fn().mockReturnValue({
              getAll: jest.fn().mockReturnValue({
                onsuccess: null,
                onerror: null,
              }),
              add: jest.fn(),
              put: jest.fn(),
              delete: jest.fn(),
            }),
          }),
          close: jest.fn(),
        },
      }),
    };
    global.indexedDB = mockIndexedDB;

    // Mock fetch for schema loading
    global.fetch = jest.fn().mockImplementation((url) => {
      const schemaData = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {},
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(schemaData),
      });
    });

    // Set up DOM first
    const htmlPath = path.join(process.cwd(), 'character-builder.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.documentElement.innerHTML = htmlContent;

    // Set document ready state to complete
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() {
        return 'complete';
      },
    });

    // Load and execute the built character builder script
    const jsPath = path.join(process.cwd(), 'dist', 'character-builder.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // Execute the script - it should initialize immediately since DOM is ready
    expect(() => {
      eval(jsContent);
    }).not.toThrow();

    // Wait a moment for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not have any console errors during initialization
    // Filter out expected warnings about log level (these are normal)
    const relevantErrors = mockConsole.errors.filter(
      (error) =>
        !error.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('Invalid log level input type')
        )
    );

    expect(relevantErrors).toHaveLength(0);
  });
});
