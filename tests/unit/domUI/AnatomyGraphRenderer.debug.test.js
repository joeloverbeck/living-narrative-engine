/**
 * @file tests/unit/domUI/AnatomyGraphRenderer.debug.test.js
 * @description Debug unit tests for AnatomyGraphRenderer focusing on parts collection
 */

import AnatomyGraphRenderer from '../../../src/domUI/AnatomyGraphRenderer.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AnatomyGraphRenderer - Debug Tests', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;
  let mockContainer;
  let mockSvg;

  beforeEach(() => {
    // Mock SVG element
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
      style: { cursor: 'grab' },
      id: 'anatomy-graph',
    };

    // Mock container
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
    };

    // Mock document
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
          tagName,
        };
      }),
      createElement: jest.fn(() => ({
        className: '',
        style: {},
        innerHTML: '',
      })),
      addEventListener: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    renderer = new AnatomyGraphRenderer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: { document: mockDocument },
    });
  });

  describe('Parts Collection from bodyData', () => {
    it('should collect all parts from bodyData.parts', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-1',
        parts: {
          torso: 'torso-1',
          head: 'head-1',
          left_arm: 'arm-1',
          right_arm: 'arm-2',
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
          'torso-1': createMockEntity('torso-1', 'Torso', 'torso'),
          'head-1': createMockEntity('head-1', 'Head', 'head', 'torso-1'),
          'arm-1': createMockEntity('arm-1', 'Left Arm', 'arm', 'torso-1'),
          'arm-2': createMockEntity('arm-2', 'Right Arm', 'arm', 'torso-1'),
        };
        return Promise.resolve(entities[id] || null);
      });

      // Act
      await renderer.renderGraph('test-entity', bodyData);

      // Assert
      expect(renderer._nodes.size).toBe(4); // All 4 parts should be processed
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Building graph data from bodyData:',
        expect.objectContaining({
          root: 'torso-1',
          partsCount: 4,
          parts: bodyData.parts,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Graph building complete: 4 nodes, 3 edges')
      );
    });

    it('should handle parts without joint components gracefully', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-1',
        parts: {
          torso: 'torso-1',
          floating_part: 'floating-1', // No joint connection
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') {
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: 'Torso' };
              if (component === 'anatomy:part') return { subType: 'torso' };
              return null;
            }),
          });
        }
        if (id === 'floating-1') {
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: 'Floating Part' };
              if (component === 'anatomy:part') return { subType: 'unknown' };
              return null; // No joint component
            }),
          });
        }
        return Promise.resolve(null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(renderer._nodes.size).toBe(2); // Both parts should be added
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Found 1 unconnected parts:',
        [{ name: 'floating_part', id: 'floating-1' }]
      );
    });

    it('should log component data for each processed entity', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-1',
        parts: {
          torso: 'torso-1',
        },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue({
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') return { text: 'Torso' };
          if (component === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Entity torso-1 components:',
        expect.objectContaining({
          hasName: true,
          nameText: 'Torso',
          hasPartComponent: true,
          partType: 'torso',
          hasJointComponent: false,
          jointParentId: undefined,
        })
      );
    });

    it('should correctly identify and log children for each node', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-1',
        parts: {
          torso: 'torso-1',
          head: 'head-1',
          left_arm: 'arm-1',
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
          'torso-1': createMockEntity('torso-1', 'Torso', 'torso'),
          'head-1': createMockEntity('head-1', 'Head', 'head', 'torso-1'),
          'arm-1': createMockEntity('arm-1', 'Left Arm', 'arm', 'torso-1'),
        };
        return Promise.resolve(entities[id] || null);
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Found 2 children for torso-1:',
        expect.arrayContaining([
          { id: 'head-1', name: 'Head' },
          { id: 'arm-1', name: 'Left Arm' },
        ])
      );
    });
  });

  describe('Debug Info Display', () => {
    it('should add debug info group to SVG', async () => {
      // Arrange
      const bodyData = {
        root: 'torso-1',
        parts: {
          torso: 'torso-1',
          head: 'head-1',
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') {
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: 'Torso' };
              if (component === 'anatomy:part') return { subType: 'torso' };
              return null;
            }),
          });
        }
        if (id === 'head-1') {
          return Promise.resolve({
            getComponentData: jest.fn((component) => {
              if (component === 'core:name') return { text: 'Head' };
              if (component === 'anatomy:part') return { subType: 'head' };
              if (component === 'anatomy:joint')
                return { parentId: 'torso-1', socketId: 'neck' };
              return null;
            }),
          });
        }
        return Promise.resolve(null);
      });

      const debugElements = [];
      mockDocument.createElementNS.mockImplementation((ns, tagName) => {
        if (tagName === 'svg') return mockSvg;
        const element = {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          style: {},
          tagName,
        };
        if (tagName === 'g' || tagName === 'text') {
          debugElements.push(element);
        }
        return element;
      });

      // Act
      await renderer.renderGraph('test', bodyData);

      // Assert
      const debugGroup = debugElements.find((el) =>
        el.setAttribute.mock.calls.some(
          (call) => call[0] === 'class' && call[1] === 'debug-info'
        )
      );
      expect(debugGroup).toBeDefined();

      const debugText = debugElements.find(
        (el) => el.tagName === 'text' && el.textContent.includes('Nodes:')
      );
      expect(debugText).toBeDefined();
      expect(debugText.textContent).toBe('Nodes: 2, Edges: 1');
    });
  });
});
