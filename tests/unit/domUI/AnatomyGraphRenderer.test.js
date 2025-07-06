/**
 * @file tests/unit/domUI/AnatomyGraphRenderer.test.js
 * @description Unit tests for AnatomyGraphRenderer
 */

import AnatomyGraphRenderer from '../../../src/domUI/AnatomyGraphRenderer.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AnatomyGraphRenderer', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;
  let mockContainer;
  let mockSvg;

  beforeEach(() => {
    // Reset DOM mocks
    mockSvg = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      parentElement: null,
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      style: {},
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
        return {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          style: {},
        };
      }),
      createElement: jest.fn((tagName) => ({
        className: '',
        style: {},
        innerHTML: '',
      })),
      addEventListener: jest.fn(),
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

  describe('renderGraph', () => {
    it('should render a graph with valid body data', async () => {
      // Arrange
      const rootEntityId = 'test-entity';
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
          if (component === 'core:description')
            return { text: 'The main body' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockHeadEntity = {
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Head' };
          if (component === 'core:description')
            return { text: 'Contains the brain' };
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

      // Act
      await renderer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyGraphRenderer: Rendering graph for entity ${rootEntityId}`
      );
      expect(mockDocument.createElementNS).toHaveBeenCalledWith(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      expect(mockSvg.setAttribute).toHaveBeenCalledWith('width', '100%');
      expect(mockSvg.setAttribute).toHaveBeenCalledWith('height', '100%');
      expect(mockSvg.setAttribute).toHaveBeenCalledWith(
        'preserveAspectRatio',
        'xMidYMid meet'
      );
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    it('should handle missing body data gracefully', async () => {
      // Arrange
      const rootEntityId = 'test-entity';
      const bodyData = null;

      // Act
      await renderer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No body data or root found'
      );
      expect(mockDocument.createElementNS).not.toHaveBeenCalled();
    });

    it('should handle entity not found errors', async () => {
      // Arrange
      const rootEntityId = 'test-entity';
      const bodyData = {
        root: 'missing-id',
        parts: {
          missing: 'missing-id',
        },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      // Act
      await renderer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Entity not found: missing-id'
      );
      expect(mockDocument.createElementNS).toHaveBeenCalledWith(
        'http://www.w3.org/2000/svg',
        'svg'
      );
    });
  });

  describe('clear', () => {
    it('should remove existing SVG and tooltip elements', () => {
      // Arrange
      const mockExistingSvg = { remove: jest.fn() };
      const mockExistingTooltip = { remove: jest.fn() };

      mockContainer.querySelector.mockImplementation((selector) => {
        if (selector === 'svg') return mockExistingSvg;
        if (selector === '.anatomy-tooltip') return mockExistingTooltip;
        return null;
      });

      // Act
      renderer.clear();

      // Assert
      expect(mockExistingSvg.remove).toHaveBeenCalled();
      expect(mockExistingTooltip.remove).toHaveBeenCalled();
      expect(renderer._nodes.size).toBe(0);
      expect(renderer._edges.length).toBe(0);
      expect(renderer._svg).toBeNull();
      expect(renderer._tooltip).toBeNull();
    });

    it('should handle missing container gracefully', () => {
      // Arrange
      mockDocument.getElementById.mockReturnValue(null);

      // Act & Assert (should not throw)
      expect(() => renderer.clear()).not.toThrow();
    });
  });

  describe('radial layout features', () => {
    it('should position children radially around parent', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
          head: 'head-id',
          'left-arm': 'left-arm-id',
          'right-arm': 'right-arm-id',
        },
      };

      const mockTorsoEntity = {
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const createChildEntity = (name, type) => ({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: name };
          if (component === 'anatomy:part') return { subType: type };
          if (component === 'anatomy:joint') return { parentId: 'torso-id' };
          return null;
        }),
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-id') return Promise.resolve(mockTorsoEntity);
        if (id === 'head-id')
          return Promise.resolve(createChildEntity('Head', 'head'));
        if (id === 'left-arm-id')
          return Promise.resolve(createChildEntity('Left Arm', 'arm'));
        if (id === 'right-arm-id')
          return Promise.resolve(createChildEntity('Right Arm', 'arm'));
        return Promise.resolve(null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      const torso = renderer._nodes.get('torso-id');
      const head = renderer._nodes.get('head-id');
      const leftArm = renderer._nodes.get('left-arm-id');
      const rightArm = renderer._nodes.get('right-arm-id');

      // Root should be at center
      expect(torso.x).toBe(600);
      expect(torso.y).toBe(400);

      // Children should be at radius 150 from root
      const expectedRadius = 150;
      const children = [head, leftArm, rightArm];

      children.forEach((child) => {
        const dx = child.x - torso.x;
        const dy = child.y - torso.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeCloseTo(expectedRadius, 1);
      });
    });
  });

  describe('node positioning', () => {
    it('should position root node at center', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-id',
        parts: { torso: 'torso-id' },
      };

      const mockEntity = {
        getComponentData: jest.fn(() => ({ text: 'Test' })),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      const nodes = Array.from(renderer._nodes.values());
      expect(nodes[0].x).toBe(600); // Root at center X
      expect(nodes[0].y).toBe(400); // Root at center Y
    });

    it('should create nodes for root entity', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-id',
        parts: {
          torso: 'torso-id',
        },
      };

      const mockTorsoEntity = {
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-id') return Promise.resolve(mockTorsoEntity);
        return Promise.resolve(null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      const nodes = Array.from(renderer._nodes.values());
      expect(nodes.length).toBe(1);

      const torso = nodes[0];
      expect(torso.id).toBe('torso-id');
      expect(torso.depth).toBe(0);
      expect(torso.name).toBe('Torso');
      expect(torso.type).toBe('torso');
      expect(torso.x).toBe(600); // Root at center X
      expect(torso.y).toBe(400); // Root at center Y
    });
  });

  describe('error handling', () => {
    it('should catch and log errors during graph rendering', async () => {
      // Arrange
      const bodyData = { root: 'test-id', parts: {} };
      const error = new Error('Test error');

      // Mock _buildGraphData to throw an error
      jest.spyOn(renderer, '_buildGraphData').mockRejectedValue(error);

      // Act & Assert
      await expect(renderer.renderGraph('test', bodyData)).rejects.toThrow(
        'Test error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to render anatomy graph:',
        error
      );
    });

    it('should handle missing root entity', async () => {
      // Arrange
      const bodyData = {
        root: 'missing-id',
        parts: {},
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Entity not found: missing-id'
      );
      expect(renderer._nodes.size).toBe(0);
    });
  });
});
