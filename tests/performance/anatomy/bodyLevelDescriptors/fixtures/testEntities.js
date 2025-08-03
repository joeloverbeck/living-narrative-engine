import { jest } from '@jest/globals';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../../../src/constants/componentIds.js';

/**
 * Create a fully-featured humanoid entity with all descriptors
 */
export const createCompleteHumanoidEntity = () => {
  const entity = {
    id: 'test-humanoid-complete',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      const components = [
        ANATOMY_BODY_COMPONENT_ID,
        'descriptors:build',
        'descriptors:body_composition',
        'descriptors:body_hair',
      ];
      return components.includes(componentId);
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      const componentData = {
        [ANATOMY_BODY_COMPONENT_ID]: { 
          body: { 
            root: 'torso',
            // Parts would be managed by bodyGraphService.getAllParts()
          }
        },
        'descriptors:build': { build: 'athletic' },
        'descriptors:body_composition': { composition: 'lean' },
        'descriptors:body_hair': { density: 'moderate' },
      };
      return componentData[componentId] || null;
    }),
  };

  return entity;
};

/**
 * Create humanoid with partial descriptors
 */
export const createPartialHumanoidEntity = () => {
  const entity = {
    id: 'test-humanoid-partial',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      const components = [
        ANATOMY_BODY_COMPONENT_ID,
        'descriptors:build',
        'descriptors:body_hair',
      ];
      return components.includes(componentId);
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      const componentData = {
        [ANATOMY_BODY_COMPONENT_ID]: { 
          body: { 
            root: 'torso',
          }
        },
        'descriptors:build': { build: 'average' },
        // Missing body_composition
        'descriptors:body_hair': { density: 'light' },
      };
      return componentData[componentId] || null;
    }),
  };

  return entity;
};

/**
 * Create entity with no body-level descriptors
 */
export const createMinimalHumanoidEntity = () => {
  const entity = {
    id: 'test-humanoid-minimal',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      return componentId === ANATOMY_BODY_COMPONENT_ID;
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return { 
          body: { 
            root: 'torso',
          }
        };
      }
      return null;
    }),
  };
  
  return entity;
};

/**
 * Create mock body parts that the bodyGraphService would return
 * Note: In actual implementation, parts are managed by bodyGraphService.getAllParts()
 * and entityFinder.getEntityInstance(), so we mock these services instead
 */
export const createMockBodyParts = () => {
  // Mock part IDs that would be returned by bodyGraphService.getAllParts()
  return ['head-part-id', 'hair-part-id', 'eyes-part-id', 'arms-part-id', 'chest-part-id'];
};

/**
 * Create entity with edge case descriptors
 */
export const createEdgeCaseEntity = () => {
  const entity = {
    id: 'test-edge-case',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      const components = [
        ANATOMY_BODY_COMPONENT_ID,
        'descriptors:build',
        'descriptors:body_composition',
        'descriptors:body_hair',
      ];
      return components.includes(componentId);
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      const componentData = {
        [ANATOMY_BODY_COMPONENT_ID]: { 
          body: { 
            root: 'torso',
          }
        },
        'descriptors:build': { build: '' }, // Empty string
        'descriptors:body_composition': { composition: null }, // Null value
        'descriptors:body_hair': { density: 'very-hairy' }, // Hyphenated value
      };
      return componentData[componentId] || null;
    }),
  };

  return entity;
};

/**
 * Create entity with malformed component data for error testing
 */
export const createMalformedEntity = () => {
  const entity = {
    id: 'test-malformed',
    hasComponent: jest.fn().mockReturnValue(true),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return { body: { root: 'torso' } };
      }
      if (componentId === 'descriptors:body_composition') {
        return { wrongProperty: 'lean' }; // Wrong property name
      }
      if (componentId === 'descriptors:body_hair') {
        return 'not an object'; // Wrong return type
      }
      return null;
    }),
  };

  return entity;
};

/**
 * Create entity with all valid body hair density values for comprehensive testing
 *
 * @param densityValue
 */
export const createBodyHairVariantsEntity = (densityValue) => {
  const entity = {
    id: `test-body-hair-${densityValue}`,
    hasComponent: jest.fn().mockImplementation((componentId) => {
      const components = [
        ANATOMY_BODY_COMPONENT_ID,
        'descriptors:body_hair',
      ];
      return components.includes(componentId);
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      const componentData = {
        [ANATOMY_BODY_COMPONENT_ID]: { 
          body: { 
            root: 'torso',
          }
        },
        'descriptors:body_hair': { density: densityValue },
      };
      return componentData[componentId] || null;
    }),
  };

  return entity;
};

/**
 * Create entity with all valid body composition values for comprehensive testing
 *
 * @param compositionValue
 */
export const createBodyCompositionVariantsEntity = (compositionValue) => {
  const entity = {
    id: `test-body-composition-${compositionValue}`,
    hasComponent: jest.fn().mockImplementation((componentId) => {
      const components = [
        ANATOMY_BODY_COMPONENT_ID,
        'descriptors:body_composition',
      ];
      return components.includes(componentId);
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      const componentData = {
        [ANATOMY_BODY_COMPONENT_ID]: { 
          body: { 
            root: 'torso',
          }
        },
        'descriptors:body_composition': { composition: compositionValue },
      };
      return componentData[componentId] || null;
    }),
  };

  return entity;
};