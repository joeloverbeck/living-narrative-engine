const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

const buildPopulationPredicate = (constraints) => {
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return 'all';
  }

  const sorted = [...constraints].sort((a, b) => {
    const pathCompare = String(a.varPath).localeCompare(String(b.varPath));
    if (pathCompare !== 0) return pathCompare;
    const opCompare = String(a.operator).localeCompare(String(b.operator));
    if (opCompare !== 0) return opCompare;
    return Number(a.threshold) - Number(b.threshold);
  });

  return sorted
    .map((constraint) => {
      const threshold = Number.isFinite(constraint.threshold)
        ? constraint.threshold
        : constraint.threshold ?? 'NaN';
      return `${constraint.varPath} ${constraint.operator} ${threshold}`;
    })
    .join(', ');
};

const buildPopulationHash = (sampleIds, predicate) => {
  const safeIds = Array.isArray(sampleIds) ? sampleIds : [];
  const seed = `${predicate ?? 'all'}|${safeIds.join(',')}`;

  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }

  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, '0');
};

export { buildPopulationHash, buildPopulationPredicate };
