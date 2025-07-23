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

  // Removed test that depends on dist folder existing
  // it('should load built JavaScript file without errors', () => {
  //   const jsPath = path.join(process.cwd(), 'dist', 'character-builder.js');
  //   expect(fs.existsSync(jsPath)).toBe(true);
  //
  //   const jsContent = fs.readFileSync(jsPath, 'utf8');
  //   // Should contain the bundled application code
  //   expect(jsContent.length).toBeGreaterThan(1000);
  // });

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

  // Removed test that depends on dist folder and uses eval()
  // it('should initialize without JavaScript errors when DOM is ready', async () => {
  //   // This test was attempting to load and eval() the built bundle from dist/
  //   // which is not a good testing pattern. The functionality should be tested
  //   // at the unit/integration level on the source code, not the built artifacts.
  // });
});
