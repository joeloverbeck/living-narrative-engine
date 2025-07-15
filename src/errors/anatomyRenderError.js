/**
 * @file Error class for anatomy rendering operations
 * @see src/errors/anatomyVisualizationError.js
 */

import { AnatomyVisualizationError } from './anatomyVisualizationError.js';

/**
 * Error thrown when anatomy visualization rendering fails.
 * Used for SVG rendering issues, layout calculation problems,
 * DOM manipulation failures, and visual display errors.
 *
 * @class
 * @augments {AnatomyVisualizationError}
 */
export class AnatomyRenderError extends AnatomyVisualizationError {
  /**
   * Create a new AnatomyRenderError instance.
   *
   * @param {string} message - The error message
   * @param {object} options - Error options
   * @param {string} options.renderStage - Stage of rendering that failed
   * @param {string} options.elementId - DOM element ID that failed
   * @param {object} options.renderData - Data being rendered when error occurred
   * @param {string} options.layoutType - Layout algorithm being used
   * @param {object} options.viewport - Viewport configuration
   * @param {...*} options.rest - Additional options passed to parent class
   */
  constructor(message, options = {}) {
    const {
      renderStage,
      elementId,
      renderData,
      layoutType,
      viewport,
      ...parentOptions
    } = options;

    super(message, {
      code: 'ANATOMY_RENDER_ERROR',
      severity: 'MEDIUM',
      context: `Anatomy rendering at stage: ${renderStage || 'unknown'}`,
      userMessage: AnatomyRenderError._getUserMessage(renderStage),
      suggestions: AnatomyRenderError._getSuggestions(renderStage),
      ...parentOptions
    });

    this.name = 'AnatomyRenderError';
    this.renderStage = renderStage || null;
    this.elementId = elementId || null;
    this.renderData = renderData || null;
    this.layoutType = layoutType || null;
    this.viewport = viewport || null;
  }

  /**
   * Create an error for DOM element not found
   *
   * @param {string} elementId - Missing DOM element ID
   * @param {string} renderStage - Stage where element was needed
   * @returns {AnatomyRenderError} Configured error instance
   */
  static domElementNotFound(elementId, renderStage = 'initialization') {
    return new AnatomyRenderError(
      `Required DOM element not found: ${elementId}`,
      {
        code: 'DOM_ELEMENT_NOT_FOUND',
        renderStage,
        elementId,
        severity: 'HIGH',
        recoverable: false,
        userMessage: 'The anatomy visualization container is not available.',
        suggestions: [
          'Refresh the page to reload the interface',
          'Ensure the anatomy visualizer is properly initialized',
          'Check that the required HTML elements are present'
        ]
      }
    );
  }

  /**
   * Create an error for SVG rendering failure
   *
   * @param {string} svgOperation - SVG operation that failed
   * @param {Error} cause - Original error that caused the failure
   * @param {object} renderData - Data being rendered
   * @returns {AnatomyRenderError} Configured error instance
   */
  static svgRenderingFailed(svgOperation, cause, renderData = null) {
    return new AnatomyRenderError(
      `SVG rendering failed during ${svgOperation}: ${cause?.message || 'Unknown error'}`,
      {
        code: 'SVG_RENDERING_FAILED',
        renderStage: 'svg_creation',
        renderData,
        cause,
        severity: 'HIGH',
        recoverable: true,
        userMessage: 'Could not create the anatomy visualization graphics.',
        suggestions: [
          'Try refreshing the page',
          'Your browser may not support required graphics features',
          'Try using a different browser if the problem persists'
        ]
      }
    );
  }

  /**
   * Create an error for layout calculation failure
   *
   * @param {string} layoutType - Type of layout that failed
   * @param {object} anatomyData - Anatomy data being laid out
   * @param {Error} cause - Original error
   * @returns {AnatomyRenderError} Configured error instance
   */
  static layoutCalculationFailed(layoutType, anatomyData, cause) {
    return new AnatomyRenderError(
      `Layout calculation failed for ${layoutType} layout: ${cause?.message || 'Unknown error'}`,
      {
        code: 'LAYOUT_CALCULATION_FAILED',
        renderStage: 'layout_calculation',
        layoutType,
        renderData: anatomyData,
        cause,
        severity: 'MEDIUM',
        recoverable: true,
        userMessage: 'Could not arrange the anatomy visualization layout.',
        suggestions: [
          'Try selecting a different entity with simpler anatomy',
          'The anatomy structure may be too complex to display',
          'Try again with a different layout if available'
        ]
      }
    );
  }

