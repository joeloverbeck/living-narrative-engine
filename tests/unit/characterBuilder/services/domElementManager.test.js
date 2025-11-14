import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DOMElementManager } from '../../../../src/characterBuilder/services/domElementManager.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createPerformance = () => {
  let current = 0;
  return {
    now: jest.fn(() => {
      current += 5;
      return current;
    }),
  };
};

describe('DOMElementManager', () => {
  let logger;
  let performanceRef;
  let manager;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="form"></div>
      <button id="submit-btn" class="cta"></button>
      <div class="optional"></div>
    `;

    logger = createLogger();
    performanceRef = createPerformance();

    manager = new DOMElementManager({
      logger,
      documentRef: document,
      performanceRef,
      elementsRef: {},
      contextName: 'TestController',
    });
  });

  describe('cacheElement', () => {
    it('caches elements by ID and returns reference', () => {
      const element = manager.cacheElement('submit', '#submit-btn');
      expect(element).toBeInstanceOf(HTMLElement);
      expect(manager.getElement('submit')).toBe(element);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("TestController: Cached element 'submit'" )
      );
    });

    it('returns null for optional elements that are missing', () => {
      const result = manager.cacheElement('tooltip', '#missing', false);
      expect(result).toBeNull();
      expect(manager.getElement('tooltip')).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws when required element is missing', () => {
      expect(() => manager.cacheElement('tooltip', '#missing', true)).toThrow(
        /Failed to cache element 'tooltip'/
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('TestController: Element caching failed'),
        expect.objectContaining({ elementKey: 'tooltip' })
      );
    });
  });

  describe('cacheElementsFromMap', () => {
    it('caches configured elements and tracks stats', () => {
      const results = manager.cacheElementsFromMap({
        form: '#form',
        submit: '#submit-btn',
        optional: { selector: '.missing', required: false },
      });

      expect(results.stats).toEqual(
        expect.objectContaining({ total: 3, cached: 2, optional: 1, failed: 0 })
      );
      expect(results.cached).toHaveProperty('form');
      expect(results.cached).toHaveProperty('submit');
      expect(results.errors).toHaveLength(0);
    });

    it('collects errors and respects stopOnFirstError option', () => {
      expect(() =>
        manager.cacheElementsFromMap(
          {
            form: '#form',
            missing: '#nope',
          },
          { stopOnFirstError: true }
        )
      ).toThrow(/Element caching failed for 'missing'/);
    });

    it('runs custom validators', () => {
      const failingValidator = jest.fn().mockReturnValue(false);

      const results = manager.cacheElementsFromMap({
        submit: { selector: '#submit-btn', required: true, validate: failingValidator },
      });

      expect(results.errors).toHaveLength(1);
      expect(results.stats.failed).toBe(1);
      expect(failingValidator).toHaveBeenCalled();
    });
  });

  describe('normalization helpers', () => {
    it('normalizes string configs', () => {
      const normalized = manager.normalizeElementConfig('#form');
      expect(normalized).toEqual({ selector: '#form', required: true, validate: null });
    });

    it('normalizes object configs', () => {
      const normalized = manager.normalizeElementConfig({ selector: '.optional', required: false });
      expect(normalized).toEqual(
        expect.objectContaining({ selector: '.optional', required: false })
      );
    });
  });

  describe('cache validation and clearing', () => {
    it('validates cache entries and clears cache', () => {
      manager.cacheElement('form', '#form');
      const button = manager.cacheElement('submit', '#submit-btn');
      document.body.removeChild(button);

      const results = manager.validateElementCache();
      expect(results.total).toBe(2);
      expect(results.invalid).toContain('submit');

      const cleared = manager.clearCache();
      expect(cleared).toBe(2);
      expect(manager.getElementsSnapshot()).toEqual({});
    });
  });

  describe('DOM manipulation helpers', () => {
    it('refreshes and toggles elements', () => {
      manager.cacheElement('submit', '#submit-btn');
      const refreshed = manager.refreshElement('submit', '#submit-btn');
      expect(refreshed).toBeInstanceOf(HTMLElement);

      expect(manager.showElement('submit')).toBe(true);
      expect(manager.hideElement('submit')).toBe(true);
      expect(manager.toggleElement('submit', true)).toBe(true);
    });

    it('updates enabled state, text, and classes', () => {
      const button = document.getElementById('submit-btn');
      manager.cacheElement('submit', '#submit-btn');

      expect(manager.setElementEnabled('submit', false)).toBe(true);
      expect(button.disabled).toBe(true);

      expect(manager.setElementText('submit', 'Save')).toBe(true);
      expect(button.textContent).toBe('Save');

      expect(manager.addElementClass('submit', 'primary')).toBe(true);
      expect(button.classList.contains('primary')).toBe(true);

      expect(manager.removeElementClass('submit', 'cta')).toBe(true);
      expect(button.classList.contains('cta')).toBe(false);
    });
  });
});
