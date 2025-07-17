/**
 * @file Unit tests for RenderContext
 * @description Comprehensive unit tests for RenderContext class covering all methods and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RenderContext from '../../../../../src/domUI/anatomy-renderer/types/RenderContext.js';

describe('RenderContext', () => {
  let renderContext;

  beforeEach(() => {
    renderContext = new RenderContext();
  });

  describe('constructor', () => {
    it('should initialize with default viewport settings', () => {
      expect(renderContext.viewport).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        scale: 1,
      });
    });

    it('should initialize with default theme settings', () => {
      expect(renderContext.theme).toEqual({
        nodeColors: {
          torso: '#e74c3c',
          head: '#3498db',
          arm: '#2ecc71',
          leg: '#f39c12',
          hand: '#27ae60',
          foot: '#e67e22',
          eye: '#9b59b6',
          hair: '#34495e',
          genital: '#e91e63',
          unknown: '#95a5a6',
        },
        edgeColor: '#666',
        backgroundColor: '#ffffff',
        tooltipBackground: '#333',
        tooltipText: '#fff',
      });
    });

    it('should initialize with default render options', () => {
      expect(renderContext.options).toEqual({
        showDebugInfo: true,
        enableTooltips: true,
        enableInteractions: true,
        animationDuration: 300,
        nodeRadius: 30,
        minNodeSpacing: 20,
      });
    });

    it('should initialize with default performance metrics', () => {
      expect(renderContext.performance).toEqual({
        nodeCount: 0,
        edgeCount: 0,
        renderTime: 0,
        layoutTime: 0,
        lastFrameTime: 0,
        fps: 0,
      });
    });

    it('should initialize with default container bounds', () => {
      expect(renderContext.containerBounds).toEqual({
        width: 0,
        height: 0,
        left: 0,
        top: 0,
      });
    });

    it('should initialize with default interaction state', () => {
      expect(renderContext.interactionState).toEqual({
        isPanning: false,
        panStart: { x: 0, y: 0 },
        mousePosition: { x: 0, y: 0 },
        hoveredNodeId: null,
        selectedNodeId: null,
      });
    });
  });

  describe('updateViewport', () => {
    it('should update viewport with partial properties', () => {
      renderContext.updateViewport({ x: 100, y: 200 });

      expect(renderContext.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        scale: 1,
      });
    });

    it('should update viewport with all properties', () => {
      const newViewport = {
        x: 50,
        y: 100,
        width: 1200,
        height: 800,
        scale: 1.5,
      };

      renderContext.updateViewport(newViewport);

      expect(renderContext.viewport).toEqual(newViewport);
    });

    it('should handle empty viewport update', () => {
      const originalViewport = { ...renderContext.viewport };

      renderContext.updateViewport({});

      expect(renderContext.viewport).toEqual(originalViewport);
    });

    it('should handle undefined viewport update', () => {
      const originalViewport = { ...renderContext.viewport };

      renderContext.updateViewport(undefined);

      expect(renderContext.viewport).toEqual(originalViewport);
    });
  });

  describe('updateTheme', () => {
    it('should update nodeColors partially', () => {
      const newColors = {
        torso: '#ff0000',
        head: '#00ff00',
      };

      renderContext.updateTheme({ nodeColors: newColors });

      expect(renderContext.theme.nodeColors.torso).toBe('#ff0000');
      expect(renderContext.theme.nodeColors.head).toBe('#00ff00');
      expect(renderContext.theme.nodeColors.arm).toBe('#2ecc71'); // unchanged
    });

    it('should update edgeColor when provided', () => {
      renderContext.updateTheme({ edgeColor: '#ff0000' });

      expect(renderContext.theme.edgeColor).toBe('#ff0000');
    });

    it('should update backgroundColor when provided', () => {
      renderContext.updateTheme({ backgroundColor: '#000000' });

      expect(renderContext.theme.backgroundColor).toBe('#000000');
    });

    it('should not update edgeColor when undefined', () => {
      const originalColor = renderContext.theme.edgeColor;

      renderContext.updateTheme({ edgeColor: undefined });

      expect(renderContext.theme.edgeColor).toBe(originalColor);
    });

    it('should not update backgroundColor when undefined', () => {
      const originalColor = renderContext.theme.backgroundColor;

      renderContext.updateTheme({ backgroundColor: undefined });

      expect(renderContext.theme.backgroundColor).toBe(originalColor);
    });

    it('should handle empty theme update', () => {
      const originalTheme = { ...renderContext.theme };

      renderContext.updateTheme({});

      expect(renderContext.theme).toEqual(originalTheme);
    });

    it('should handle undefined theme update', () => {
      expect(() => {
        renderContext.updateTheme(undefined);
      }).toThrow();
    });
  });

  describe('updateOptions', () => {
    it('should update options with partial properties', () => {
      renderContext.updateOptions({ showDebugInfo: false, nodeRadius: 50 });

      expect(renderContext.options.showDebugInfo).toBe(false);
      expect(renderContext.options.nodeRadius).toBe(50);
      expect(renderContext.options.enableTooltips).toBe(true); // unchanged
    });

    it('should update options with all properties', () => {
      const newOptions = {
        showDebugInfo: false,
        enableTooltips: false,
        enableInteractions: false,
        animationDuration: 500,
        nodeRadius: 25,
        minNodeSpacing: 15,
      };

      renderContext.updateOptions(newOptions);

      expect(renderContext.options).toEqual(newOptions);
    });

    it('should handle empty options update', () => {
      const originalOptions = { ...renderContext.options };

      renderContext.updateOptions({});

      expect(renderContext.options).toEqual(originalOptions);
    });

    it('should handle undefined options update', () => {
      const originalOptions = { ...renderContext.options };

      renderContext.updateOptions(undefined);

      expect(renderContext.options).toEqual(originalOptions);
    });
  });

  describe('updatePerformance', () => {
    it('should update performance metrics with partial properties', () => {
      renderContext.updatePerformance({ nodeCount: 10, edgeCount: 5 });

      expect(renderContext.performance.nodeCount).toBe(10);
      expect(renderContext.performance.edgeCount).toBe(5);
      expect(renderContext.performance.renderTime).toBe(0); // unchanged
    });

    it('should update performance metrics with all properties', () => {
      const newMetrics = {
        nodeCount: 15,
        edgeCount: 8,
        renderTime: 100,
        layoutTime: 50,
        lastFrameTime: 16,
        fps: 60,
      };

      renderContext.updatePerformance(newMetrics);

      expect(renderContext.performance).toEqual(newMetrics);
    });

    it('should handle empty performance update', () => {
      const originalPerformance = { ...renderContext.performance };

      renderContext.updatePerformance({});

      expect(renderContext.performance).toEqual(originalPerformance);
    });

    it('should handle undefined performance update', () => {
      const originalPerformance = { ...renderContext.performance };

      renderContext.updatePerformance(undefined);

      expect(renderContext.performance).toEqual(originalPerformance);
    });
  });

  describe('updateContainerBounds', () => {
    it('should update container bounds from DOMRect-like object', () => {
      const bounds = {
        width: 1000,
        height: 700,
        left: 100,
        top: 50,
      };

      renderContext.updateContainerBounds(bounds);

      expect(renderContext.containerBounds).toEqual(bounds);
    });

    it('should handle bounds with additional properties', () => {
      const bounds = {
        width: 1200,
        height: 800,
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        x: 0,
        y: 0,
      };

      renderContext.updateContainerBounds(bounds);

      expect(renderContext.containerBounds).toEqual({
        width: 1200,
        height: 800,
        left: 0,
        top: 0,
      });
    });
  });

  describe('getNodeColor', () => {
    it('should return correct color for known node types', () => {
      expect(renderContext.getNodeColor('torso')).toBe('#e74c3c');
      expect(renderContext.getNodeColor('head')).toBe('#3498db');
      expect(renderContext.getNodeColor('arm')).toBe('#2ecc71');
      expect(renderContext.getNodeColor('leg')).toBe('#f39c12');
      expect(renderContext.getNodeColor('hand')).toBe('#27ae60');
      expect(renderContext.getNodeColor('foot')).toBe('#e67e22');
      expect(renderContext.getNodeColor('eye')).toBe('#9b59b6');
      expect(renderContext.getNodeColor('hair')).toBe('#34495e');
      expect(renderContext.getNodeColor('genital')).toBe('#e91e63');
    });

    it('should return unknown color for unknown node types', () => {
      expect(renderContext.getNodeColor('unknown')).toBe('#95a5a6');
      expect(renderContext.getNodeColor('nonexistent')).toBe('#95a5a6');
      expect(renderContext.getNodeColor('')).toBe('#95a5a6');
      expect(renderContext.getNodeColor(null)).toBe('#95a5a6');
      expect(renderContext.getNodeColor(undefined)).toBe('#95a5a6');
    });

    it('should work after theme updates', () => {
      renderContext.updateTheme({
        nodeColors: {
          torso: '#ff0000',
          unknown: '#00ff00',
        },
      });

      expect(renderContext.getNodeColor('torso')).toBe('#ff0000');
      expect(renderContext.getNodeColor('nonexistent')).toBe('#00ff00');
    });
  });

  describe('getViewBoxString', () => {
    it('should return correct viewBox string with default viewport', () => {
      expect(renderContext.getViewBoxString()).toBe('0 0 800 600');
    });

    it('should return correct viewBox string with updated viewport', () => {
      renderContext.updateViewport({
        x: 100,
        y: 200,
        width: 1000,
        height: 700,
      });

      expect(renderContext.getViewBoxString()).toBe('100 200 1000 700');
    });

    it('should handle negative viewport values', () => {
      renderContext.updateViewport({
        x: -50,
        y: -100,
        width: 500,
        height: 400,
      });

      expect(renderContext.getViewBoxString()).toBe('-50 -100 500 400');
    });

    it('should handle decimal viewport values', () => {
      renderContext.updateViewport({
        x: 10.5,
        y: 20.3,
        width: 100.7,
        height: 200.9,
      });

      expect(renderContext.getViewBoxString()).toBe('10.5 20.3 100.7 200.9');
    });
  });

  describe('calculateFPS', () => {
    it('should calculate FPS correctly for valid frame times', () => {
      renderContext.calculateFPS(16.67); // ~60 FPS
      expect(renderContext.performance.fps).toBe(60);
      expect(renderContext.performance.lastFrameTime).toBe(16.67);
    });

    it('should calculate FPS correctly for different frame times', () => {
      renderContext.calculateFPS(33.33); // ~30 FPS
      expect(renderContext.performance.fps).toBe(30);

      renderContext.calculateFPS(50); // 20 FPS
      expect(renderContext.performance.fps).toBe(20);
    });

    it('should round FPS to nearest integer', () => {
      renderContext.calculateFPS(16.5); // 60.6 FPS
      expect(renderContext.performance.fps).toBe(61);

      renderContext.calculateFPS(16.8); // 59.5 FPS
      expect(renderContext.performance.fps).toBe(60);
    });

    it('should handle zero frame time', () => {
      renderContext.calculateFPS(0);
      expect(renderContext.performance.fps).toBe(0);
      expect(renderContext.performance.lastFrameTime).toBe(0);
    });

    it('should handle negative frame time', () => {
      renderContext.calculateFPS(-10);
      expect(renderContext.performance.fps).toBe(0);
      expect(renderContext.performance.lastFrameTime).toBe(-10);
    });

    it('should handle very small frame times', () => {
      renderContext.calculateFPS(0.1);
      expect(renderContext.performance.fps).toBe(10000);
      expect(renderContext.performance.lastFrameTime).toBe(0.1);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the render context', () => {
      // Modify the original context
      renderContext.updateViewport({ x: 100, y: 200 });
      renderContext.updateTheme({ nodeColors: { torso: '#ff0000' } });
      renderContext.updateOptions({ showDebugInfo: false });
      renderContext.updatePerformance({ nodeCount: 10 });
      renderContext.updateContainerBounds({
        width: 1000,
        height: 700,
        left: 0,
        top: 0,
      });

      const clone = renderContext.clone();

      expect(clone).not.toBe(renderContext);
      expect(clone.viewport).not.toBe(renderContext.viewport);
      expect(clone.theme).not.toBe(renderContext.theme);
      expect(clone.theme.nodeColors).not.toBe(renderContext.theme.nodeColors);
      expect(clone.options).not.toBe(renderContext.options);
      expect(clone.performance).not.toBe(renderContext.performance);
      expect(clone.containerBounds).not.toBe(renderContext.containerBounds);
      expect(clone.interactionState).not.toBe(renderContext.interactionState);
    });

    it('should preserve all values in the clone', () => {
      // Modify the original context
      renderContext.updateViewport({ x: 100, y: 200, scale: 2 });
      renderContext.updateTheme({
        nodeColors: { torso: '#ff0000' },
        edgeColor: '#00ff00',
        backgroundColor: '#0000ff',
      });
      renderContext.updateOptions({ showDebugInfo: false, nodeRadius: 40 });
      renderContext.updatePerformance({ nodeCount: 15, fps: 30 });
      renderContext.updateContainerBounds({
        width: 1000,
        height: 700,
        left: 50,
        top: 25,
      });

      const clone = renderContext.clone();

      expect(clone.viewport).toEqual(renderContext.viewport);
      expect(clone.theme).toEqual(renderContext.theme);
      expect(clone.options).toEqual(renderContext.options);
      expect(clone.performance).toEqual(renderContext.performance);
      expect(clone.containerBounds).toEqual(renderContext.containerBounds);
      expect(clone.interactionState).toEqual(renderContext.interactionState);
    });

    it('should create independent copies that do not affect each other', () => {
      const clone = renderContext.clone();

      // Modify the original
      renderContext.updateViewport({ x: 100 });
      renderContext.updateTheme({ nodeColors: { torso: '#ff0000' } });

      // Clone should be unchanged
      expect(clone.viewport.x).toBe(0);
      expect(clone.theme.nodeColors.torso).toBe('#e74c3c');

      // Modify the clone
      clone.updateViewport({ y: 200 });
      clone.updateTheme({ nodeColors: { head: '#00ff00' } });

      // Original should be unchanged (except for the previous modifications)
      expect(renderContext.viewport.y).toBe(0);
      expect(renderContext.theme.nodeColors.head).toBe('#3498db');
    });
  });
});
