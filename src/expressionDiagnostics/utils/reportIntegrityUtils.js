/**
 * @file reportIntegrityUtils - Helpers for report integrity warnings.
 */

const REPORT_INTEGRITY_EPSILON = 1e-6;
const REPORT_INTEGRITY_SAMPLE_LIMIT = 5;

const buildReportIntegrityWarning = ({
  code,
  message,
  populationHash = null,
  signal = null,
  prototypeId = null,
  details = null,
}) => ({
  code,
  message,
  populationHash,
  signal,
  prototypeId,
  details,
});

const isNonZero = (value, epsilon = REPORT_INTEGRITY_EPSILON) =>
  typeof value === 'number' && value > epsilon;

export {
  REPORT_INTEGRITY_EPSILON,
  REPORT_INTEGRITY_SAMPLE_LIMIT,
  buildReportIntegrityWarning,
  isNonZero,
};
