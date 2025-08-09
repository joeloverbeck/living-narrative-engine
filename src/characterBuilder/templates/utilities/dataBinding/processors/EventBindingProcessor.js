/**
 * @file Event Binding Processor for template event handling
 * @module characterBuilder/templates/utilities/dataBinding/processors/EventBindingProcessor
 * @description Handles tb-on:* directives for DOM event binding
 */

import { validateDependency } from '../../../../../utils/index.js';

/**
 * Processes template event binding directives
 */
export class EventBindingProcessor {
  #evaluator;
  #eventManager;
  #supportedEvents;
  #modifierMap;

  /**
   * @param {object} config - Processor configuration
   * @param {ExpressionEvaluator} config.evaluator - Expression evaluator
   * @param {TemplateEventManager} config.eventManager - Event manager
   */
  constructor(config) {
    validateDependency(config.evaluator, 'ExpressionEvaluator');
    validateDependency(config.eventManager, 'TemplateEventManager');

    this.#evaluator = config.evaluator;
    this.#eventManager = config.eventManager;

    // Supported DOM events
    this.#supportedEvents = new Set([
      'click',
      'dblclick',
      'mousedown',
      'mouseup',
      'mouseover',
      'mouseout',
      'mouseenter',
      'mouseleave',
      'mousemove',
      'contextmenu',
      'keydown',
      'keyup',
      'keypress',
      'focus',
      'blur',
      'focusin',
      'focusout',
      'input',
      'change',
      'select',
      'submit',
      'reset',
      'load',
      'unload',
      'beforeunload',
      'resize',
      'scroll',
      'drag',
      'dragstart',
      'dragend',
      'dragover',
      'dragenter',
      'dragleave',
      'drop',
      'touchstart',
      'touchend',
      'touchmove',
      'touchcancel',
    ]);

    // Event modifiers
    this.#modifierMap = {
      prevent: (event) => event.preventDefault(),
      stop: (event) => event.stopPropagation(),
      once: () => {}, // Handled in addEventListener options
      passive: () => {}, // Handled in addEventListener options
      capture: () => {}, // Handled in addEventListener options
      self: (event) => event.target === event.currentTarget,
      enter: (event) => event.key === 'Enter' || event.keyCode === 13,
      esc: (event) => event.key === 'Escape' || event.keyCode === 27,
      space: (event) => event.key === ' ' || event.keyCode === 32,
      tab: (event) => event.key === 'Tab' || event.keyCode === 9,
      up: (event) => event.key === 'ArrowUp' || event.keyCode === 38,
      down: (event) => event.key === 'ArrowDown' || event.keyCode === 40,
      left: (event) => event.key === 'ArrowLeft' || event.keyCode === 37,
      right: (event) => event.key === 'ArrowRight' || event.keyCode === 39,
    };
  }

  /**
   * Process event binding directives on an element
   *
   * @param {HTMLElement} element - Element with event attributes
   * @param {object} context - Template context
   * @returns {Function} Cleanup function to remove all event listeners
   */
  process(element, context) {
    const cleanupFunctions = [];

    // Find all tb-on:* attributes
    const eventBindings = this.#extractEventBindings(element);

    for (const binding of eventBindings) {
      try {
        const cleanup = this.#bindEvent(element, binding, context);
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      } catch (error) {
        console.error(`Event binding failed: ${binding.attribute}`, error);
      }
    }

    // Return combined cleanup function
    return () => {
      cleanupFunctions.forEach((fn) => fn());
    };
  }

  /**
   * Extract event binding information from element
   *
   * @param element
   * @private
   */
  #extractEventBindings(element) {
    const bindings = [];

    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith('tb-on:')) {
        const eventName = attr.name.substring(6); // Remove 'tb-on:' prefix
        const [baseEvent, ...modifiers] = eventName.split('.');

        bindings.push({
          attribute: attr.name,
          event: baseEvent,
          modifiers,
          expression: attr.value,
        });
      }
    });

    return bindings;
  }

  /**
   * Bind a single event
   *
   * @param element
   * @param binding
   * @param context
   * @private
   */
  #bindEvent(element, binding, context) {
    const { event, modifiers, expression } = binding;

    // Validate event type
    if (!this.#supportedEvents.has(event)) {
      console.warn(`Unsupported event type: ${event}`);
      return null;
    }

    // Create event handler
    const handler = this.#createEventHandler(expression, context, modifiers);

    // Determine event options from modifiers
    const options = this.#getEventOptions(modifiers);

    // Add event listener
    const listenerId = this.#eventManager.addEventListener(
      element,
      event,
      handler,
      options
    );

    // Return cleanup function
    return () => {
      this.#eventManager.removeEventListener(listenerId);
    };
  }

  /**
   * Create event handler from expression
   *
   * @param expression
   * @param context
   * @param modifiers
   * @private
   */
  #createEventHandler(expression, context, modifiers) {
    return (event) => {
      try {
        // Apply pre-modifiers (filters that run before handler)
        if (!this.#applyPreModifiers(event, modifiers)) {
          return; // Event was filtered out
        }

        // Apply behavior modifiers
        this.#applyBehaviorModifiers(event, modifiers);

        // Create event context
        const eventContext = this.#createEventContext(event, context);

        // Execute handler expression
        this.#executeHandler(expression, eventContext);
      } catch (error) {
        console.error('Event handler execution failed:', error);
      }
    };
  }

  /**
   * Apply modifiers that filter events (run before handler)
   *
   * @param event
   * @param modifiers
   * @private
   */
  #applyPreModifiers(event, modifiers) {
    // Self modifier - only trigger if target is current element
    if (modifiers.includes('self')) {
      if (event.target !== event.currentTarget) {
        return false;
      }
    }

    // Key modifiers - only trigger for specific keys
    const keyModifiers = modifiers.filter((m) =>
      ['enter', 'esc', 'space', 'tab', 'up', 'down', 'left', 'right'].includes(
        m
      )
    );

    if (keyModifiers.length > 0) {
      const keyMatch = keyModifiers.some((modifier) =>
        this.#modifierMap[modifier](event)
      );
      if (!keyMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply behavior modifiers (prevent, stop, etc.)
   *
   * @param event
   * @param modifiers
   * @private
   */
  #applyBehaviorModifiers(event, modifiers) {
    if (modifiers.includes('prevent')) {
      event.preventDefault();
    }

    if (modifiers.includes('stop')) {
      event.stopPropagation();
    }
  }

  /**
   * Get event listener options from modifiers
   *
   * @param modifiers
   * @private
   */
  #getEventOptions(modifiers) {
    const options = {};

    if (modifiers.includes('once')) {
      options.once = true;
    }

    if (modifiers.includes('passive')) {
      options.passive = true;
    }

    if (modifiers.includes('capture')) {
      options.capture = true;
    }

    return options;
  }

  /**
   * Create event context with event information
   *
   * @param event
   * @param context
   * @private
   */
  #createEventContext(event, context) {
    return {
      ...context,
      $event: event,
      $target: event.target,
      $currentTarget: event.currentTarget,
      $key: event.key,
      $keyCode: event.keyCode,
      $altKey: event.altKey,
      $ctrlKey: event.ctrlKey,
      $metaKey: event.metaKey,
      $shiftKey: event.shiftKey,
      $clientX: event.clientX,
      $clientY: event.clientY,
      $button: event.button,
    };
  }

  /**
   * Execute handler expression
   *
   * @param expression
   * @param eventContext
   * @private
   */
  #executeHandler(expression, eventContext) {
    if (!expression) return;

    // Handle different expression types
    if (expression.includes('(')) {
      // Function call expression
      this.#evaluator.evaluate(expression, eventContext);
    } else {
      // Simple function reference
      const handler = this.#evaluator.evaluate(expression, eventContext);

      if (typeof handler === 'function') {
        handler(eventContext.$event);
      } else if (handler != null) {
        console.warn(`Event handler is not a function: ${expression}`);
      }
    }
  }

  /**
   * Extract all event bindings from element tree
   *
   * @param {HTMLElement} root - Root element to search
   * @returns {object[]} Array of event binding info
   */
  extractEventBindings(root) {
    const bindings = [];

    // Find all elements with tb-on:* attributes
    const elements = root.querySelectorAll('*');

    elements.forEach((element) => {
      const elementBindings = this.#extractEventBindings(element);
      elementBindings.forEach((binding) => {
        bindings.push({
          element,
          ...binding,
        });
      });
    });

    return bindings;
  }

  /**
   * Validate event bindings
   *
   * @param {HTMLElement} root - Root element to validate
   * @returns {object[]} Array of validation errors
   */
  validateEventBindings(root) {
    const bindings = this.extractEventBindings(root);
    const errors = [];

    for (const binding of bindings) {
      const { element, event, expression, modifiers } = binding;

      // Validate event type
      if (!this.#supportedEvents.has(event)) {
        errors.push({
          element,
          attribute: binding.attribute,
          error: `Unsupported event type: ${event}`,
        });
      }

      // Validate expression
      if (!expression) {
        errors.push({
          element,
          attribute: binding.attribute,
          error: 'Missing event handler expression',
        });
        continue;
      }

      if (!this.#evaluator.isSafeExpression(expression)) {
        errors.push({
          element,
          attribute: binding.attribute,
          expression,
          error: 'Unsafe event handler expression',
        });
      }

      // Validate modifiers
      for (const modifier of modifiers) {
        if (
          !this.#modifierMap.hasOwnProperty(modifier) &&
          !['once', 'passive', 'capture'].includes(modifier)
        ) {
          errors.push({
            element,
            attribute: binding.attribute,
            modifier,
            error: `Unknown event modifier: ${modifier}`,
          });
        }
      }

      // Check for conflicting modifiers
      if (modifiers.includes('passive') && modifiers.includes('prevent')) {
        errors.push({
          element,
          attribute: binding.attribute,
          error: 'Cannot use "prevent" modifier with "passive" modifier',
        });
      }
    }

    return errors;
  }

  /**
   * Check if element has event binding directives
   *
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if has event bindings
   */
  hasEventBindings(element) {
    return Array.from(element.attributes).some((attr) =>
      attr.name.startsWith('tb-on:')
    );
  }

  /**
   * Get all supported event types
   *
   * @returns {string[]} Array of supported event types
   */
  getSupportedEvents() {
    return Array.from(this.#supportedEvents);
  }

  /**
   * Get all supported modifiers
   *
   * @returns {string[]} Array of supported modifiers
   */
  getSupportedModifiers() {
    return Object.keys(this.#modifierMap).concat([
      'once',
      'passive',
      'capture',
    ]);
  }
}
