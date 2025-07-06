/**
 * @file tests/unit/domUI/AnatomyGraphRenderer.enhanced.test.js
 * @description Enhanced unit tests for AnatomyGraphRenderer covering new features
 */

import AnatomyGraphRenderer from '../../../src/domUI/AnatomyGraphRenderer.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AnatomyGraphRenderer - Enhanced Features', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;
  let mockContainer;
  let mockSvg;
  let mouseEventListeners;
  let wheelEventListeners;

  beforeEach(() => {
    mouseEventListeners = {};
    wheelEventListeners = {};

    // Reset DOM mocks
    mockSvg = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      parentElement: null,
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn((event, handler) => {
        if (event === 'wheel') {
          wheelEventListeners[event] = handler;
        } else {
          mouseEventListeners[event] = handler;
        }
      }),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      style: { cursor: 'grab' },
      id: 'anatomy-graph',
    };

    mockContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      scrollTop: 0,
    };

    const mockElements = [];

    mockDocument = {
      getElementById: jest.fn((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        return null;
      }),
      createElementNS: jest.fn((ns, tagName) => {
        if (tagName === 'svg') {
          mockSvg.parentElement = mockContainer;
          return mockSvg;
        }
        const element = {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          style: {},
          tagName,
        };
        mockElements.push(element);
        return element;
      }),
      createElement: jest.fn((tagName) => ({
        className: '',
        style: {},
        innerHTML: '',
      })),
      addEventListener: jest.fn((event, handler) => {
        mouseEventListeners[event] = handler;
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    renderer = new AnatomyGraphRenderer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: { document: mockDocument },
    });
  });

  describe('Full Body Graph Traversal', () => {
    it('should render all body parts in the graph', async () => {
      // Arrange - Complex body with multiple levels
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
          head: 'head-id',
          leftArm: 'left-arm-id',
          rightArm: 'right-arm-id',
          leftHand: 'left-hand-id',
          rightHand: 'right-hand-id',
          leftLeg: 'left-leg-id',
          rightLeg: 'right-leg-id',
          leftFoot: 'left-foot-id',
          rightFoot: 'right-foot-id',
        },
      };

      const createMockEntity = (id, name, type, parentId = null) => ({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: name };
          if (component === 'core:description')
            return { text: `${name} description` };
          if (component === 'anatomy:part') return { subType: type };
          if (component === 'anatomy:joint' && parentId) {
            return { parentId, socketId: `${type}-socket` };
          }
          return null;
        }),
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'torso-id': createMockEntity('torso-id', 'Torso', 'torso'),
          'head-id': createMockEntity('head-id', 'Head', 'head', 'torso-id'),
          'left-arm-id': createMockEntity(
            'left-arm-id',
            'Left Arm',
            'arm',
            'torso-id'
          ),
          'right-arm-id': createMockEntity(
            'right-arm-id',
            'Right Arm',
            'arm',
            'torso-id'
          ),
          'left-hand-id': createMockEntity(
            'left-hand-id',
            'Left Hand',
            'hand',
            'left-arm-id'
          ),
          'right-hand-id': createMockEntity(
            'right-hand-id',
            'Right Hand',
            'hand',
            'right-arm-id'
          ),
          'left-leg-id': createMockEntity(
            'left-leg-id',
            'Left Leg',
            'leg',
            'torso-id'
          ),
          'right-leg-id': createMockEntity(
            'right-leg-id',
            'Right Leg',
            'leg',
            'torso-id'
          ),
          'left-foot-id': createMockEntity(
            'left-foot-id',
            'Left Foot',
            'foot',
            'left-leg-id'
          ),
          'right-foot-id': createMockEntity(
            'right-foot-id',
            'Right Foot',
            'foot',
            'right-leg-id'
          ),
        };
        return Promise.resolve(entities[id] || null);
      });

      // Act
      await renderer.renderGraph('test-entity', bodyData);

      // Assert - All nodes should be created
      expect(renderer._nodes.size).toBe(10); // All body parts
      expect(renderer._edges.length).toBe(9); // All connections

      // Verify hierarchy depths
      const nodes = Array.from(renderer._nodes.values());
      const torso = nodes.find((n) => n.id === 'torso-id');
      const head = nodes.find((n) => n.id === 'head-id');
      const leftHand = nodes.find((n) => n.id === 'left-hand-id');
      const leftFoot = nodes.find((n) => n.id === 'left-foot-id');

      expect(torso.depth).toBe(0);
      expect(head.depth).toBe(1);
      expect(leftHand.depth).toBe(2);
      expect(leftFoot.depth).toBe(2);
    });

    it('should handle disconnected body parts gracefully', async () => {
      // Arrange - Body with parts that have no joints
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
          floatingPart: 'floating-id', // No joint connection
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-id') {
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: 'Torso' };
              if (component === 'anatomy:part') return { subType: 'torso' };
              return null;
            }),
          });
        }
        if (id === 'floating-id') {
          return Promise.resolve({
            getComponentData: jest.fn(() => null), // No joint component
          });
        }
        return Promise.resolve(null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(renderer._nodes.size).toBe(2); // Both torso and floating part should be rendered
      expect(renderer._edges.length).toBe(0);
    });
  });

  describe('Curved Edge Rendering', () => {
    it('should render curved paths instead of straight lines', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
          head: 'head-id',
        },
      };

      const mockTorsoEntity = {
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockHeadEntity = {
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Head' };
          if (component === 'anatomy:part') return { subType: 'head' };
          if (component === 'anatomy:joint')
            return { parentId: 'torso-id', socketId: 'neck' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-id') return Promise.resolve(mockTorsoEntity);
        if (id === 'head-id') return Promise.resolve(mockHeadEntity);
        return Promise.resolve(null);
      });

      const pathElements = [];
      mockDocument.createElementNS.mockImplementation((ns, tagName) => {
        if (tagName === 'svg') return mockSvg;
        if (tagName === 'path') {
          const path = {
            setAttribute: jest.fn(),
            appendChild: jest.fn(),
            style: {},
          };
          pathElements.push(path);
          return path;
        }
        return {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          style: {},
        };
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(pathElements.length).toBeGreaterThan(0);
      const pathElement = pathElements[0];

      // Check that path uses quadratic Bezier curve
      const dAttrCall = pathElement.setAttribute.mock.calls.find(
        (call) => call[0] === 'd'
      );
      expect(dAttrCall).toBeDefined();
      expect(dAttrCall[1]).toMatch(
        /M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+/
      ); // Quadratic Bezier curve pattern

      // Check other path attributes
      expect(pathElement.setAttribute).toHaveBeenCalledWith('stroke', '#666');
      expect(pathElement.setAttribute).toHaveBeenCalledWith(
        'stroke-width',
        '2'
      );
      expect(pathElement.setAttribute).toHaveBeenCalledWith('fill', 'none');
      expect(pathElement.setAttribute).toHaveBeenCalledWith(
        'stroke-opacity',
        '0.6'
      );
    });
  });

  describe('Pan and Zoom Functionality', () => {
    beforeEach(async () => {
      // Setup a basic graph first
      const bodyData = {
        root: 'torso-id',
        parts: { torso: 'torso-id' },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue({
        getComponentData: jest.fn(() => ({ text: 'Test' })),
      });

      await renderer.renderGraph('test', bodyData);
    });

    it('should initialize pan and zoom state', () => {
      expect(renderer._viewBox).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });
      expect(renderer._zoom).toBe(1);
      expect(renderer._isPanning).toBe(false);
    });

    it('should handle mouse down for panning', () => {
      // Simulate left mouse button down
      const mouseDownEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
      };

      mouseEventListeners.mousedown(mouseDownEvent);

      expect(renderer._isPanning).toBe(true);
      expect(renderer._panStart).toEqual({ x: 100, y: 100 });
      expect(mockSvg.style.cursor).toBe('grabbing');
      expect(mouseDownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle mouse move for panning', () => {
      // Start panning
      renderer._isPanning = true;
      renderer._panStart = { x: 100, y: 100 };
      renderer._zoom = 1;
      const originalViewBox = { ...renderer._viewBox };

      // Simulate mouse move
      const mouseMoveEvent = {
        clientX: 150,
        clientY: 120,
      };

      mouseEventListeners.mousemove(mouseMoveEvent);

      // ViewBox should be updated
      expect(renderer._viewBox.x).toBe(originalViewBox.x - 50);
      expect(renderer._viewBox.y).toBe(originalViewBox.y - 20);
      expect(mockSvg.setAttribute).toHaveBeenCalledWith(
        'viewBox',
        expect.stringContaining(`${renderer._viewBox.x} ${renderer._viewBox.y}`)
      );
    });

    it('should handle mouse up to stop panning', () => {
      renderer._isPanning = true;

      mouseEventListeners.mouseup({});

      expect(renderer._isPanning).toBe(false);
      expect(mockSvg.style.cursor).toBe('grab');
    });

    it('should handle wheel events for zooming', () => {
      const originalWidth = renderer._viewBox.width;
      const originalHeight = renderer._viewBox.height;

      // Simulate zoom in (negative deltaY)
      const wheelEvent = {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        preventDefault: jest.fn(),
      };

      wheelEventListeners.wheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(renderer._zoom).toBeLessThan(1); // Zoom in reduces zoom factor
      expect(renderer._viewBox.width).toBeLessThan(originalWidth);
      expect(renderer._viewBox.height).toBeLessThan(originalHeight);
    });

    it('should limit zoom to reasonable bounds', () => {
      // Zoom out to maximum
      for (let i = 0; i < 20; i++) {
        wheelEventListeners.wheel({
          deltaY: 100,
          clientX: 400,
          clientY: 300,
          preventDefault: jest.fn(),
        });
      }

      expect(renderer._zoom).toBeGreaterThanOrEqual(0.1);
      expect(renderer._zoom).toBeLessThanOrEqual(5);

      // Zoom in to maximum
      for (let i = 0; i < 20; i++) {
        wheelEventListeners.wheel({
          deltaY: -100,
          clientX: 400,
          clientY: 300,
          preventDefault: jest.fn(),
        });
      }

      expect(renderer._zoom).toBeGreaterThanOrEqual(0.1);
      expect(renderer._zoom).toBeLessThanOrEqual(5);
    });

    it('should prevent panning when interacting with nodes', async () => {
      // This test verifies that the implementation prevents event propagation on nodes
      // The actual implementation adds stopPropagation to node mousedown events

      // Setup basic graph
      const bodyData = {
        root: 'torso-id',
        parts: { torso: 'torso-id' },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      });

      // Track created node elements
      const nodeElements = [];
      const originalCreateElementNS = mockDocument.createElementNS;

      mockDocument.createElementNS = jest.fn((ns, tagName) => {
        const element = originalCreateElementNS(ns, tagName);

        // Capture g elements with class anatomy-node
        if (tagName === 'g') {
          element.setAttribute = jest.fn((attr, value) => {
            if (attr === 'class' && value === 'anatomy-node') {
              nodeElements.push(element);
              element.className = 'anatomy-node';
            } else if (attr === 'data-node-id') {
              element.nodeId = value;
            }
          });

          element.getAttribute = jest.fn((attr) => {
            if (attr === 'data-node-id') return element.nodeId || 'torso-id';
            return '';
          });
        }

        return element;
      });

      mockSvg.querySelectorAll = jest.fn((selector) => {
        if (selector === '.anatomy-node') {
          return nodeElements;
        }
        return [];
      });

      // Render the graph
      await renderer.renderGraph('test', bodyData);

      // Verify that nodes were created and have the mousedown handler
      expect(nodeElements.length).toBeGreaterThan(0);

      const node = nodeElements[0];
      const mousedownCall = node.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousedown'
      );

      expect(mousedownCall).toBeDefined();

      // Verify the handler prevents propagation
      const mockEvent = { stopPropagation: jest.fn() };
      mousedownCall[1](mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Dynamic ViewBox Adjustment', () => {
    it('should adjust viewBox to fit all content', async () => {
      // Arrange - Create a graph with spread out nodes
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
          leftArm: 'left-arm-id',
          rightArm: 'right-arm-id',
        },
      };

      const createMockEntity = (id, name, type, parentId = null) => ({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: name };
          if (component === 'anatomy:part') return { subType: type };
          if (component === 'anatomy:joint' && parentId) {
            return { parentId, socketId: `${type}-socket` };
          }
          return null;
        }),
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'torso-id': createMockEntity('torso-id', 'Torso', 'torso'),
          'left-arm-id': createMockEntity(
            'left-arm-id',
            'Left Arm',
            'arm',
            'torso-id'
          ),
          'right-arm-id': createMockEntity(
            'right-arm-id',
            'Right Arm',
            'arm',
            'torso-id'
          ),
        };
        return Promise.resolve(entities[id] || null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(renderer._viewBox.width).toBeGreaterThan(0);
      expect(renderer._viewBox.height).toBeGreaterThan(0);

      // ViewBox should include padding
      const nodes = Array.from(renderer._nodes.values());
      const minX = Math.min(...nodes.map((n) => n.x));
      const maxX = Math.max(...nodes.map((n) => n.x));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxY = Math.max(...nodes.map((n) => n.y));

      expect(renderer._viewBox.x).toBeLessThan(minX);
      expect(renderer._viewBox.y).toBeLessThan(minY);
      expect(renderer._viewBox.x + renderer._viewBox.width).toBeGreaterThan(
        maxX
      );
      expect(renderer._viewBox.y + renderer._viewBox.height).toBeGreaterThan(
        maxY
      );
    });
  });

  describe('Node Hover Effects', () => {
    it('should apply hover effects to nodes', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-id',
        parts: { torso: 'torso-id' },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      });

      const mockNodeElement = {
        getAttribute: jest.fn().mockReturnValue('torso-id'),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        getBoundingClientRect: jest.fn().mockReturnValue({
          left: 100,
          top: 100,
          width: 60,
          height: 60,
        }),
      };

      const mockCircle = {
        getAttribute: jest.fn((attr) => {
          if (attr === 'r') return '30';
          if (attr === 'stroke-width') return '2';
          return '';
        }),
        setAttribute: jest.fn(),
      };

      mockNodeElement.querySelector.mockReturnValue(mockCircle);
      mockSvg.querySelectorAll.mockReturnValue([mockNodeElement]);

      // Act
      await renderer.renderGraph('test', bodyData);

      // Find mouseenter and mouseleave handlers
      // There are two mouseenter handlers - first for tooltip, second for hover effect
      const mouseEnterCalls =
        mockNodeElement.addEventListener.mock.calls.filter(
          (call) => call[0] === 'mouseenter'
        );
      const mouseLeaveCalls =
        mockNodeElement.addEventListener.mock.calls.filter(
          (call) => call[0] === 'mouseleave'
        );

      expect(mouseEnterCalls.length).toBe(2); // One for tooltip, one for hover
      expect(mouseLeaveCalls.length).toBe(2);

      // The second mouseenter handler is for the hover effect
      const hoverEnterHandler = mouseEnterCalls[1][1];
      const hoverLeaveHandler = mouseLeaveCalls[1][1];

      // Simulate hover
      hoverEnterHandler();

      expect(mockCircle.setAttribute).toHaveBeenCalledWith('r', '33');
      expect(mockCircle.setAttribute).toHaveBeenCalledWith('stroke-width', '3');
      expect(mockCircle.setAttribute).toHaveBeenCalledWith(
        'fill-opacity',
        '0.9'
      );

      // Simulate mouse leave
      hoverLeaveHandler();

      expect(mockCircle.setAttribute).toHaveBeenCalledWith('r', '30');
      expect(mockCircle.setAttribute).toHaveBeenCalledWith('stroke-width', '2');
      expect(mockCircle.setAttribute).toHaveBeenCalledWith('fill-opacity', '1');
    });
  });

  describe('Performance with Large Graphs', () => {
    it('should handle graphs with many nodes efficiently', async () => {
      // Arrange - Create a large body graph
      const parts = {};
      const numParts = 50;

      for (let i = 0; i < numParts; i++) {
        parts[`part-${i}`] = `part-${i}-id`;
      }

      const bodyData = {
        root: 'part-0-id',
        parts,
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const match = id.match(/part-(\d+)-id/);
        if (match) {
          const index = parseInt(match[1]);
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: `Part ${index}` };
              if (component === 'anatomy:part') return { subType: 'generic' };
              if (component === 'anatomy:joint' && index > 0) {
                // Create a tree structure
                const parentIndex = Math.floor((index - 1) / 2);
                return {
                  parentId: `part-${parentIndex}-id`,
                  socketId: 'socket',
                };
              }
              return null;
            }),
          });
        }
        return Promise.resolve(null);
      });

      // Act
      const startTime = Date.now();
      await renderer.renderGraph('test', bodyData);
      const endTime = Date.now();

      // Assert
      expect(renderer._nodes.size).toBeGreaterThan(25); // At least half should be connected
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
