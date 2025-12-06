/**
 * @file Unit tests for ErrorClassifier
 * @description Comprehensive tests for error classification, categorization, and handling strategies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ErrorClassifier } from '../../../../src/domUI/visualizer/ErrorClassifier.js';
import { AnatomyVisualizationError } from '../../../../src/errors/anatomyVisualizationError.js';
import { AnatomyDataError } from '../../../../src/errors/anatomyDataError.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';
import { AnatomyStateError } from '../../../../src/errors/anatomyStateError.js';

describe('ErrorClassifier', () => {
  describe('Static Properties', () => {
    it('should define ERROR_CATEGORIES with all expected values', () => {
      expect(ErrorClassifier.ERROR_CATEGORIES).toEqual({
        DATA: 'data',
        RENDER: 'render',
        STATE: 'state',
        NETWORK: 'network',
        VALIDATION: 'validation',
        PERMISSION: 'permission',
        RESOURCE: 'resource',
        UNKNOWN: 'unknown',
      });
    });

    it('should define ERROR_DOMAINS with all expected values', () => {
      expect(ErrorClassifier.ERROR_DOMAINS).toEqual({
        ANATOMY: 'anatomy',
        UI: 'ui',
        SYSTEM: 'system',
        NETWORK: 'network',
        USER: 'user',
      });
    });

    it('should define RECOVERY_PRIORITIES with all expected values', () => {
      expect(ErrorClassifier.RECOVERY_PRIORITIES).toEqual({
        IMMEDIATE: 'immediate',
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
        DEFERRED: 'deferred',
      });
    });
  });

  describe('classify()', () => {
    describe('Basic Classification', () => {
      it('should classify a basic error with minimal context', () => {
        const error = new Error('Test error');
        const classification = ErrorClassifier.classify(error);

        expect(classification).toMatchObject({
          errorType: 'Error',
          errorMessage: 'Test error',
          errorStack: expect.any(String),
          timestamp: expect.any(String),
          category: 'unknown',
          domain: 'system',
          severity: 'LOW',
          recoverable: true,
          retryable: false,
          priority: 'low',
          operation: 'unknown',
          component: 'unknown',
          userImpact: 'minimal',
          systemImpact: 'minimal',
          recommendedStrategy: 'fallback',
          fallbackAvailable: false,
          userMessageSuggested:
            'An error occurred with the anatomy visualizer.',
          actionsSuggested: expect.arrayContaining(['Refresh the page']),
        });
      });

      it('should include context information when provided', () => {
        const error = new Error('Test error');
        const context = {
          operation: 'test_operation',
          component: 'TestComponent',
          data: { testData: true },
        };
        const classification = ErrorClassifier.classify(error, context);

        expect(classification.operation).toBe('test_operation');
        expect(classification.component).toBe('TestComponent');
      });
    });

    describe('AnatomyVisualizationError Classification', () => {
      it('should classify AnatomyDataError correctly', () => {
        const error = new AnatomyDataError('Data error', {
          code: 'MISSING_ANATOMY_PARTS',
          severity: 'HIGH',
          context: 'Loading anatomy',
          recoverable: true,
          userMessage: 'Custom user message',
          suggestions: ['Try again', 'Select different entity'],
        });

        const classification = ErrorClassifier.classify(error);

        expect(classification).toMatchObject({
          errorType: 'AnatomyDataError',
          category: 'data',
          domain: 'anatomy',
          severity: 'HIGH',
          recoverable: true,
          retryable: true,
          anatomyErrorDetails: {
            code: 'MISSING_ANATOMY_PARTS',
            context: expect.objectContaining({
              code: 'MISSING_ANATOMY_PARTS',
              context: 'Loading anatomy',
              severity: 'HIGH',
              recoverable: true,
              userMessage: 'Custom user message',
              suggestions: ['Try again', 'Select different entity'],
            }),
            userMessage: 'Custom user message',
            suggestions: ['Try again', 'Select different entity'],
          },
        });
      });

      it('should classify AnatomyRenderError correctly', () => {
        const error = new AnatomyRenderError('Render error', {
          code: 'SVG_RENDERING_FAILED',
          severity: 'MEDIUM',
        });

        const classification = ErrorClassifier.classify(error);

        expect(classification).toMatchObject({
          errorType: 'AnatomyRenderError',
          category: 'render',
          domain: 'anatomy',
          severity: 'MEDIUM',
          retryable: true,
          fallbackAvailable: true,
        });
      });

      it('should classify AnatomyStateError correctly', () => {
        const error = new AnatomyStateError('State error', {
          severity: 'CRITICAL',
        });

        const classification = ErrorClassifier.classify(error);

        expect(classification).toMatchObject({
          errorType: 'AnatomyStateError',
          category: 'state',
          domain: 'anatomy',
          severity: 'CRITICAL',
          systemImpact: 'major',
        });
      });
    });

    describe('Error Category Detection', () => {
      it('should detect network errors', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('network');
        expect(classification.domain).toBe('network');
      });

      it('should detect validation errors by name', () => {
        const error = new Error('Invalid input');
        error.name = 'ValidationError';
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('validation');
      });

      it('should detect validation errors by message', () => {
        const error = new Error('Schema validation failed');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('validation');
      });

      it('should detect permission errors', () => {
        const error = new Error('permission denied');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('permission');
      });

      it('should detect unauthorized errors', () => {
        const error = new Error('User unauthorized');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('permission');
      });

      it('should detect resource errors - memory', () => {
        const error = new Error('Out of memory');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('resource');
      });

      it('should detect resource errors - quota', () => {
        const error = new Error('Storage quota exceeded');
        const classification = ErrorClassifier.classify(error);
        expect(classification.category).toBe('resource');
      });
    });

    describe('Domain Detection', () => {
      it('should detect UI domain from component context', () => {
        const error = new Error('UI error');
        const context = { component: 'UIRenderer' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.domain).toBe('ui');
      });

      it('should detect UI domain from Renderer component', () => {
        const error = new Error('Render error');
        const context = { component: 'AnatomyRenderer' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.domain).toBe('ui');
      });

      it('should detect UI domain from Dom component', () => {
        const error = new Error('DOM error');
        const context = { component: 'DomHelper' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.domain).toBe('ui');
      });

      it('should detect user domain from error message', () => {
        const error = new Error('Invalid user input');
        const classification = ErrorClassifier.classify(error);
        expect(classification.domain).toBe('user');
      });
    });

    describe('Severity Determination', () => {
      it('should classify TypeError in initialization as CRITICAL', () => {
        const error = new TypeError('Cannot read property');
        const context = { operation: 'initialization' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.severity).toBe('CRITICAL');
      });

      it('should classify core functionality errors as HIGH', () => {
        const operations = ['entity_selection', 'anatomy_loading', 'rendering'];
        operations.forEach((operation) => {
          const error = new Error('Test error');
          const context = { operation };
          const classification = ErrorClassifier.classify(error, context);
          expect(classification.severity).toBe('HIGH');
        });
      });

      it('should classify UI component errors as MEDIUM', () => {
        const error = new Error('UI error');
        const context = { component: 'UIComponent' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.severity).toBe('MEDIUM');
      });

      it('should default to LOW severity', () => {
        const error = new Error('Generic error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.severity).toBe('LOW');
      });
    });

    describe('Recoverability Determination', () => {
      it('should mark network errors as recoverable', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recoverable).toBe(true);
      });

      it('should mark validation errors as recoverable', () => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        const classification = ErrorClassifier.classify(error);
        expect(classification.recoverable).toBe(true);
      });

      it('should mark ReferenceError as not recoverable', () => {
        const error = new ReferenceError('Variable not defined');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recoverable).toBe(false);
      });

      it('should mark TypeError (non-network) as not recoverable', () => {
        const error = new TypeError('Cannot read property');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recoverable).toBe(false);
      });

      it('should default unknown errors to recoverable', () => {
        const error = new Error('Unknown error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recoverable).toBe(true);
      });
    });

    describe('Retryability Determination', () => {
      it('should mark network errors as retryable', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(true);
      });

      it('should mark timeout errors as retryable', () => {
        const error = new Error('Request timeout');
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(true);
      });

      it('should mark MISSING_ANATOMY_PARTS as retryable', () => {
        const error = new AnatomyDataError('Missing parts', {
          code: 'MISSING_ANATOMY_PARTS',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(true);
      });

      it('should mark SVG_RENDERING_FAILED as retryable', () => {
        const error = new AnatomyRenderError('SVG failed', {
          code: 'SVG_RENDERING_FAILED',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(true);
      });

      it('should mark validation errors as not retryable', () => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(false);
      });

      it('should mark permission errors as not retryable', () => {
        const error = new Error('Permission denied');
        const classification = ErrorClassifier.classify(error);
        expect(classification.retryable).toBe(false);
      });
    });

    describe('Priority Determination', () => {
      it('should assign IMMEDIATE priority to CRITICAL errors', () => {
        const error = new AnatomyStateError('Critical error', {
          severity: 'CRITICAL',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.priority).toBe('immediate');
      });

      it('should assign IMMEDIATE priority to HIGH severity with blocking impact', () => {
        const error = new TypeError('Blocking error');
        const context = { operation: 'initialization' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.priority).toBe('immediate');
      });

      it('should assign HIGH priority to HIGH severity errors', () => {
        const error = new AnatomyDataError('Data error', {
          severity: 'HIGH',
        });
        const context = { operation: 'data_loading' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.priority).toBe('high');
      });

      it('should assign HIGH priority to MEDIUM severity with significant impact', () => {
        const error = new Error('Significant error');
        const context = { operation: 'entity_selection' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.priority).toBe('high');
      });

      it('should assign HIGH priority to MEDIUM severity with significant impact', () => {
        const error = new Error('Significant error with medium severity');
        const context = {
          operation: 'entity_selection', // This gives significant user impact
          component: 'UIComponent', // This gives MEDIUM severity
        };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.priority).toBe('high');
      });

      it('should assign HIGH priority when AnatomyVisualizationError reports MEDIUM severity with significant impact', () => {
        const error = new AnatomyDataError('Medium severity anatomy issue', {
          severity: 'MEDIUM',
          recoverable: true,
        });
        const context = { operation: 'entity_selection' };
        const classification = ErrorClassifier.classify(error, context);

        expect(classification.severity).toBe('MEDIUM');
        expect(classification.userImpact).toBe('significant');
        expect(classification.priority).toBe('high');
      });

      it('should assign MEDIUM priority to MEDIUM severity errors', () => {
        const error = new AnatomyRenderError('Render error', {
          severity: 'MEDIUM',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.priority).toBe('medium');
      });

      it('should assign LOW priority to LOW severity errors', () => {
        const error = new Error('Minor error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.priority).toBe('low');
      });
    });

    describe('User Impact Assessment', () => {
      it('should assess blocking impact for initialization errors', () => {
        const error = new Error('Init error');
        const context = { operation: 'initialization' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.userImpact).toBe('blocking');
      });

      it('should assess significant impact for core features', () => {
        const operations = ['entity_selection', 'anatomy_loading'];
        operations.forEach((operation) => {
          const error = new Error('Feature error');
          const context = { operation };
          const classification = ErrorClassifier.classify(error, context);
          expect(classification.userImpact).toBe('significant');
        });
      });

      it('should assess moderate impact for rendering errors', () => {
        const error = new Error('Render error');
        const context = { operation: 'rendering' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.userImpact).toBe('moderate');
      });

      it('should assess moderate impact for AnatomyRenderError', () => {
        const error = new AnatomyRenderError('Render failed');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userImpact).toBe('moderate');
      });

      it('should assess minor impact for UI components', () => {
        const error = new Error('UI error');
        const context = { component: 'UIWidget' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.userImpact).toBe('minor');
      });

      it('should default to minimal impact', () => {
        const error = new Error('Generic error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userImpact).toBe('minimal');
      });
    });

    describe('System Impact Assessment', () => {
      it('should assess major impact for state errors', () => {
        const error = new AnatomyStateError('State corruption');
        const classification = ErrorClassifier.classify(error);
        expect(classification.systemImpact).toBe('major');
      });

      it('should assess major impact for initialization errors', () => {
        const error = new Error('Init failed');
        const context = { operation: 'initialization' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.systemImpact).toBe('major');
      });

      it('should assess moderate impact for data errors', () => {
        const error = new AnatomyDataError('Data missing');
        const classification = ErrorClassifier.classify(error);
        expect(classification.systemImpact).toBe('moderate');
      });

      it('should assess minor impact for render errors', () => {
        const error = new AnatomyRenderError('Render issue');
        const classification = ErrorClassifier.classify(error);
        expect(classification.systemImpact).toBe('minor');
      });

      it('should default to minimal impact', () => {
        const error = new Error('Generic error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.systemImpact).toBe('minimal');
      });
    });

    describe('Strategy Recommendation', () => {
      it('should recommend retry for retryable errors', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recommendedStrategy).toBe('retry');
      });

      it('should recommend fallback for recoverable non-retryable errors', () => {
        const error = new Error('Recoverable error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recommendedStrategy).toBe('fallback');
      });

      it('should recommend user intervention for non-recoverable errors', () => {
        const error = new ReferenceError('Not defined');
        const classification = ErrorClassifier.classify(error);
        expect(classification.recommendedStrategy).toBe('user_intervention');
      });
    });

    describe('Fallback Availability', () => {
      it('should indicate fallback available for render errors', () => {
        const error = new AnatomyRenderError('Render failed');
        const classification = ErrorClassifier.classify(error);
        expect(classification.fallbackAvailable).toBe(true);
      });

      it('should indicate fallback available for MISSING_ANATOMY_PARTS', () => {
        const error = new AnatomyDataError('Parts missing', {
          code: 'MISSING_ANATOMY_PARTS',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.fallbackAvailable).toBe(true);
      });

      it('should indicate fallback available for MISSING_ANATOMY_DATA', () => {
        const error = new AnatomyDataError('Data missing', {
          code: 'MISSING_ANATOMY_DATA',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.fallbackAvailable).toBe(true);
      });

      it('should indicate no fallback for other errors', () => {
        const error = new Error('Generic error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.fallbackAvailable).toBe(false);
      });
    });

    describe('User Message Generation', () => {
      it('should use custom message from AnatomyVisualizationError', () => {
        const error = new AnatomyDataError('Error', {
          userMessage: 'Custom message for user',
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'Custom message for user'
        );
      });

      it('should generate critical error message', () => {
        const error = new TypeError('Critical failure');
        const context = { operation: 'initialization' };
        const classification = ErrorClassifier.classify(error, context);
        expect(classification.userMessageSuggested).toBe(
          'A critical error occurred. Please refresh the page.'
        );
      });

      it('should generate network error message', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'Network connection issue. Please check your internet connection.'
        );
      });

      it('should generate validation error message', () => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'Invalid input provided to the anatomy visualizer.'
        );
      });

      it('should generate permission error message', () => {
        const error = new Error('permission denied');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'You do not have permission to view this anatomy data.'
        );
      });

      it('should generate resource error message', () => {
        const error = new Error('Out of memory');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'Insufficient resources to display the anatomy visualization.'
        );
      });

      it('should generate default error message', () => {
        const error = new Error('Unknown error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.userMessageSuggested).toBe(
          'An error occurred with the anatomy visualizer.'
        );
      });
    });

    describe('Action Suggestions Generation', () => {
      it('should use custom suggestions from AnatomyVisualizationError', () => {
        const customSuggestions = ['Custom action 1', 'Custom action 2'];
        const error = new AnatomyDataError('Error', {
          suggestions: customSuggestions,
        });
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual(customSuggestions);
      });

      it('should include retry suggestion for retryable errors', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toContain('Try again');
      });

      it('should generate network error suggestions', () => {
        const error = new TypeError('Failed to fetch');
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual(
          expect.arrayContaining([
            'Try again',
            'Check your internet connection',
            'Try again in a moment',
          ])
        );
      });

      it('should generate validation error suggestions', () => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual([
          'Check your input and try again',
          'Ensure all required fields are filled correctly',
        ]);
      });

      it('should generate permission error suggestions', () => {
        const error = new Error('permission denied');
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual([
          'Contact your administrator for access',
          'Ensure you are logged in with the correct account',
        ]);
      });

      it('should generate resource error suggestions', () => {
        const error = new Error('Out of memory');
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual([
          'Close other applications to free up resources',
          'Try again with a smaller dataset',
        ]);
      });

      it('should generate default suggestions', () => {
        const error = new Error('Unknown error');
        const classification = ErrorClassifier.classify(error);
        expect(classification.actionsSuggested).toEqual(
          expect.arrayContaining([
            'Refresh the page',
            'Contact support if the problem persists',
          ])
        );
      });
    });
  });

  describe('shouldReport()', () => {
    it('should report critical errors', () => {
      const error = new AnatomyStateError('Critical', { severity: 'CRITICAL' });
      const shouldReport = ErrorClassifier.shouldReport(error);
      expect(shouldReport).toBe(true);
    });

    it('should report high severity errors with major system impact', () => {
      const error = new AnatomyDataError('High severity', {
        severity: 'HIGH',
      });
      const context = { operation: 'initialization' };
      const shouldReport = ErrorClassifier.shouldReport(error, context);
      expect(shouldReport).toBe(true);
    });

    it('should report unknown category errors', () => {
      const error = new Error('Unknown error type');
      const shouldReport = ErrorClassifier.shouldReport(error);
      expect(shouldReport).toBe(true);
    });

    it('should report low severity errors with unknown category', () => {
      // Note: All unknown category errors are reported for investigation
      const error = new Error('Minor issue');
      const shouldReport = ErrorClassifier.shouldReport(error);
      expect(shouldReport).toBe(true);
    });

    it('should not report medium severity errors with minor impact', () => {
      const error = new AnatomyRenderError('Render issue', {
        severity: 'MEDIUM',
      });
      const shouldReport = ErrorClassifier.shouldReport(error);
      expect(shouldReport).toBe(false);
    });

    it('should not report low severity validation errors', () => {
      const error = new Error('Invalid data');
      error.name = 'ValidationError';
      const shouldReport = ErrorClassifier.shouldReport(error);
      expect(shouldReport).toBe(false);
    });
  });

  describe('getUrgency()', () => {
    it('should return urgent for critical errors', () => {
      const error = new AnatomyStateError('Critical', { severity: 'CRITICAL' });
      const urgency = ErrorClassifier.getUrgency(error);
      expect(urgency).toBe('urgent');
    });

    it('should return high for blocking user impact', () => {
      const error = new Error('Blocking error');
      const context = { operation: 'initialization' };
      const urgency = ErrorClassifier.getUrgency(error, context);
      expect(urgency).toBe('high');
    });

    it('should return high for major system impact', () => {
      const error = new AnatomyStateError('State error');
      const urgency = ErrorClassifier.getUrgency(error);
      expect(urgency).toBe('high');
    });

    it('should return medium for significant user impact', () => {
      const error = new Error('Significant error');
      const context = { operation: 'entity_selection' };
      const urgency = ErrorClassifier.getUrgency(error, context);
      expect(urgency).toBe('medium');
    });

    it('should return low for errors with no special impact', () => {
      const error = new AnatomyDataError('Data error', { severity: 'HIGH' });
      const context = { operation: 'data_loading' };
      const urgency = ErrorClassifier.getUrgency(error, context);
      expect(urgency).toBe('low');
    });

    it('should return low for other errors', () => {
      const error = new Error('Minor error');
      const urgency = ErrorClassifier.getUrgency(error);
      expect(urgency).toBe('low');
    });
  });
});
