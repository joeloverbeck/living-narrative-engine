/**
 * @file Tests for BaseCharacterBuilderController test infrastructure
 * @description Validates the test infrastructure components work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  BaseCharacterBuilderControllerTestBase,
  EventSimulation,
  ControllerAssertions,
  TestDataBuilders,
  TestController,
} from './BaseCharacterBuilderController.testbase.js';

describe('BaseCharacterBuilderController Test Infrastructure', () => {
  describe('BaseCharacterBuilderControllerTestBase', () => {
    let testBase;

    beforeEach(async () => {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();
    });

    afterEach(async () => {
      await testBase.cleanup();
    });

    it('should extend BaseTestBed', () => {
      expect(testBase).toBeInstanceOf(BaseCharacterBuilderControllerTestBase);
      expect(testBase.mocks).toBeDefined();
      expect(testBase.resetMocks).toBeDefined();
    });

    it('should setup DOM elements for UIStateManager', () => {
      expect(document.getElementById('empty-state')).toBeTruthy();
      expect(document.getElementById('loading-state')).toBeTruthy();
      expect(document.getElementById('results-state')).toBeTruthy();
      expect(document.getElementById('error-state')).toBeTruthy();
      expect(document.querySelector('.error-message-text')).toBeTruthy();
    });

    it('should create mock dependencies using existing factories', () => {
      expect(testBase.mockDependencies.logger).toBeDefined();
      expect(testBase.mockDependencies.eventBus).toBeDefined();
      expect(testBase.mockDependencies.characterBuilderService).toBeDefined();
      expect(testBase.mockDependencies.schemaValidator).toBeDefined();
    });

    it('should create CharacterBuilderService mock with all required methods', () => {
      const service = testBase.mockDependencies.characterBuilderService;

      expect(service.initialize).toBeDefined();
      expect(service.getAllCharacterConcepts).toBeDefined();
      expect(service.getCharacterConcept).toBeDefined();
      expect(service.createCharacterConcept).toBeDefined();
      expect(service.updateCharacterConcept).toBeDefined();
      expect(service.deleteCharacterConcept).toBeDefined();
      expect(service.getThematicDirections).toBeDefined();
      expect(service.generateThematicDirections).toBeDefined();
      expect(service.getAllThematicDirectionsWithConcepts).toBeDefined();
      expect(service.getOrphanedThematicDirections).toBeDefined();
      expect(service.updateThematicDirection).toBeDefined();
      expect(service.deleteThematicDirection).toBeDefined();
    });

    it('should create SchemaValidator mock with validation methods', () => {
      const validator = testBase.mockDependencies.schemaValidator;

      expect(validator.validateAgainstSchema).toBeDefined();
      expect(validator.loadSchema).toBeDefined();
      expect(validator.hasSchema).toBeDefined();
    });

    it('should add DOM elements dynamically', () => {
      const html = '<div id="test-element">Test</div>';
      const element = testBase.addDOMElement(html);

      expect(element).toBeTruthy();
      expect(element.id).toBe('test-element');
      expect(document.getElementById('test-element')).toBe(element);
    });

    it('should cleanup DOM after tests', async () => {
      const html = '<div id="cleanup-test">Test</div>';
      testBase.addDOMElement(html);

      expect(document.getElementById('cleanup-test')).toBeTruthy();

      testBase.cleanupDOM();

      expect(document.body.innerHTML).toBe('');
    });

    it('should throw error if createController not overridden', () => {
      expect(() => testBase.createController()).toThrow(
        'Must override createController() in test class'
      );
    });
  });

  describe('EventSimulation', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="test-btn">Click me</button>
        <form id="test-form">
          <input id="test-input" type="text" />
          <button type="submit">Submit</button>
        </form>
      `;
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should simulate click events', () => {
      const button = document.getElementById('test-btn');
      let clicked = false;

      button.addEventListener('click', () => {
        clicked = true;
      });

      EventSimulation.click('#test-btn');

      expect(clicked).toBe(true);
    });

    it('should throw error if element not found for click', () => {
      expect(() => EventSimulation.click('#nonexistent')).toThrow(
        'Element not found: #nonexistent'
      );
    });

    it('should simulate form submission', () => {
      const form = document.getElementById('test-form');
      let submitted = false;

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });

      EventSimulation.submitForm('#test-form');

      expect(submitted).toBe(true);
    });

    it('should throw error if form not found', () => {
      expect(() => EventSimulation.submitForm('#nonexistent')).toThrow(
        'Form not found: #nonexistent'
      );
    });

    it('should set input value and trigger input event', () => {
      const input = document.getElementById('test-input');
      let inputChanged = false;

      input.addEventListener('input', () => {
        inputChanged = true;
      });

      EventSimulation.setInputValue('#test-input', 'test value');

      expect(input.value).toBe('test value');
      expect(inputChanged).toBe(true);
    });

    it('should throw error if input not found', () => {
      expect(() =>
        EventSimulation.setInputValue('#nonexistent', 'value')
      ).toThrow('Input not found: #nonexistent');
    });

    it('should wait for specified time', async () => {
      const startTime = Date.now();
      await EventSimulation.wait(50);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(40); // Account for timing variations
    });
  });

  describe('ControllerAssertions', () => {
    let mockController;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="empty-state" style="display: block;"></div>
        <div id="loading-state" style="display: none;"></div>
        <div class="error-message-text">Error occurred</div>
      `;

      mockController = {
        isInitialized: false,
        isDestroyed: false,
      };
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should assert controller is initialized', () => {
      mockController.isInitialized = true;
      mockController.isDestroyed = false;

      expect(() =>
        ControllerAssertions.assertInitialized(mockController)
      ).not.toThrow();
    });

    it('should fail when controller is not initialized', () => {
      mockController.isInitialized = false;

      expect(() =>
        ControllerAssertions.assertInitialized(mockController)
      ).toThrow();
    });

    it('should assert controller is destroyed', () => {
      mockController.isInitialized = false;
      mockController.isDestroyed = true;

      expect(() =>
        ControllerAssertions.assertDestroyed(mockController)
      ).not.toThrow();
    });

    it('should fail when controller is not destroyed', () => {
      mockController.isDestroyed = false;

      expect(() =>
        ControllerAssertions.assertDestroyed(mockController)
      ).toThrow();
    });

    it('should assert UI state is visible', () => {
      expect(() => ControllerAssertions.assertUIState('empty')).not.toThrow();
    });

    it('should fail when UI state is not visible', () => {
      expect(() => ControllerAssertions.assertUIState('loading')).toThrow();
    });

    it('should assert error message is displayed', () => {
      expect(() =>
        ControllerAssertions.assertErrorMessage('Error occurred')
      ).not.toThrow();
    });

    it('should fail when error message does not contain expected text', () => {
      expect(() =>
        ControllerAssertions.assertErrorMessage('Different error')
      ).toThrow();
    });
  });

  describe('TestDataBuilders', () => {
    it('should build character concept with defaults', () => {
      const concept = TestDataBuilders.buildCharacterConcept();

      expect(concept).toMatchObject({
        id: expect.stringMatching(/^concept-\d+$/),
        text: 'A brave knight on a quest',
        createdAt: expect.any(String),
        thematicDirections: [],
      });
    });

    it('should build character concept with overrides', () => {
      const concept = TestDataBuilders.buildCharacterConcept({
        text: 'Custom concept text',
        thematicDirections: ['direction1', 'direction2'],
      });

      expect(concept.text).toBe('Custom concept text');
      expect(concept.thematicDirections).toEqual(['direction1', 'direction2']);
    });

    it('should build thematic direction with defaults', () => {
      const direction = TestDataBuilders.buildThematicDirection();

      expect(direction).toMatchObject({
        id: expect.stringMatching(/^direction-\d+$/),
        title: "The Hero's Journey",
        description: 'A classic tale of growth and adventure',
        themes: ['courage', 'growth', 'adventure'],
        characterConceptId: expect.stringMatching(/^concept-\d+$/),
      });
    });

    it('should build thematic direction with overrides', () => {
      const direction = TestDataBuilders.buildThematicDirection({
        title: 'Custom Direction',
        themes: ['custom', 'theme'],
      });

      expect(direction.title).toBe('Custom Direction');
      expect(direction.themes).toEqual(['custom', 'theme']);
    });

    it('should build validation error with defaults', () => {
      const error = TestDataBuilders.buildValidationError();

      expect(error).toMatchObject({
        instancePath: '/text',
        schemaPath: '#/properties/text/type',
        message: 'must be string',
      });
    });

    it('should build validation error with overrides', () => {
      const error = TestDataBuilders.buildValidationError({
        instancePath: '/title',
        message: 'must be required',
      });

      expect(error.instancePath).toBe('/title');
      expect(error.message).toBe('must be required');
    });
  });

  describe('TestController', () => {
    let testBase;
    let controller;

    beforeEach(async () => {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();
      controller = new TestController(testBase.mockDependencies);
    });

    afterEach(async () => {
      if (controller && !controller.isDestroyed) {
        await controller.destroy();
      }
      await testBase.cleanup();
    });

    it('should extend BaseCharacterBuilderController', () => {
      expect(controller).toBeInstanceOf(TestController);
      expect(controller.methodCalls).toEqual([]);
    });

    it('should track method calls', () => {
      controller._trackCall('testMethod');

      expect(controller.methodCalls).toHaveLength(1);
      expect(controller.methodCalls[0].method).toBe('testMethod');
      expect(controller.methodCalls[0].timestamp).toBeGreaterThan(0);
    });

    it('should implement all required abstract methods', () => {
      expect(typeof controller._cacheElements).toBe('function');
      expect(typeof controller._setupEventListeners).toBe('function');
      expect(typeof controller._preDestroy).toBe('function');
      expect(typeof controller._postDestroy).toBe('function');
      expect(typeof controller._cancelCustomOperations).toBe('function');
      expect(typeof controller._cleanupCoreServices).toBe('function');
      expect(typeof controller._cleanupAdditionalServices).toBe('function');
      expect(typeof controller._clearCachedData).toBe('function');
    });

    it('should track method calls when abstract methods are invoked', async () => {
      await controller.initialize();

      expect(controller.wasMethodCalled('_cacheElements')).toBe(true);
      expect(controller.wasMethodCalled('_setupEventListeners')).toBe(true);
    });

    it('should provide call order information', async () => {
      await controller.initialize();

      const callOrder = controller.getCallOrder();
      expect(callOrder).toContain('_cacheElements');
      expect(callOrder).toContain('_setupEventListeners');
    });

    it('should track destroy lifecycle methods when destroyed', async () => {
      await controller.initialize();
      await controller.destroy();

      expect(controller.wasMethodCalled('_preDestroy')).toBe(true);
      expect(controller.wasMethodCalled('_cancelCustomOperations')).toBe(true);
      expect(controller.wasMethodCalled('_cleanupCoreServices')).toBe(true);
      expect(controller.wasMethodCalled('_cleanupAdditionalServices')).toBe(
        true
      );
      expect(controller.wasMethodCalled('_clearCachedData')).toBe(true);
      expect(controller.wasMethodCalled('_postDestroy')).toBe(true);
    });

    it('should cache elements correctly during initialization', async () => {
      await controller.initialize();

      // The TestController should cache the DOM elements
      expect(controller.wasMethodCalled('_cacheElements')).toBe(true);
    });
  });

  describe('Test Infrastructure Integration', () => {
    let testBase;

    beforeEach(async () => {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();

      // Create controller instance
      testBase.controller = new TestController(testBase.mockDependencies);
    });

    afterEach(async () => {
      await testBase.cleanup();
    });

    it('should provide integrated testing experience', async () => {
      await testBase.controller.initialize();

      // Test assertions work with controller
      testBase.assertInitialized();

      // Test event simulation works
      const html = '<button id="test-action">Action</button>';
      testBase.addDOMElement(html);

      // This should not throw
      testBase.click('#test-action');

      // Test data builders work
      const concept = testBase.buildCharacterConcept({ text: 'Test concept' });
      expect(concept.text).toBe('Test concept');

      // Test mock service interactions
      const service = testBase.mockDependencies.characterBuilderService;
      const result = await service.getAllCharacterConcepts();
      expect(result).toEqual([]);
      expect(service.getAllCharacterConcepts).toHaveBeenCalled();
    });

    it('should handle controller lifecycle correctly', async () => {
      // Initialize
      await testBase.controller.initialize();
      testBase.assertInitialized();
      expect(testBase.controller.wasMethodCalled('_cacheElements')).toBe(true);

      // Destroy
      await testBase.controller.destroy();
      testBase.assertDestroyed();
      expect(testBase.controller.wasMethodCalled('_preDestroy')).toBe(true);
    });

    it('should handle validation scenarios', () => {
      const validator = testBase.mockDependencies.schemaValidator;
      const error = testBase.buildValidationError({
        message: 'Custom validation error',
      });

      validator.validateAgainstSchema.mockReturnValue({
        isValid: false,
        errors: [error],
      });

      const result = validator.validateAgainstSchema({ invalid: 'data' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(error);
    });
  });
});
