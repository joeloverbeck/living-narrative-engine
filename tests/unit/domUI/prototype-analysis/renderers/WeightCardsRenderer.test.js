/**
 * @file Unit tests for WeightCardsRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WeightCardsRenderer from '../../../../../src/domUI/prototype-analysis/renderers/WeightCardsRenderer.js';

describe('WeightCardsRenderer', () => {
  let renderer;
  let mockLogger;

  function createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }

  function createMockElements() {
    return {
      prototypeCardsContainer: document.createElement('div'),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new WeightCardsRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[WeightCardsRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new WeightCardsRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new WeightCardsRenderer({ logger: {} })).toThrow();
    });
  });

  describe('renderPrototypeWeightCards', () => {
    describe('empty state', () => {
      it('should render empty message when prototypeWeightSummaries is null', () => {
        const elements = createMockElements();

        renderer.renderPrototypeWeightCards(null, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('No prototypes flagged');
        expect(elements.prototypeCardsContainer.querySelector('.prototype-cards-empty')).not.toBeNull();
      });

      it('should render empty message when prototypeWeightSummaries is undefined', () => {
        const elements = createMockElements();

        renderer.renderPrototypeWeightCards(undefined, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('No prototypes flagged');
      });

      it('should render empty message when prototypeWeightSummaries is empty array', () => {
        const elements = createMockElements();

        renderer.renderPrototypeWeightCards([], elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('No prototypes flagged');
      });

      it('should render empty message when prototypeWeightSummaries is not an array', () => {
        const elements = createMockElements();

        renderer.renderPrototypeWeightCards('not an array', elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('No prototypes flagged');
      });

      it('should handle null container', () => {
        const elements = { prototypeCardsContainer: null };

        expect(() => renderer.renderPrototypeWeightCards([], elements)).not.toThrow();
      });
    });

    describe('card rendering', () => {
      it('should render a single prototype card', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto_test',
            reason: 'hub',
            topAxes: [{ axis: 'strength', weight: 0.5 }],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.querySelectorAll('.prototype-card').length).toBe(1);
        expect(elements.prototypeCardsContainer.innerHTML).toContain('proto_test');
      });

      it('should render multiple prototype cards', () => {
        const elements = createMockElements();
        const summaries = [
          { prototypeId: 'proto_1', reason: 'hub', topAxes: [] },
          { prototypeId: 'proto_2', reason: 'extreme_projection', topAxes: [] },
          { prototypeId: 'proto_3', reason: 'coverage_gap', topAxes: [] },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.querySelectorAll('.prototype-card').length).toBe(3);
      });

      it('should clear previous content before rendering', () => {
        const elements = createMockElements();
        elements.prototypeCardsContainer.innerHTML = '<div>Previous content</div>';

        const summaries = [{ prototypeId: 'proto_new', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).not.toContain('Previous content');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('proto_new');
      });
    });

    describe('card structure', () => {
      it('should include prototype ID in header', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'my_prototype', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const prototypeId = elements.prototypeCardsContainer.querySelector('.prototype-id');
        expect(prototypeId).not.toBeNull();
        expect(prototypeId.textContent).toBe('my_prototype');
      });

      it('should include reason badge with correct class', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'extreme_projection', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const badge = elements.prototypeCardsContainer.querySelector('.prototype-reason-badge');
        expect(badge).not.toBeNull();
        expect(badge.classList.contains('reason-extreme_projection')).toBe(true);
      });

      it('should include card with reason class', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'coverage_gap', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const card = elements.prototypeCardsContainer.querySelector('.prototype-card');
        expect(card.classList.contains('reason-coverage_gap')).toBe(true);
      });
    });

    describe('reason label formatting', () => {
      it('should format high_reconstruction_error correctly', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'high_reconstruction_error', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('High Recon. Error');
      });

      it('should format extreme_projection correctly', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'extreme_projection', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Extreme Projection');
      });

      it('should format hub correctly', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Hub Prototype');
      });

      it('should format multi_axis_conflict correctly', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'multi_axis_conflict', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Multi-Axis Conflict');
      });

      it('should format coverage_gap correctly', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'coverage_gap', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Coverage Gap');
      });

      it('should format unknown reason by replacing underscores', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'unknown_new_reason', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('unknown new reason');
      });
    });

    describe('top axes rendering', () => {
      it('should render weight list when topAxes has items', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [
              { axis: 'strength', weight: 0.75 },
              { axis: 'agility', weight: -0.25 },
            ],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Top Axes by Weight');
        expect(elements.prototypeCardsContainer.querySelector('.weight-list')).not.toBeNull();
      });

      it('should not render weight list when topAxes is empty', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).not.toContain('Top Axes by Weight');
      });

      it('should not render weight list when topAxes is missing', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'hub' }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).not.toContain('Top Axes by Weight');
      });

      it('should display axis names correctly', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [{ axis: 'intelligence', weight: 0.5 }],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const axisName = elements.prototypeCardsContainer.querySelector('.axis-name');
        expect(axisName.textContent).toBe('intelligence');
      });

      it('should format positive weights with + sign', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [{ axis: 'strength', weight: 0.75 }],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const weightValue = elements.prototypeCardsContainer.querySelector('.weight-value');
        expect(weightValue.textContent).toBe('+0.750');
        expect(weightValue.classList.contains('positive')).toBe(true);
      });

      it('should format negative weights without + sign', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [{ axis: 'weakness', weight: -0.333 }],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const weightValue = elements.prototypeCardsContainer.querySelector('.weight-value');
        expect(weightValue.textContent).toBe('-0.333');
        expect(weightValue.classList.contains('negative')).toBe(true);
      });

      it('should format zero weight with + sign as positive', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [{ axis: 'neutral', weight: 0 }],
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        const weightValue = elements.prototypeCardsContainer.querySelector('.weight-value');
        expect(weightValue.textContent).toBe('+0.000');
        expect(weightValue.classList.contains('positive')).toBe(true);
      });
    });

    describe('why flagged section', () => {
      it('should always include why flagged section', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Why flagged:');
        expect(elements.prototypeCardsContainer.querySelector('.prototype-unusual')).not.toBeNull();
      });

      it('should format high_reconstruction_error with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'high_reconstruction_error',
            topAxes: [],
            metrics: { reconstructionError: 0.65 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('RMSE 0.650');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('above 0.5 threshold');
      });

      it('should format extreme_projection with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'extreme_projection',
            topAxes: [],
            metrics: { projectionScore: 2.5 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Projection score 2.500');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('unexplained component');
      });

      it('should format hub with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [],
            metrics: { hubScore: 0.85 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Hub score 0.850');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('connects multiple clusters');
      });

      it('should format multi_axis_conflict with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'multi_axis_conflict',
            topAxes: [],
            metrics: { axisCount: 5 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Uses 5 axes');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('conflicting signs');
      });

      it('should format coverage_gap with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'coverage_gap',
            topAxes: [],
            metrics: { distance: 1.234 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Distance 1.234');
        expect(elements.prototypeCardsContainer.innerHTML).toContain('from nearest axis');
      });

      it('should fall back to reason label when metrics is null', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'hub',
            topAxes: [],
            metrics: null,
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Hub Prototype');
      });

      it('should fall back to reason label when metrics is missing', () => {
        const elements = createMockElements();
        const summaries = [{ prototypeId: 'proto', reason: 'hub', topAxes: [] }];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Hub Prototype');
      });

      it('should handle missing metric values with defaults', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'high_reconstruction_error',
            topAxes: [],
            metrics: {},
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('RMSE 0.000');
      });

      it('should handle missing axisCount with ? placeholder', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'multi_axis_conflict',
            topAxes: [],
            metrics: {},
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('Uses ? axes');
      });

      it('should fall back to reason label for unknown reason with metrics', () => {
        const elements = createMockElements();
        const summaries = [
          {
            prototypeId: 'proto',
            reason: 'new_unknown_reason',
            topAxes: [],
            metrics: { someValue: 123 },
          },
        ];

        renderer.renderPrototypeWeightCards(summaries, elements);

        expect(elements.prototypeCardsContainer.innerHTML).toContain('new unknown reason');
      });
    });
  });

  describe('static constants', () => {
    it('should have reason labels', () => {
      expect(WeightCardsRenderer.REASON_LABELS).toBeDefined();
      expect(WeightCardsRenderer.REASON_LABELS.high_reconstruction_error).toBe('High Recon. Error');
      expect(WeightCardsRenderer.REASON_LABELS.extreme_projection).toBe('Extreme Projection');
      expect(WeightCardsRenderer.REASON_LABELS.hub).toBe('Hub Prototype');
      expect(WeightCardsRenderer.REASON_LABELS.multi_axis_conflict).toBe('Multi-Axis Conflict');
      expect(WeightCardsRenderer.REASON_LABELS.coverage_gap).toBe('Coverage Gap');
    });
  });
});
