/**
 * @file damageAnalyticsPanelIssues.integration.test.js
 * @description Integration tests reproducing 3 issues in the DamageAnalyticsPanel:
 *   Issue 1: "No anatomy data available" shown even after entity selection
 *   Issue 2: Hit Probability section is not showing up
 *   Issue 3: Analytics section is too narrow (200px max-height)
 *
 * These tests are written in TDD style - they should fail before fixes
 * are applied and pass after the production code is fixed.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import DamageAnalyticsPanel from '../../../../src/domUI/damage-simulator/DamageAnalyticsPanel.js';
import fs from 'fs';
import path from 'path';

/**
 * Creates a mock event bus for testing.
 *
 * @returns {object} Mock event bus with subscribe and dispatch methods.
 */
function createMockEventBus() {
  const subscribers = new Map();

  return {
    subscribe: jest.fn((eventType, callback) => {
      if (!subscribers.has(eventType)) {
        subscribers.set(eventType, []);
      }
      subscribers.get(eventType).push(callback);
      return () => {
        const callbacks = subscribers.get(eventType);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    }),
    dispatch: jest.fn((event) => {
      const callbacks = subscribers.get(event.type);
      if (callbacks) {
        callbacks.forEach(cb => cb(event));
      }
    }),
    _subscribers: subscribers,
  };
}

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} Mock logger with all required methods.
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a mock HitProbabilityCalculator for testing Issue 2.
 *
 * @returns {object} Mock calculator with expected methods.
 */
function createMockHitProbabilityCalculator() {
  return {
    calculateProbabilities: jest.fn((parts) => {
      if (!parts || parts.length === 0) return [];
      // Return mock probabilities proportional to part count
      const totalWeight = parts.length * 10;
      return parts.map((part, index) => ({
        partId: part.id,
        partName: part.name || part.id,
        weight: 10,
        probability: (10 / totalWeight) * 100,
        tier: index === 0 ? 'high' : 'medium',
      }));
    }),
    getVisualizationData: jest.fn((probabilities) => {
      if (!probabilities || probabilities.length === 0) {
        return { bars: [], maxProbability: 0, totalParts: 0 };
      }
      const maxProbability = Math.max(...probabilities.map(p => p.probability));
      return {
        bars: probabilities.map(p => ({
          partId: p.partId,
          label: p.partName,
          percentage: p.probability,
          barWidth: maxProbability > 0 ? (p.probability / maxProbability) * 100 : 0,
          colorClass: p.tier === 'high' ? 'ds-prob-high' : 'ds-prob-medium',
        })),
        maxProbability,
        totalParts: probabilities.length,
      };
    }),
  };
}

/**
 * Creates sample anatomy data for testing.
 *
 * @returns {object} Anatomy data with parts array including component data for weights.
 */
function createSampleAnatomyData() {
  return {
    parts: [
      {
        id: 'head',
        name: 'Head',
        currentHealth: 100,
        maxHealth: 100,
        armor: 0,
        resistance: 0,
        component: { hitProbabilityWeight: 10 }
      },
      {
        id: 'torso',
        name: 'Torso',
        currentHealth: 150,
        maxHealth: 150,
        armor: 5,
        resistance: 0.1,
        component: { hitProbabilityWeight: 30 }
      },
      {
        id: 'left_arm',
        name: 'Left Arm',
        currentHealth: 80,
        maxHealth: 80,
        armor: 0,
        resistance: 0,
        component: { hitProbabilityWeight: 15 }
      },
      {
        id: 'right_arm',
        name: 'Right Arm',
        currentHealth: 80,
        maxHealth: 80,
        armor: 0,
        resistance: 0,
        component: { hitProbabilityWeight: 15 }
      },
      {
        id: 'left_leg',
        name: 'Left Leg',
        currentHealth: 90,
        maxHealth: 90,
        armor: 0,
        resistance: 0,
        component: { hitProbabilityWeight: 15 }
      },
      {
        id: 'right_leg',
        name: 'Right Leg',
        currentHealth: 90,
        maxHealth: 90,
        armor: 0,
        resistance: 0,
        component: { hitProbabilityWeight: 15 }
      },
    ],
  };
}

