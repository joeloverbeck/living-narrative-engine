/**
 * @file Example tests using the new BaseCharacterBuilderController test infrastructure
 * @description Demonstrates proper usage of the test infrastructure components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  BaseCharacterBuilderControllerTestBase,
  TestController,
} from './BaseCharacterBuilderController.testbase.js';

describe('BaseCharacterBuilderController - Using Test Infrastructure', () => {
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

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await testBase.controller.initialize();

      testBase.assertInitialized();
      expect(testBase.controller.wasMethodCalled('_cacheElements')).toBe(true);
      expect(testBase.controller.wasMethodCalled('_setupEventListeners')).toBe(
        true
      );
    });

    it('should handle lifecycle methods in correct order', async () => {
      await testBase.controller.initialize();

      const callOrder = testBase.controller.getCallOrder();
      expect(callOrder).toContain('_preInitialize');
      expect(callOrder).toContain('_cacheElements');
      expect(callOrder).toContain('_setupEventListeners');
      expect(callOrder.indexOf('_preInitialize')).toBeLessThan(
        callOrder.indexOf('_cacheElements')
      );
    });

    it('should initialize CharacterBuilderService during setup', async () => {
      const service = testBase.mockDependencies.characterBuilderService;

      await testBase.controller.initialize();

      expect(service.initialize).toHaveBeenCalled();
    });
  });

  describe('UI State Management', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should show error state with message', async () => {
      testBase.controller._showError('Test error message');

      testBase.assertUIState('error');
      testBase.assertErrorMessage('Test error message');
    });

    it('should show loading state', () => {
      testBase.controller._showLoading('Loading data...');

      testBase.assertUIState('loading');
    });

    it('should show empty state', () => {
      testBase.controller._showEmpty();

      testBase.assertUIState('empty');
    });
  });

  describe('Destruction', () => {
    it('should call all destroy methods when destroyed', async () => {
      await testBase.controller.initialize();
      await testBase.controller.destroy();

      testBase.assertDestroyed();
      expect(testBase.controller.wasMethodCalled('_preDestroy')).toBe(true);
      expect(
        testBase.controller.wasMethodCalled('_cancelCustomOperations')
      ).toBe(true);
      expect(testBase.controller.wasMethodCalled('_cleanupCoreServices')).toBe(
        true
      );
      expect(
        testBase.controller.wasMethodCalled('_cleanupAdditionalServices')
      ).toBe(true);
      expect(testBase.controller.wasMethodCalled('_clearCachedData')).toBe(
        true
      );
      expect(testBase.controller.wasMethodCalled('_postDestroy')).toBe(true);
    });

    it('should handle destroy lifecycle in correct order', async () => {
      await testBase.controller.initialize();
      await testBase.controller.destroy();

      const callOrder = testBase.controller.getCallOrder();
      const destroyMethods = [
        '_preDestroy',
        '_cancelCustomOperations',
        '_cleanupAdditionalServices',
        '_cleanupCoreServices',
        '_clearCachedData',
        '_postDestroy',
      ];

      // Verify all destroy methods were called
      destroyMethods.forEach((method) => {
        expect(callOrder).toContain(method);
      });

      // Verify order is correct (note: exact order reflects BaseCharacterBuilderController destroy phases)
      const destroyCallOrder = callOrder.filter((method) =>
        destroyMethods.includes(method)
      );
      expect(destroyCallOrder).toEqual(destroyMethods);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();

      // Add interactive elements for testing
      testBase.addDOMElement('<button id="action-btn">Action</button>');
      testBase.addDOMElement(
        '<form id="test-form"><input id="text-input" type="text" /></form>'
      );
    });

    it('should handle button click events', () => {
      let clicked = false;
      const button = document.getElementById('action-btn');

      button.addEventListener('click', () => {
        clicked = true;
      });

      testBase.click('#action-btn');

      expect(clicked).toBe(true);
    });

    it('should handle form input changes', () => {
      let inputChanged = false;
      const input = document.getElementById('text-input');

      input.addEventListener('input', () => {
        inputChanged = true;
      });

      testBase.setInputValue('#text-input', 'test value');

      expect(input.value).toBe('test value');
      expect(inputChanged).toBe(true);
    });

    it('should handle form submission', () => {
      let submitted = false;
      const form = document.getElementById('test-form');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });

      testBase.submitForm('#test-form');

      expect(submitted).toBe(true);
    });
  });

  describe('Data Validation', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should handle validation errors', () => {
      const mockValidator = testBase.mockDependencies.schemaValidator;
      const error = testBase.buildValidationError({
        instancePath: '/characterConcept',
        message: 'must not be empty',
      });

      mockValidator.validate.mockReturnValue({
        isValid: false,
        errors: [error],
      });

      const result = mockValidator.validate('character-concept', {
        characterConcept: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(error);
      expect(error.instancePath).toBe('/characterConcept');
      expect(error.message).toBe('must not be empty');
    });

    it('should handle successful validation', () => {
      const mockValidator = testBase.mockDependencies.schemaValidator;

      mockValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = mockValidator.validate('character-concept', {
        characterConcept: 'A valid concept',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should interact with CharacterBuilderService', async () => {
      const service = testBase.mockDependencies.characterBuilderService;
      const mockConcept = testBase.buildCharacterConcept({
        text: 'Test character concept',
      });

      service.getAllCharacterConcepts.mockResolvedValue([mockConcept]);

      const result = await service.getAllCharacterConcepts();

      expect(result).toEqual([mockConcept]);
      expect(service.getAllCharacterConcepts).toHaveBeenCalled();
    });

    it('should create character concepts', async () => {
      const service = testBase.mockDependencies.characterBuilderService;
      const conceptData = { text: 'New character concept' };
      const createdConcept = testBase.buildCharacterConcept({
        id: 'new-concept-id',
        text: conceptData.text,
      });

      service.createCharacterConcept.mockResolvedValue(createdConcept);

      const result = await service.createCharacterConcept(conceptData);

      expect(result).toEqual(createdConcept);
      expect(service.createCharacterConcept).toHaveBeenCalledWith(conceptData);
    });

    it('should handle thematic directions', async () => {
      const service = testBase.mockDependencies.characterBuilderService;
      const mockDirection = testBase.buildThematicDirection({
        title: 'Epic Adventure',
        themes: ['heroism', 'discovery'],
      });

      service.getThematicDirections.mockResolvedValue([mockDirection]);

      const result = await service.getThematicDirections();

      expect(result).toEqual([mockDirection]);
      expect(mockDirection.title).toBe('Epic Adventure');
      expect(mockDirection.themes).toEqual(['heroism', 'discovery']);
    });
  });

  describe('Event Bus Integration', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should dispatch events through event bus', () => {
      const eventBus = testBase.mockDependencies.eventBus;

      eventBus.dispatch('CONTROLLER_ACTION', { action: 'test' });

      expect(eventBus.dispatch).toHaveBeenCalledWith('CONTROLLER_ACTION', {
        action: 'test',
      });
    });

    it('should subscribe to events', () => {
      const eventBus = testBase.mockDependencies.eventBus;
      const handler = jest.fn();

      eventBus.subscribe('TEST_EVENT', handler);

      expect(eventBus.subscribe).toHaveBeenCalledWith('TEST_EVENT', handler);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should handle service errors gracefully', async () => {
      const service = testBase.mockDependencies.characterBuilderService;
      const error = new Error('Service unavailable');

      service.getAllCharacterConcepts.mockRejectedValue(error);

      await expect(service.getAllCharacterConcepts()).rejects.toThrow(
        'Service unavailable'
      );
    });

    it('should log errors appropriately', () => {
      const logger = testBase.mockDependencies.logger;
      const error = new Error('Test error');

      logger.error('Operation failed', error);

      expect(logger.error).toHaveBeenCalledWith('Operation failed', error);
    });
  });

  describe('Async Operations', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should handle async operations with wait helper', async () => {
      const startTime = Date.now();

      await testBase.wait(50);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should handle async service calls', async () => {
      const service = testBase.mockDependencies.characterBuilderService;

      // Simulate async operation
      service.createCharacterConcept.mockImplementation(async (data) => {
        await testBase.wait(10);
        return testBase.buildCharacterConcept({ ...data, id: 'async-id' });
      });

      const result = await service.createCharacterConcept({
        text: 'Async concept',
      });

      expect(result.id).toBe('async-id');
      expect(result.text).toBe('Async concept');
    });
  });
});
