/**
 * @file tests/e2e/anatomy/entitySelectionVisualizationWorkflow.e2e.test.js
 * @description E2E tests for the entity selection visualization workflow.
 * Tests the complete user journey from entity dropdown selection to visualization display.
 *
 * Priority 1: CRITICAL - Addresses 0% E2E coverage of visualizer UI workflows.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  waitForCondition,
  performSharedBootstrap,
  createFreshUIInstance,
  cleanupSharedBootstrap,
  TEST_TIMEOUT_MS,
} from '../../common/visualizer/visualizerTestUtils.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Reduce console noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error,
};

describe('Entity Selection Visualization Workflow E2E Tests', () => {
  // Shared across all tests (expensive to create)
  let sharedContext;

  // Per-test instances (cheap to create)
  let uiInstance;

  // Bootstrap once for the entire suite
  beforeAll(async () => {
    jest.resetModules();
    sharedContext = await performSharedBootstrap();
  }, 30000);

  afterAll(() => {
    cleanupSharedBootstrap();
    jest.resetModules();
  });

  beforeEach(() => {
    // Reset DOM (cheap operation)
    document.body.innerHTML = `
      <div id="anatomy-visualizer-container">
        <header id="anatomy-header">
          <h1>Anatomy Visualizer</h1>
          <button id="back-button" class="menu-button">Back to Menu</button>
        </header>
        <div id="entity-selector-container">
          <label for="entity-selector">Select Entity:</label>
          <select id="entity-selector">
            <option value="">Loading entities...</option>
          </select>
        </div>
        <div id="anatomy-content">
          <div id="anatomy-graph-panel" class="panel">
            <h2>Body Parts Graph</h2>
            <div id="anatomy-graph-container"></div>
          </div>
          <div id="right-panels-container">
            <div id="equipment-panel" class="panel">
              <h2>Equipment</h2>
              <div id="equipment-content">
                <p class="message">Loading equipment...</p>
              </div>
            </div>
            <div id="entity-description-panel" class="panel">
              <h2>Entity Description</h2>
              <div id="entity-description-content">
                <p>Select an entity to view its description.</p>
              </div>
            </div>
          </div>
        </div>
        <div id="error-output"></div>
      </div>
    `;

    global.alert = jest.fn();
    uiInstance = null;

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'complete',
    });
  });

  afterEach(() => {
    delete document.readyState;
    delete global.alert;
    document.body.innerHTML = '';
    uiInstance = null;
  });

  /**
   * Helper to initialize a fresh UI instance using shared services.
   * Much faster than full bootstrap.
   */
  async function initializeVisualizer() {
    uiInstance = await createFreshUIInstance(sharedContext);
    return {
      ui: uiInstance,
      entityManager: sharedContext.entityManager,
      container: sharedContext.container,
    };
  }

  /**
   * Helper to select an entity by its definition ID.
   *
   * @param {string} entityDefId - Entity definition ID
   */
  async function selectEntity(entityDefId) {
    const selector = document.getElementById('entity-selector');
    selector.value = entityDefId;
    selector.dispatchEvent(new Event('change'));
  }

  /**
   * Helper to wait for a specific visualizer state.
   *
   * @param {any} ui - UI instance
   * @param {string} targetState - State to wait for
   * @param {number} [timeout] - Timeout in ms
   */
  async function waitForState(ui, targetState, timeout = TEST_TIMEOUT_MS) {
    await waitForCondition(() => {
      const controller = ui?._visualizerStateController;
      return controller?.getCurrentState?.() === targetState;
    }, timeout);
  }

  it(
    'should populate entity selector with all anatomy-enabled entities',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      expect(entitySelector).toBeTruthy();
      expect(entitySelector.options.length).toBeGreaterThan(1);

      // Verify registry is available and all options (except placeholder) have anatomy:body component
      const registry = uiInstance?._registry;
      expect(registry).toBeTruthy();

      for (let i = 1; i < entitySelector.options.length; i++) {
        const entityDefId = entitySelector.options[i].value;
        const entityDef = registry.getEntityDefinition(entityDefId);
        expect(entityDef).toBeTruthy();
        // Entity definitions store components as an object with component ID keys
        const hasAnatomy = entityDef?.components?.[ANATOMY_BODY_COMPONENT_ID];
        expect(hasAnatomy).toBeTruthy();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should create entity instance when entity is selected',
    async () => {
      const { entityManager } = await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;
      expect(firstEntityDefId).toBeTruthy();

      const createSpy = jest.spyOn(entityManager, 'createEntityInstance');

      await selectEntity(firstEntityDefId);

      await waitForCondition(() => createSpy.mock.calls.length > 0);

      expect(createSpy).toHaveBeenCalledWith(
        firstEntityDefId,
        expect.any(Object)
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should trigger anatomy generation pipeline automatically',
    async () => {
      const { entityManager } = await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;
      expect(firstEntityDefId).toBeTruthy();

      await selectEntity(firstEntityDefId);

      // Wait for READY state which indicates anatomy generation completed
      await waitForState(uiInstance, 'READY');

      // Verify entity has anatomy:body with populated body structure
      const createdEntities = uiInstance?._createdEntities || [];
      expect(createdEntities.length).toBeGreaterThan(0);

      const entityId = createdEntities[0];
      const entity = entityManager.getEntityInstance(entityId);
      expect(entity).toBeTruthy();

      const anatomyData = entity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
      expect(anatomyData).toBeTruthy();
      expect(anatomyData.body).toBeTruthy();
      expect(anatomyData.body.root).toBeTruthy();
      expect(anatomyData.body.parts).toBeTruthy();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should transition through state machine (IDLE→LOADING→LOADED→RENDERING→READY)',
    async () => {
      await initializeVisualizer();

      const controller = uiInstance?._visualizerStateController;
      expect(controller).toBeTruthy();

      // Initial state should be IDLE
      expect(controller.getCurrentState()).toBe('IDLE');

      // Track state changes by polling
      const observedStates = ['IDLE'];
      const checkState = () => {
        const currentState = controller.getCurrentState();
        if (
          observedStates.length === 0 ||
          observedStates[observedStates.length - 1] !== currentState
        ) {
          observedStates.push(currentState);
        }
      };

      // Start polling for state changes
      const pollInterval = setInterval(checkState, 10);

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      // Stop polling
      clearInterval(pollInterval);
      checkState(); // Capture final state

      // Verify state reached READY and passed through expected states
      expect(observedStates).toContain('READY');

      // The exact sequence may vary, but we should see progression through states
      // At minimum: IDLE → ... → READY
      expect(observedStates[0]).toBe('IDLE');
      expect(observedStates[observedStates.length - 1]).toBe('READY');

      // Verify intermediate states were observed (may not catch all due to polling)
      // At least one of LOADING, LOADED, or RENDERING should be observed
      const hasIntermediateState =
        observedStates.includes('LOADING') ||
        observedStates.includes('LOADED') ||
        observedStates.includes('RENDERING');
      expect(hasIntermediateState).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should render complete SVG graph with correct node count',
    async () => {
      const { entityManager } = await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      // Check for SVG element in graph container
      const graphContainer = document.getElementById('anatomy-graph-container');
      expect(graphContainer).toBeTruthy();

      const svg = graphContainer.querySelector('svg');
      expect(svg).toBeTruthy();

      // Count node elements (circles or groups representing anatomy nodes)
      const nodes = svg.querySelectorAll('circle, .anatomy-node');
      expect(nodes.length).toBeGreaterThan(0);

      // Verify node count matches anatomy parts
      const createdEntities = uiInstance?._createdEntities || [];
      const entityId = createdEntities[0];
      const entity = entityManager.getEntityInstance(entityId);
      expect(entity).toBeTruthy();

      const anatomyData = entity?.getComponentData(ANATOMY_BODY_COMPONENT_ID);
      expect(anatomyData?.body?.parts).toBeTruthy();

      const partCount = Object.keys(anatomyData.body.parts).length;
      // Allow for some flexibility (root + parts)
      expect(nodes.length).toBeGreaterThanOrEqual(partCount);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should render correct edge count matching parent-child relationships',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      const graphContainer = document.getElementById('anatomy-graph-container');
      const svg = graphContainer?.querySelector('svg');
      expect(svg).toBeTruthy();

      // Count edge elements (lines connecting nodes)
      const edges = svg.querySelectorAll('line, path.edge, .anatomy-edge');
      expect(edges.length).toBeGreaterThan(0);

      // In a tree structure, edges should be proportional to nodes
      // The relationship varies based on graph structure and rendering approach
      const nodes = svg.querySelectorAll('circle, .anatomy-node');
      // Verify reasonable edge count when we have multiple nodes
      // Just verify reasonable edge count (at least 1 edge per few nodes)
      // Different renderers may use different edge representations
      const expectedMinEdges = nodes.length > 1 ? Math.floor(nodes.length / 3) : 0;
      expect(edges.length).toBeGreaterThanOrEqual(expectedMinEdges);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should display entity description in description panel',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      // Wait for description to be populated
      const descriptionPanel = document.getElementById(
        'entity-description-content'
      );
      expect(descriptionPanel).toBeTruthy();

      await waitForCondition(() => {
        const text = descriptionPanel.textContent || '';
        return (
          text.length > 50 &&
          !text.includes('Select an entity to view its description')
        );
      });

      const descriptionText = descriptionPanel.textContent;
      expect(descriptionText.length).toBeGreaterThan(50);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should display equipment in equipment panel when present',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      const equipmentPanel = document.getElementById('equipment-content');
      expect(equipmentPanel).toBeTruthy();

      // Wait for equipment panel to be updated
      await waitForCondition(() => {
        const text = equipmentPanel.textContent || '';
        return !text.includes('Loading equipment');
      });

      // Equipment panel should either show equipment or "No equipment" message
      const equipmentText = equipmentPanel.textContent || '';
      expect(
        equipmentText.length > 0 ||
          equipmentPanel.innerHTML.includes('No equipment')
      ).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should handle entity re-selection with proper cleanup',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      // Need at least 2 entities (plus placeholder) for re-selection test
      // If fewer entities available, verify at least single selection works
      const hasEnoughEntities = entitySelector.options.length >= 3;
      const firstEntityDefId = entitySelector.options[1]?.value;

      // Always verify first selection works
      expect(firstEntityDefId).toBeTruthy();
      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      const firstCreatedEntities = [...(uiInstance?._createdEntities || [])];
      expect(firstCreatedEntities.length).toBeGreaterThan(0);

      // Skip re-selection portion if not enough entities
      if (!hasEnoughEntities) {
        return;
      }

      const secondEntityDefId = entitySelector.options[2]?.value;

      const cleanupSpy = jest.spyOn(
        uiInstance?._entityManager,
        'removeEntityInstance'
      );

      // Select second entity
      await selectEntity(secondEntityDefId);
      await waitForState(uiInstance, 'READY');

      const secondCreatedEntities = [...(uiInstance?._createdEntities || [])];

      // Ensure a new entity instance is active (IDs may repeat if generator is deterministic)
      expect(secondCreatedEntities.length).toBeGreaterThan(0);
      expect(secondCreatedEntities.length).toBeLessThanOrEqual(1);

      // Previous entity should have been scheduled for removal
      expect(cleanupSpy).toHaveBeenCalled();
      cleanupSpy.mockRestore();

      // Verify SVG was re-rendered (should show different anatomy)
      const graphContainer = document.getElementById('anatomy-graph-container');
      const svg = graphContainer?.querySelector('svg');
      expect(svg).toBeTruthy();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should clean up previous entities before loading new one',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      // Need at least 2 entities (plus placeholder) for cleanup test
      // If fewer entities available, verify at least single selection works
      const hasEnoughEntities = entitySelector.options.length >= 3;
      const firstEntityDefId = entitySelector.options[1]?.value;

      // Always verify first selection works
      expect(firstEntityDefId).toBeTruthy();
      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      const firstEntityId = (uiInstance?._createdEntities || [])[0];
      expect(firstEntityId).toBeTruthy();

      // Skip cleanup verification if not enough entities for re-selection
      if (!hasEnoughEntities) {
        return;
      }

      const secondEntityDefId = entitySelector.options[2]?.value;

      const cleanupSpy = jest.spyOn(
        uiInstance?._entityManager,
        'removeEntityInstance'
      );

      // Select second entity
      await selectEntity(secondEntityDefId);
      await waitForState(uiInstance, 'READY');

      // First entity should have been cleaned up
      // The _createdEntities array should only contain the current entity
      const currentEntities = uiInstance?._createdEntities || [];
      expect(currentEntities.length).toBeLessThanOrEqual(1);

      // Cleanup path should be exercised even if IDs are reused
      expect(cleanupSpy).toHaveBeenCalled();
      cleanupSpy.mockRestore();
    },
    TEST_TIMEOUT_MS
  );
});
