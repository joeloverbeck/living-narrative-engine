/**
 * @file TestBedAnatomy - Wrapper around AnatomyIntegrationTestBed for body descriptor tests
 */

import AnatomyIntegrationTestBed from './anatomy/anatomyIntegrationTestBed.js';

/**
 * Test bed specifically designed for body descriptor integration tests.
 * This is a simplified wrapper around AnatomyIntegrationTestBed to maintain
 * compatibility with existing test expectations.
 */
export class TestBedAnatomy extends AnatomyIntegrationTestBed {
  /**
   * Creates a new TestBedAnatomy instance
   *
   * @param {object} [options] - Optional configuration
   */
  constructor(options = {}) {
    super(options);
  }

  /**
   * Gets the data registry for compatibility with test expectations
   *
   * @returns {object} The data registry
   */
  get dataRegistry() {
    return this.registry;
  }

  /**
   * Sets up the test bed with anatomy test data and ensures proper initialization
   *
   * @returns {Promise<void>}
   */
  async setup() {
    await super.setup();

    // CRITICAL FIX: Initialize the anatomy initialization service
    // This enables automatic anatomy generation when entities are created
    if (
      this.anatomyInitializationService &&
      this.anatomyInitializationService.initialize
    ) {
      this.anatomyInitializationService.initialize();
    }

    // Ensure we have the anatomy:body_test entity definition
    this.loadEntityDefinitions({
      'anatomy:body_test': {
        id: 'anatomy:body_test',
        description: 'Test body entity for descriptor tests',
        components: {
          'anatomy:body': {},
        },
      },
      'test:simple_torso': {
        id: 'test:simple_torso',
        description: 'Simple torso entity for testing',
        components: {
          'anatomy:part': {
            partType: 'torso',
            subType: 'torso',
          },
          'core:name': {
            text: 'Simple Torso',
          },
        },
      },
    });

    // Load simplified test data that doesn't require complex anatomy structures
    // Create a minimal test blueprint
    this.loadBlueprints({
      'anatomy:humanoid': {
        id: 'anatomy:humanoid',
        root: 'test:simple_torso',
        slots: {},
        clothingSlotMappings: {},
      },
    });

    // Load a simple torso part
    this.loadBlueprintParts({
      'test:simple_torso': {
        id: 'test:simple_torso',
        partType: 'torso',
        subType: 'torso',
        sockets: {},
        defaultComponents: {
          'anatomy:part': {
            partType: 'torso',
            subType: 'torso',
          },
          'core:name': {
            text: 'Simple Torso',
          },
        },
      },
    });
  }

  /**
   * Performs cleanup after test execution
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    await super.cleanup();
  }
}

export default TestBedAnatomy;
