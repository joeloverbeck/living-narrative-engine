/**
 * @file anatomy-visualizer.constructor.validation.test.js
 * @description Unit tests for anatomy-visualizer.js constructor validation and module setup
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';

describe('anatomy-visualizer.js - Constructor Validation', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    // Save original globals
    originalDocument = global.document;
    originalWindow = global.window;

    // Mock document and window
    global.document = {
      readyState: 'complete',
      getElementById: jest.fn(),
      addEventListener: jest.fn(),
    };

    global.window = {
      location: {
        href: '',
      },
    };

    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original globals
    global.document = originalDocument;
    global.window = originalWindow;
  });

  it('should verify anatomy-visualizer.js file exists and is readable', async () => {
    // This test verifies that the file exists and has basic structure
    const anatomyVisualizerModule = await import(
      '../../src/anatomy-visualizer.js'
    );

    // Should import successfully
    expect(anatomyVisualizerModule).toBeDefined();

    // Check that it's a module with expected structure
    expect(typeof anatomyVisualizerModule).toBe('object');
  });

  it('should handle DOM readyState complete without errors', async () => {
    // Mock complete DOM state
    global.document = {
      readyState: 'complete',
      getElementById: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
      }),
      addEventListener: jest.fn(),
    };

    // Import should not throw
    await expect(
      import('../../src/anatomy-visualizer.js')
    ).resolves.toBeDefined();
  });

  it('should handle DOM readyState loading without errors', async () => {
    // Mock loading DOM state
    global.document = {
      readyState: 'loading',
      getElementById: jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
      }),
      addEventListener: jest.fn(),
    };

    // Import should not throw
    await expect(
      import('../../src/anatomy-visualizer.js')
    ).resolves.toBeDefined();
  });

  it('should handle missing back button gracefully', async () => {
    // Mock document without back button
    global.document = {
      readyState: 'complete',
      getElementById: jest.fn().mockReturnValue(null),
      addEventListener: jest.fn(),
    };

    // Import should not throw
    await expect(
      import('../../src/anatomy-visualizer.js')
    ).resolves.toBeDefined();
  });
});