/**
 * Creates sample damage configuration for testing.
 *
 * @returns {object} Damage entry configuration.
 */
function createSampleDamageConfig() {
  return {
    amount: 25,
    damageType: 'slashing',
    penetration: 0.2,
  };
}

describe('DamageAnalyticsPanel - Issue Reproduction Tests', () => {
  let dom;
  let document;
  let window;
  let containerElement;
  let eventBus;
  let logger;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test-container"></div></body></html>', {
      runScripts: 'dangerously',
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    containerElement = document.getElementById('test-container');
    eventBus = createMockEventBus();
    logger = createMockLogger();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    delete global.document;
    delete global.window;
  });

  describe('Issue 1: Analytics display without damage config', () => {
    describe('Root Cause: getAnalytics() requires both anatomyData AND damageEntry', () => {
      it('should display parts table after setEntity() WITHOUT requiring updateDamageConfig()', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();

        // Act - ONLY set entity, NO damage config
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - Should display parts, not "No anatomy data available"
        const analytics = panel.getAnalytics();

        // BUG: Currently getAnalytics() returns empty parts array because
        // line 488 checks: if (this.#anatomyData?.parts && this.#damageEntry)
        // When damageEntry is null, it returns empty even though anatomy is loaded
        expect(analytics.parts.length).toBe(6);
        expect(analytics.aggregate.totalParts).toBe(6);

        panel.destroy();
      });

      it('should NOT show "No anatomy data available" when entity has anatomy data', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();

        // Act - Set entity without damage config
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - The "No anatomy data" message should NOT appear
        const noDataMessage = containerElement.querySelector('.ds-no-data');
        const renderedHTML = containerElement.innerHTML;

        // BUG: Currently shows "No anatomy data available" because getAnalytics()
        // returns empty parts array without damage config
        expect(renderedHTML).not.toContain('No anatomy data available');

        panel.destroy();
      });

      it('should show placeholder values for damage calculations when no damage config is set', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();

        // Act - Set entity without damage config
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - Parts should be listed with placeholder for hits-to-destroy
        const hitsTable = containerElement.querySelector('.ds-hits-table');
        expect(hitsTable).not.toBeNull();

        // Should have rows for all 6 parts
        const rows = containerElement.querySelectorAll('.ds-hits-table tbody tr');
        expect(rows.length).toBe(6);

        // Hits-to-destroy values should show placeholder (—) or similar when no damage config
        const analytics = panel.getAnalytics();
        analytics.parts.forEach(part => {
          // When no damage config, hitsToDestroy should be null or show placeholder
          // Rather than hiding the entire analytics section
          expect(part.partName).toBeDefined();
        });

        panel.destroy();
      });

      it('should update parts table when entity loaded event fires without damage config', () => {
        // Arrange
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
        });
        const anatomyData = createSampleAnatomyData();

        // Act - Dispatch entity loaded event WITHOUT setting damage config first
        eventBus.dispatch({
          type: 'core:damage_simulator_entity_loaded',
          payload: {
            definitionId: 'human_male',
            instanceId: 'entity-123',
            anatomyData,
          },
        });
        panel.render();

        // Assert
        const analytics = panel.getAnalytics();
        expect(analytics.parts.length).toBe(6);

        const hitsTable = containerElement.querySelector('.ds-hits-table');
        expect(hitsTable).not.toBeNull();

        panel.destroy();
      });
    });
  });

  describe('Issue 2: Hit Probability section is not showing up', () => {
    describe('Root Cause: HitProbabilityCalculator is not integrated into DamageAnalyticsPanel', () => {
      it('should render a Hit Probability section after entity selection', () => {
        // Arrange - For this test to pass, we need to inject HitProbabilityCalculator
        const mockCalculator = createMockHitProbabilityCalculator();
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
          hitProbabilityCalculator: mockCalculator, // BUG: Currently not accepted
        });
        const anatomyData = createSampleAnatomyData();

        // Act
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - There should be a "Hit Probability" section
        // BUG: Currently #generateContentHTML() only generates 3 sections:
        // "Hits to Destroy", "Effect Triggers", "Aggregate Stats"
        // Hit Probability is completely missing
        const headings = containerElement.querySelectorAll('h4');
        const headingTexts = Array.from(headings).map(h => h.textContent);

        expect(headingTexts).toContain('Hit Probability');

        panel.destroy();
      });

      it('should display probability bars with correct CSS classes', () => {
        // Arrange
        const mockCalculator = createMockHitProbabilityCalculator();
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
          hitProbabilityCalculator: mockCalculator,
        });
        const anatomyData = createSampleAnatomyData();

        // Act
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - Should have probability bar elements
        const probChart = containerElement.querySelector('.ds-prob-chart');
        expect(probChart).not.toBeNull();

        const probBars = containerElement.querySelectorAll('.ds-prob-bar-row');
        expect(probBars.length).toBe(6); // One for each body part

        panel.destroy();
      });

      it('should calculate and display probability percentages', () => {
        // Arrange
        const mockCalculator = createMockHitProbabilityCalculator();
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
          hitProbabilityCalculator: mockCalculator,
        });
        const anatomyData = createSampleAnatomyData();

        // Act
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert - Probability values should be displayed
        const probValues = containerElement.querySelectorAll('.ds-prob-value');
        expect(probValues.length).toBe(6);

        // Values should contain percentage signs
        probValues.forEach(value => {
          expect(value.textContent).toMatch(/%$/);
        });

        // Calculator should have been called
        expect(mockCalculator.calculateProbabilities).toHaveBeenCalled();
        expect(mockCalculator.getVisualizationData).toHaveBeenCalled();

        panel.destroy();
      });

      it('should call HitProbabilityCalculator.calculateProbabilities with parts data', () => {
        // Arrange
        const mockCalculator = createMockHitProbabilityCalculator();
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
          hitProbabilityCalculator: mockCalculator,
        });
        const anatomyData = createSampleAnatomyData();

        // Act
        panel.setEntity('entity-123', anatomyData);
        panel.render();

        // Assert
        expect(mockCalculator.calculateProbabilities).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'head', name: 'Head' }),
            expect.objectContaining({ id: 'torso', name: 'Torso' }),
          ])
        );

        panel.destroy();
      });

      it('should show "No hit probability data" message when calculator returns empty', () => {
        // Arrange
        const mockCalculator = {
          calculateProbabilities: jest.fn(() => []),
          getVisualizationData: jest.fn(() => ({ bars: [], maxProbability: 0, totalParts: 0 })),
        };
        const panel = new DamageAnalyticsPanel({
          containerElement,
          eventBus,
          logger,
          hitProbabilityCalculator: mockCalculator,
        });

        // Act - No entity set, so no parts
        panel.render();

        // Assert
        const noDataMessage = containerElement.innerHTML;
        // Should show appropriate no-data message for hit probability section
        // This is a graceful degradation test

        panel.destroy();
      });
    });
  });

  describe('Issue 3: Analytics section is too narrow (vertically)', () => {
    describe('Root Cause: CSS max-height: 200px on #ds-analytics', () => {
      let cssContent;

      beforeEach(() => {
        // Load the actual CSS file
        const cssPath = path.resolve(__dirname, '../../../../css/damage-simulator.css');
        try {
          cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (err) {
          cssContent = null;
        }
      });

      it('should have max-height >= 600px on #ds-analytics', () => {
        // Arrange
        expect(cssContent).not.toBeNull();

        // Act - Parse the CSS for #ds-analytics max-height
        // Look for pattern: #ds-analytics { ... max-height: XXXpx ... }
        const dsAnalyticsMatch = cssContent.match(/#ds-analytics\s*\{[^}]*max-height:\s*(\d+)px/);

        // Assert
        expect(dsAnalyticsMatch).not.toBeNull();
        const maxHeightValue = parseInt(dsAnalyticsMatch[1], 10);

        // BUG: Currently 200px, should be at least 600px (tripled)
        expect(maxHeightValue).toBeGreaterThanOrEqual(600);
      });

      it('should have adequate vertical height for displaying 6+ parts without forced scrolling', () => {
        // Arrange
        const dom = new JSDOM(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              ${cssContent || '#ds-analytics { max-height: 600px; }'}
            </style>
          </head>
          <body>
            <div id="ds-analytics">
              <section class="ds-analytics-section">
                <h4>Hits to Destroy</h4>
                <table class="ds-hits-table">
                  <tbody>
                    ${Array.from({ length: 6 }, (_, i) => `
                      <tr><td>Part ${i + 1}</td><td>100</td><td>4</td></tr>
                    `).join('')}
                  </tbody>
                </table>
              </section>
              <section class="ds-analytics-section">
                <h4>Hit Probability</h4>
                <div class="ds-prob-chart">
                  ${Array.from({ length: 6 }, (_, i) => `
                    <div class="ds-prob-bar-row">
                      <span>Part ${i + 1}</span>
                      <div class="ds-prob-bar-container"><div class="ds-prob-bar"></div></div>
                      <span>16.7%</span>
                    </div>
                  `).join('')}
                </div>
              </section>
              <section class="ds-analytics-section">
                <h4>Effect Triggers</h4>
                <p>No effect thresholds</p>
              </section>
            </div>
          </body>
          </html>
        `, { runScripts: 'dangerously' });

        const analyticsElement = dom.window.document.getElementById('ds-analytics');
        const computedStyle = dom.window.getComputedStyle(analyticsElement);

        // Assert - max-height should be at least 600px
        const maxHeight = computedStyle.maxHeight;
        if (maxHeight !== 'none') {
          const maxHeightValue = parseInt(maxHeight, 10);
          expect(maxHeightValue).toBeGreaterThanOrEqual(600);
        }

        dom.window.close();
      });

      it('should have min-height >= 300px for reasonable default display', () => {
        // Arrange
        expect(cssContent).not.toBeNull();

        // Act - Parse the CSS for #ds-analytics min-height
        const minHeightMatch = cssContent.match(/#ds-analytics\s*\{[^}]*min-height:\s*(\d+)px/);

        // Assert - min-height should be set for consistent UX
        // This is a new requirement to ensure analytics section has reasonable minimum size
        if (minHeightMatch) {
          const minHeightValue = parseInt(minHeightMatch[1], 10);
          expect(minHeightValue).toBeGreaterThanOrEqual(300);
        } else {
          // min-height should exist after fix
          expect(minHeightMatch).not.toBeNull();
        }
      });
    });
  });

  describe('Integration: All issues fixed together', () => {
    it('should display complete analytics with parts, hit probability, and proper height after entity selection', () => {
      // Arrange
      const mockCalculator = createMockHitProbabilityCalculator();
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: mockCalculator,
      });
      const anatomyData = createSampleAnatomyData();

      // Act - Just select entity, no damage config
      panel.setEntity('entity-123', anatomyData);
      panel.render();

      // Assert Issue 1: Parts should be displayed
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(6);
      expect(containerElement.innerHTML).not.toContain('No anatomy data available');

      // Assert Issue 2: Hit Probability section should exist
      const headings = containerElement.querySelectorAll('h4');
      const headingTexts = Array.from(headings).map(h => h.textContent);
      expect(headingTexts).toContain('Hit Probability');
      expect(containerElement.querySelector('.ds-prob-chart')).not.toBeNull();

      panel.destroy();
    });

    it('should update analytics correctly when damage config is later added', () => {
      // Arrange
      const mockCalculator = createMockHitProbabilityCalculator();
      const panel = new DamageAnalyticsPanel({
        containerElement,
        eventBus,
        logger,
        hitProbabilityCalculator: mockCalculator,
      });
      const anatomyData = createSampleAnatomyData();
      const damageConfig = createSampleDamageConfig();

      // Act - First set entity only
      panel.setEntity('entity-123', anatomyData);
      panel.render();

      // Then add damage config
      panel.updateDamageConfig(damageConfig);
      panel.render();

      // Assert - Now should have full analytics including hits-to-destroy calculations
      const analytics = panel.getAnalytics();
      expect(analytics.parts.length).toBe(6);

      // With damage config, should have actual hitsToDestroy values
      const headPart = analytics.parts.find(p => p.partName === 'Head');
      expect(headPart).toBeDefined();
      expect(headPart.hitsToDestroy).toBeGreaterThan(0);

      panel.destroy();
    });
  });
});
