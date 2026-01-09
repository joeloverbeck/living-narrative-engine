/**
 * @file Unit tests for HierarchicalAnatomyRenderer
 * @see src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import HierarchicalAnatomyRenderer from '../../../../src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js';

describe('HierarchicalAnatomyRenderer', () => {
  let mockContainer;
  let mockLogger;
  let renderer;

  /**
   * Create a mock anatomy tree node for testing
   *
   * @param {object} overrides - Properties to override
   * @returns {object} Mock AnatomyTreeNode
   */
  function createMockNode(overrides = {}) {
    return {
      id: 'test-part-id',
      name: 'Test Part',
      components: {
        'anatomy:part': { type: 'limb' },
        'anatomy:part_health': { current: 85, max: 100 },
      },
      health: { current: 85, max: 100 },
      children: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    // Create mock container element
    mockContainer = document.createElement('div');
    mockContainer.id = 'anatomy-tree';
    document.body.appendChild(mockContainer);

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    renderer = new HierarchicalAnatomyRenderer({
      containerElement: mockContainer,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should throw error when containerElement is not provided', () => {
      expect(() => {
        new HierarchicalAnatomyRenderer({
          containerElement: null,
          logger: mockLogger,
        });
      }).toThrow('containerElement must be a valid HTMLElement');
    });

    it('should throw error when containerElement is not an HTMLElement', () => {
      expect(() => {
        new HierarchicalAnatomyRenderer({
          containerElement: 'not-an-element',
          logger: mockLogger,
        });
      }).toThrow('containerElement must be a valid HTMLElement');
    });

    it('should create instance with valid dependencies', () => {
      expect(renderer).toBeInstanceOf(HierarchicalAnatomyRenderer);
    });
  });

  describe('render()', () => {
    it('should render tree structure from hierarchy data', () => {
      const rootNode = createMockNode({
        children: [
          createMockNode({ id: 'child-1', name: 'Child 1' }),
          createMockNode({ id: 'child-2', name: 'Child 2' }),
        ],
      });

      renderer.render(rootNode);

      expect(mockContainer.getAttribute('role')).toBe('tree');
      expect(mockContainer.querySelectorAll('.ds-part-card').length).toBe(3);
    });

    it('should create card for each part', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      const card = mockContainer.querySelector('.ds-part-card');
      expect(card).not.toBeNull();
      expect(card.getAttribute('data-part-id')).toBe('test-part-id');
    });

    it('should show part name on card', () => {
      const rootNode = createMockNode({ name: 'Torso' });
      renderer.render(rootNode);

      const nameElement = mockContainer.querySelector('.ds-part-card-name');
      expect(nameElement).not.toBeNull();
      expect(nameElement.textContent).toBe('Torso');
    });

    it('should display health bar with correct percentage', () => {
      const rootNode = createMockNode({
        health: { current: 75, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill).not.toBeNull();
      expect(healthFill.style.width).toBe('75%');
    });

    it('should color health bar green when health > 66%', () => {
      const rootNode = createMockNode({
        health: { current: 85, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.classList.contains('ds-health-bar-fill--healthy')).toBe(true);
    });

    it('should color health bar orange when health between 33% and 66%', () => {
      const rootNode = createMockNode({
        health: { current: 50, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.classList.contains('ds-health-bar-fill--damaged')).toBe(true);
    });

    it('should color health bar red when health <= 33%', () => {
      const rootNode = createMockNode({
        health: { current: 20, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.classList.contains('ds-health-bar-fill--critical')).toBe(true);
    });

    it('should filter out descriptor components', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:part': { type: 'limb' },
          'descriptors:visual': { texture: 'smooth' },
          'descriptors:smell': { odor: 'none' },
        },
      });
      renderer.render(rootNode);

      const componentsList = mockContainer.querySelector('.ds-part-components ul');
      expect(componentsList).not.toBeNull();
      expect(componentsList.querySelectorAll('li').length).toBe(1);
      expect(componentsList.querySelector('li').textContent).toBe('anatomy:part');
    });

    it('should show mechanical components list', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:part': { type: 'limb' },
          'anatomy:sockets': { slots: { slot1: {}, slot2: {} } },
        },
      });
      renderer.render(rootNode);

      const componentsList = mockContainer.querySelector('.ds-part-components ul');
      expect(componentsList).not.toBeNull();
      const items = componentsList.querySelectorAll('li');
      expect(items.length).toBe(2);
    });

    it('should format sockets component with slot count', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:sockets': { slots: { slot1: {}, slot2: {}, slot3: {} } },
        },
      });
      renderer.render(rootNode);

      const componentsList = mockContainer.querySelector('.ds-part-components ul');
      const socketItem = Array.from(componentsList.querySelectorAll('li')).find(
        (li) => li.textContent.includes('anatomy:sockets')
      );
      expect(socketItem.textContent).toBe('anatomy:sockets (3 slots)');
    });

    it('should handle parts without health component', () => {
      const rootNode = createMockNode({
        health: null,
      });
      renderer.render(rootNode);

      const healthBar = mockContainer.querySelector('.ds-health-bar');
      expect(healthBar).toBeNull();
    });

    it('should indent child parts correctly using data-depth attribute', () => {
      const rootNode = createMockNode({
        children: [
          createMockNode({
            id: 'level-1',
            children: [createMockNode({ id: 'level-2' })],
          }),
        ],
      });
      renderer.render(rootNode);

      const rootCard = mockContainer.querySelector('[data-part-id="test-part-id"]');
      const level1Card = mockContainer.querySelector('[data-part-id="level-1"]');
      const level2Card = mockContainer.querySelector('[data-part-id="level-2"]');

      expect(rootCard.getAttribute('data-depth')).toBe('0');
      expect(level1Card.getAttribute('data-depth')).toBe('1');
      expect(level2Card.getAttribute('data-depth')).toBe('2');
    });

    it('should clear previous render before new render', () => {
      const firstNode = createMockNode({ id: 'first', name: 'First' });
      renderer.render(firstNode);
      expect(mockContainer.querySelectorAll('.ds-part-card').length).toBe(1);

      const secondNode = createMockNode({ id: 'second', name: 'Second' });
      renderer.render(secondNode);
      expect(mockContainer.querySelectorAll('.ds-part-card').length).toBe(1);
      expect(mockContainer.querySelector('.ds-part-card-name').textContent).toBe('Second');
    });

    it('should handle empty hierarchy gracefully', () => {
      renderer.render(null);

      const emptyState = mockContainer.querySelector('.ds-empty-state');
      expect(emptyState).not.toBeNull();
      expect(emptyState.textContent).toBe('No anatomy data available');
    });
  });

  describe('Overall Health', () => {
    it('should render overall health header when setOverallHealth is called', () => {
      const rootNode = createMockNode();
      renderer.setOverallHealth(80);
      renderer.render(rootNode);

      const header = mockContainer.querySelector('.ds-overall-health-header');
      expect(header).not.toBeNull();

      const text = mockContainer.querySelector('.ds-overall-health-text');
      expect(text.textContent).toBe('80%');
    });

    it('should position overall health header above first anatomy card', () => {
      const rootNode = createMockNode();
      renderer.setOverallHealth(80);
      renderer.render(rootNode);

      const firstChild = mockContainer.firstElementChild;
      expect(firstChild.classList.contains('ds-overall-health-header')).toBe(true);
    });

    it('should apply health bar class based on overall health percentage', () => {
      const rootNode = createMockNode();
      renderer.setOverallHealth(50);
      renderer.render(rootNode);

      const fill = mockContainer.querySelector('.ds-overall-health-header .ds-health-bar-fill');
      expect(fill.classList.contains('ds-health-bar-fill--damaged')).toBe(true);
    });

    it('should update overall health on re-render', () => {
      const rootNode = createMockNode();
      renderer.setOverallHealth(100);
      renderer.render(rootNode);

      renderer.setOverallHealth(50);
      renderer.render(rootNode);

      const fill = mockContainer.querySelector('.ds-overall-health-header .ds-health-bar-fill');
      expect(fill.style.width).toBe('50%');
    });
  });

  describe('clear()', () => {
    it('should remove all content from container', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);
      expect(mockContainer.children.length).toBeGreaterThan(0);

      renderer.clear();
      expect(mockContainer.innerHTML).toBe('');
    });

    it('should remove tree role from container', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);
      expect(mockContainer.getAttribute('role')).toBe('tree');

      renderer.clear();
      expect(mockContainer.getAttribute('role')).toBeNull();
    });

    it('should clear part elements map', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);
      expect(renderer.getPartElement('test-part-id')).not.toBeNull();

      renderer.clear();
      expect(renderer.getPartElement('test-part-id')).toBeNull();
    });
  });

  describe('updatePart()', () => {
    it('should update display on refresh call', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.style.width).toBe('100%');

      renderer.updatePart('test-part-id', {
        health: { current: 50, max: 100 },
      });

      expect(healthFill.style.width).toBe('50%');
    });

    it('should update health bar color on update', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.classList.contains('ds-health-bar-fill--healthy')).toBe(true);

      renderer.updatePart('test-part-id', {
        health: { current: 20, max: 100 },
      });

      expect(healthFill.classList.contains('ds-health-bar-fill--critical')).toBe(true);
      expect(healthFill.classList.contains('ds-health-bar-fill--healthy')).toBe(false);
    });

    it('should update health text on update', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
      });
      renderer.render(rootNode);

      const healthText = mockContainer.querySelector('.ds-part-card-health');
      expect(healthText.textContent).toBe('100/100 HP');

      renderer.updatePart('test-part-id', {
        health: { current: 25, max: 100 },
      });

      expect(healthText.textContent).toBe('25/100 HP');
    });

    it('should warn when part ID not found', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      renderer.updatePart('nonexistent-id', { health: { current: 50, max: 100 } });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Part not found for update: nonexistent-id')
      );
    });
  });

  describe('getPartElement()', () => {
    it('should return DOM element for valid part ID', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      const element = renderer.getPartElement('test-part-id');
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.getAttribute('data-part-id')).toBe('test-part-id');
    });

    it('should return null for invalid part ID', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      const element = renderer.getPartElement('nonexistent-id');
      expect(element).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should set tree role on container', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      expect(mockContainer.getAttribute('role')).toBe('tree');
    });

    it('should set treeitem role on cards', () => {
      const rootNode = createMockNode();
      renderer.render(rootNode);

      const card = mockContainer.querySelector('.ds-part-card');
      expect(card.getAttribute('role')).toBe('treeitem');
    });

    it('should set group role on children container', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      const childrenContainer = mockContainer.querySelector('.ds-part-children');
      expect(childrenContainer.getAttribute('role')).toBe('group');
    });

    it('should set aria-expanded on cards with children', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      const card = mockContainer.querySelector('[data-part-id="test-part-id"]');
      expect(card.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('Expand/Collapse', () => {
    it('should toggle children visibility on expand click', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      const expandButton = mockContainer.querySelector('.ds-part-expand');
      const childrenContainer = mockContainer.querySelector('.ds-part-children');

      expect(childrenContainer.style.display).not.toBe('none');

      // Click to collapse
      expandButton.click();
      expect(childrenContainer.style.display).toBe('none');

      // Click to expand
      expandButton.click();
      expect(childrenContainer.style.display).toBe('block');
    });

    it('should toggle expand icon on click', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      const expandButton = mockContainer.querySelector('.ds-part-expand');
      expect(expandButton.textContent).toBe('▼');

      expandButton.click();
      expect(expandButton.textContent).toBe('▶');

      expandButton.click();
      expect(expandButton.textContent).toBe('▼');
    });

    it('should update aria-expanded on toggle', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      const card = mockContainer.querySelector('[data-part-id="test-part-id"]');
      const expandButton = mockContainer.querySelector('.ds-part-expand');

      expect(card.getAttribute('aria-expanded')).toBe('true');

      expandButton.click();
      expect(card.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max health', () => {
      const rootNode = createMockNode({
        health: { current: 0, max: 0 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.style.width).toBe('0%');
    });

    it('should handle health exceeding max', () => {
      const rootNode = createMockNode({
        health: { current: 150, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.style.width).toBe('100%');
    });

    it('should handle negative health', () => {
      const rootNode = createMockNode({
        health: { current: -10, max: 100 },
      });
      renderer.render(rootNode);

      const healthFill = mockContainer.querySelector('.ds-health-bar-fill');
      expect(healthFill.style.width).toBe('0%');
    });

    it('should handle empty components object', () => {
      const rootNode = createMockNode({
        components: {},
      });
      renderer.render(rootNode);

      const componentsSection = mockContainer.querySelector('.ds-part-components');
      expect(componentsSection).toBeNull();
    });

    it('should exclude core:name from components list', () => {
      const rootNode = createMockNode({
        components: {
          'core:name': { text: 'Test' },
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      const componentsList = mockContainer.querySelector('.ds-part-components ul');
      expect(componentsList.querySelectorAll('li').length).toBe(1);
      expect(componentsList.querySelector('li').textContent).toBe('anatomy:part');
    });

    it('should exclude core:description from components list', () => {
      const rootNode = createMockNode({
        components: {
          'core:description': { text: 'A test description' },
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      const componentsList = mockContainer.querySelector('.ds-part-components ul');
      expect(componentsList.querySelectorAll('li').length).toBe(1);
      expect(componentsList.querySelector('li').textContent).toBe('anatomy:part');
    });

    it('should not show expand button for parts without children', () => {
      const rootNode = createMockNode({ children: [] });
      renderer.render(rootNode);

      const expandButton = mockContainer.querySelector('.ds-part-expand');
      expect(expandButton).toBeNull();
    });
  });

  describe('Static Constants', () => {
    it('should expose CSS_CLASSES constant', () => {
      expect(HierarchicalAnatomyRenderer.CSS_CLASSES).toBeDefined();
      expect(HierarchicalAnatomyRenderer.CSS_CLASSES.partCard).toBe('ds-part-card');
    });

    it('should expose HEALTH_THRESHOLDS constant', () => {
      expect(HierarchicalAnatomyRenderer.HEALTH_THRESHOLDS).toBeDefined();
      expect(HierarchicalAnatomyRenderer.HEALTH_THRESHOLDS.healthy).toBe(66);
      expect(HierarchicalAnatomyRenderer.HEALTH_THRESHOLDS.damaged).toBe(33);
    });

    it('should expose RESPIRATORY_COMPONENT constant', () => {
      expect(HierarchicalAnatomyRenderer.RESPIRATORY_COMPONENT).toBe('breathing-states:respiratory_organ');
    });

    it('should expose EFFECT_COMPONENTS constant', () => {
      expect(HierarchicalAnatomyRenderer.EFFECT_COMPONENTS).toBeDefined();
      expect(HierarchicalAnatomyRenderer.EFFECT_COMPONENTS.bleeding).toBe('anatomy:bleeding');
      expect(HierarchicalAnatomyRenderer.EFFECT_COMPONENTS.burning).toBe('anatomy:burning');
      expect(HierarchicalAnatomyRenderer.EFFECT_COMPONENTS.poisoned).toBe('anatomy:poisoned');
      expect(HierarchicalAnatomyRenderer.EFFECT_COMPONENTS.fractured).toBe('anatomy:fractured');
    });

    it('should expose EFFECT_EMOJIS constant', () => {
      expect(HierarchicalAnatomyRenderer.EFFECT_EMOJIS).toBeDefined();
      expect(HierarchicalAnatomyRenderer.EFFECT_EMOJIS.bleeding).toBe('🩸');
      expect(HierarchicalAnatomyRenderer.EFFECT_EMOJIS.burning).toBe('🔥');
      expect(HierarchicalAnatomyRenderer.EFFECT_EMOJIS.poisoned).toBe('☠️');
      expect(HierarchicalAnatomyRenderer.EFFECT_EMOJIS.fractured).toBe('🦴');
    });
  });

  describe('Oxygen Display', () => {
    it('should display oxygen bar for respiratory parts', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 8,
          },
        },
      });
      renderer.render(rootNode);

      const oxygenSection = mockContainer.querySelector('.ds-part-oxygen');
      expect(oxygenSection).not.toBeNull();

      const oxygenBar = mockContainer.querySelector('.ds-oxygen-bar');
      expect(oxygenBar).not.toBeNull();

      const oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill).not.toBeNull();
      expect(oxygenFill.style.width).toBe('80%');
    });

    it('should not show oxygen bar for non-respiratory parts', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      const oxygenSection = mockContainer.querySelector('.ds-part-oxygen');
      expect(oxygenSection).toBeNull();
    });

    it('should show oxygen percentage correctly', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 20,
            currentOxygen: 5,
          },
        },
      });
      renderer.render(rootNode);

      const oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill.style.width).toBe('25%');
    });

    it('should display oxygen text correctly', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 7,
          },
        },
      });
      renderer.render(rootNode);

      const oxygenText = mockContainer.querySelector('.ds-oxygen-text');
      expect(oxygenText).not.toBeNull();
      expect(oxygenText.textContent).toBe('7/10 O₂');
    });

    it('should default to max oxygen when currentOxygen is missing', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 15,
          },
        },
      });
      renderer.render(rootNode);

      const oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill.style.width).toBe('100%');

      const oxygenText = mockContainer.querySelector('.ds-oxygen-text');
      expect(oxygenText.textContent).toBe('15/15 O₂');
    });

    it('should handle missing oxygen data gracefully', () => {
      const rootNode = createMockNode({
        components: null,
      });
      renderer.render(rootNode);

      const oxygenSection = mockContainer.querySelector('.ds-part-oxygen');
      expect(oxygenSection).toBeNull();
    });

    it('should update oxygen on updatePart call', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 10,
          },
        },
      });
      renderer.render(rootNode);

      let oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill.style.width).toBe('100%');

      renderer.updatePart('test-part-id', {
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 3,
          },
        },
      });

      oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill.style.width).toBe('30%');

      const oxygenText = mockContainer.querySelector('.ds-oxygen-text');
      expect(oxygenText.textContent).toBe('3/10 O₂');
    });

    it('should remove oxygen section when respiratory component is removed', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 10,
          },
        },
      });
      renderer.render(rootNode);

      expect(mockContainer.querySelector('.ds-part-oxygen')).not.toBeNull();

      renderer.updatePart('test-part-id', {
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });

      expect(mockContainer.querySelector('.ds-part-oxygen')).toBeNull();
    });

    it('should add oxygen section when respiratory component is added', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
        components: {
          'anatomy:part': { type: 'organ' },
        },
      });
      renderer.render(rootNode);

      expect(mockContainer.querySelector('.ds-part-oxygen')).toBeNull();

      renderer.updatePart('test-part-id', {
        components: {
          'anatomy:part': { type: 'organ' },
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 8,
          },
        },
      });

      expect(mockContainer.querySelector('.ds-part-oxygen')).not.toBeNull();
    });
  });

  describe('Status Effects Display', () => {
    it('should display bleeding status effect indicator', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
      });
      renderer.render(rootNode);

      const effectsSection = mockContainer.querySelector('.ds-part-effects');
      expect(effectsSection).not.toBeNull();

      const bleedingEffect = effectsSection.querySelector('.ds-effect-bleeding');
      expect(bleedingEffect).not.toBeNull();
      expect(bleedingEffect.textContent).toBe('🩸');
    });

    it('should display burning status effect indicator', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:burning': {
            remainingTurns: 2,
            tickDamage: 5,
            stackedCount: 3,
          },
        },
      });
      renderer.render(rootNode);

      const burningEffect = mockContainer.querySelector('.ds-effect-burning');
      expect(burningEffect).not.toBeNull();
      expect(burningEffect.textContent).toBe('🔥');
    });

    it('should display poison status effect indicator', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:poisoned': {
            remainingTurns: 5,
            tickDamage: 1,
          },
        },
      });
      renderer.render(rootNode);

      const poisonedEffect = mockContainer.querySelector('.ds-effect-poisoned');
      expect(poisonedEffect).not.toBeNull();
      expect(poisonedEffect.textContent).toBe('☠️');
    });

    it('should display fracture status effect indicator', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:fractured': {
            sourceDamageType: 'blunt',
            appliedAtHealth: 50,
          },
        },
      });
      renderer.render(rootNode);

      const fracturedEffect = mockContainer.querySelector('.ds-effect-fractured');
      expect(fracturedEffect).not.toBeNull();
      expect(fracturedEffect.textContent).toBe('🦴');
    });

    it('should show effect duration in tooltip when available', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': {
            severity: 'moderate',
            remainingTurns: 3,
          },
        },
      });
      renderer.render(rootNode);

      const bleedingEffect = mockContainer.querySelector('.ds-effect-bleeding');
      expect(bleedingEffect.getAttribute('title')).toBe('Bleeding (moderate, 3 turns)');
    });

    it('should show bleeding severity in tooltip', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': {
            severity: 'severe',
          },
        },
      });
      renderer.render(rootNode);

      const bleedingEffect = mockContainer.querySelector('.ds-effect-bleeding');
      expect(bleedingEffect.getAttribute('title')).toBe('Bleeding (severe)');
    });

    it('should show burning stacked count in tooltip', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:burning': {
            remainingTurns: 2,
            stackedCount: 3,
          },
        },
      });
      renderer.render(rootNode);

      const burningEffect = mockContainer.querySelector('.ds-effect-burning');
      expect(burningEffect.getAttribute('title')).toBe('Burning (2 turns, x3)');
    });

    it('should show fractured without duration in tooltip', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:fractured': {
            sourceDamageType: 'blunt',
            appliedAtHealth: 50,
          },
        },
      });
      renderer.render(rootNode);

      const fracturedEffect = mockContainer.querySelector('.ds-effect-fractured');
      expect(fracturedEffect.getAttribute('title')).toBe('Fractured');
    });

    it('should handle multiple simultaneous effects', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': { severity: 'minor', remainingTurns: 2 },
          'anatomy:burning': { remainingTurns: 1, stackedCount: 1 },
          'anatomy:poisoned': { remainingTurns: 4 },
          'anatomy:fractured': { sourceDamageType: 'slash' },
        },
      });
      renderer.render(rootNode);

      const effectsSection = mockContainer.querySelector('.ds-part-effects');
      expect(effectsSection).not.toBeNull();

      expect(effectsSection.querySelector('.ds-effect-bleeding')).not.toBeNull();
      expect(effectsSection.querySelector('.ds-effect-burning')).not.toBeNull();
      expect(effectsSection.querySelector('.ds-effect-poisoned')).not.toBeNull();
      expect(effectsSection.querySelector('.ds-effect-fractured')).not.toBeNull();
    });

    it('should not show effects section when no effects present', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      const effectsSection = mockContainer.querySelector('.ds-part-effects');
      expect(effectsSection).toBeNull();
    });

    it('should update effects on updatePart call', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': { severity: 'minor', remainingTurns: 5 },
        },
      });
      renderer.render(rootNode);

      expect(mockContainer.querySelector('.ds-effect-bleeding')).not.toBeNull();
      expect(mockContainer.querySelector('.ds-effect-burning')).toBeNull();

      renderer.updatePart('test-part-id', {
        components: {
          'anatomy:burning': { remainingTurns: 2, stackedCount: 1 },
        },
      });

      expect(mockContainer.querySelector('.ds-effect-bleeding')).toBeNull();
      expect(mockContainer.querySelector('.ds-effect-burning')).not.toBeNull();
    });

    it('should remove effects section when all effects cleared', () => {
      const rootNode = createMockNode({
        components: {
          'anatomy:bleeding': { severity: 'minor', remainingTurns: 1 },
        },
      });
      renderer.render(rootNode);

      expect(mockContainer.querySelector('.ds-part-effects')).not.toBeNull();

      renderer.updatePart('test-part-id', {
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });

      expect(mockContainer.querySelector('.ds-part-effects')).toBeNull();
    });

    it('should add effects section when effects are applied', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      expect(mockContainer.querySelector('.ds-part-effects')).toBeNull();

      renderer.updatePart('test-part-id', {
        components: {
          'anatomy:part': { type: 'limb' },
          'anatomy:poisoned': { remainingTurns: 3, tickDamage: 2 },
        },
      });

      expect(mockContainer.querySelector('.ds-part-effects')).not.toBeNull();
      expect(mockContainer.querySelector('.ds-effect-poisoned')).not.toBeNull();
    });
  });

  describe('DOM Manipulation Edge Cases', () => {
    it('should handle missing healthBarFill element gracefully during update', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
      });
      renderer.render(rootNode);

      // Remove healthBarFill element to simulate external DOM manipulation
      const healthBarFill = mockContainer.querySelector('.ds-health-bar-fill');
      healthBarFill.remove();

      // Should not throw when updating
      expect(() => {
        renderer.updatePart('test-part-id', {
          health: { current: 50, max: 100 },
        });
      }).not.toThrow();
    });

    it('should handle missing healthText element gracefully during update', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
      });
      renderer.render(rootNode);

      // Remove healthText element to simulate external DOM manipulation
      const healthText = mockContainer.querySelector('.ds-part-card-health');
      healthText.remove();

      // Should not throw when updating
      expect(() => {
        renderer.updatePart('test-part-id', {
          health: { current: 50, max: 100 },
        });
      }).not.toThrow();
    });

    it('should handle missing childrenContainer gracefully on expand click', () => {
      const rootNode = createMockNode({
        children: [createMockNode({ id: 'child' })],
      });
      renderer.render(rootNode);

      // Remove childrenContainer to simulate external DOM manipulation
      const childrenContainer = mockContainer.querySelector('.ds-part-children');
      childrenContainer.remove();

      const expandButton = mockContainer.querySelector('.ds-part-expand');

      // Should not throw when clicking expand with missing children container
      expect(() => {
        expandButton.click();
      }).not.toThrow();
    });

    it('should handle oxygen with max <= 0', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 0,
            currentOxygen: 0,
          },
        },
      });
      renderer.render(rootNode);

      const oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      expect(oxygenFill.style.width).toBe('0%');
    });

    it('should handle missing oxygenFill element gracefully during update', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 10,
          },
        },
      });
      renderer.render(rootNode);

      // Remove oxygenFill element to simulate external DOM manipulation
      const oxygenFill = mockContainer.querySelector('.ds-oxygen-fill');
      oxygenFill.remove();

      // Should not throw when updating
      expect(() => {
        renderer.updatePart('test-part-id', {
          components: {
            'breathing-states:respiratory_organ': {
              oxygenCapacity: 10,
              currentOxygen: 5,
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle missing oxygenText element gracefully during update', () => {
      const rootNode = createMockNode({
        components: {
          'breathing-states:respiratory_organ': {
            oxygenCapacity: 10,
            currentOxygen: 10,
          },
        },
      });
      renderer.render(rootNode);

      // Remove oxygenText element to simulate external DOM manipulation
      const oxygenText = mockContainer.querySelector('.ds-oxygen-text');
      oxygenText.remove();

      // Should not throw when updating
      expect(() => {
        renderer.updatePart('test-part-id', {
          components: {
            'breathing-states:respiratory_organ': {
              oxygenCapacity: 10,
              currentOxygen: 5,
            },
          },
        });
      }).not.toThrow();
    });

    it('should handle missing all insertion targets when adding oxygen section', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
        components: {
          'anatomy:part': { type: 'organ' },
        },
      });
      renderer.render(rootNode);

      // Remove all potential insertion targets
      const header = mockContainer.querySelector('.ds-part-card-header');
      const healthBar = mockContainer.querySelector('.ds-health-bar');
      const healthText = mockContainer.querySelector('.ds-part-card-health');
      header.remove();
      healthBar.remove();
      healthText.remove();

      // Should not throw when trying to add oxygen section
      expect(() => {
        renderer.updatePart('test-part-id', {
          components: {
            'anatomy:part': { type: 'organ' },
            'breathing-states:respiratory_organ': {
              oxygenCapacity: 10,
              currentOxygen: 8,
            },
          },
        });
      }).not.toThrow();

      // Oxygen section should not be added (no insertion point found)
      expect(mockContainer.querySelector('.ds-part-oxygen')).toBeNull();
    });

    it('should handle missing all insertion targets when adding effects section', () => {
      const rootNode = createMockNode({
        health: { current: 100, max: 100 },
        components: {
          'anatomy:part': { type: 'limb' },
        },
      });
      renderer.render(rootNode);

      // Remove all potential insertion targets
      const header = mockContainer.querySelector('.ds-part-card-header');
      const healthBar = mockContainer.querySelector('.ds-health-bar');
      const healthText = mockContainer.querySelector('.ds-part-card-health');
      header.remove();
      healthBar.remove();
      healthText.remove();

      // Should not throw when trying to add effects section
      expect(() => {
        renderer.updatePart('test-part-id', {
          components: {
            'anatomy:part': { type: 'limb' },
            'anatomy:bleeding': { severity: 'minor', remainingTurns: 2 },
          },
        });
      }).not.toThrow();

      // Effects section should not be added (no insertion point found)
      expect(mockContainer.querySelector('.ds-part-effects')).toBeNull();
    });

  });
});
