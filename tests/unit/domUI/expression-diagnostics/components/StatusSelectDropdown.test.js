/**
 * @file Unit tests for StatusSelectDropdown component.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import StatusSelectDropdown from '../../../../../src/domUI/expression-diagnostics/components/StatusSelectDropdown.js';

describe('StatusSelectDropdown', () => {
  let mockLogger;
  let containerElement;
  let mockOnSelectionChange;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    containerElement = document.createElement('div');
    containerElement.id = 'test-container';
    document.body.appendChild(containerElement);

    mockOnSelectionChange = jest.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  // =====================================================
  // Construction
  // =====================================================
  describe('Construction', () => {
    it('throws if containerElement is missing', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement: null,
          onSelectionChange: mockOnSelectionChange,
          logger: mockLogger,
        });
      }).toThrow('containerElement must be a valid HTMLElement');
    });

    it('throws if containerElement is not an HTMLElement', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement: 'not-an-element',
          onSelectionChange: mockOnSelectionChange,
          logger: mockLogger,
        });
      }).toThrow('containerElement must be a valid HTMLElement');
    });

    it('throws if onSelectionChange is not a function', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement,
          onSelectionChange: 'not-a-function',
          logger: mockLogger,
        });
      }).toThrow('onSelectionChange must be a function');
    });

    it('throws if onSelectionChange is missing', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement,
          logger: mockLogger,
        });
      }).toThrow('onSelectionChange must be a function');
    });

    it('throws if logger is invalid', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement,
          onSelectionChange: mockOnSelectionChange,
          logger: null,
        });
      }).toThrow();
    });

    it('constructs successfully with valid parameters', () => {
      expect(() => {
        new StatusSelectDropdown({
          containerElement,
          onSelectionChange: mockOnSelectionChange,
          logger: mockLogger,
        });
      }).not.toThrow();
    });

    it('renders trigger button with placeholder', () => {
      new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
        placeholder: 'Select something',
      });

      const trigger = containerElement.querySelector('.status-select-trigger');
      expect(trigger).not.toBeNull();
      expect(trigger.textContent).toContain('Select something');
    });

    it('renders hidden listbox', () => {
      new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      const listbox = containerElement.querySelector('.status-select-listbox');
      expect(listbox).not.toBeNull();
      expect(listbox.getAttribute('aria-hidden')).toBe('true');
    });

    it('uses custom id for elements', () => {
      new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
        id: 'custom-select',
      });

      const trigger = containerElement.querySelector('#custom-select');
      expect(trigger).not.toBeNull();
      const listbox = containerElement.querySelector('#custom-select-listbox');
      expect(listbox).not.toBeNull();
    });
  });

  // =====================================================
  // setOptions()
  // =====================================================
  describe('setOptions()', () => {
    it('renders options with correct status circle classes', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expression 1', status: 'impossible' },
        { value: 'expr2', label: 'Expression 2', status: 'rare' },
      ]);

      const options = containerElement.querySelectorAll(
        '.status-select-option'
      );
      expect(options.length).toBe(2);

      const circle1 = options[0].querySelector('.status-circle');
      expect(circle1.classList.contains('status-impossible')).toBe(true);

      const circle2 = options[1].querySelector('.status-circle');
      expect(circle2.classList.contains('status-rare')).toBe(true);
    });

    it('handles empty options array', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([]);

      const options = containerElement.querySelectorAll(
        '.status-select-option'
      );
      expect(options.length).toBe(0);
    });

    it('handles null/unknown status with gray circle class', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expression 1', status: null },
        { value: 'expr2', label: 'Expression 2', status: 'unknown' },
      ]);

      const options = containerElement.querySelectorAll(
        '.status-select-option'
      );
      const circle1 = options[0].querySelector('.status-circle');
      const circle2 = options[1].querySelector('.status-circle');

      expect(circle1.classList.contains('status-unknown')).toBe(true);
      expect(circle2.classList.contains('status-unknown')).toBe(true);
    });

    it('normalizes status with underscores to hyphenated class', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expression 1', status: 'extremely_rare' },
      ]);

      const circle = containerElement.querySelector('.status-circle');
      expect(circle.classList.contains('status-extremely-rare')).toBe(true);
    });

    it('displays option label text', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'My Expression', status: 'normal' },
      ]);

      const optionText = containerElement.querySelector(
        '.status-select-option-text'
      );
      expect(optionText.textContent).toBe('My Expression');
    });

    it('resets selection if selected value not in new options', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([{ value: 'expr1', label: 'Expr 1', status: null }]);
      dropdown.setValue('expr1', false);
      expect(dropdown.getValue()).toBe('expr1');

      dropdown.setOptions([{ value: 'expr2', label: 'Expr 2', status: null }]);
      expect(dropdown.getValue()).toBe('');
    });

    it('logs error for non-array input', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions('not-an-array');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'StatusSelectDropdown: setOptions requires an array'
      );
    });
  });

  // =====================================================
  // getValue() / setValue()
  // =====================================================
  describe('getValue() / setValue()', () => {
    it('returns empty string when nothing selected', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      expect(dropdown.getValue()).toBe('');
    });

    it('returns selected value', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);
      dropdown.setValue('expr2', false);

      expect(dropdown.getValue()).toBe('expr2');
    });

    it('updates trigger display when value set', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'My Expression', status: 'rare' },
      ]);
      dropdown.setValue('expr1', false);

      const trigger = containerElement.querySelector('.status-select-trigger');
      expect(trigger.textContent).toContain('My Expression');

      const circle = trigger.querySelector('.status-circle');
      expect(circle.classList.contains('status-rare')).toBe(true);
    });

    it('triggers callback when setValue with triggerCallback=true', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);
      dropdown.setValue('expr1', true);

      expect(mockOnSelectionChange).toHaveBeenCalledWith('expr1');
    });

    it('does not trigger callback when triggerCallback=false', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);
      dropdown.setValue('expr1', false);

      expect(mockOnSelectionChange).not.toHaveBeenCalled();
    });

    it('logs warning for non-existent value', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);
      dropdown.setValue('nonexistent', true);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'StatusSelectDropdown: setValue - option not found',
        { value: 'nonexistent' }
      );
    });
  });

  // =====================================================
  // updateOptionStatus()
  // =====================================================
  describe('updateOptionStatus()', () => {
    it('updates status circle class for matching option', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: 'unknown' },
      ]);

      const circleBefore = containerElement.querySelector('.status-circle');
      expect(circleBefore.classList.contains('status-unknown')).toBe(true);

      dropdown.updateOptionStatus('expr1', 'normal');

      const circleAfter = containerElement.querySelector('.status-circle');
      expect(circleAfter.classList.contains('status-normal')).toBe(true);
      expect(circleAfter.classList.contains('status-unknown')).toBe(false);
    });

    it('updates trigger display if selected option changed', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: 'impossible' },
      ]);
      dropdown.setValue('expr1', false);

      const triggerCircleBefore = containerElement.querySelector(
        '.status-select-trigger .status-circle'
      );
      expect(
        triggerCircleBefore.classList.contains('status-impossible')
      ).toBe(true);

      dropdown.updateOptionStatus('expr1', 'normal');

      const triggerCircleAfter = containerElement.querySelector(
        '.status-select-trigger .status-circle'
      );
      expect(triggerCircleAfter.classList.contains('status-normal')).toBe(
        true
      );
    });

    it('logs warning for non-existent option', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: 'unknown' },
      ]);
      dropdown.updateOptionStatus('nonexistent', 'normal');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'StatusSelectDropdown: updateOptionStatus - option not found',
        {
          value: 'nonexistent',
          optionCount: 1,
          sampleValues: ['expr1'],
        }
      );
    });
  });

  // =====================================================
  // Keyboard Navigation
  // =====================================================
  describe('Keyboard Navigation', () => {
    it('opens dropdown on Enter key', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('opens dropdown on Space key', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      );

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('opens dropdown on ArrowDown key', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes dropdown on Escape key', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      // Open first
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      // Close with Escape
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('navigates options with ArrowDown when open', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      // First option should be focused
      const firstOption = listbox.querySelector(
        '[data-index="0"]'
      );
      expect(firstOption.classList.contains('focused')).toBe(true);

      // Navigate down
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      const secondOption = listbox.querySelector(
        '[data-index="1"]'
      );
      expect(secondOption.classList.contains('focused')).toBe(true);
    });

    it('navigates options with ArrowUp when open', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open and move to second option
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      // Navigate up
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      );

      const firstOption = listbox.querySelector(
        '[data-index="0"]'
      );
      expect(firstOption.classList.contains('focused')).toBe(true);
    });

    it('selects focused option on Enter when open', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      // Navigate to second option
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      // Select with Enter
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      expect(dropdown.getValue()).toBe('expr2');
      expect(mockOnSelectionChange).toHaveBeenCalledWith('expr2');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('supports Home key to jump to first option', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
        { value: 'expr3', label: 'Expr 3', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open and move to last
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true })
      );

      // Jump to first with Home
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
      );

      const firstOption = listbox.querySelector('[data-index="0"]');
      expect(firstOption.classList.contains('focused')).toBe(true);
    });

    it('supports End key to jump to last option', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
        { value: 'expr3', label: 'Expr 3', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      // Jump to last with End
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true })
      );

      const lastOption = listbox.querySelector('[data-index="2"]');
      expect(lastOption.classList.contains('focused')).toBe(true);
    });

    it('wraps navigation at boundaries', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      // Move to end
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true })
      );

      // Arrow down should wrap to first
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      const firstOption = listbox.querySelector('[data-index="0"]');
      expect(firstOption.classList.contains('focused')).toBe(true);
    });
  });

  // =====================================================
  // Mouse Interaction
  // =====================================================
  describe('Mouse Interaction', () => {
    it('toggles dropdown on trigger click', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      // Open
      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      // Close
      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('selects option on click', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      // Open
      trigger.click();

      // Click second option
      const secondOption = containerElement.querySelector(
        '[data-value="expr2"]'
      );
      secondOption.click();

      expect(dropdown.getValue()).toBe('expr2');
      expect(mockOnSelectionChange).toHaveBeenCalledWith('expr2');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes dropdown when clicking outside', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      // Open
      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      // Click outside
      document.body.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  // =====================================================
  // Accessibility
  // =====================================================
  describe('Accessibility', () => {
    it('has correct ARIA attributes on trigger', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
        id: 'test-select',
      });

      const trigger = containerElement.querySelector('.status-select-trigger');

      expect(trigger.getAttribute('role')).toBe('combobox');
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.getAttribute('aria-controls')).toBe('test-select-listbox');
    });

    it('has correct ARIA attributes on listbox', () => {
      new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
        id: 'test-select',
      });

      const listbox = containerElement.querySelector('.status-select-listbox');

      expect(listbox.getAttribute('role')).toBe('listbox');
      expect(listbox.getAttribute('aria-hidden')).toBe('true');
      expect(listbox.getAttribute('aria-labelledby')).toBe('test-select-label');
    });

    it('has correct ARIA attributes on options', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const option = containerElement.querySelector('.status-select-option');

      expect(option.getAttribute('role')).toBe('option');
      expect(option.getAttribute('aria-selected')).toBe('false');
    });

    it('updates aria-expanded when toggled', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('updates aria-selected on option selection', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const option1 = containerElement.querySelector('[data-value="expr1"]');
      const option2 = containerElement.querySelector('[data-value="expr2"]');

      expect(option1.getAttribute('aria-selected')).toBe('false');
      expect(option2.getAttribute('aria-selected')).toBe('false');

      dropdown.setValue('expr1', false);

      expect(option1.getAttribute('aria-selected')).toBe('true');
      expect(option2.getAttribute('aria-selected')).toBe('false');
    });

    it('updates aria-activedescendant during navigation', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
        id: 'test-select',
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
        { value: 'expr2', label: 'Expr 2', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');
      const listbox = containerElement.querySelector('.status-select-listbox');

      // Open
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      expect(trigger.getAttribute('aria-activedescendant')).toBe(
        'test-select-option-0'
      );

      // Navigate down
      listbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );

      expect(trigger.getAttribute('aria-activedescendant')).toBe(
        'test-select-option-1'
      );
    });
  });

  // =====================================================
  // setEnabled()
  // =====================================================
  describe('setEnabled()', () => {
    it('disables the trigger button', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      const trigger = containerElement.querySelector('.status-select-trigger');

      expect(trigger.disabled).toBe(false);

      dropdown.setEnabled(false);
      expect(trigger.disabled).toBe(true);

      dropdown.setEnabled(true);
      expect(trigger.disabled).toBe(false);
    });

    it('closes dropdown when disabled', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      const trigger = containerElement.querySelector('.status-select-trigger');

      // Open
      trigger.click();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      // Disable
      dropdown.setEnabled(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('prevents opening when disabled', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      dropdown.setEnabled(false);

      const trigger = containerElement.querySelector('.status-select-trigger');
      trigger.click();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  // =====================================================
  // dispose()
  // =====================================================
  describe('dispose()', () => {
    it('clears container content', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      expect(containerElement.children.length).toBeGreaterThan(0);

      dropdown.dispose();

      expect(containerElement.innerHTML).toBe('');
    });

    it('removes document click listener', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.setOptions([
        { value: 'expr1', label: 'Expr 1', status: null },
      ]);

      dropdown.dispose();

      // After dispose, clicking outside should not throw
      expect(() => {
        document.body.click();
      }).not.toThrow();
    });

    it('logs debug message on dispose', () => {
      const dropdown = new StatusSelectDropdown({
        containerElement,
        onSelectionChange: mockOnSelectionChange,
        logger: mockLogger,
      });

      dropdown.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'StatusSelectDropdown: Disposed'
      );
    });
  });
});
