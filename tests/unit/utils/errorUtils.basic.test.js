import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { displayFatalStartupError } from '../../../src/utils/errorUtils.js';
import {
  showErrorInElement,
  createTemporaryErrorElement,
  disableInput,
} from '../../../src/utils/startupErrorHandler.js';

jest.mock('../../../src/utils/startupErrorHandler.js', () => {
  const actual = jest.requireActual('../../../src/utils/startupErrorHandler.js');
  return {
    ...actual,
    StartupErrorHandler: jest.fn().mockImplementation(() => ({
      displayFatalStartupError: jest.fn(() => ({ displayed: true })),
    })),
  };
});

const mockDom = {
  setTextContent: jest.fn(),
  setStyle: jest.fn(),
  createElement: jest.fn((tag) => document.createElement(tag)),
  insertAfter: jest.fn((ref, el) => ref.insertAdjacentElement('afterend', el)),
};

afterEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

describe('errorUtils basic functions', () => {
  describe('showErrorInElement', () => {
    it('returns false when element is invalid', () => {
      const result = showErrorInElement(null, 'msg', mockDom);
      expect(result).toBe(false);
      expect(mockDom.setTextContent).not.toHaveBeenCalled();
    });

    it('updates element text and style when element is valid', () => {
      const el = document.createElement('div');
      const result = showErrorInElement(el, 'oops', mockDom);
      expect(result).toBe(true);
      expect(mockDom.setTextContent).toHaveBeenCalledWith(el, 'oops');
      expect(mockDom.setStyle).toHaveBeenCalledWith(el, 'display', 'block');
    });
  });

  describe('createTemporaryErrorElement', () => {
    it('returns null when base element is invalid', () => {
      const result = createTemporaryErrorElement(undefined, 'err', mockDom);
      expect(result).toBeNull();
      expect(mockDom.createElement).not.toHaveBeenCalled();
    });

    it('creates and inserts an element when base element is valid', () => {
      const base = document.createElement('div');
      document.body.appendChild(base);
      const result = createTemporaryErrorElement(base, 'boom', mockDom);
      expect(result).not.toBeNull();
      expect(result.id).toBe('temp-startup-error');
      expect(mockDom.createElement).toHaveBeenCalledWith('div');
      expect(mockDom.insertAfter).toHaveBeenCalledWith(base, result);
      expect(base.nextElementSibling).toBe(result);
    });
  });

  describe('disableInput', () => {
    it('returns false when provided element is not input', () => {
      expect(disableInput(null, 'x')).toBe(false);
    });

    it('disables input and sets placeholder', () => {
      const input = document.createElement('input');
      const result = disableInput(input, 'here');
      expect(result).toBe(true);
      expect(input.disabled).toBe(true);
      expect(input.placeholder).toBe('here');
    });
  });

  describe('displayFatalStartupError', () => {
    it('delegates to StartupErrorHandler', () => {
      const ui = {};
      const err = {};
      const result = displayFatalStartupError(ui, err, null, mockDom, null);
      const Handler =
        require('../../../src/utils/startupErrorHandler.js').StartupErrorHandler;
      expect(Handler).toHaveBeenCalledWith(null, mockDom, null, 'errorUtils');
      expect(result).toEqual({ displayed: true });
    });
  });
});
