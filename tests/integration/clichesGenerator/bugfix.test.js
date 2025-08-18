/**
 * @file Integration tests for clichés generator bug fixes
 * Tests the fixes for:
 * 1. Missing event definitions
 * 2. Incorrect method call parameters
 * 3. Invalid state management
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGenerator - Bug Fix Integration Tests', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();

    // IMPORTANT: Setup mocks BEFORE calling setup() so they're available during initialization
    testBed.setupSuccessfulDirectionLoad();

    // Now setup will initialize the controller with the mocked data already in place
    await testBed.setup();
    
    // Additional wait to ensure initialization is complete
    await testBed.flushPromises();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Event Definition Validation', () => {
    it('should dispatch core:direction_selection_started event without warnings', async () => {
      // Arrange - Use a direction ID that matches what setupSuccessfulDirectionLoad creates
      const mockDirection = testBed.createMockDirection('dir-1'); // Use dir-1 which is created by setupSuccessfulDirectionLoad

      // Controller is already initialized in beforeEach, no need to wait
      // Just verify the selector is populated
      const selector = document.getElementById('direction-selector');
      expect(selector).toBeDefined();
      expect(selector.options.length).toBeGreaterThan(1);

      // Setup event spy - subscribe directly to the mockEventBus dispatch calls
      const dispatchSpy = testBed.mockEventBus.dispatch;

      // Act - Simulate selecting a direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = mockDirection.id;
      
      // Trigger the change event
      const changeEvent = new Event('change', { bubbles: true });
      directionSelector.dispatchEvent(changeEvent);

      // Wait for async operations to complete
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 100)); // Additional wait for async handlers

      // Assert - Check if the event was dispatched
      const calls = dispatchSpy.mock.calls;
      const eventCall = calls.find(call => call[0] === 'core:direction_selection_started');
      
      expect(eventCall).toBeDefined();
      expect(eventCall[1]).toEqual(
        expect.objectContaining({
          directionId: mockDirection.id,
        })
      );
    });

    it('should dispatch core events for cliché generation lifecycle', async () => {
      // Arrange - Use consistent direction ID
      const mockDirection = testBed.createMockDirection('dir-1');
      const mockCliches = testBed.createMockCliches();

      // Controller is already initialized in beforeEach
      const selector = document.getElementById('direction-selector');
      expect(selector).toBeDefined();
      expect(selector.options.length).toBeGreaterThan(1);

      // Setup cliché generation mocks (direction data already loaded from setupSuccessfulDirectionLoad)
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
        mockCliches
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Get the dispatch spy
      const dispatchSpy = testBed.mockEventBus.dispatch;
      
      // Clear previous calls
      dispatchSpy.mockClear();

      // Act - Select direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = mockDirection.id;
      directionSelector.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async operations
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for direction selection to complete and generate button to be enabled
      await testBed.waitFor(() => {
        const generateBtn = document.getElementById('generate-btn');
        return generateBtn && !generateBtn.disabled;
      }, 2000);

      // Generate clichés
      const generateBtn = document.getElementById('generate-btn');
      const form = document.getElementById('cliches-form');
      
      // Trigger form submit event (which the controller listens to)
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for generation to complete
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert - check if events were dispatched
      const calls = dispatchSpy.mock.calls;
      const startedEvent = calls.find(call => call[0] === 'core:cliches_generation_started');
      const completedEvent = calls.find(call => call[0] === 'core:cliches_generation_completed');
      
      expect(startedEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
    });

    it('should dispatch core:cliches_generation_failed event on error', async () => {
      // Arrange - Use consistent direction ID
      const mockDirection = testBed.createMockDirection('dir-1');
      const testError = new Error('Generation failed');

      // Controller is already initialized in beforeEach
      const selector = document.getElementById('direction-selector');
      expect(selector).toBeDefined();
      expect(selector.options.length).toBeGreaterThan(1);

      // Setup the mock service to fail (direction data already loaded from setupSuccessfulDirectionLoad)
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
        testError
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Get the dispatch spy
      const dispatchSpy = testBed.mockEventBus.dispatch;
      dispatchSpy.mockClear();

      // Act - Select direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = mockDirection.id;
      directionSelector.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for direction selection
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await testBed.waitFor(() => {
        const generateBtn = document.getElementById('generate-btn');
        return generateBtn && !generateBtn.disabled;
      }, 2000);

      // Try to generate clichés
      const form = document.getElementById('cliches-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for failure event
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      const calls = dispatchSpy.mock.calls;
      const failedEvent = calls.find(call => call[0] === 'core:cliches_generation_failed');
      
      expect(failedEvent).toBeDefined();
      expect(failedEvent[0]).toBe('core:cliches_generation_failed');
    });
  });

  describe('State Management', () => {
    it('should properly manage states without using invalid idle state', async () => {
      // Arrange - Use consistent direction ID
      const mockDirection = testBed.createMockDirection('dir-1');

      // Controller is already initialized in beforeEach
      const selector = document.getElementById('direction-selector');
      expect(selector).toBeDefined();
      expect(selector.options.length).toBeGreaterThan(1);

      // Setup mocks (direction data already loaded from setupSuccessfulDirectionLoad)
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Spy on console to check for warnings about invalid state
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act - Select direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = mockDirection.id;
      directionSelector.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async operations
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for state change
      await testBed.waitFor(() => {
        const emptyState = document.getElementById('empty-state');
        return emptyState && emptyState.style.display !== 'none';
      }, 2000);

      // Assert - should not have warnings about invalid 'idle' state
      const invalidStateWarnings = warnSpy.mock.calls.filter(
        (call) => call[0] && call[0].toString().includes("Invalid state 'idle'")
      );
      expect(invalidStateWarnings).toHaveLength(0);

      // Clean up
      warnSpy.mockRestore();
    });

    it('should transition through correct states during cliché generation', async () => {
      // Arrange - Use consistent direction ID
      const mockDirection = testBed.createMockDirection('dir-1');
      const mockCliches = testBed.createMockCliches();

      // Controller is already initialized in beforeEach
      const selector = document.getElementById('direction-selector');
      expect(selector).toBeDefined();
      expect(selector.options.length).toBeGreaterThan(1);

      // Setup mocks (direction data already loaded from setupSuccessfulDirectionLoad)
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
        mockCliches
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Act - Select direction
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = mockDirection.id;
      directionSelector.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async operations
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for direction selection
      await testBed.waitFor(() => {
        const generateBtn = document.getElementById('generate-btn');
        return generateBtn && !generateBtn.disabled;
      }, 2000);

      // Generate clichés
      const form = document.getElementById('cliches-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for generation to complete
      await testBed.flushPromises();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await testBed.waitFor(() => {
        const resultsState = document.getElementById('results-state');
        return resultsState && resultsState.style.display !== 'none';
      }, 2000);

      // Assert - should show results state after completion
      const resultsState = document.getElementById('results-state');
      const errorState = document.getElementById('error-state');
      const emptyState = document.getElementById('empty-state');

      expect(resultsState.style.display).not.toBe('none');
      expect(errorState.style.display).toBe('none');
      expect(emptyState.style.display).toBe('none');
    });
  });
});
