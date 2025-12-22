/**
 * @file Shared helpers for CLI container overrides.
 */

/**
 * Overrides IDataFetcher registration for CLI tools without re-register warnings.
 *
 * @param {object} container - DI container instance.
 * @param {any} token - IDataFetcher token.
 * @param {() => any} factory - Factory that returns the data fetcher.
 */
export function overrideContainerToken(container, token, factory) {
  if (typeof container?.setOverride === 'function') {
    container.setOverride(token, factory);
    return;
  }

  if (typeof container?.register === 'function') {
    container.register(token, factory);
    return;
  }

  throw new Error(
    'overrideContainerToken requires a container with setOverride or register.'
  );
}

export const overrideDataFetcher = overrideContainerToken;
