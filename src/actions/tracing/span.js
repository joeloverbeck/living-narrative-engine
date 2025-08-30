/**
 * @file Span class for hierarchical tracing
 * @see structuredTrace.js
 * @see types.js
 */

/** @typedef {import('./types.js').SpanStatus} SpanStatus */
/** @typedef {import('./types.js').SpanAttributes} SpanAttributes */

/**
 * @class Span
 * @description Represents a single operation in a trace with timing and hierarchy
 */
export class Span {
  #id;
  #operation;
  #parentId;
  #startTime;
  #endTime;
  #duration;
  #status;
  #attributes;
  #children;
  #error;

  /**
   * Creates a new Span instance
   *
   * @param {number} id - Unique identifier for this span
   * @param {string} operation - Name of the operation this span represents
   * @param {number|null} parentId - ID of the parent span, or null for root spans
   */
  constructor(id, operation, parentId = null) {
    if (typeof id !== 'number') {
      throw new Error('Span id must be a number');
    }
    if (typeof operation !== 'string' || operation.trim() === '') {
      throw new Error('Span operation must be a non-empty string');
    }
    if (parentId !== null && typeof parentId !== 'number') {
      throw new Error('Span parentId must be a number or null');
    }

    this.#id = id;
    this.#operation = operation;
    this.#parentId = parentId;
    this.#startTime = performance.now();
    this.#endTime = null;
    this.#duration = null;
    this.#status = 'active';
    this.#attributes = {};
    this.#children = [];
    this.#error = null;
  }

  /**
   * Gets the span ID
   *
   * @returns {number} The span ID
   */
  get id() {
    return this.#id;
  }

  /**
   * Gets the operation name
   *
   * @returns {string} The operation name
   */
  get operation() {
    return this.#operation;
  }

  /**
   * Gets the parent span ID
   *
   * @returns {number|null} The parent ID or null
   */
  get parentId() {
    return this.#parentId;
  }

  /**
   * Gets the start time
   *
   * @returns {number} The start time from performance.now()
   */
  get startTime() {
    return this.#startTime;
  }

  /**
   * Gets the end time
   *
   * @returns {number|null} The end time or null if not ended
   */
  get endTime() {
    return this.#endTime;
  }

  /**
   * Gets the duration
   *
   * @returns {number|null} The duration in milliseconds or null if not ended
   */
  get duration() {
    return this.#duration;
  }

  /**
   * Gets the span status
   *
   * @returns {SpanStatus} The current status
   */
  get status() {
    return this.#status;
  }

  /**
   * Gets a copy of the span attributes
   *
   * @returns {SpanAttributes} The span attributes
   */
  get attributes() {
    return { ...this.#attributes };
  }

  /**
   * Gets a copy of the child spans array
   *
   * @returns {Span[]} The child spans
   */
  get children() {
    return [...this.#children];
  }

  /**
   * Gets the error if any
   *
   * @returns {Error|null} The error or null
   */
  get error() {
    return this.#error;
  }

  /**
   * Ends the span and calculates duration
   *
   * @throws {Error} If the span has already been ended
   */
  end() {
    if (this.#endTime !== null) {
      throw new Error(`Span ${this.#id} has already been ended`);
    }

    this.#endTime = performance.now();
    this.#duration = this.#endTime - this.#startTime;

    // Validate duration to prevent negative values
    if (this.#duration < 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `Span "${this.#operation}" (${this.#id}) has negative duration: ${this.#duration}ms. Setting to 0.`
      );
      this.#duration = 0;
    }

    // Set status to success if it's still active
    if (this.#status === 'active') {
      this.#status = 'success';
    }
  }

  /**
   * Sets the span status
   *
   * @param {SpanStatus} status - The new status
   * @throws {Error} If the status is invalid
   */
  setStatus(status) {
    const validStatuses = ['active', 'success', 'failure', 'error'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid span status: ${status}`);
    }
    this.#status = status;
  }

  /**
   * Sets an attribute on the span
   *
   * @param {string} key - The attribute key
   * @param {*} value - The attribute value
   * @throws {Error} If the key is not a string
   */
  setAttribute(key, value) {
    if (typeof key !== 'string') {
      throw new Error('Attribute key must be a string');
    }
    this.#attributes[key] = value;
  }

  /**
   * Sets multiple attributes on the span
   *
   * @param {SpanAttributes} attributes - The attributes to set
   */
  setAttributes(attributes) {
    if (typeof attributes !== 'object' || attributes === null) {
      throw new Error('Attributes must be an object');
    }
    Object.assign(this.#attributes, attributes);
  }

  /**
   * Adds multiple attributes on the span (alias for setAttributes for compatibility)
   *
   * @param {SpanAttributes} attributes - The attributes to add
   */
  addAttributes(attributes) {
    return this.setAttributes(attributes);
  }

  /**
   * Sets an error on the span
   *
   * @param {Error} error - The error to capture
   * @throws {Error} If the provided error is not an Error instance
   */
  setError(error) {
    if (!(error instanceof Error)) {
      throw new Error('setError requires an Error instance');
    }
    this.#error = error;
    this.#status = 'error';
    this.setAttribute('error.message', error.message);
    this.setAttribute('error.stack', error.stack);
  }

  /**
   * Records an error on the span (alias for setError for compatibility)
   *
   * @param {Error} error - The error to record
   */
  recordError(error) {
    return this.setError(error);
  }

  /**
   * Adds an event to the span (stored as a timestamped attribute for compatibility)
   *
   * @param {string} name - The event name
   * @param {object} [attributes] - The event attributes
   */
  addEvent(name, attributes = {}) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Event name must be a non-empty string');
    }

    // Initialize events array in attributes if not present
    if (!this.#attributes.events) {
      this.#attributes.events = [];
    }

    // Add the event with timestamp
    this.#attributes.events.push({
      name,
      timestamp: performance.now(),
      attributes: attributes || {},
    });
  }

  /**
   * Adds a child span
   *
   * @param {Span} childSpan - The child span to add
   * @throws {Error} If the child is not a Span instance or has wrong parent
   */
  addChild(childSpan) {
    if (!(childSpan instanceof Span)) {
      throw new Error('Child must be a Span instance');
    }
    if (childSpan.parentId !== this.#id) {
      throw new Error(
        `Child span ${childSpan.id} has parent ${childSpan.parentId}, not ${this.#id}`
      );
    }
    this.#children.push(childSpan);
  }

  /**
   * Converts the span to a plain object for serialization
   *
   * @returns {object} Plain object representation
   */
  toJSON() {
    return {
      id: this.#id,
      operation: this.#operation,
      parentId: this.#parentId,
      startTime: this.#startTime,
      endTime: this.#endTime,
      duration: this.#duration,
      status: this.#status,
      attributes: this.attributes,
      children: this.#children.map((child) => child.toJSON()),
      error: this.#error
        ? {
            message: this.#error.message,
            stack: this.#error.stack,
          }
        : null,
    };
  }
}

export default Span;
