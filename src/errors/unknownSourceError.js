export class UnknownSourceError extends Error {
  constructor(sourceKind) {
    super(`Unknown source kind: ${sourceKind}`);
    this.name = 'UnknownSourceError';
    this.sourceKind = sourceKind;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnknownSourceError);
    }
  }
}
