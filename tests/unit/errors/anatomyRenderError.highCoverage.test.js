import { describe, expect, it } from '@jest/globals';
import { AnatomyRenderError } from '../../../src/errors/anatomyRenderError.js';

/**
 * These tests focus on the bespoke helper logic baked into AnatomyRenderError.
 * Many existing suites assert that the error is thrown, but they rarely inspect
 * the rich metadata we attach to each variant. By validating the individual
 * factory helpers and the internal messaging utilities we can drive the module's
 * branch coverage close to 100%.
 */

describe('AnatomyRenderError', () => {
  describe('constructor', () => {
    it('populates default fields when options are omitted', () => {
      const error = new AnatomyRenderError('visualization failed');

      expect(error).toBeInstanceOf(AnatomyRenderError);
      expect(error.code).toBe('ANATOMY_RENDER_ERROR');
      expect(error.renderStage).toBeNull();
      expect(error.elementId).toBeNull();
      expect(error.renderData).toBeNull();
      expect(error.layoutType).toBeNull();
      expect(error.viewport).toBeNull();
      expect(error.userMessage).toBe(
        'Could not render the anatomy visualization.'
      );
      expect(error.suggestions).toEqual(
        expect.arrayContaining(['Try refreshing the page'])
      );
    });

    it('accepts extended metadata and preserves provided values', () => {
      const cause = new Error('boom');
      const error = new AnatomyRenderError('render hiccup', {
        renderStage: 'svg_creation',
        elementId: 'viz-root',
        renderData: { nodes: 3 },
        layoutType: 'force-directed',
        viewport: { width: 800, height: 600 },
        metadata: { attempt: 1 },
        cause,
        recoverable: false,
      });

      expect(error.renderStage).toBe('svg_creation');
      expect(error.elementId).toBe('viz-root');
      expect(error.renderData).toEqual({ nodes: 3 });
      expect(error.layoutType).toBe('force-directed');
      expect(error.viewport).toEqual({ width: 800, height: 600 });
      expect(error.context).toEqual(
        expect.objectContaining({
          context: 'Anatomy rendering at stage: svg_creation',
        })
      );
      expect(error.userMessage).toBe('Could not create the anatomy graphics.');
      expect(error.suggestions).toEqual(
        expect.arrayContaining(['Try using a different browser'])
      );
      expect(error.cause).toBe(cause);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('factory helpers', () => {
    it('creates a domElementNotFound error with high severity', () => {
      const error = AnatomyRenderError.domElementNotFound(
        'canvas-root',
        'initialization'
      );

      expect(error.code).toBe('DOM_ELEMENT_NOT_FOUND');
      expect(error.renderStage).toBe('initialization');
      expect(error.elementId).toBe('canvas-root');
      expect(error.severity).toBe('HIGH');
      expect(error.recoverable).toBe(false);
      expect(error.userMessage).toBe(
        'The anatomy visualization container is not available.'
      );
    });

    it('uses the default initialization stage when none is provided', () => {
      const error = AnatomyRenderError.domElementNotFound('missing-root');

      expect(error.renderStage).toBe('initialization');
      expect(error.elementId).toBe('missing-root');
    });

    it('creates an svgRenderingFailed error that captures the cause', () => {
      const cause = new Error('DOMException');
      const error = AnatomyRenderError.svgRenderingFailed(
        'path creation',
        cause,
        {
          segments: 5,
        }
      );

      expect(error.code).toBe('SVG_RENDERING_FAILED');
      expect(error.renderStage).toBe('svg_creation');
      expect(error.renderData).toEqual({ segments: 5 });
      expect(error.cause).toBe(cause);
      expect(error.recoverable).toBe(true);
    });

    it('falls back to an unknown-error message when SVG cause is missing', () => {
      const error = AnatomyRenderError.svgRenderingFailed('paint', undefined, {
        segments: 0,
      });

      expect(error.message).toContain('Unknown error');
      expect(error.cause).toBeNull();
    });

    it('creates a layoutCalculationFailed error with metadata', () => {
      const cause = new Error('overflow');
      const error = AnatomyRenderError.layoutCalculationFailed(
        'grid',
        { limbs: 4 },
        cause
      );

      expect(error.code).toBe('LAYOUT_CALCULATION_FAILED');
      expect(error.layoutType).toBe('grid');
      expect(error.renderData).toEqual({ limbs: 4 });
      expect(error.cause).toBe(cause);
      expect(error.userMessage).toBe(
        'Could not arrange the anatomy visualization layout.'
      );
    });

    it('creates a viewportConfigError with viewport details', () => {
      const viewport = { width: 640, height: 480 };
      const error = AnatomyRenderError.viewportConfigError(
        'invalid dimensions',
        viewport
      );

      expect(error.code).toBe('VIEWPORT_CONFIG_ERROR');
      expect(error.renderStage).toBe('viewport_setup');
      expect(error.viewport).toBe(viewport);
      expect(error.userMessage).toBe(
        'Could not configure the visualization display area.'
      );
    });

    it('creates an interactionSetupFailed error with metadata', () => {
      const cause = new Error('listener error');
      const error = AnatomyRenderError.interactionSetupFailed('zoom', cause);

      expect(error.code).toBe('INTERACTION_SETUP_FAILED');
      expect(error.renderStage).toBe('interaction_setup');
      expect(error.metadata).toEqual({ interactionType: 'zoom' });
      expect(error.userMessage).toBe(
        'Some interactive features may not work properly.'
      );
    });

    it('uses a friendly fallback when interaction setup lacks a cause', () => {
      const error = AnatomyRenderError.interactionSetupFailed('pan');

      expect(error.message).toContain('Unknown error');
      expect(error.cause).toBeNull();
    });

    it('creates a performanceIssue error that records metrics', () => {
      const error = AnatomyRenderError.performanceIssue('frame drops', {
        fps: 12,
      });

      expect(error.code).toBe('RENDERING_PERFORMANCE_ISSUE');
      expect(error.renderStage).toBe('performance_monitoring');
      expect(error.metadata).toEqual({
        performanceIssue: 'frame drops',
        metrics: { fps: 12 },
      });
      expect(error.userMessage).toBe(
        'The anatomy visualization is running slowly.'
      );
    });
  });

  describe('_getUserMessage', () => {
    it('returns stage-specific user messaging', () => {
      expect(AnatomyRenderError._getUserMessage('initialization')).toBe(
        'Could not initialize the anatomy visualization.'
      );
      expect(AnatomyRenderError._getUserMessage('svg_creation')).toBe(
        'Could not create the anatomy graphics.'
      );
      expect(AnatomyRenderError._getUserMessage('layout_calculation')).toBe(
        'Could not arrange the anatomy visualization.'
      );
      expect(AnatomyRenderError._getUserMessage('viewport_setup')).toBe(
        'Could not configure the display area.'
      );
      expect(AnatomyRenderError._getUserMessage('interaction_setup')).toBe(
        'Interactive features may not work properly.'
      );
      expect(AnatomyRenderError._getUserMessage('performance_monitoring')).toBe(
        'The visualization is running slowly.'
      );
      expect(AnatomyRenderError._getUserMessage('unknown_stage')).toBe(
        'Could not render the anatomy visualization.'
      );
    });
  });

  describe('_getSuggestions', () => {
    it('returns tailored recovery suggestions for each stage', () => {
      expect(AnatomyRenderError._getSuggestions('initialization')).toEqual(
        expect.arrayContaining([
          'Ensure your browser supports modern web features',
          'Check that JavaScript is enabled',
          'Try refreshing the page',
        ])
      );
      expect(AnatomyRenderError._getSuggestions('svg_creation')).toEqual(
        expect.arrayContaining([
          'Your browser may not support SVG graphics',
          'Try using a different browser',
          'Try refreshing the page',
        ])
      );
      expect(AnatomyRenderError._getSuggestions('layout_calculation')).toEqual(
        expect.arrayContaining([
          'Try selecting a different entity',
          'The anatomy structure may be too complex',
          'Try refreshing the page',
        ])
      );
      expect(AnatomyRenderError._getSuggestions('viewport_setup')).toEqual(
        expect.arrayContaining([
          'Try resizing your browser window',
          'Check your browser zoom level',
          'Try refreshing the page',
        ])
      );
      expect(AnatomyRenderError._getSuggestions('interaction_setup')).toEqual(
        expect.arrayContaining([
          'The visualization is still viewable',
          'Some interactive features may be unavailable',
          'Try refreshing the page',
        ])
      );
      expect(
        AnatomyRenderError._getSuggestions('performance_monitoring')
      ).toEqual(
        expect.arrayContaining([
          'Try selecting an entity with simpler anatomy',
          'Close other browser tabs',
          'The visualization may respond slowly',
        ])
      );
      expect(AnatomyRenderError._getSuggestions('something_else')).toEqual([
        'Try refreshing the page',
        'Try selecting a different entity',
        'Wait a moment and try again',
      ]);
    });
  });
});
