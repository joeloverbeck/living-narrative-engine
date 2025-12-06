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
      <div class="class-selector"></div>
      <div id="detached"></div>
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

  describe('Constructor & Configuration', () => {
    it('throws if documentRef is invalid (missing body.contains)', () => {
      expect(
        () =>
          new DOMElementManager({
            logger,
            documentRef: {
              getElementById: jest.fn(),
              querySelector: jest.fn(),
            }, // Missing body
          })
      ).toThrow('Invalid documentRef provided');
    });

    it('configure updates dependencies', () => {
      const newDocs = {
        body: { contains: jest.fn() },
        getElementById: jest.fn(),
        querySelector: jest.fn(),
      };
      const newPerf = { now: jest.fn() };
      const newElements = { foo: {} };

      manager.configure({
        documentRef: newDocs,
        performanceRef: newPerf,
        elementsRef: newElements,
        contextName: 'NewContext',
      });

      // Verify via side effects or subsequent calls
      expect(manager.getElementsSnapshot()).toEqual(newElements);

      // Check context name update by triggering a log
      manager.clearCache();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('NewContext: Cleared')
      );
    });

    it('configure throws on invalid documentRef', () => {
      expect(() =>
        manager.configure({
          documentRef: { getElementById: jest.fn(), querySelector: jest.fn() },
        })
      ).toThrow('Invalid documentRef provided');
    });

    it('configure ignores valid but empty/whitespace contextName', () => {
      manager.configure({ contextName: '   ' });
      manager.clearCache();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('TestController: Cleared')
      );
    });
  });

  describe('cacheElement', () => {
    it('caches elements by ID and returns reference', () => {
      const element = manager.cacheElement('submit', '#submit-btn');
      expect(element).toBeInstanceOf(HTMLElement);
      expect(manager.getElement('submit')).toBe(element);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("TestController: Cached element 'submit'")
      );
    });

    it('caches elements by class selector (querySelector)', () => {
      const element = manager.cacheElement('byClass', '.class-selector');
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.classList.contains('class-selector')).toBe(true);
    });

    it('returns null for optional elements that are missing', () => {
      const result = manager.cacheElement('tooltip', '#missing', false);
      expect(result).toBeNull();
      expect(manager.getElement('tooltip')).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Optional element 'tooltip' not found")
      );
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

    it('throws when required element by selector is missing', () => {
      expect(() =>
        manager.cacheElement('missingClass', '.missing-class', true)
      ).toThrow(/Failed to cache element 'missingClass'/);
    });

    it('throws if key is invalid', () => {
      expect(() => manager.cacheElement(null, '#foo')).toThrow(
        /Invalid element key provided/
      );
    });

    it('throws if selector is invalid', () => {
      expect(() => manager.cacheElement('key', null)).toThrow(
        /Invalid selector provided/
      );
    });

    it('throws if element is not an HTMLElement (validation)', () => {
      const mockDoc = {
        getElementById: jest.fn().mockReturnValue({}), // Plain object, not HTMLElement
        querySelector: jest.fn(),
        body: { contains: jest.fn().mockReturnValue(true) },
        defaultView: { HTMLElement: class HTMLElement {} },
      };

      manager.configure({
        documentRef: mockDoc,
      });

      expect(() => manager.cacheElement('badType', '#any')).toThrow(
        /not a valid HTMLElement/
      );
    });

    it('warns if cached element is not in DOM during validation', () => {
      const el = document.createElement('div');
      // Not appending to body
      jest.spyOn(document, 'getElementById').mockReturnValue(el);

      manager.cacheElement('detached', '#detached');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Element 'detached' is not attached to DOM")
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

    it('throws if continueOnError is false and required element fails', () => {
      expect(() =>
        manager.cacheElementsFromMap(
          {
            form: '#form',
            missing: '#nope',
          },
          { continueOnError: false }
        )
      ).toThrow(/Element caching failed for 'missing'/);
    });

    it('collects errors for invalid optional elements without throwing', () => {
      const results = manager.cacheElementsFromMap({
        badOptional: { selector: null, required: false },
      });

      expect(results.stats.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].error).toMatch(/Invalid selector/);
    });

    it('does not throw if continueOnError is false but element is optional', () => {
      const results = manager.cacheElementsFromMap(
        { badOptional: { selector: null, required: false } },
        { continueOnError: false }
      );
      expect(results.errors).toHaveLength(1);
    });

    it('runs custom validators', () => {
      const failingValidator = jest.fn().mockReturnValue(false);

      const results = manager.cacheElementsFromMap({
        submit: {
          selector: '#submit-btn',
          required: true,
          validate: failingValidator,
        },
      });

      expect(results.errors).toHaveLength(1);
      expect(results.stats.failed).toBe(1);
      expect(failingValidator).toHaveBeenCalled();
    });
  });

  describe('normalization helpers', () => {
    it('normalizes string configs', () => {
      const normalized = manager.normalizeElementConfig('#form');
      expect(normalized).toEqual({
        selector: '#form',
        required: true,
        validate: null,
      });
    });

    it('normalizes object configs', () => {
      const normalized = manager.normalizeElementConfig({
        selector: '.optional',
        required: false,
      });
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

  describe('getElements', () => {
    it('retrieves multiple elements', () => {
      manager.cacheElement('form', '#form');
      manager.cacheElement('submit', '#submit-btn');

      const results = manager.getElements(['form', 'submit', 'missing']);
      expect(results.form).toBeInstanceOf(HTMLElement);
      expect(results.submit).toBeInstanceOf(HTMLElement);
      expect(results.missing).toBeNull();
    });
  });

  describe('hasElement', () => {
    it('returns true if element exists and is in DOM', () => {
      manager.cacheElement('form', '#form');
      expect(manager.hasElement('form')).toBe(true);
    });

    it('returns false if element is not cached', () => {
      expect(manager.hasElement('missing')).toBe(false);
    });

    it('returns false if element is cached but removed from DOM', () => {
      const el = manager.cacheElement('temp', '#form');
      document.body.removeChild(el);
      expect(manager.hasElement('temp')).toBe(false);
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

    it('toggles element visibility based on current state', () => {
      const el = manager.cacheElement('submit', '#submit-btn');

      // Initially visible (block or empty)
      el.style.display = 'block';
      expect(manager.toggleElement('submit')).toBe(false); // toggles to none (visible=false)
      expect(el.style.display).toBe('none');

      el.style.display = 'none';
      expect(manager.toggleElement('submit')).toBe(true); // Toggles to block (visible=true)
      expect(el.style.display).toBe('block');

      el.style.display = 'block';
      expect(manager.toggleElement('submit')).toBe(false); // Toggles to none (visible=false)
      expect(el.style.display).toBe('none');
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

    it('returns false when manipulating non-existent elements', () => {
      const key = 'non-existent';
      expect(manager.showElement(key)).toBe(false);
      expect(manager.hideElement(key)).toBe(false);
      expect(manager.toggleElement(key)).toBe(false);
      expect(manager.setElementEnabled(key, true)).toBe(false);
      expect(manager.setElementText(key, 'text')).toBe(false);
      expect(manager.addElementClass(key, 'cls')).toBe(false);
      expect(manager.removeElementClass(key, 'cls')).toBe(false);
    });

    it('returns false when setting enabled on element without disabled property', () => {
      manager.cacheElement('div', '#form'); // divs don't have disabled property by default
      expect(manager.setElementEnabled('div', false)).toBe(false);
    });
  });
});
