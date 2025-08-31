/**
 * @file Unit tests for drag handler utility
 * @see dragHandler.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import DragHandler from '../../../src/logging/dragHandler.js';
import { createTestBed } from '../../common/testBed.js';

describe('DragHandler', () => {
  let dom;
  let document;
  let window;
  let testBed;
  let element;
  let container;
  let logger;
  let dragHandler;
  let callbacks;

  beforeEach(() => {
    // Set up test bed
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.navigator = {
      vibrate: jest.fn(),
    };

    // Create test elements
    container = document.createElement('div');
    container.className = 'test-container';
    container.style.position = 'fixed';
    container.style.width = '200px';
    container.style.height = '100px';
    container.setAttribute('data-position', 'top-right');
    document.body.appendChild(container);

    element = document.createElement('div');
    element.className = 'test-badge';
    container.appendChild(element);

    // Create callbacks
    callbacks = {
      onDragStart: jest.fn(),
      onDragEnd: jest.fn(),
    };

    // Mock getBoundingClientRect for container (JSDOM doesn't provide layout)
    container.getBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 100,
      right: 300,
      bottom: 200,
      width: 200,
      height: 100,
    }));

    // Create drag handler
    dragHandler = new DragHandler({
      element,
      container,
      callbacks,
      logger,
    });
    
    // Enable drag functionality
    dragHandler.enable();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    
    if (dragHandler) {
      dragHandler.destroy();
    }
    
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.navigator;
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(dragHandler).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith('Drag functionality enabled');
    });

    it('should throw error if logger is missing required methods', () => {
      expect(() => {
        new DragHandler({
          element,
          container,
          callbacks,
          logger: {},
        });
      }).toThrow();
    });

    it('should set cursor style on element when enabled', () => {
      dragHandler.enable();
      expect(element.style.cursor).toBe('move');
      expect(element.getAttribute('title')).toBe('Hold to drag');
    });
  });

  describe('Mouse Events', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      dragHandler.enable();
    });

    it('should start drag after long press on mousedown', () => {
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });

      element.dispatchEvent(mousedownEvent);
      
      // Should not start immediately
      expect(callbacks.onDragStart).not.toHaveBeenCalled();
      
      // Fast-forward time to trigger long press
      jest.advanceTimersByTime(500);
      
      expect(callbacks.onDragStart).toHaveBeenCalled();
      expect(container.classList.contains('dragging')).toBe(true);
    });

    it('should update position during mousemove when dragging', () => {
      // Start drag
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);

      // Move mouse
      const mousemoveEvent = new window.MouseEvent('mousemove', {
        clientX: 150,
        clientY: 120,
        bubbles: true,
      });
      document.dispatchEvent(mousemoveEvent);

      // Check position updated
      expect(container.style.left).toBeTruthy();
      expect(container.style.top).toBeTruthy();
    });


    it('should cancel drag if mouseup before long press completes', () => {
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      
      // Release before 500ms
      jest.advanceTimersByTime(200);
      
      const mouseupEvent = new window.MouseEvent('mouseup', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(mouseupEvent);

      expect(callbacks.onDragStart).not.toHaveBeenCalled();
      expect(callbacks.onDragEnd).not.toHaveBeenCalled();
    });
  });

  describe('Touch Events', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      dragHandler.enable();
    });

    it('should start drag after long press on touchstart', () => {
      const touchstartEvent = new window.TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
        bubbles: true,
      });

      element.dispatchEvent(touchstartEvent);
      
      // Should not start immediately
      expect(callbacks.onDragStart).not.toHaveBeenCalled();
      
      // Fast-forward time to trigger long press
      jest.advanceTimersByTime(500);
      
      expect(callbacks.onDragStart).toHaveBeenCalled();
      expect(global.navigator.vibrate).toHaveBeenCalledWith(50);
    });

    it('should update position during touchmove when dragging', () => {
      // Start drag
      const touchstartEvent = new window.TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
        bubbles: true,
      });
      element.dispatchEvent(touchstartEvent);
      jest.advanceTimersByTime(500);

      // Move touch
      const touchmoveEvent = new window.TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 120 }],
        bubbles: true,
      });
      document.dispatchEvent(touchmoveEvent);

      // Check position updated
      expect(container.style.left).toBeTruthy();
      expect(container.style.top).toBeTruthy();
    });


    it('should ignore multi-touch events', () => {
      const touchstartEvent = new window.TouchEvent('touchstart', {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
        bubbles: true,
      });

      element.dispatchEvent(touchstartEvent);
      jest.advanceTimersByTime(500);

      expect(callbacks.onDragStart).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Events', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      dragHandler.enable();
    });


    it('should ignore non-Escape keys during drag', () => {
      // Start drag
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);

      // Press other key
      const keyEvent = new window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      document.dispatchEvent(keyEvent);

      expect(container.classList.contains('dragging')).toBe(true);
    });
  });


  describe('Constraint Boundaries', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      dragHandler.enable();
      
      // Mock viewport dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    });

    it('should constrain position within viewport boundaries', () => {
      // Start drag
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);

      // Try to move beyond viewport
      const mousemoveEvent = new window.MouseEvent('mousemove', {
        clientX: -100, // Beyond left edge
        clientY: -100, // Beyond top edge
        bubbles: true,
      });
      document.dispatchEvent(mousemoveEvent);

      // Position should be constrained
      const left = parseFloat(container.style.left);
      const top = parseFloat(container.style.top);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Panel Interaction', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      dragHandler.enable();

      // Add panel to container
      const panel = document.createElement('div');
      panel.className = 'lne-log-panel';
      panel.style.pointerEvents = 'auto';
      container.appendChild(panel);
    });

    it('should disable panel pointer events during drag', () => {
      const panel = container.querySelector('.lne-log-panel');
      
      // Start drag
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);

      expect(panel.style.pointerEvents).toBe('none');
    });

  });

  describe('Cleanup', () => {
    it('should clean up event listeners on disable', () => {
      dragHandler.enable();
      
      const removeEventListenerSpy = jest.spyOn(element, 'removeEventListener');
      
      dragHandler.disable();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(element.style.cursor).toBe('pointer');
    });

    it('should clean up all references on destroy', () => {
      dragHandler.enable();
      dragHandler.destroy();
      
      // Try to enable after destroy - should not throw but won't do anything
      expect(() => dragHandler.enable()).not.toThrow();
    });

    it('should cancel active drag on disable', () => {
      jest.useFakeTimers();
      dragHandler.enable();
      
      // Start drag
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      element.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);
      
      expect(container.classList.contains('dragging')).toBe(true);
      
      dragHandler.disable();
      
      expect(container.classList.contains('dragging')).toBe(false);
    });
  });
});