  /**
   * Create an error for viewport configuration issues
   *
   * @param {string} issue - Specific viewport issue
   * @param {object} viewport - Viewport configuration
   * @returns {AnatomyRenderError} Configured error instance
   */
  static viewportConfigError(issue, viewport) {
    return new AnatomyRenderError(
      `Viewport configuration error: ${issue}`,
      {
        code: 'VIEWPORT_CONFIG_ERROR',
        renderStage: 'viewport_setup',
        viewport,
        severity: 'MEDIUM',
        recoverable: true,
        userMessage: 'Could not configure the visualization display area.',
        suggestions: [
          'Try resizing your browser window',
          'Refresh the page to reset the display',
          'Check your browser zoom level'
        ]
      }
    );
  }

  /**
   * Create an error for interaction setup failure
   *
   * @param {string} interactionType - Type of interaction that failed
   * @param {Error} cause - Original error
   * @returns {AnatomyRenderError} Configured error instance
   */
  static interactionSetupFailed(interactionType, cause) {
    return new AnatomyRenderError(
      `Failed to setup ${interactionType} interaction: ${cause?.message || 'Unknown error'}`,
      {
        code: 'INTERACTION_SETUP_FAILED',
        renderStage: 'interaction_setup',
        metadata: { interactionType },
        cause,
        severity: 'LOW',
        recoverable: true,
        userMessage: 'Some interactive features may not work properly.',
        suggestions: [
          'The visualization is still viewable',
          'Try refreshing to restore interactive features',
          'Some mouse/touch interactions may be unavailable'
        ]
      }
    );
  }

  /**
   * Create an error for performance issues during rendering
   *
   * @param {string} performanceIssue - Type of performance issue
   * @param {object} metrics - Performance metrics
   * @returns {AnatomyRenderError} Configured error instance
   */
  static performanceIssue(performanceIssue, metrics) {
    return new AnatomyRenderError(
      `Rendering performance issue: ${performanceIssue}`,
      {
        code: 'RENDERING_PERFORMANCE_ISSUE',
        renderStage: 'performance_monitoring',
        metadata: { performanceIssue, metrics },
        severity: 'LOW',
        recoverable: true,
        userMessage: 'The anatomy visualization is running slowly.',
        suggestions: [
          'Try selecting an entity with simpler anatomy',
          'Close other browser tabs to free up memory',
          'The visualization may take longer to respond'
        ]
      }
    );
  }

  /**
   * Get user-friendly message based on render stage
   *
   * @private
   * @param {string} renderStage - Stage of rendering that failed
   * @returns {string} User-friendly message
   */
  static _getUserMessage(renderStage) {
    switch (renderStage) {
      case 'initialization':
        return 'Could not initialize the anatomy visualization.';
      case 'svg_creation':
        return 'Could not create the anatomy graphics.';
      case 'layout_calculation':
        return 'Could not arrange the anatomy visualization.';
      case 'viewport_setup':
        return 'Could not configure the display area.';
      case 'interaction_setup':
        return 'Interactive features may not work properly.';
      case 'performance_monitoring':
        return 'The visualization is running slowly.';
      default:
        return 'Could not render the anatomy visualization.';
    }
  }

  /**
   * Get suggestions based on render stage
   *
   * @private
   * @param {string} renderStage - Stage of rendering that failed
   * @returns {Array<string>} Recovery suggestions
   */
  static _getSuggestions(renderStage) {
    const baseSuggestions = ['Try refreshing the page'];

    switch (renderStage) {
      case 'initialization':
        return [
          ...baseSuggestions,
          'Ensure your browser supports modern web features',
          'Check that JavaScript is enabled'
        ];
      case 'svg_creation':
        return [
          ...baseSuggestions,
          'Your browser may not support SVG graphics',
          'Try using a different browser'
        ];
      case 'layout_calculation':
        return [
          'Try selecting a different entity',
          'The anatomy structure may be too complex',
          ...baseSuggestions
        ];
      case 'viewport_setup':
        return [
          'Try resizing your browser window',
          'Check your browser zoom level',
          ...baseSuggestions
        ];
      case 'interaction_setup':
        return [
          'The visualization is still viewable',
          'Some interactive features may be unavailable',
          ...baseSuggestions
        ];
      case 'performance_monitoring':
        return [
          'Try selecting an entity with simpler anatomy',
          'Close other browser tabs',
          'The visualization may respond slowly'
        ];
      default:
        return [
          ...baseSuggestions,
          'Try selecting a different entity',
          'Wait a moment and try again'
        ];
    }
  }
}