/**
 * @file Unit tests for LayoutEngine
 * @description Comprehensive unit tests for LayoutEngine class covering all methods and edge cases
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LayoutEngine from '../../../../src/domUI/anatomy-renderer/LayoutEngine.js';
import AnatomyVisualizerTestBed from '../../../common/anatomy/anatomyVisualizerTestBed.js';

describe('LayoutEngine', () => {
  let testBed;
  let layoutEngine;
  let mockLogger;
  let mockStrategy;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    mockLogger = testBed.mockLogger;

    // Create a mock strategy following ILayoutStrategy interface
    mockStrategy = {
      calculate: jest.fn(),
      configure: jest.fn(),
      getRequiredSpace: jest.fn().mockReturnValue({ width: 800, height: 600 }),
      getName: jest.fn().mockReturnValue('test-strategy'),
    };

    layoutEngine = new LayoutEngine({ logger: mockLogger });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create instance with valid logger', () => {
      expect(layoutEngine).toBeDefined();
      expect(layoutEngine).toBeInstanceOf(LayoutEngine);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new LayoutEngine({ logger: null });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is undefined', () => {
      expect(() => {
        new LayoutEngine({ logger: undefined });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is not an object', () => {
      expect(() => {
        new LayoutEngine({ logger: 'not-an-object' });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other methods
      expect(() => {
        new LayoutEngine({ logger: invalidLogger });
      }).toThrow('Invalid or missing method');
    });

    it('should initialize with empty strategies', () => {
      expect(layoutEngine.getAvailableStrategies()).toEqual([]);
    });

    it('should initialize with null current strategy', () => {
      expect(layoutEngine.getCurrentStrategyName()).toBeNull();
    });
  });

  describe('registerStrategy', () => {
    it('should register a valid strategy', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(layoutEngine.hasStrategy('test-strategy')).toBe(true);
      expect(layoutEngine.getAvailableStrategies()).toContain('test-strategy');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayoutEngine: Registered strategy 'test-strategy'"
      );
    });

    it('should set first registered strategy as current', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(layoutEngine.getCurrentStrategyName()).toBe('test-strategy');
    });

    it('should not change current strategy when registering additional strategies', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('first-strategy', mockStrategy);
      layoutEngine.registerStrategy('second-strategy', secondStrategy);

      expect(layoutEngine.getCurrentStrategyName()).toBe('first-strategy');
    });

    it('should throw error when strategy name is null', () => {
      expect(() => {
        layoutEngine.registerStrategy(null, mockStrategy);
      }).toThrow('LayoutEngine.registerStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is undefined', () => {
      expect(() => {
        layoutEngine.registerStrategy(undefined, mockStrategy);
      }).toThrow('LayoutEngine.registerStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is empty string', () => {
      expect(() => {
        layoutEngine.registerStrategy('', mockStrategy);
      }).toThrow('LayoutEngine.registerStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is whitespace only', () => {
      expect(() => {
        layoutEngine.registerStrategy('   ', mockStrategy);
      }).toThrow('LayoutEngine.registerStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy is null', () => {
      expect(() => {
        layoutEngine.registerStrategy('test-strategy', null);
      }).toThrow('Strategy must be an object');
    });

    it('should throw error when strategy is undefined', () => {
      expect(() => {
        layoutEngine.registerStrategy('test-strategy', undefined);
      }).toThrow('Strategy must be an object');
    });

    it('should throw error when strategy is not an object', () => {
      expect(() => {
        layoutEngine.registerStrategy('test-strategy', 'not-an-object');
      }).toThrow('Strategy must be an object');
    });

    it('should throw error when strategy is missing calculate method', () => {
      const invalidStrategy = { ...mockStrategy };
      delete invalidStrategy.calculate;

      expect(() => {
        layoutEngine.registerStrategy('test-strategy', invalidStrategy);
      }).toThrow('Strategy must implement method: calculate');
    });

    it('should throw error when strategy is missing configure method', () => {
      const invalidStrategy = { ...mockStrategy };
      delete invalidStrategy.configure;

      expect(() => {
        layoutEngine.registerStrategy('test-strategy', invalidStrategy);
      }).toThrow('Strategy must implement method: configure');
    });

    it('should throw error when strategy is missing getRequiredSpace method', () => {
      const invalidStrategy = { ...mockStrategy };
      delete invalidStrategy.getRequiredSpace;

      expect(() => {
        layoutEngine.registerStrategy('test-strategy', invalidStrategy);
      }).toThrow('Strategy must implement method: getRequiredSpace');
    });

    it('should throw error when strategy is missing getName method', () => {
      const invalidStrategy = { ...mockStrategy };
      delete invalidStrategy.getName;

      expect(() => {
        layoutEngine.registerStrategy('test-strategy', invalidStrategy);
      }).toThrow('Strategy must implement method: getName');
    });

    it('should throw error when strategy method is not a function', () => {
      const invalidStrategy = { ...mockStrategy };
      invalidStrategy.calculate = 'not-a-function';

      expect(() => {
        layoutEngine.registerStrategy('test-strategy', invalidStrategy);
      }).toThrow('Strategy must implement method: calculate');
    });

    it('should allow replacing existing strategy', () => {
      const newStrategy = { ...mockStrategy };
      newStrategy.getName = jest.fn().mockReturnValue('new-test-strategy');

      layoutEngine.registerStrategy('test-strategy', mockStrategy);
      layoutEngine.registerStrategy('test-strategy', newStrategy);

      expect(layoutEngine.hasStrategy('test-strategy')).toBe(true);
      expect(layoutEngine.getAvailableStrategies()).toHaveLength(1);
    });
  });

  describe('hasStrategy', () => {
    it('should return true for registered strategy', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(layoutEngine.hasStrategy('test-strategy')).toBe(true);
    });

    it('should return false for unregistered strategy', () => {
      expect(layoutEngine.hasStrategy('nonexistent-strategy')).toBe(false);
    });

    it('should return false for null strategy name', () => {
      expect(layoutEngine.hasStrategy(null)).toBe(false);
    });

    it('should return false for undefined strategy name', () => {
      expect(layoutEngine.hasStrategy(undefined)).toBe(false);
    });

    it('should return false for empty strategy name', () => {
      expect(layoutEngine.hasStrategy('')).toBe(false);
    });
  });

  describe('setStrategy', () => {
    beforeEach(() => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
    });

    it('should set current strategy to registered strategy', () => {
      layoutEngine.setStrategy('test-strategy');

      expect(layoutEngine.getCurrentStrategyName()).toBe('test-strategy');
      expect(mockLogger.info).toHaveBeenCalledWith(
        "LayoutEngine: Active strategy set to 'test-strategy'"
      );
    });

    it('should throw error when strategy name is null', () => {
      expect(() => {
        layoutEngine.setStrategy(null);
      }).toThrow('LayoutEngine.setStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is undefined', () => {
      expect(() => {
        layoutEngine.setStrategy(undefined);
      }).toThrow('LayoutEngine.setStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is empty string', () => {
      expect(() => {
        layoutEngine.setStrategy('');
      }).toThrow('LayoutEngine.setStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy name is whitespace only', () => {
      expect(() => {
        layoutEngine.setStrategy('   ');
      }).toThrow('LayoutEngine.setStrategy: Invalid Strategy name');
    });

    it('should throw error when strategy is not registered', () => {
      expect(() => {
        layoutEngine.setStrategy('nonexistent-strategy');
      }).toThrow('Unknown layout strategy: nonexistent-strategy');
    });

    it('should allow switching between registered strategies', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('second-strategy', secondStrategy);
      layoutEngine.setStrategy('second-strategy');

      expect(layoutEngine.getCurrentStrategyName()).toBe('second-strategy');
    });
  });

  describe('getCurrentStrategyName', () => {
    it('should return null when no strategy is set', () => {
      expect(layoutEngine.getCurrentStrategyName()).toBeNull();
    });

    it('should return current strategy name when strategy is set', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(layoutEngine.getCurrentStrategyName()).toBe('test-strategy');
    });

    it('should return updated strategy name after switching', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('first-strategy', mockStrategy);
      layoutEngine.registerStrategy('second-strategy', secondStrategy);
      layoutEngine.setStrategy('second-strategy');

      expect(layoutEngine.getCurrentStrategyName()).toBe('second-strategy');
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return empty array when no strategies are registered', () => {
      expect(layoutEngine.getAvailableStrategies()).toEqual([]);
    });

    it('should return array with single strategy name', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(layoutEngine.getAvailableStrategies()).toEqual(['test-strategy']);
    });

    it('should return array with multiple strategy names', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('first-strategy', mockStrategy);
      layoutEngine.registerStrategy('second-strategy', secondStrategy);

      const strategies = layoutEngine.getAvailableStrategies();
      expect(strategies).toHaveLength(2);
      expect(strategies).toContain('first-strategy');
      expect(strategies).toContain('second-strategy');
    });

    it('should not expose internal strategies map', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      const strategies = layoutEngine.getAvailableStrategies();
      strategies.push('modified');

      expect(layoutEngine.getAvailableStrategies()).toEqual(['test-strategy']);
    });
  });

  describe('removeStrategy', () => {
    beforeEach(() => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
    });

    it('should remove strategy when not current', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('second-strategy', secondStrategy);
      layoutEngine.removeStrategy('second-strategy');

      expect(layoutEngine.hasStrategy('second-strategy')).toBe(false);
      expect(layoutEngine.getAvailableStrategies()).toEqual(['test-strategy']);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayoutEngine: Removed strategy 'second-strategy'"
      );
    });

    it('should throw error when trying to remove current strategy', () => {
      expect(() => {
        layoutEngine.removeStrategy('test-strategy');
      }).toThrow('Cannot remove current strategy');
    });

    it('should not throw error when removing non-existent strategy', () => {
      expect(() => {
        layoutEngine.removeStrategy('nonexistent-strategy');
      }).not.toThrow();
    });

    it('should not affect other strategies when removing one', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');
      const thirdStrategy = { ...mockStrategy };
      thirdStrategy.getName = jest.fn().mockReturnValue('third-strategy');

      layoutEngine.registerStrategy('second-strategy', secondStrategy);
      layoutEngine.registerStrategy('third-strategy', thirdStrategy);
      layoutEngine.removeStrategy('second-strategy');

      expect(layoutEngine.hasStrategy('test-strategy')).toBe(true);
      expect(layoutEngine.hasStrategy('third-strategy')).toBe(true);
      expect(layoutEngine.hasStrategy('second-strategy')).toBe(false);
    });
  });

  describe('clearStrategies', () => {
    it('should clear all strategies when called', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      layoutEngine.clearStrategies();

      expect(layoutEngine.getAvailableStrategies()).toEqual([]);
      expect(layoutEngine.getCurrentStrategyName()).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LayoutEngine: Cleared all strategies'
      );
    });

    it('should clear multiple strategies', () => {
      const secondStrategy = { ...mockStrategy };
      secondStrategy.getName = jest.fn().mockReturnValue('second-strategy');

      layoutEngine.registerStrategy('first-strategy', mockStrategy);
      layoutEngine.registerStrategy('second-strategy', secondStrategy);

      layoutEngine.clearStrategies();

      expect(layoutEngine.getAvailableStrategies()).toEqual([]);
      expect(layoutEngine.getCurrentStrategyName()).toBeNull();
    });

    it('should not throw error when clearing empty strategies', () => {
      expect(() => {
        layoutEngine.clearStrategies();
      }).not.toThrow();
    });

    it('should reset current strategy to null', () => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
      expect(layoutEngine.getCurrentStrategyName()).toBe('test-strategy');

      layoutEngine.clearStrategies();
      expect(layoutEngine.getCurrentStrategyName()).toBeNull();
    });
  });

  describe('calculateLayout', () => {
    let mockNodes;
    let mockEdges;
    let mockRenderContext;

    beforeEach(() => {
      // Mock nodes as a Map
      mockNodes = new Map([
        ['node1', { id: 'node1', x: 0, y: 0 }],
        ['node2', { id: 'node2', x: 100, y: 100 }],
      ]);

      // Mock edges as an array
      mockEdges = [{ source: 'node1', target: 'node2' }];

      // Mock render context
      mockRenderContext = {
        updatePerformance: jest.fn(),
        options: {
          nodeRadius: 20,
        },
      };

      // Register strategy for testing
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
    });

    it('should delegate to current strategy when strategy is set', () => {
      layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);

      expect(mockStrategy.calculate).toHaveBeenCalledWith(
        mockNodes,
        mockEdges,
        mockRenderContext
      );
    });

    it('should log debug information about layout calculation', () => {
      layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayoutEngine: Calculating layout with strategy 'test-strategy'",
        {
          nodeCount: 2,
          edgeCount: 1,
        }
      );
    });

    it('should update performance metrics in render context', () => {
      layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);

      expect(mockRenderContext.updatePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          layoutTime: expect.any(Number),
        })
      );
    });

    it('should log completion time after successful calculation', () => {
      layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /LayoutEngine: Layout calculation completed in \d+\.\d+ms/
        )
      );
    });

    it('should throw error when no strategy is set', () => {
      layoutEngine.clearStrategies();

      expect(() => {
        layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);
      }).toThrow('No layout strategy set');
    });

    it('should handle strategy calculation errors', () => {
      const testError = new Error('Strategy calculation failed');
      mockStrategy.calculate.mockImplementation(() => {
        throw testError;
      });

      expect(() => {
        layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);
      }).toThrow('Strategy calculation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'LayoutEngine: Layout calculation failed',
        testError
      );
    });

    it('should handle empty nodes map', () => {
      const emptyNodes = new Map();

      expect(() => {
        layoutEngine.calculateLayout(emptyNodes, mockEdges, mockRenderContext);
      }).not.toThrow();

      expect(mockStrategy.calculate).toHaveBeenCalledWith(
        emptyNodes,
        mockEdges,
        mockRenderContext
      );
    });

    it('should handle empty edges array', () => {
      const emptyEdges = [];

      expect(() => {
        layoutEngine.calculateLayout(mockNodes, emptyEdges, mockRenderContext);
      }).not.toThrow();

      expect(mockStrategy.calculate).toHaveBeenCalledWith(
        mockNodes,
        emptyEdges,
        mockRenderContext
      );
    });

    it('should measure and log performance timing', () => {
      layoutEngine.calculateLayout(mockNodes, mockEdges, mockRenderContext);

      expect(mockRenderContext.updatePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          layoutTime: expect.any(Number),
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /LayoutEngine: Layout calculation completed in \d+\.\d+ms/
        )
      );
    });
  });

  describe('configure', () => {
    beforeEach(() => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
    });

    it('should delegate to current strategy when strategy is set', () => {
      const options = { centerX: 400, centerY: 300 };

      layoutEngine.configure(options);

      expect(mockStrategy.configure).toHaveBeenCalledWith(options);
    });

    it('should log debug information about configuration', () => {
      const options = { centerX: 400, centerY: 300 };

      layoutEngine.configure(options);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "LayoutEngine: Configuring strategy 'test-strategy'",
        options
      );
    });

    it('should throw error when no strategy is set', () => {
      layoutEngine.clearStrategies();

      expect(() => {
        layoutEngine.configure({ centerX: 400 });
      }).toThrow('No layout strategy set');
    });

    it('should handle null configuration options', () => {
      expect(() => {
        layoutEngine.configure(null);
      }).not.toThrow();

      expect(mockStrategy.configure).toHaveBeenCalledWith(null);
    });

    it('should handle undefined configuration options', () => {
      expect(() => {
        layoutEngine.configure(undefined);
      }).not.toThrow();

      expect(mockStrategy.configure).toHaveBeenCalledWith(undefined);
    });

    it('should handle empty configuration options', () => {
      const options = {};

      expect(() => {
        layoutEngine.configure(options);
      }).not.toThrow();

      expect(mockStrategy.configure).toHaveBeenCalledWith(options);
    });

    it('should pass through complex configuration objects', () => {
      const options = {
        centerX: 400,
        centerY: 300,
        nested: {
          property: 'value',
        },
        array: [1, 2, 3],
      };

      layoutEngine.configure(options);

      expect(mockStrategy.configure).toHaveBeenCalledWith(options);
    });
  });

  describe('getRequiredSpace', () => {
    beforeEach(() => {
      layoutEngine.registerStrategy('test-strategy', mockStrategy);
    });

    it('should delegate to current strategy when strategy is set', () => {
      const result = layoutEngine.getRequiredSpace();

      expect(mockStrategy.getRequiredSpace).toHaveBeenCalled();
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('should return result from strategy', () => {
      const expectedSpace = { width: 1200, height: 800 };
      mockStrategy.getRequiredSpace.mockReturnValue(expectedSpace);

      const result = layoutEngine.getRequiredSpace();

      expect(result).toEqual(expectedSpace);
    });

    it('should throw error when no strategy is set', () => {
      layoutEngine.clearStrategies();

      expect(() => {
        layoutEngine.getRequiredSpace();
      }).toThrow('No layout strategy set');
    });

    it('should handle strategy returning null', () => {
      mockStrategy.getRequiredSpace.mockReturnValue(null);

      const result = layoutEngine.getRequiredSpace();

      expect(result).toBeNull();
    });

    it('should handle strategy returning undefined', () => {
      mockStrategy.getRequiredSpace.mockReturnValue(undefined);

      const result = layoutEngine.getRequiredSpace();

      expect(result).toBeUndefined();
    });

    it('should handle strategy returning malformed data', () => {
      mockStrategy.getRequiredSpace.mockReturnValue({ width: 'invalid' });

      const result = layoutEngine.getRequiredSpace();

      expect(result).toEqual({ width: 'invalid' });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle strategy method throwing errors', () => {
      const testError = new Error('Strategy error');
      mockStrategy.getRequiredSpace.mockImplementation(() => {
        throw testError;
      });

      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(() => {
        layoutEngine.getRequiredSpace();
      }).toThrow('Strategy error');
    });

    it('should handle strategy configure method throwing errors', () => {
      const testError = new Error('Configuration error');
      mockStrategy.configure.mockImplementation(() => {
        throw testError;
      });

      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      expect(() => {
        layoutEngine.configure({ test: 'value' });
      }).toThrow('Configuration error');
    });

    it('should maintain consistent state after errors', () => {
      const testError = new Error('Test error');
      mockStrategy.calculate.mockImplementation(() => {
        throw testError;
      });

      layoutEngine.registerStrategy('test-strategy', mockStrategy);

      // Error should not change current strategy
      expect(() => {
        layoutEngine.calculateLayout(new Map(), [], {
          updatePerformance: jest.fn(),
        });
      }).toThrow('Test error');

      expect(layoutEngine.getCurrentStrategyName()).toBe('test-strategy');
    });

    it('should handle rapid strategy switching', () => {
      const strategy1 = { ...mockStrategy };
      const strategy2 = { ...mockStrategy };
      strategy2.getName = jest.fn().mockReturnValue('strategy2');

      layoutEngine.registerStrategy('strategy1', strategy1);
      layoutEngine.registerStrategy('strategy2', strategy2);

      layoutEngine.setStrategy('strategy2');
      layoutEngine.setStrategy('strategy1');
      layoutEngine.setStrategy('strategy2');

      expect(layoutEngine.getCurrentStrategyName()).toBe('strategy2');
    });
  });
});
