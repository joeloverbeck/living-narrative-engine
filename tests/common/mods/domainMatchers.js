/**
 * @file Domain-specific Jest matchers for mod testing
 * @description Provides readable assertions with rich error messages for action testing
 */

/**
 * Checks if action execution succeeded by examining events array
 *
 * @param {Array} received - Events array from testFixture
 * @param {string} [expectedMessage] - Optional expected success message. If not provided, just checks for success event existence.
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(testFixture.events).toHaveActionSuccess('Alice sits down')
 * @example expect(testFixture.events).toHaveActionSuccess() // Just check for success
 */
function toHaveActionSuccess(received, expectedMessage) {
  const { printReceived, printExpected, matcherHint } = this.utils;

  if (!Array.isArray(received)) {
    throw new Error('toHaveActionSuccess: received must be an events array');
  }

  const successEvent = received.find(
    (e) => e.eventType === 'core:display_successful_action_result'
  );

  // If no expected message is provided, just check that success event exists
  const pass = expectedMessage === undefined
    ? !!successEvent
    : successEvent && successEvent.payload.message === expectedMessage;

  if (pass) {
    return {
      message: () =>
        matcherHint('.not.toHaveActionSuccess', 'events', printExpected(expectedMessage)) +
        '\n\n' +
        'Expected action NOT to succeed with message:\n' +
        `  ${printExpected(expectedMessage)}\n\n` +
        'But it did succeed with that message',
      pass: true,
    };
  }

  // Build detailed failure message
  let failureDetails = '';

  if (!successEvent) {
    failureDetails += '\nNo success event found in events array\n';

    // Check for error events
    const errorEvent = received.find((e) => e.eventType === 'core:system_error_occurred');
    if (errorEvent) {
      failureDetails += `\nFound error event: ${errorEvent.payload.error}\n`;
    }

    // List actual event types
    const eventTypes = received.map((e) => e.eventType);
    failureDetails += `\nActual events: ${printReceived(eventTypes.join(', '))}\n`;
  } else {
    failureDetails += `\nExpected message: ${printExpected(expectedMessage)}\n`;
    failureDetails += `Received message: ${printReceived(successEvent.payload.message)}\n`;
  }

  return {
    message: () =>
      matcherHint('.toHaveActionSuccess', 'events', printExpected(expectedMessage)) +
      '\n\n' +
      'Expected action to succeed with message:' +
      failureDetails,
    pass: false,
  };
}

/**
 * Checks if action execution failed by looking for absence of success events
 *
 * @param {Array} received - Events array from testFixture
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(testFixture.events).toHaveActionFailure()
 */
function toHaveActionFailure(received) {
  const { printReceived, matcherHint } = this.utils;

  if (!Array.isArray(received)) {
    throw new Error('toHaveActionFailure: received must be an events array');
  }

  const successEvent = received.find(
    (e) => e.eventType === 'core:display_successful_action_result'
  );

  const pass = !successEvent;

  if (pass) {
    return {
      message: () =>
        matcherHint('.not.toHaveActionFailure', 'events', '') +
        '\n\n' +
        'Expected action to succeed, but no success event was found',
      pass: true,
    };
  }

  return {
    message: () =>
      matcherHint('.toHaveActionFailure', 'events', '') +
      '\n\n' +
      'Expected action to fail (no success event)\n' +
      `But found success event with message: ${printReceived(successEvent.payload.message)}`,
    pass: false,
  };
}

/**
 * Checks if a component exists on an entity (was added)
 *
 * @param {object} received - Entity object from entityManager.getEntityInstance()
 * @param {string} componentType - Component type to check for
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(entity).toHaveComponent('core:sitting')
 * @example expect(actor).toHaveComponent('positioning:lying_down')
 */
function toHaveComponent(received, componentType) {
  const { printExpected, printReceived, matcherHint } = this.utils;

  if (!received || typeof received !== 'object') {
    throw new Error(
      'toHaveComponent: received must be an entity object from entityManager.getEntityInstance()'
    );
  }

  if (!received.components) {
    throw new Error('toHaveComponent: received object must have a components property');
  }

  const hasComponent = received.components[componentType] !== undefined;

  if (hasComponent) {
    return {
      message: () =>
        matcherHint('.not.toHaveComponent', 'entity', printExpected(componentType)) +
        '\n\n' +
        `Expected entity '${received.id}' NOT to have component ${printExpected(componentType)}` +
        '\n\n' +
        `But it has the component`,
      pass: true,
    };
  }

  const actualComponents = Object.keys(received.components).join(', ') || 'none';

  return {
    message: () =>
      matcherHint('.toHaveComponent', 'entity', printExpected(componentType)) +
      '\n\n' +
      `Expected entity '${received.id}' to have component ${printExpected(componentType)}` +
      '\n\n' +
      `Actual components: ${printReceived(actualComponents)}`,
    pass: false,
  };
}

