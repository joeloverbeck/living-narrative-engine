import { describe, expect, it, test } from '@jest/globals';
import { ErrorClassifier } from '../../../src/domUI/visualizer/ErrorClassifier.js';
import { AnatomyRenderError } from '../../../src/errors/anatomyRenderError.js';
import { AnatomyDataError } from '../../../src/errors/anatomyDataError.js';
import { AnatomyStateError } from '../../../src/errors/anatomyStateError.js';

const createContext = (overrides = {}) => ({
  operation: 'rendering',
  component: 'AnatomyRendererUI',
  data: { entityId: 'entity-42' },
  ...overrides,
});

describe('ErrorClassifier integration for anatomy visualizer failures', () => {
  it('classifies SVG rendering failures with retry guidance and fallbacks', () => {
    const renderError = AnatomyRenderError.svgRenderingFailed(
      'path_generation',
      new Error('GPU reset detected'),
      { entityId: 'entity-42' }
    );
    const context = createContext({ operation: 'rendering' });

    const classification = ErrorClassifier.classify(renderError, context);

    expect(classification.category).toBe(ErrorClassifier.ERROR_CATEGORIES.RENDER);
    expect(classification.domain).toBe(ErrorClassifier.ERROR_DOMAINS.ANATOMY);
    expect(classification.retryable).toBe(true);
    expect(classification.recommendedStrategy).toBe('retry');
    expect(classification.fallbackAvailable).toBe(true);
    expect(classification.systemImpact).toBe('minor');
    expect(classification.userMessageSuggested).toBe(renderError.userMessage);
    expect(classification.actionsSuggested).toEqual(renderError.suggestions);
  });

  it('treats initialization fetch failures as urgent, reportable incidents', () => {
    const fetchError = new TypeError('Failed to fetch anatomy dataset');
    const context = createContext({
      operation: 'initialization',
      component: 'VisualizerBootstrap',
      data: { attempt: 1 },
    });

    const classification = ErrorClassifier.classify(fetchError, context);

    expect(classification.category).toBe(ErrorClassifier.ERROR_CATEGORIES.NETWORK);
    expect(classification.domain).toBe(ErrorClassifier.ERROR_DOMAINS.NETWORK);
    expect(classification.severity).toBe('CRITICAL');
    expect(classification.userImpact).toBe('blocking');
    expect(classification.systemImpact).toBe('major');
    expect(classification.priority).toBe(
      ErrorClassifier.RECOVERY_PRIORITIES.IMMEDIATE
    );
    expect(classification.recommendedStrategy).toBe('retry');
    expect(classification.fallbackAvailable).toBe(false);
    expect(classification.userMessageSuggested).toBe(
      'A critical error occurred. Please refresh the page.'
    );
    expect(classification.actionsSuggested).toEqual(
      expect.arrayContaining([
        'Try again',
        'Check your internet connection',
        'Try again in a moment',
      ])
    );
    expect(ErrorClassifier.shouldReport(fetchError, context)).toBe(true);
    expect(ErrorClassifier.getUrgency(fetchError, context)).toBe('urgent');
  });

  it('escalates missing anatomy parts to retriable loading workflows', () => {
    const dataError = AnatomyDataError.missingAnatomyParts('entity-77', [
      'left_arm',
      'right_leg',
    ]);
    const context = createContext({
      operation: 'anatomy_loading',
      component: 'AnatomyLoader',
      data: { entityId: 'entity-77' },
    });

    const classification = ErrorClassifier.classify(dataError, context);

    expect(classification.category).toBe(ErrorClassifier.ERROR_CATEGORIES.DATA);
    expect(classification.domain).toBe(ErrorClassifier.ERROR_DOMAINS.ANATOMY);
    expect(classification.retryable).toBe(true);
    expect(classification.priority).toBe(ErrorClassifier.RECOVERY_PRIORITIES.HIGH);
    expect(classification.systemImpact).toBe('moderate');
    expect(classification.recommendedStrategy).toBe('retry');
    expect(classification.fallbackAvailable).toBe(true);
    expect(classification.actionsSuggested).toEqual(dataError.suggestions);
  });

  it('keeps UI timeout issues at medium priority with default fallbacks', () => {
    const timeoutError = new Error(
      'Operation timeout while syncing anatomy controls'
    );
    const context = createContext({
      operation: 'ui_refresh',
      component: 'StatusPanelUI',
    });

    const classification = ErrorClassifier.classify(timeoutError, context);

    expect(classification.retryable).toBe(true);
    expect(classification.priority).toBe(
      ErrorClassifier.RECOVERY_PRIORITIES.MEDIUM
    );
    expect(classification.userImpact).toBe('minor');
    expect(classification.systemImpact).toBe('minimal');
    expect(classification.userMessageSuggested).toBe(
      'An error occurred with the anatomy visualizer.'
    );
    expect(classification.actionsSuggested).toEqual(
      expect.arrayContaining(['Try again', 'Refresh the page'])
    );
  });

  it('prioritizes blocking state errors for immediate recovery', () => {
    const stateError = AnatomyStateError.invalidStateTransition(
      'IDLE',
      'LOADING',
      'initialization'
    );
    const context = createContext({
      operation: 'initialization',
      component: 'VisualizerStateMachine',
    });

    const classification = ErrorClassifier.classify(stateError, context);

    expect(classification.category).toBe(ErrorClassifier.ERROR_CATEGORIES.STATE);
    expect(classification.priority).toBe(
      ErrorClassifier.RECOVERY_PRIORITIES.IMMEDIATE
    );
    expect(classification.userImpact).toBe('blocking');
    expect(classification.systemImpact).toBe('major');
    expect(classification.recommendedStrategy).toBe('fallback');
    expect(classification.fallbackAvailable).toBe(false);
  });

  describe('category-specific user guidance', () => {
    test.each([
      {
        name: 'validation errors',
        factory: () => {
          const error = new Error('Validation failed for anatomy input');
          error.name = 'ValidationError';
          return error;
        },
        category: ErrorClassifier.ERROR_CATEGORIES.VALIDATION,
        expectedMessage: 'Invalid input provided to the anatomy visualizer.',
        expectedSuggestions: [
          'Check your input and try again',
          'Ensure all required fields are filled correctly',
        ],
      },
      {
        name: 'permission errors',
        factory: () => new Error('permission denied for dataset'),
        category: ErrorClassifier.ERROR_CATEGORIES.PERMISSION,
        expectedMessage: 'You do not have permission to view this anatomy data.',
        expectedSuggestions: [
          'Contact your administrator for access',
          'Ensure you are logged in with the correct account',
        ],
      },
      {
        name: 'resource exhaustion errors',
        factory: () => new Error('memory quota exceeded when rendering'),
        category: ErrorClassifier.ERROR_CATEGORIES.RESOURCE,
        expectedMessage:
          'Insufficient resources to display the anatomy visualization.',
        expectedSuggestions: [
          'Close other applications to free up resources',
          'Try again with a smaller dataset',
        ],
      },
    ])('provides guidance for %s', ({
      factory,
      category,
      expectedMessage,
      expectedSuggestions,
    }) => {
      const error = factory();
      const classification = ErrorClassifier.classify(error, {
        operation: 'entity_selection',
        component: 'ControlsUI',
      });

      expect(classification.category).toBe(category);
      expect(classification.userMessageSuggested).toBe(expectedMessage);
      expectedSuggestions.forEach((suggestion) => {
        expect(classification.actionsSuggested).toEqual(
          expect.arrayContaining([suggestion])
        );
      });
      expect(classification.retryable).toBe(false);
    });
  });
});
