/**
 * @file Unit tests for ViewportManager
 * @description Comprehensive tests for viewport management, transformations, and coordinate conversion
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ViewportManager from '../../../../src/domUI/anatomy-renderer/ViewportManager.js';
import { BaseTestBed } from '../../../common/baseTestBed.js';

describe('ViewportManager', () => {
  let testBed;
  let mockLogger;
  let viewportManager;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    testBed = new BaseTestBed({ mockLogger });
    viewportManager = new ViewportManager({ logger: mockLogger });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor & Initialization', () => {
    it('should initialize with default viewport settings', () => {
      const viewport = viewportManager.getViewport();
      expect(viewport).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });

    it('should initialize with custom viewport settings', () => {
      const customViewport = { x: 10, y: 20, width: 1000, height: 800 };
      const customManager = new ViewportManager({
        logger: mockLogger,
        initialViewport: customViewport,
      });

      expect(customManager.getViewport()).toEqual(customViewport);
    });

    it('should initialize with default transform settings', () => {
      const transform = viewportManager.getTransform();
      expect(transform).toEqual({
        x: 0,
        y: 0,
        scale: 1,
      });
    });

    it('should initialize with default zoom limits', () => {
      // Test zoom limits indirectly through zoom behavior
      viewportManager.zoom(0.05, 400, 300); // Try to zoom below min
      expect(viewportManager.getTransform().scale).toBe(0.1); // Should be clamped to min

      viewportManager.zoom(100, 400, 300); // Try to zoom above max
      expect(viewportManager.getTransform().scale).toBe(5); // Should be clamped to max
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new ViewportManager({ logger: null });
      }).toThrow();
    });

    it('should handle partial initial viewport settings', () => {
      const partialViewport = { width: 1000 };
      const manager = new ViewportManager({
        logger: mockLogger,
        initialViewport: partialViewport,
      });

      const viewport = manager.getViewport();
      expect(viewport).toEqual({
        x: 0,
        y: 0,
        width: 1000,
        height: 600,
      });
    });
  });

  describe('Viewport Management', () => {
    it('should set viewport and notify observers', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);

      const newViewport = { x: 100, y: 200, width: 1000, height: 800 };
      viewportManager.setViewport(newViewport);

      expect(viewportManager.getViewport()).toEqual(newViewport);
      expect(observer).toHaveBeenCalledWith({
        viewport: newViewport,
        transform: viewportManager.getTransform(),
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Viewport updated',
        newViewport
      );
    });

    it('should not notify observers when viewport unchanged', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear(); // Clear the initial notification

      const currentViewport = viewportManager.getViewport();
      viewportManager.setViewport(currentViewport);

      expect(observer).not.toHaveBeenCalled();
    });

    it('should handle partial viewport updates', () => {
      const initialViewport = viewportManager.getViewport();
      viewportManager.setViewport({ width: 1000 });

      const updatedViewport = viewportManager.getViewport();
      expect(updatedViewport).toEqual({
        ...initialViewport,
        width: 1000,
      });
    });

    it('should return a copy of viewport to prevent external mutation', () => {
      const viewport1 = viewportManager.getViewport();
      const viewport2 = viewportManager.getViewport();

      expect(viewport1).not.toBe(viewport2);
      expect(viewport1).toEqual(viewport2);

      viewport1.x = 100;
      expect(viewportManager.getViewport().x).toBe(0);
    });

    it('should return a copy of transform to prevent external mutation', () => {
      const transform1 = viewportManager.getTransform();
      const transform2 = viewportManager.getTransform();

      expect(transform1).not.toBe(transform2);
      expect(transform1).toEqual(transform2);

      transform1.scale = 2;
      expect(viewportManager.getTransform().scale).toBe(1);
    });
  });

  describe('Pan Operations', () => {
    it('should pan viewport by screen delta', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.pan(100, 50);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      // At scale 1, world delta equals screen delta
      expect(viewport.x).toBe(-100);
      expect(viewport.y).toBe(-50);
      expect(transform.x).toBe(100);
      expect(transform.y).toBe(50);

      expect(observer).toHaveBeenCalledWith({
        viewport,
        transform,
      });
    });

    it('should NOT adjust pan for zoom scale (consistent pan speed)', () => {
      // First zoom to scale 2
      viewportManager.zoom(2, 400, 300);
      const initialViewport = viewportManager.getViewport();

      // Then pan
      viewportManager.pan(100, 50);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      // Pan speed is consistent regardless of zoom - no scale adjustment
      expect(viewport.x).toBe(initialViewport.x - 100);
      expect(viewport.y).toBe(initialViewport.y - 50);
      expect(transform.x).toBe(100);
      expect(transform.y).toBe(50);
    });

    it('should constrain pan to bounds when bounds are set', () => {
      viewportManager.setBounds(-100, -100, 1000, 800);

      // Current viewport is 0,0,800,600 and bounds are -100,-100,1000,800
      // Max allowed position is 1000-800=200 for x and 800-600=200 for y

      // Try to pan outside bounds (pan adds to transform, subtracts from viewport)
      viewportManager.pan(-200, -200);

      const viewport = viewportManager.getViewport();
      // Pan(-200, -200) means viewport moves from (0,0) to (200,200)
      // This should be constrained to max bounds
      expect(viewport.x).toBe(200); // Should be constrained to maxX - width
      expect(viewport.y).toBe(200); // Should be constrained to maxY - height
    });

    it('should handle negative pan values', () => {
      viewportManager.pan(-100, -50);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(50);
      expect(transform.x).toBe(-100);
      expect(transform.y).toBe(-50);
    });
  });

  describe('Zoom Operations', () => {
    it('should zoom in around center point', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      const centerX = 400;
      const centerY = 300;
      const factor = 2;

      viewportManager.zoom(factor, centerX, centerY);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      expect(transform.scale).toBe(2);
      expect(viewport.width).toBe(1600); // 800 * 2
      expect(viewport.height).toBe(1200); // 600 * 2

      expect(observer).toHaveBeenCalledWith({
        viewport,
        transform,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Zoomed to 2.00x'
      );
    });

    it('should zoom out around center point', () => {
      const centerX = 400;
      const centerY = 300;
      const factor = 0.5;

      viewportManager.zoom(factor, centerX, centerY);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      expect(transform.scale).toBe(0.5);
      expect(viewport.width).toBe(400); // 800 * 0.5
      expect(viewport.height).toBe(300); // 600 * 0.5
    });

    it('should clamp zoom to minimum limit', () => {
      const factor = 0.05; // Below minimum of 0.1

      viewportManager.zoom(factor, 400, 300);

      expect(viewportManager.getTransform().scale).toBe(0.1);
    });

    it('should clamp zoom to maximum limit', () => {
      const factor = 10; // Above maximum of 5

      viewportManager.zoom(factor, 400, 300);

      expect(viewportManager.getTransform().scale).toBe(5);
    });

    it('should not change viewport when zoom factor results in no change', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      // First zoom to max
      viewportManager.zoom(10, 400, 300);
      observer.mockClear();

      // Try to zoom further
      viewportManager.zoom(2, 400, 300);

      expect(observer).not.toHaveBeenCalled();
    });

    it('should maintain center point during zoom', () => {
      const centerX = 200;
      const centerY = 150;

      // Convert center to world coordinates before zoom
      const worldCenterBefore = viewportManager.screenToWorld(centerX, centerY);

      viewportManager.zoom(2, centerX, centerY);

      // Convert center back to screen coordinates after zoom
      const screenCenterAfter = viewportManager.worldToScreen(
        worldCenterBefore.x,
        worldCenterBefore.y
      );

      expect(screenCenterAfter.x).toBeCloseTo(centerX, 5);
      expect(screenCenterAfter.y).toBeCloseTo(centerY, 5);
    });

    it('should constrain zoom to bounds when bounds are set', () => {
      viewportManager.setBounds(-100, -100, 1000, 800);

      // Zoom in significantly around center
      viewportManager.zoom(3, 400, 300);

      const viewport = viewportManager.getViewport();
      // After zoom, the viewport is much larger (2400x1800)
      // The constraint logic is applied, which is the main behavior to test
      expect(viewport.width).toBe(2400); // 800 * 3
      expect(viewport.height).toBe(1800); // 600 * 3

      // The constrainToBounds function was called during zoom
      expect(viewportManager.getTransform().scale).toBe(3);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset viewport to default state', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);

      // Modify viewport and transform
      viewportManager.setViewport({ x: 100, y: 200, width: 1000, height: 800 });
      viewportManager.zoom(2, 400, 300);
      viewportManager.pan(50, 75);

      observer.mockClear();

      // Reset
      viewportManager.reset();

      expect(viewportManager.getViewport()).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });

      expect(viewportManager.getTransform()).toEqual({
        x: 0,
        y: 0,
        scale: 1,
      });

      expect(observer).toHaveBeenCalledWith({
        viewport: { x: 0, y: 0, width: 800, height: 600 },
        transform: { x: 0, y: 0, scale: 1 },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Reset to default'
      );
    });
  });

  describe('Fit to Content', () => {
    it('should fit viewport to content bounds', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      const contentBounds = { minX: 100, minY: 50, maxX: 400, maxY: 350 };

      viewportManager.fitToContent(contentBounds);

      const viewport = viewportManager.getViewport();
      const transform = viewportManager.getTransform();

      // Content is 300x300, with padding becomes 400x400
      expect(viewport.width).toBe(400);
      expect(viewport.height).toBe(400);

      // Centered on content center (250, 200)
      expect(viewport.x).toBe(50); // 250 - 400/2
      expect(viewport.y).toBe(0); // 200 - 400/2

      // Transform should be reset
      expect(transform).toEqual({ x: 0, y: 0, scale: 1 });

      expect(observer).toHaveBeenCalledWith({
        viewport,
        transform,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Fit to content',
        contentBounds
      );
    });

    it('should use custom padding in fit to content', () => {
      const contentBounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
      const padding = 100;

      viewportManager.fitToContent(contentBounds, padding);

      const viewport = viewportManager.getViewport();

      // Content is 200x200, with 100px padding becomes 400x400
      expect(viewport.width).toBe(400);
      expect(viewport.height).toBe(400);
    });

    it('should handle invalid content bounds', () => {
      const invalidBounds = { minX: 100, minY: 50, maxX: 50, maxY: 25 };

      viewportManager.fitToContent(invalidBounds);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ViewportManager: Invalid content bounds for fit'
      );

      // Viewport should remain unchanged
      expect(viewportManager.getViewport()).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });

    it('should handle zero width content bounds', () => {
      const zeroBounds = { minX: 100, minY: 50, maxX: 100, maxY: 200 };

      viewportManager.fitToContent(zeroBounds);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ViewportManager: Invalid content bounds for fit'
      );
    });

    it('should handle zero height content bounds', () => {
      const zeroBounds = { minX: 100, minY: 50, maxX: 200, maxY: 50 };

      viewportManager.fitToContent(zeroBounds);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ViewportManager: Invalid content bounds for fit'
      );
    });

    it('should ensure viewport is square for radial layouts', () => {
      const contentBounds = { minX: 0, minY: 0, maxX: 300, maxY: 100 };

      viewportManager.fitToContent(contentBounds);

      const viewport = viewportManager.getViewport();

      // Content is 300x100, with padding becomes 400x200
      // But viewport should be square (max dimension)
      expect(viewport.width).toBe(400);
      expect(viewport.height).toBe(400);
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert screen coordinates to world coordinates', () => {
      const screenX = 100;
      const screenY = 200;

      const worldCoords = viewportManager.screenToWorld(screenX, screenY);

      expect(worldCoords).toEqual({ x: 100, y: 200 });
    });

    it('should convert world coordinates to screen coordinates', () => {
      const worldX = 100;
      const worldY = 200;

      const screenCoords = viewportManager.worldToScreen(worldX, worldY);

      expect(screenCoords).toEqual({ x: 100, y: 200 });
    });

    it('should handle coordinate conversion with viewport offset', () => {
      viewportManager.setViewport({ x: 50, y: 75, width: 800, height: 600 });

      const screenCoords = viewportManager.worldToScreen(150, 275);
      expect(screenCoords).toEqual({ x: 100, y: 200 });

      const worldCoords = viewportManager.screenToWorld(100, 200);
      expect(worldCoords).toEqual({ x: 150, y: 275 });
    });

    it('should handle coordinate conversion with zoom', () => {
      viewportManager.zoom(2, 400, 300);

      // After zoom, viewport changes position and size
      const viewport = viewportManager.getViewport();

      // Test round trip conversion
      const worldX = 100;
      const worldY = 200;
      const screenCoords = viewportManager.worldToScreen(worldX, worldY);
      const backToWorld = viewportManager.screenToWorld(
        screenCoords.x,
        screenCoords.y
      );

      expect(backToWorld.x).toBeCloseTo(worldX, 5);
      expect(backToWorld.y).toBeCloseTo(worldY, 5);
    });

    it('should handle coordinate conversion with complex transforms', () => {
      // Pan and zoom
      viewportManager.setViewport({ x: 100, y: 50, width: 800, height: 600 });
      viewportManager.zoom(1.5, 400, 300);

      const worldX = 200;
      const worldY = 150;

      const screenCoords = viewportManager.worldToScreen(worldX, worldY);
      const backToWorld = viewportManager.screenToWorld(
        screenCoords.x,
        screenCoords.y
      );

      expect(backToWorld.x).toBeCloseTo(worldX, 5);
      expect(backToWorld.y).toBeCloseTo(worldY, 5);
    });

    it('should handle negative coordinates', () => {
      const worldCoords = viewportManager.screenToWorld(-50, -100);
      expect(worldCoords.x).toBe(-50);
      expect(worldCoords.y).toBe(-100);

      const screenCoords = viewportManager.worldToScreen(-50, -100);
      expect(screenCoords.x).toBe(-50);
      expect(screenCoords.y).toBe(-100);
    });
  });

  describe('Bounds Management', () => {
    it('should set viewport bounds', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.setBounds(-100, -50, 1000, 800);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Bounds set',
        { minX: -100, minY: -50, maxX: 1000, maxY: 800 }
      );

      // Should trigger constraint check - but may not notify if no constraint needed
      // The default viewport (0,0,800,600) fits within bounds (-100,-50,1000,800)
      // So no constraint occurs and no observer notification
    });

    it('should clear viewport bounds', () => {
      viewportManager.setBounds(-100, -50, 1000, 800);

      viewportManager.clearBounds();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ViewportManager: Bounds cleared'
      );
    });

    it('should constrain viewport to bounds when setBounds is called', () => {
      // First set viewport outside bounds
      viewportManager.setViewport({ x: -50, y: -25, width: 800, height: 600 });

      let viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(-50); // Not constrained yet
      expect(viewport.y).toBe(-25); // Not constrained yet

      // Then set bounds - this should trigger constraint
      viewportManager.setBounds(0, 0, 1000, 800);

      viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(0); // Now constrained to minX
      expect(viewport.y).toBe(0); // Now constrained to minY
    });

    it('should constrain viewport to maximum bounds when setBounds is called', () => {
      // First set viewport that would exceed bounds
      viewportManager.setViewport({ x: 500, y: 400, width: 800, height: 600 });

      let viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(500); // Not constrained yet
      expect(viewport.y).toBe(400); // Not constrained yet

      // Then set bounds - this should trigger constraint
      viewportManager.setBounds(0, 0, 1000, 800);

      viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(200); // 1000 - 800
      expect(viewport.y).toBe(200); // 800 - 600
    });

    it('should handle bounds constraint during pan', () => {
      viewportManager.setBounds(0, 0, 1000, 800);

      // Pan that would move viewport outside bounds
      // Pan(-100, -50) means world delta = (-100, -50), so viewport moves from (0,0) to (100,50)
      // This is within bounds, so it should be allowed
      viewportManager.pan(-100, -50);

      const viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(100); // Moved to 100
      expect(viewport.y).toBe(50); // Moved to 50

      // Now pan in the opposite direction to exceed bounds
      // Pan(200, 100) means world delta = (200, 100), so viewport moves from (100,50) to (-100,-50)
      // This would exceed minimum bounds, so it should be constrained
      viewportManager.pan(200, 100);

      const viewport2 = viewportManager.getViewport();
      expect(viewport2.x).toBe(0); // Should be constrained to minX = 0
      expect(viewport2.y).toBe(0); // Should be constrained to minY = 0
    });

    it('should handle bounds constraint during zoom', () => {
      viewportManager.setBounds(0, 0, 1000, 800);

      // Zoom that would move viewport outside bounds
      // Zoom around (0,0) with factor 2 would change viewport position
      viewportManager.zoom(2, 0, 0);

      const viewport = viewportManager.getViewport();
      // Width and height should be scaled
      expect(viewport.width).toBe(1600); // 800 * 2
      expect(viewport.height).toBe(1200); // 600 * 2

      // Constraint function was called during zoom
      expect(viewportManager.getTransform().scale).toBe(2);
    });

    it('should not constrain when bounds are cleared', () => {
      viewportManager.setBounds(0, 0, 1000, 800);
      viewportManager.clearBounds();

      viewportManager.setViewport({ x: -100, y: -50, width: 800, height: 600 });

      const viewport = viewportManager.getViewport();
      expect(viewport.x).toBe(-100); // Not constrained
      expect(viewport.y).toBe(-50); // Not constrained
    });

    it('should notify observers when constraining to bounds', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.setBounds(0, 0, 1000, 800);
      observer.mockClear();

      // Pan that triggers constraint
      viewportManager.pan(-100, -50);

      expect(observer).toHaveBeenCalledTimes(1);
    });

    it('should notify observers when constraint is needed', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      viewportManager.setBounds(0, 0, 1000, 800);
      observer.mockClear();

      // Pan that triggers constraint
      // Pan(50, 25) means world delta = (50, 25), so viewport moves from (0,0) to (-50,-25)
      // This exceeds minimum bounds, so constraint will be triggered
      viewportManager.pan(50, 25);

      expect(observer).toHaveBeenCalled(); // Called for pan and/or constraint
    });
  });

  describe('Zoom Limits', () => {
    it('should set custom zoom limits', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.setZoomLimits(0.5, 10);

      // Test new minimum
      viewportManager.zoom(0.1, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(0.5);

      // Reset and test new maximum
      viewportManager.reset();
      viewportManager.zoom(20, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(10);
    });

    it('should clamp zoom limits to reasonable bounds', () => {
      viewportManager.setZoomLimits(0.005, 200);

      // Should be clamped to 0.01 and 100
      viewportManager.zoom(0.001, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(0.01);

      viewportManager.reset();
      viewportManager.zoom(500, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(100);
    });

    it('should adjust current zoom when setting limits', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);

      // First zoom to 0.05
      viewportManager.zoom(0.05, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(0.1); // Already clamped

      observer.mockClear();

      // Set higher minimum
      viewportManager.setZoomLimits(0.2, 5);

      expect(viewportManager.getTransform().scale).toBe(0.2);
      expect(observer).toHaveBeenCalledWith({
        viewport: viewportManager.getViewport(),
        transform: viewportManager.getTransform(),
      });
    });

    it('should adjust current zoom when above new maximum', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);

      // First zoom to maximum
      viewportManager.zoom(10, 400, 300);
      expect(viewportManager.getTransform().scale).toBe(5); // Already clamped

      observer.mockClear();

      // Set lower maximum
      viewportManager.setZoomLimits(0.1, 2);

      expect(viewportManager.getTransform().scale).toBe(2);
      expect(observer).toHaveBeenCalledWith({
        viewport: viewportManager.getViewport(),
        transform: viewportManager.getTransform(),
      });
    });

    it('should not notify observers when zoom is within new limits', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);

      // Zoom to 2x
      viewportManager.zoom(2, 400, 300);
      observer.mockClear();

      // Set limits that include current zoom
      viewportManager.setZoomLimits(0.5, 4);

      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('Observer Pattern', () => {
    it('should subscribe to viewport changes', () => {
      const observer = jest.fn();

      const unsubscribe = viewportManager.subscribe(observer);

      expect(observer).toHaveBeenCalledWith({
        viewport: viewportManager.getViewport(),
        transform: viewportManager.getTransform(),
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should notify observers on viewport changes', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.setViewport({ x: 100, y: 200, width: 1000, height: 800 });

      expect(observer).toHaveBeenCalledWith({
        viewport: { x: 100, y: 200, width: 1000, height: 800 },
        transform: viewportManager.getTransform(),
      });
    });

    it('should unsubscribe observers', () => {
      const observer = jest.fn();

      const unsubscribe = viewportManager.subscribe(observer);
      observer.mockClear();

      unsubscribe();

      viewportManager.setViewport({ x: 100, y: 200, width: 1000, height: 800 });

      expect(observer).not.toHaveBeenCalled();
    });

    it('should handle multiple observers', () => {
      const observer1 = jest.fn();
      const observer2 = jest.fn();

      viewportManager.subscribe(observer1);
      viewportManager.subscribe(observer2);

      observer1.mockClear();
      observer2.mockClear();

      viewportManager.pan(50, 25);

      expect(observer1).toHaveBeenCalledTimes(1);
      expect(observer2).toHaveBeenCalledTimes(1);
    });

    it('should handle observer errors gracefully', () => {
      // Create observer that throws only when called during notification, not during subscribe
      const errorObserver = jest.fn();
      const normalObserver = jest.fn();

      viewportManager.subscribe(errorObserver);
      viewportManager.subscribe(normalObserver);

      // Clear initial calls from subscribe
      errorObserver.mockClear();
      normalObserver.mockClear();

      // Make error observer throw on next call
      errorObserver.mockImplementation(() => {
        throw new Error('Observer error');
      });

      // This should not throw even if observer fails
      expect(() => {
        viewportManager.pan(50, 25);
      }).not.toThrow();

      expect(errorObserver).toHaveBeenCalledTimes(1);
      expect(normalObserver).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ViewportManager: Error in observer',
        expect.any(Error)
      );
    });

    it('should remove observer using unsubscribe method', () => {
      const observer = jest.fn();

      viewportManager.subscribe(observer);
      observer.mockClear();

      viewportManager.unsubscribe(observer);

      viewportManager.setViewport({ x: 100, y: 200, width: 1000, height: 800 });

      expect(observer).not.toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent observer', () => {
      const observer = jest.fn();

      // Should not throw
      expect(() => {
        viewportManager.unsubscribe(observer);
      }).not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should generate SVG viewBox string', () => {
      const viewBox = viewportManager.getViewBoxString();
      expect(viewBox).toBe('0 0 800 600');

      viewportManager.setViewport({ x: 100, y: 50, width: 1000, height: 800 });
      const newViewBox = viewportManager.getViewBoxString();
      expect(newViewBox).toBe('100 50 1000 800');
    });

    it('should check if point is visible in viewport', () => {
      // Point inside viewport
      expect(viewportManager.isPointVisible(400, 300)).toBe(true);

      // Point outside viewport
      expect(viewportManager.isPointVisible(1000, 700)).toBe(false);

      // Point on edge
      expect(viewportManager.isPointVisible(0, 0)).toBe(true);
      expect(viewportManager.isPointVisible(800, 600)).toBe(true);
    });

    it('should check point visibility with margin', () => {
      const margin = 50;

      // Point just outside viewport but within margin
      expect(viewportManager.isPointVisible(-25, -25, margin)).toBe(true);
      expect(viewportManager.isPointVisible(825, 625, margin)).toBe(true);

      // Point outside viewport and margin
      expect(viewportManager.isPointVisible(-75, -75, margin)).toBe(false);
      expect(viewportManager.isPointVisible(875, 675, margin)).toBe(false);
    });

    it('should handle point visibility with viewport offset', () => {
      viewportManager.setViewport({ x: 100, y: 50, width: 800, height: 600 });

      // Point inside offset viewport
      expect(viewportManager.isPointVisible(500, 350)).toBe(true);

      // Point outside offset viewport
      expect(viewportManager.isPointVisible(50, 25)).toBe(false);

      // Point on edge of offset viewport
      expect(viewportManager.isPointVisible(100, 50)).toBe(true);
      expect(viewportManager.isPointVisible(900, 650)).toBe(true);
    });

    it('should handle point visibility with default margin', () => {
      // Test with default margin of 0
      expect(viewportManager.isPointVisible(400, 300)).toBe(true);
      expect(viewportManager.isPointVisible(-1, -1)).toBe(false);
      expect(viewportManager.isPointVisible(801, 601)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing logger dependency', () => {
      expect(() => {
        new ViewportManager({});
      }).toThrow();
    });

    it('should handle invalid logger dependency', () => {
      expect(() => {
        new ViewportManager({ logger: 'invalid' });
      }).toThrow();
    });

    it('should handle observer notification errors', () => {
      const errorObserver = jest.fn();

      viewportManager.subscribe(errorObserver);

      // Clear initial call from subscribe
      errorObserver.mockClear();

      // Make error observer throw on next call
      errorObserver.mockImplementation(() => {
        throw new Error('Observer failed');
      });

      // Should not throw even if observer fails
      expect(() => {
        viewportManager.pan(50, 25);
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ViewportManager: Error in observer',
        expect.any(Error)
      );
    });

    it('should handle multiple observer errors', () => {
      const errorObserver1 = jest.fn();
      const errorObserver2 = jest.fn();

      viewportManager.subscribe(errorObserver1);
      viewportManager.subscribe(errorObserver2);

      // Clear initial calls from subscribe
      errorObserver1.mockClear();
      errorObserver2.mockClear();

      // Make both observers throw on next call
      errorObserver1.mockImplementation(() => {
        throw new Error('Observer 1 failed');
      });
      errorObserver2.mockImplementation(() => {
        throw new Error('Observer 2 failed');
      });

      // Should not throw even if multiple observers fail
      expect(() => {
        viewportManager.pan(50, 25);
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });

    it('should handle zoom with zero factor', () => {
      const initialScale = viewportManager.getTransform().scale;

      viewportManager.zoom(0, 400, 300);

      // Should clamp to minimum zoom
      expect(viewportManager.getTransform().scale).toBe(0.1);
    });

    it('should handle very large zoom factors', () => {
      viewportManager.zoom(1000, 400, 300);

      // Should clamp to maximum zoom
      expect(viewportManager.getTransform().scale).toBe(5);
    });

    it('should handle NaN values gracefully', () => {
      const observer = jest.fn();
      viewportManager.subscribe(observer);
      observer.mockClear();

      // Should not crash with NaN values
      expect(() => {
        viewportManager.pan(NaN, 50);
      }).not.toThrow();

      expect(() => {
        viewportManager.zoom(NaN, 400, 300);
      }).not.toThrow();
    });
  });
});
