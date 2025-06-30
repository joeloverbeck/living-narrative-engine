/**
 *
 * @param resolver
 */
export function resetResolver(resolver) {
  if (resolver && typeof resolver.clearCache === 'function') {
    resolver.clearCache();
  }
}
