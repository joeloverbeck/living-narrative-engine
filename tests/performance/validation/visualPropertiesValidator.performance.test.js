/**
 * @file Performance benchmarks for visual properties validator
 * @description Tests the performance characteristics of visual properties validation
 * to ensure validation operations complete within acceptable time limits.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateVisualProperties,
  countActionsWithVisualProperties,
} from '../../../src/validation/visualPropertiesValidator.js';
import { runVisualPropertiesPerformanceTest } from '../../common/mockFactories/visualProperties.js';

// Mock the colorValidation module
jest.mock('../../../src/utils/colorValidation.js', () => ({
  validateColor: jest.fn((color) => {
    // More accurate mock validation - accepts hex colors and common named colors
    if (typeof color !== 'string') return false;
    // Accept hex colors (3 or 6 digits)
    if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color)) return true;
    // Accept rgb/rgba patterns
    if (/^rgba?\(/.test(color)) return true;
    // Accept common named colors
    const namedColors = [
      'red',
      'white',
      'black',
      'blue',
      'green',
      'yellow',
      'transparent',
      'currentColor',
      'darkslateblue',
    ];
    return namedColors.includes(color.toLowerCase());
  }),
  getColorErrorMessage: jest.fn((color) => {
    if (typeof color !== 'string') {
      return 'Color must be a string';
    }
    return `Invalid CSS color value: "${color}". Expected hex (#RGB or #RRGGBB), rgb(), rgba(), or named color.`;
  }),
}));

describe('Visual Properties Validator - Performance Benchmarks', () => {
  it('should validate 1000 colors in under 100ms', () => {
    const { validateColor } = require('../../../src/utils/colorValidation.js');

    const result = runVisualPropertiesPerformanceTest(
      () => {
        validateColor('#ff0000');
      },
      1000,
      100
    );

    expect(result.passed).toBe(true);
    expect(result.duration).toBeLessThan(100);
    console.log(
      `Validated ${result.iterations} colors in ${result.duration.toFixed(2)}ms`
    );
  });

  it('should validate complex visual properties quickly', () => {
    const complexVisual = {
      backgroundColor: '#ff0000',
      textColor: '#ffffff',
      hoverBackgroundColor: '#cc0000',
      hoverTextColor: '#ffcccc',
    };

    const result = runVisualPropertiesPerformanceTest(
      () => {
        try {
          validateVisualProperties(complexVisual, 'test:action');
        } catch (e) {
          // Ignore validation errors for performance test
        }
      },
      500,
      100
    );

    expect(result.passed).toBe(true);
    console.log(
      `Validated ${result.iterations} complex visual properties in ${result.duration.toFixed(2)}ms`
    );
  });

  it('should handle large batches of actions efficiently', () => {
    const actions = Array(100)
      .fill(null)
      .map((_, i) => ({
        id: `action${i}`,
        visual: i % 2 === 0 ? { backgroundColor: '#ff0000' } : null,
      }));

    const startTime = performance.now();
    const count = countActionsWithVisualProperties(actions);
    const endTime = performance.now();

    expect(count).toBe(50);
    expect(endTime - startTime).toBeLessThan(10);
    console.log(
      `Counted visual properties in ${actions.length} actions in ${(endTime - startTime).toFixed(2)}ms`
    );
  });
});
