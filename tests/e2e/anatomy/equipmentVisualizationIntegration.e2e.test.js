/**
 * @file tests/e2e/anatomy/equipmentVisualizationIntegration.e2e.test.js
 * @description E2E tests for the equipment visualization integration workflow.
 * Tests the complete equipment panel display from entity selection to UI rendering.
 *
 * Priority 5: MEDIUM - Equipment panel display workflow
 *
 * Performance optimization: Uses shared bootstrap (once per suite) instead of
 * per-test initialization to reduce runtime from ~10s to ~3s.
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

describe('Equipment Visualization Integration E2E Tests', () => {
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
   */
  async function selectEntity(entityDefId) {
    const selector = document.getElementById('entity-selector');
    selector.value = entityDefId;
    selector.dispatchEvent(new Event('change'));
  }

  /**
   * Helper to wait for a specific visualizer state.
   */
  async function waitForState(ui, targetState, timeout = TEST_TIMEOUT_MS) {
    await waitForCondition(() => {
      const controller = ui?._visualizerStateController;
      return controller?.getCurrentState?.() === targetState;
    }, timeout);
  }

  /**
   * Helper to get equipment panel content element.
   */
  function getEquipmentPanel() {
    return document.getElementById('equipment-content');
  }

  /**
   * Helper to get equipment panel text content.
   */
  function getEquipmentPanelText() {
    const panel = getEquipmentPanel();
    return panel?.textContent || '';
  }

  /**
   * Helper to wait for equipment panel to finish loading.
   */
  async function waitForEquipmentLoaded() {
    await waitForCondition(() => {
      const text = getEquipmentPanelText();
      return !text.includes('Loading equipment');
    });
  }

  it(
    'should retrieve equipment data for selected entity',
    async () => {
      await initializeVisualizer();

      const retrieveEquipmentSpy = jest.spyOn(
        uiInstance,
        '_retrieveEquipmentData'
      );

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;
      expect(firstEntityDefId).toBeTruthy();

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');

      expect(retrieveEquipmentSpy).toHaveBeenCalled();

      const createdEntities = uiInstance?._createdEntities || [];
      expect(createdEntities.length).toBeGreaterThan(0);
      const entityId = createdEntities[0];

      const callArgs = retrieveEquipmentSpy.mock.calls;
      const wasCalledWithEntityId = callArgs.some(
        (call) => call[0] === entityId
      );
      expect(wasCalledWithEntityId).toBe(true);

      const equipmentCache = uiInstance?._equipmentCache;
      expect(equipmentCache).toBeTruthy();
      expect(equipmentCache.has(entityId)).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should display equipped items organized by slot',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const panelText = getEquipmentPanelText();

      const hasSlotElements =
        equipmentPanel.querySelectorAll('.equipment-slot').length > 0;
      const hasNoEquipmentMessage =
        panelText.includes('no equipment') ||
        panelText.includes('No equipment') ||
        panelText.includes('No items');

      expect(hasSlotElements || hasNoEquipmentMessage).toBe(true);

      if (hasSlotElements) {
        const slots = equipmentPanel.querySelectorAll('.equipment-slot');
        for (const slot of slots) {
          const header = slot.querySelector('.equipment-slot-header');
          expect(header).toBeTruthy();
          expect(header.textContent.trim().length).toBeGreaterThan(0);
        }
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should display clothing layers in correct order (outer to inner)',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const layers = equipmentPanel.querySelectorAll('.equipment-layer');

      if (layers.length > 1) {
        const layerOrder = ['outer', 'armor', 'base', 'underwear', 'accessories'];
        const layerNames = Array.from(layers).map((layer) => {
          const nameEl = layer.querySelector('.equipment-layer-name');
          return nameEl?.textContent?.toLowerCase().trim() || '';
        });

        const orderedLayers = layerNames.filter((name) =>
          layerOrder.some((order) => name.includes(order))
        );

        if (orderedLayers.length > 1) {
          const getOrderIndex = (name) => {
            for (let i = 0; i < layerOrder.length; i++) {
              if (name.includes(layerOrder[i])) return i;
            }
            return layerOrder.length;
          };

          let previousIndex = -1;
          let isOrdered = true;
          for (const layer of orderedLayers) {
            const currentIndex = getOrderIndex(layer);
            if (currentIndex < previousIndex) {
              isOrdered = false;
              break;
            }
            previousIndex = currentIndex;
          }
          expect(isOrdered).toBe(true);
        }
      }

      const panelText = getEquipmentPanelText();
      expect(panelText).not.toContain('Failed to load');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should handle entity with no equipment gracefully',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const panelText = getEquipmentPanelText();
      const panelHtml = equipmentPanel.innerHTML;

      const hasEquipmentItems =
        equipmentPanel.querySelectorAll('.equipment-item').length > 0;
      const hasNoEquipmentMessage =
        panelText.includes('no equipment') ||
        panelText.includes('No equipment') ||
        panelText.includes('No items') ||
        panelText.includes('empty');
      const hasErrorMessage = panelText.includes('Failed to load');

      expect(hasEquipmentItems || hasNoEquipmentMessage || !hasErrorMessage).toBe(
        true
      );

      expect(panelText).not.toContain('Loading equipment');
      expect(panelHtml.trim().length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should update equipment display when equipment change event fires',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const entityId = uiInstance?._currentEntityId;
      expect(entityId).toBeTruthy();

      const clothingService = uiInstance?._clothingManagementService;

      if (!clothingService) {
        const equipmentUnsubscribes = uiInstance?._equipmentUnsubscribes;
        expect(
          !equipmentUnsubscribes || equipmentUnsubscribes.length === 0
        ).toBe(true);

        const equipmentPanel = getEquipmentPanel();
        expect(equipmentPanel).toBeTruthy();
        return;
      }

      const initialCacheEntry = uiInstance?._equipmentCache?.get(entityId);

      if (!initialCacheEntry) {
        const equipmentUnsubscribes = uiInstance?._equipmentUnsubscribes;
        expect(equipmentUnsubscribes).toBeTruthy();
        expect(equipmentUnsubscribes.length).toBeGreaterThan(0);

        const equipmentPanel = getEquipmentPanel();
        expect(equipmentPanel).toBeTruthy();
        return;
      }

      expect(initialCacheEntry).toBeTruthy();

      const retrieveSpy = jest.spyOn(uiInstance, '_retrieveEquipmentData');
      const updateDisplaySpy = jest.spyOn(uiInstance, '_updateEquipmentDisplay');

      const eventDispatcher = uiInstance?._eventDispatcher;
      expect(eventDispatcher).toBeTruthy();

      await eventDispatcher.dispatch('clothing:equipment_updated', { entityId });

      await waitForCondition(() => retrieveSpy.mock.calls.length > 0, 5000);

      expect(retrieveSpy).toHaveBeenCalled();
      expect(updateDisplaySpy).toHaveBeenCalled();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should format slot names correctly (e.g., "left_hand" to "Left Hand")',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const slotHeaders = equipmentPanel.querySelectorAll('.equipment-slot-header');

      if (slotHeaders.length > 0) {
        for (const header of slotHeaders) {
          const headerText = header.textContent.trim();

          if (headerText.length > 0) {
            const hasProperFormatting =
              !headerText.includes('_') ||
              /^[A-Z]/.test(headerText);

            expect(hasProperFormatting).toBe(true);
          }
        }
      }

      const panelText = getEquipmentPanelText();
      expect(panelText).not.toContain('undefined');
      expect(panelText).not.toContain('null');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should escape HTML in equipment item names',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const itemNames = equipmentPanel.querySelectorAll('.equipment-item-name');

      if (itemNames.length > 0) {
        for (const nameEl of itemNames) {
          const text = nameEl.textContent;
          const html = nameEl.innerHTML;

          const containsUnescapedHtml =
            html !== text && (html.includes('<') || html.includes('>'));

          expect(containsUnescapedHtml).toBe(false);
        }
      }

      const fullHtml = equipmentPanel.innerHTML;
      expect(fullHtml).not.toContain('<script');
      expect(fullHtml).not.toContain('javascript:');
      expect(fullHtml).not.toContain('onerror=');
      expect(fullHtml).not.toContain('onclick=');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'should display empty state message when no equipment',
    async () => {
      await initializeVisualizer();

      const entitySelector = document.getElementById('entity-selector');
      const firstEntityDefId = entitySelector.options[1]?.value;

      await selectEntity(firstEntityDefId);
      await waitForState(uiInstance, 'READY');
      await waitForEquipmentLoaded();

      const equipmentPanel = getEquipmentPanel();
      expect(equipmentPanel).toBeTruthy();

      const panelText = getEquipmentPanelText();
      const hasEquipmentItems =
        equipmentPanel.querySelectorAll('.equipment-item').length > 0;

      if (!hasEquipmentItems) {
        const hasEmptyStateMessage =
          panelText.includes('no equipment') ||
          panelText.includes('No equipment') ||
          panelText.includes('No items') ||
          panelText.includes('empty');

        expect(hasEmptyStateMessage).toBe(true);
      }

      expect(panelText).not.toContain('Loading equipment');
      expect(panelText.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );
});
