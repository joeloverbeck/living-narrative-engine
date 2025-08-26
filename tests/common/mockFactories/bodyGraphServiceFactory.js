/**
 * @file Factory for creating isolated mock BodyGraphService instances
 * @description Provides fresh mock instances to prevent test contamination through shared references
 */

import { jest } from '@jest/globals';

/**
 * Creates a fresh mock BodyGraphService instance with configurable behavior
 * 
 * @param {object} config - Configuration for mock behaviors
 * @param {Function} [config.hasPartWithComponentValue] - Custom implementation for hasPartWithComponentValue
 * @param {Function} [config.findPartsByType] - Custom implementation for findPartsByType
 * @param {Function} [config.getAllParts] - Custom implementation for getAllParts
 * @param {Function} [config.buildAdjacencyCache] - Custom implementation for buildAdjacencyCache
 * @returns {object} Fresh mock BodyGraphService instance
 */
export function createMockBodyGraphService(config = {}) {
  // Create fresh mock functions with default implementations
  const mockService = {
    hasPartWithComponentValue: jest.fn(
      config.hasPartWithComponentValue || (() => false)
    ),
    findPartsByType: jest.fn(
      config.findPartsByType || (() => [])
    ),
    getAllParts: jest.fn(
      config.getAllParts || (() => [])
    ),
    buildAdjacencyCache: jest.fn(
      config.buildAdjacencyCache || (() => {
        // No-op by default
      })
    ),
  };

  return mockService;
}

/**
 * Creates a mock BodyGraphService configured for anatomy tests
 * 
 * @param {object} anatomyData - Data for anatomy structure
 * @param {object} [anatomyData.parts] - Map of part IDs to part data
 * @param {object} [anatomyData.partTypes] - Map of part types to arrays of part IDs
 * @returns {object} Mock BodyGraphService configured with anatomy data
 */
export function createAnatomyMockBodyGraphService(anatomyData = {}) {
  const { parts = {}, partTypes = {} } = anatomyData;
  
  return createMockBodyGraphService({
    hasPartWithComponentValue: (rootId, componentId, propertyPath, expectedValue) => {
      // Implement based on parts data
      const part = parts[rootId];
      if (!part) return false;
      
      const component = part.components?.[componentId];
      if (!component) return false;
      
      // Simple property path evaluation
      const value = propertyPath.split('.').reduce(
        (obj, key) => obj?.[key],
        component
      );
      
      return value === expectedValue;
    },
    
    findPartsByType: (rootEntityId, partType) => {
      return partTypes[partType] || [];
    },
    
    getAllParts: (rootId) => {
      // Return all parts connected to root
      const allParts = [];
      const visited = new Set();
      
      /**
       *
       * @param partId
       */
      function traverse(partId) {
        if (visited.has(partId)) return;
        visited.add(partId);
        
        const part = parts[partId];
        if (part) {
          allParts.push(partId);
          if (part.children) {
            part.children.forEach(traverse);
          }
        }
      }
      
      traverse(rootId);
      return allParts;
    },
    
    buildAdjacencyCache: (rootId) => {
      // No-op for most tests, can be overridden if needed
    }
  });
}

/**
 * Creates a simple mock BodyGraphService for basic testing
 * 
 * @returns {object} Mock BodyGraphService with all methods returning defaults
 */
export function createSimpleMockBodyGraphService() {
  return createMockBodyGraphService();
}

/**
 * Resets all mocks in a BodyGraphService instance
 * 
 * @param {object} mockService - The mock service to reset
 */
export function resetBodyGraphServiceMocks(mockService) {
  Object.values(mockService).forEach(mockFn => {
    if (mockFn && typeof mockFn.mockReset === 'function') {
      mockFn.mockReset();
    }
  });
}