/**
 * Checks if a component does NOT exist on an entity (was removed or never added)
 *
 * @param {object} received - Entity object from entityManager.getEntityInstance()
 * @param {string} componentType - Component type to check for absence
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(entity).toNotHaveComponent('core:standing')
 * @example expect(actor).toNotHaveComponent('positioning:sitting')
 */
function toNotHaveComponent(received, componentType) {
  const { printExpected, printReceived, matcherHint } = this.utils;

  if (!received || typeof received !== 'object') {
    throw new Error(
      'toNotHaveComponent: received must be an entity object from entityManager.getEntityInstance()'
    );
  }

  if (!received.components) {
    throw new Error('toNotHaveComponent: received object must have a components property');
  }

  const hasComponent = received.components[componentType] !== undefined;

  if (!hasComponent) {
    return {
      message: () =>
        matcherHint('.toNotHaveComponent', 'entity', printExpected(componentType)) +
        '\n\n' +
        `Expected entity '${received.id}' to have component ${printExpected(componentType)}` +
        '\n\n' +
        `But it does not have the component`,
      pass: true,
    };
  }

  const actualComponents = Object.keys(received.components).join(', ');

  return {
    message: () =>
      matcherHint('.not.toNotHaveComponent', 'entity', printExpected(componentType)) +
      '\n\n' +
      `Expected entity '${received.id}' NOT to have component ${printExpected(componentType)}` +
      '\n\n' +
      `But it has the component. All components: ${printReceived(actualComponents)}`,
    pass: false,
  };
}

/**
 * Checks if an entity is at a specific location
 *
 * @param {object} received - Entity object from entityManager.getEntityInstance()
 * @param {string} locationId - Expected location ID
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(entity).toBeAt('bedroom')
 */
function toBeAt(received, locationId) {
  const { printExpected, printReceived, matcherHint } = this.utils;

  if (!received || typeof received !== 'object') {
    throw new Error('toBeAt: received must be an entity object from entityManager.getEntityInstance()');
  }

  if (!received.components) {
    throw new Error('toBeAt: received object must have a components property');
  }

  const positionComponent = received.components['core:position'];

  if (!positionComponent) {
    return {
      message: () =>
        matcherHint('.toBeAt', 'entity', printExpected(locationId)) +
        '\n\n' +
        `Expected entity '${received.id}' to be at location ${printExpected(locationId)}` +
        '\n\n' +
        `But entity has no position component`,
      pass: false,
    };
  }

  const actualLocation = positionComponent.locationId;
  const pass = actualLocation === locationId;

  if (pass) {
    return {
      message: () =>
        matcherHint('.not.toBeAt', 'entity', printExpected(locationId)) +
        '\n\n' +
        `Expected entity '${received.id}' NOT to be at location ${printExpected(locationId)}` +
        '\n\n' +
        `But it is at that location`,
      pass: true,
    };
  }

  return {
    message: () =>
      matcherHint('.toBeAt', 'entity', printExpected(locationId)) +
      '\n\n' +
      `Expected entity '${received.id}' to be at location ${printExpected(locationId)}` +
      '\n\n' +
      `Entity is actually at: ${printReceived(actualLocation || 'unknown')}`,
    pass: false,
  };
}

/**
 * Checks if events array contains a specific event type
 *
 * @param {Array} received - Events array from testFixture.events
 * @param {string} eventType - Event type to check for
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(testFixture.events).toDispatchEvent('core:perceptible_event')
 */
function toDispatchEvent(received, eventType) {
  const { printExpected, printReceived, matcherHint } = this.utils;

  if (!Array.isArray(received)) {
    throw new Error('toDispatchEvent: received must be an events array from testFixture.events');
  }

  const pass = received.some((e) => e.eventType === eventType);

  if (pass) {
    return {
      message: () =>
        matcherHint('.not.toDispatchEvent', 'events', printExpected(eventType)) +
        '\n\n' +
        `Expected event ${printExpected(eventType)} NOT to be dispatched` +
        '\n\n' +
        `But it was dispatched`,
      pass: true,
    };
  }

  const actualEvents = received.map((e) => e.eventType).join(', ') || 'none';

  return {
    message: () =>
      matcherHint('.toDispatchEvent', 'events', printExpected(eventType)) +
      '\n\n' +
      `Expected event ${printExpected(eventType)} to be dispatched` +
      '\n\n' +
      `Events actually dispatched: ${printReceived(actualEvents)}`,
    pass: false,
  };
}

/**
 * Checks if entity has component with specific data
 *
 * @param {object} received - Entity object from entityManager.getEntityInstance()
 * @param {string} componentType - Component type to check
 * @param {object} expectedData - Expected component data (partial match)
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(entity).toHaveComponentData('core:position', { locationId: 'bedroom' })
 */
