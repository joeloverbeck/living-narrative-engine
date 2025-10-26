/**
 * @file Additional coverage tests targeting uncovered branches in ClichesGeneratorController.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

let ClichesGeneratorControllerTestBed;

describe('ClichesGeneratorController uncovered logic', () => {
  beforeAll(async () => {
    ({ ClichesGeneratorControllerTestBed } = await import(
      '../../../common/clichesGeneratorControllerTestBed.js'
    ));
  });

  let testBed;

  afterEach(async () => {
    await testBed?.cleanup();
  });

  it('creates fallback concept entries when concept details are missing', async () => {
    testBed = new ClichesGeneratorControllerTestBed();

    const direction = testBed.createMockDirection('dir-missing');
    testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      { direction, concept: null },
    ]);
    testBed.mockCharacterBuilderService.getAllThematicDirections.mockResolvedValue([
      direction,
    ]);
    testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
      null
    );

    await testBed.setup();

    expect(
      testBed.mockCharacterBuilderService.getCharacterConcept
    ).toHaveBeenCalledWith(direction.conceptId);

    const optgroup = testBed
      .getDirectionSelector()
      .querySelector('optgroup');
    expect(optgroup).not.toBeNull();
    expect(optgroup.label).toBe('Untitled Concept');
    expect(optgroup.querySelector('option').value).toBe(direction.id);

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Concept concept-1 not found - using fallback placeholder')
    );
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Concept concept-1 is missing text - displaying as Untitled Concept')
    );
  });

  it('uses directionsWithConceptsMap fallback when organized data lacks a direction', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();

    const concept = testBed.createMockConcept('concept-fallback');
    const direction = {
      id: 'dir-fallback',
      conceptId: concept.id,
      title: 'Fallback Direction',
      description: 'Fallback description',
      coreTension: 'Fallback tension',
    };

    testBed.controller._testSetDirectionCaches({
      directionsData: [],
      directionsMapEntries: [[direction.id, { direction, concept }]],
    });

    await testBed.controller._testDirectionSelection(direction.id);
    await testBed.waitForAsyncOperations();

    const state = testBed.controller._testGetCurrentState();
    expect(state.currentDirection.id).toBe(direction.id);
    expect(state.currentConcept.id).toBe(concept.id);
  });

  it('warns and aborts when generation is already in progress', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    testBed.setupSuccessfulClicheGeneration();
    await testBed.setup();

    await testBed.selectDirection('dir-1');
    const state = testBed.controller._testGetCurrentState();
    testBed.controller._testSetCurrentState({
      ...state,
      isGenerating: true,
    });

    await testBed.controller._testGeneration();

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Generation already in progress, ignoring duplicate request'
    );
  });

  it('logs external direction selection failures from the event bus', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();

    await testBed.mockEventBus.dispatch('DIRECTION_SELECTION_FAILED', {
      reason: 'timeout',
    });

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Direction selection failed',
      { reason: 'timeout' }
    );
  });

  it('shows an error message when refresh fails due to DOM issues', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();

    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tagName, options) => {
      if (tagName === 'optgroup') {
        throw new Error('DOM failure');
      }
      return originalCreateElement.call(document, tagName, options);
    });

    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
      await testBed.waitForAsyncOperations();

      expect(testBed.getStatusMessages().textContent).toContain(
        'Failed to refresh data'
      );
    } finally {
      document.createElement = originalCreateElement;
    }
  });

  it('focuses the first cliché card after generation completes', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    testBed.setupSuccessfulClicheGeneration();
    await testBed.setup();

    await testBed.selectDirection('dir-1');

    const firstResult = {
      setAttribute: jest.fn(),
      focus: jest.fn(),
    };
    const originalQuerySelector = document.querySelector.bind(document);
    const querySpy = jest
      .spyOn(document, 'querySelector')
      .mockImplementation((selector) => {
        if (selector === '.cliche-category-card') {
          return firstResult;
        }
        return originalQuerySelector(selector);
      });

    await testBed.controller._testGeneration();
    await testBed.waitForAsyncOperations();

    expect(firstResult.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    expect(firstResult.focus).toHaveBeenCalled();

    querySpy.mockRestore();
  });

  it('validates direction selection transitions when context is complete', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();

    const result = testBed.controller._testValidateStateTransition(
      'direction_selection',
      { directionId: 'dir-1' }
    );

    expect(result).toBe(true);
  });

  it('navigates back to the index page when the back button is clicked', async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();

    const navigationSpy = jest.fn();
    testBed.controller._testSetNavigationHandler(navigationSpy);

    const backBtn = document.getElementById('back-btn');
    backBtn.click();

    expect(navigationSpy).toHaveBeenCalledWith('index.html');
  });
});

describe('ClichesGeneratorController error handler fallback coverage', () => {
  beforeAll(async () => {
    jest.resetModules();
    jest.unstable_mockModule(
      '../../../../src/characterBuilder/services/clicheErrorHandler.js',
      () => ({
        ClicheErrorHandler: class {
          constructor() {
            throw new Error('Intentional initialization failure');
          }
        },
      })
    );

    ({ ClichesGeneratorControllerTestBed } = await import(
      '../../../common/clichesGeneratorControllerTestBed.js'
    ));
  });

  afterAll(() => {
    jest.resetModules();
  });

  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    testBed.setupSuccessfulDirectionLoad();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed?.cleanup();
  });

  it('falls back to basic messaging when error handler initialization fails', async () => {
    const loadingSpy = jest
      .spyOn(testBed.controller, '_showLoading')
      .mockImplementation(() => {
        throw new Error('Temporary service disruption');
      });

    await testBed.controller._testDirectionSelection('dir-1');
    await testBed.waitForAsyncOperations();

    const messages = testBed.getStatusMessages().textContent;
    expect(messages).toContain(
      'An unexpected error occurred. Please refresh the page and try again.'
    );
    expect(messages).toContain(
      'Could not load existing clichés. You can generate new ones.'
    );

    loadingSpy.mockRestore();
  });
});

