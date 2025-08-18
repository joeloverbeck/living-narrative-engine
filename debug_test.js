import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from './tests/common/clichesGeneratorControllerTestBed.js';

describe('Debug Test', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should debug controller initialization', async () => {
    console.log('Controller exists:', !!testBed.controller);

    // Check if direction selector exists
    const directionSelector = document.getElementById('direction-selector');
    console.log('Direction selector exists:', !!directionSelector);

    // Check if empty state exists
    const emptyState = document.getElementById('empty-state');
    console.log('Empty state exists:', !!emptyState);

    // Check if controller has direction data
    console.log(
      'Direction data length:',
      testBed.controller ? 'unknown' : 'no controller'
    );

    expect(testBed.controller).toBeTruthy();
    expect(directionSelector).toBeTruthy();
    expect(emptyState).toBeTruthy();
  });
});
