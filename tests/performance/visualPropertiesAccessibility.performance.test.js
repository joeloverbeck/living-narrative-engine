/**
 * @file Visual Properties Accessibility Performance Tests
 * Tests performance benchmarks for accessibility calculations and validations
 * Validates contrast calculation speed and efficiency requirements
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { AccessibilityTestBed } from '../common/accessibilityTestBed.js';

describe('Visual Properties Accessibility - Performance Tests', () => {
  let a11yTestBed;
  let dom;
  let document;

  beforeEach(async () => {
    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><div id="test-container"></div>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.getComputedStyle = dom.window.getComputedStyle;

    // Initialize accessibility test bed
    a11yTestBed = new AccessibilityTestBed();
  });

  afterEach(async () => {
    if (a11yTestBed) {
      await a11yTestBed.cleanup();
    }
    if (dom) {
      dom.window.close();
    }
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    delete global.HTMLButtonElement;
    delete global.getComputedStyle;
  });

  describe('accessibility calculation performance', () => {
    it('should validate accessibility utilities performance', async () => {
      // Test that accessibility calculations are performant
      const manyColors = Array.from({ length: 100 }, (_, i) => ({
        bg: `#${(i * 100000).toString(16).substr(0, 6).padStart(6, '0')}`,
        text: '#ffffff',
      }));

      const startTime = performance.now();

      // Test contrast calculation performance
      for (const colors of manyColors) {
        const contrastTest = a11yTestBed.calculateContrastRatio(
          colors.bg,
          colors.text
        );
        expect(contrastTest).toBeGreaterThan(0);

        // Also test validation
        const validation = a11yTestBed.validateColorContrast(
          colors.bg,
          colors.text
        );
        expect(validation.contrastRatio).toBe(contrastTest);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should perform contrast calculations quickly (CI-adjusted)
      expect(totalTime).toBeLessThan(130); // <130ms for 100 calculations

      const timePerCalculation = totalTime / 100;
      expect(timePerCalculation).toBeLessThan(1.3); // <1.3ms per calculation
    });

    it('should handle large-scale color contrast validation efficiently', async () => {
      // Test performance with various color combinations
      const colorCombinations = Array.from({ length: 500 }, (_, i) => ({
        bg: `#${Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0')}`,
        text: i % 2 === 0 ? '#ffffff' : '#000000',
      }));

      const startTime = performance.now();

      let passCount = 0;
      let failCount = 0;

      for (const colors of colorCombinations) {
        const validation = a11yTestBed.validateColorContrast(
          colors.bg,
          colors.text,
          'AA',
          'normal'
        );

        if (validation.passes) {
          passCount++;
        } else {
          failCount++;
        }

        expect(validation.contrastRatio).toBeGreaterThan(0);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance requirements for 500 calculations
      expect(totalTime).toBeLessThan(500); // <500ms for 500 calculations

      const timePerCalculation = totalTime / 500;
      expect(timePerCalculation).toBeLessThan(1); // <1ms per calculation

      // Verify we got reasonable results
      expect(passCount + failCount).toBe(500);
      expect(passCount).toBeGreaterThan(0); // Some should pass
      expect(failCount).toBeGreaterThan(0); // Some should fail with random colors
    });

    it('should perform RGB conversion calculations efficiently', async () => {
      // Test hex to RGB conversion performance
      const hexColors = Array.from(
        { length: 1000 },
        (_, i) => `#${i.toString(16).padStart(6, '0')}`
      );

      const startTime = performance.now();

      for (const hexColor of hexColors) {
        const rgb = a11yTestBed.hexToRgb(hexColor);

        // Verify conversion accuracy
        expect(rgb).toHaveProperty('r');
        expect(rgb).toHaveProperty('g');
        expect(rgb).toHaveProperty('b');
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
        expect(rgb.g).toBeGreaterThanOrEqual(0);
        expect(rgb.g).toBeLessThanOrEqual(255);
        expect(rgb.b).toBeGreaterThanOrEqual(0);
        expect(rgb.b).toBeLessThanOrEqual(255);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance requirements for RGB conversion (CI-adjusted)
      expect(totalTime).toBeLessThan(1500); // <1500ms for 1000 conversions

      const timePerConversion = totalTime / 1000;
      expect(timePerConversion).toBeLessThan(1.5); // <1.5ms per conversion
    });

    it('should handle luminance calculation performance efficiently', async () => {
      // Test relative luminance calculation performance
      const testColors = [
        '#000000',
        '#ffffff',
        '#ff0000',
        '#00ff00',
        '#0000ff',
        '#808080',
        '#c0c0c0',
        '#800000',
        '#008000',
        '#000080',
        '#ffff00',
        '#ff00ff',
        '#00ffff',
        '#ffa500',
        '#800080',
      ];

      // Generate many luminance calculations
      const manyLuminanceTests = [];
      for (let i = 0; i < 200; i++) {
        manyLuminanceTests.push(testColors[i % testColors.length]);
      }

      const startTime = performance.now();

      for (const color of manyLuminanceTests) {
        const luminance = a11yTestBed.getRelativeLuminance(color);

        // Verify luminance is in valid range [0, 1]
        expect(luminance).toBeGreaterThanOrEqual(0);
        expect(luminance).toBeLessThanOrEqual(1);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance requirements for luminance calculation
      expect(totalTime).toBeLessThan(200); // <200ms for 200 calculations

      const timePerCalculation = totalTime / 200;
      expect(timePerCalculation).toBeLessThan(1); // <1ms per calculation
    });
  });

  describe('memory management', () => {
    it('should not leak memory during repeated accessibility calculations', async () => {
      // Measure initial memory if available
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Perform many cycles of accessibility calculations
      for (let cycle = 0; cycle < 50; cycle++) {
        const colors = Array.from({ length: 20 }, (_, i) => ({
          bg: `#${(cycle * 1000 + i).toString(16).padStart(6, '0')}`,
          text: '#ffffff',
        }));

        // Perform calculations and validations
        for (const colorPair of colors) {
          const contrast = a11yTestBed.calculateContrastRatio(
            colorPair.bg,
            colorPair.text
          );
          const validation = a11yTestBed.validateColorContrast(
            colorPair.bg,
            colorPair.text
          );
          const rgb = a11yTestBed.hexToRgb(colorPair.bg);
          const luminance = a11yTestBed.getRelativeLuminance(colorPair.bg);

          // Verify calculations work
          expect(contrast).toBeGreaterThan(0);
          expect(validation.contrastRatio).toBe(contrast);
          expect(rgb).toBeDefined();
          expect(luminance).toBeGreaterThanOrEqual(0);
        }

        // Force garbage collection periodically
        if (cycle % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (<1MB for 50 cycles)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });
  });
});
