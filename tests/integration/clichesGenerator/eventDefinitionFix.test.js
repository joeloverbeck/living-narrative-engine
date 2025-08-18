/**
 * @file Integration test for event definition fixes
 * Verifies that the new event definitions are properly loaded and used
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGenerator - Event Definition Fix', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();

    // Setup successful direction load BEFORE setup
    testBed.setupSuccessfulDirectionLoad();

    await testBed.setup();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should dispatch core:direction_selection_started event', async () => {
    // Arrange
    const eventSpy = jest.fn();
    testBed.mockEventBus.subscribe(
      'core:direction_selection_started',
      eventSpy
    );

    // Act - simulate direction selection
    await testBed.simulateDirectionSelection('dir-1');

    // Assert
    expect(eventSpy).toHaveBeenCalled();
    const eventPayload = eventSpy.mock.calls[0][0].payload;
    expect(eventPayload.directionId).toBe('dir-1');
  });

  it('should dispatch core:cliches_generation_started event', async () => {
    // Arrange
    testBed.setupSuccessfulClicheGeneration();
    const eventSpy = jest.fn();
    testBed.mockEventBus.subscribe('core:cliches_generation_started', eventSpy);

    // Act
    await testBed.simulateDirectionSelection('dir-1');
    await testBed.simulateGenerateClick();

    // Assert
    expect(eventSpy).toHaveBeenCalled();
  });

  it('should dispatch core:cliches_generation_completed event on success', async () => {
    // Arrange
    testBed.setupSuccessfulClicheGeneration();
    const eventSpy = jest.fn();
    testBed.mockEventBus.subscribe(
      'core:cliches_generation_completed',
      eventSpy
    );

    // Act
    await testBed.simulateDirectionSelection('dir-1');
    await testBed.simulateGenerateClick();
    await testBed.flushPromises();

    // Assert
    expect(eventSpy).toHaveBeenCalled();
  });

  it('should dispatch core:cliches_generation_failed event on error', async () => {
    // Arrange
    testBed.setupFailedClicheGeneration();
    const eventSpy = jest.fn();
    testBed.mockEventBus.subscribe('core:cliches_generation_failed', eventSpy);

    // Act
    await testBed.simulateDirectionSelection('dir-1');
    await testBed.simulateGenerateClick();
    await testBed.flushPromises();

    // Assert
    expect(eventSpy).toHaveBeenCalled();
  });

  it('should not log warnings about missing event definitions', async () => {
    // Arrange
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    testBed.setupSuccessfulClicheGeneration();

    // Act
    await testBed.simulateDirectionSelection('dir-1');
    await testBed.simulateGenerateClick();
    await testBed.flushPromises();

    // Assert - check for event definition warnings
    const eventWarnings = warnSpy.mock.calls.filter((call) => {
      const message = call[0]?.toString() || '';
      return message.includes('EventDefinition not found');
    });

    expect(eventWarnings).toHaveLength(0);

    // Clean up
    warnSpy.mockRestore();
  });
});