function toHaveComponentData(received, componentType, expectedData) {
  const { printExpected, printReceived, matcherHint } = this.utils;

  if (!received || typeof received !== 'object') {
    throw new Error(
      'toHaveComponentData: received must be an entity object from entityManager.getEntityInstance()'
    );
  }

  if (!received.components) {
    throw new Error('toHaveComponentData: received object must have a components property');
  }

  const component = received.components[componentType];

  if (!component) {
    return {
      message: () =>
        matcherHint('.toHaveComponentData', 'entity', '') +
        '\n\n' +
        `Expected entity '${received.id}' to have component ${printExpected(componentType)}` +
        '\n\n' +
        `But component not found on entity`,
      pass: false,
    };
  }

  // Check if all expected keys match
  const allKeysMatch = Object.keys(expectedData).every((key) =>
    this.equals(component[key], expectedData[key])
  );

  if (allKeysMatch) {
    return {
      message: () =>
        matcherHint('.not.toHaveComponentData', 'entity', '') +
        '\n\n' +
        `Expected component ${printExpected(componentType)} NOT to have data:` +
        '\n' +
        printExpected(expectedData) +
        '\n\n' +
        `But it does have that data`,
      pass: true,
    };
  }

  // Build detailed diff
  let diff = '\nData differences:\n';
  for (const key of Object.keys(expectedData)) {
    if (!this.equals(component[key], expectedData[key])) {
      diff += `  ${key}:\n`;
      diff += `  Expected: ${printExpected(expectedData[key])}\n`;
      diff += `  Received: ${printReceived(component[key])}\n`;
    }
  }

  return {
    message: () =>
      matcherHint('.toHaveComponentData', 'entity', '') +
      '\n\n' +
      `Expected component ${printExpected(componentType)} to have data:` +
      '\n' +
      printExpected(expectedData) +
      diff,
    pass: false,
  };
}

/**
 * Checks if discovered actions array contains a specific action
 *
 * @param {Array} received - Actions array from discoverActions
 * @param {string} expectedActionId - Action ID to find (e.g., 'patrol:travel_through_dimensions')
 * @param {object} [options] - Optional match criteria
 * @param {string} [options.primaryTargetId] - Expected primary target ID
 * @returns {{pass: boolean, message: Function}} Jest matcher result
 * @example expect(actions).toContainAction('patrol:travel_through_dimensions')
 * @example expect(actions).toContainAction('patrol:travel_through_dimensions', { primaryTargetId: 'dimension-1' })
 */
function toContainAction(received, expectedActionId, options = {}) {
  const { printReceived, printExpected, matcherHint } = this.utils;

  if (!Array.isArray(received)) {
    throw new Error('toContainAction: received must be an actions array');
  }

  const { primaryTargetId } = options;

  // Find matching actions
  let matchingActions = received.filter((action) => action.id === expectedActionId);

  // If primaryTargetId is specified, further filter by target
  if (primaryTargetId !== undefined && matchingActions.length > 0) {
    matchingActions = matchingActions.filter(
      (action) => action.primaryTargetId === primaryTargetId
    );
  }

  const pass = matchingActions.length > 0;

  if (pass) {
    return {
      message: () =>
        matcherHint('.not.toContainAction', 'actions', printExpected(expectedActionId)) +
        '\n\n' +
        'Expected actions NOT to contain:\n' +
        `  ${printExpected(expectedActionId)}\n` +
        (primaryTargetId ? `  with primaryTargetId: ${printExpected(primaryTargetId)}\n` : '') +
        '\nBut it was found in the actions array',
      pass: true,
    };
  }

  // Build detailed failure message
  const actionIds = received.map((a) => a.id);
  const failureDetails =
    '\nExpected action: ' +
    printExpected(expectedActionId) +
    (primaryTargetId ? `\nWith primaryTargetId: ${printExpected(primaryTargetId)}` : '') +
    '\n\nAvailable actions: ' +
    printReceived(actionIds.length > 0 ? actionIds.join(', ') : '(none)') +
    '\n';

  return {
    message: () =>
      matcherHint('.toContainAction', 'actions', printExpected(expectedActionId)) +
      '\n\n' +
      'Expected actions to contain:' +
      failureDetails,
    pass: false,
  };
}

// Export all matchers
export const domainMatchers = {
  toHaveActionSuccess,
  toHaveActionFailure,
  toHaveComponent,
  toNotHaveComponent,
  toBeAt,
  toDispatchEvent,
  toHaveComponentData,
  toContainAction,
};

/**
 * Helper to register matchers with Jest
 */
export function registerDomainMatchers() {
  // eslint-disable-next-line no-undef
  expect.extend(domainMatchers);
}
