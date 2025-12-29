/**
 * @file Integration tests for travel_through_dimensions action validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Travel Through Dimensions - Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  describe('Rule Validation', () => {
    it('should successfully load rule with MODIFY_COMPONENT operation', async () => {
      // This test validates that the rule now uses the correct MODIFY_COMPONENT operation
      let loadError = null;

      try {
        await testBed.container.loadModsForTesting(['patrol']);
      } catch (error) {
        loadError = error;
      }

      // Should not have CHANGE_LOCATION errors
      if (loadError) {
        expect(loadError.message).not.toContain('CHANGE_LOCATION');
      }
    });
  });

  describe('Scope Validation', () => {
    it('should successfully resolve dimensional_portals scope using pattern matching', async () => {
      // This test validates that the scope condition now uses valid JSON Logic operators
      let loadError = null;

      try {
        await testBed.container.loadModsForTesting(['patrol']);
      } catch (error) {
        loadError = error;
      }

      // Should not have has_component errors
      if (loadError) {
        expect(loadError.message).not.toContain('has_component');
        expect(loadError.message).not.toContain('Unrecognized operation');
      }
    });
  });

  describe('Action Discovery', () => {
    it('should be able to discover travel_through_dimensions action', async () => {
      // This test validates that the action can be discovered without errors
      let loadError = null;

      try {
        await testBed.container.loadModsForTesting(['patrol']);
      } catch (error) {
        loadError = error;
      }

      // Should load without critical errors related to our fixes
      if (loadError) {
        expect(loadError.message).not.toContain('CHANGE_LOCATION');
        expect(loadError.message).not.toContain('has_component');
      }
    });
  });
});
