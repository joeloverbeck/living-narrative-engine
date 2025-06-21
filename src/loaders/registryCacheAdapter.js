export function makeRegistryCache(registry) {
  return {
    clear: () => registry.clear(),
    snapshot: () => JSON.parse(JSON.stringify(registry)),
    restore: snap => {
      // Remove all properties except 'clear'
      Object.keys(registry).forEach(k => {
        if (k !== 'clear') delete registry[k];
      });
      // Deep clone the snapshot before assigning
      const deepClone = obj => JSON.parse(JSON.stringify(obj));
      Object.keys(snap).forEach(k => {
        if (k !== 'clear') registry[k] = deepClone(snap[k]);
      });
    },
  };
} 