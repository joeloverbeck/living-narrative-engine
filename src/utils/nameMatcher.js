// src/utils/nameMatcher.js

import { ResolutionStatus } from '../types/resolutionStatus.js';

/** @typedef {import('../core/interfaces/ILogger.js').ILogger} ILogger */

/**
 * @description Represents a candidate item for name matching.
 * @typedef {object} NameMatchCandidate
 * @property {string} id - The unique identifier of the candidate.
 * @property {string} name - The name of the candidate to match against.
 */

/**
 * @description Result object from the NameMatcher utility.
 * @typedef {object} MatcherResult
 * @property {ResolutionStatus} status - FOUND_UNIQUE, AMBIGUOUS, NOT_FOUND, NONE (if phrase empty).
 * @property {NameMatchCandidate | null} target - The uniquely matched candidate (if status is FOUND_UNIQUE).
 * @property {NameMatchCandidate[]} [candidates] - List of ambiguous candidates (if status is AMBIGUOUS).
 * @property {string} [error] - A generic error message.
 */

/**
 * Matches a phrase against a list of candidates using a three-tier logic: exact, startsWith, substring.
 * @param {NameMatchCandidate[]} candidates - Array of candidates {id, name}.
 * @param {string} phrase - The noun phrase to match.
 * @param {ILogger} logger - An ILogger instance for internal logging.
 * @returns {MatcherResult} Result of the matching.
 */
export function matchNames(candidates, phrase, logger) {
  logger.debug(
    `NameMatcher.matchNames called with phrase: "${phrase}", ${candidates?.length || 0} candidates.`
  );

  if (!phrase || typeof phrase !== 'string' || phrase.trim() === '') {
    logger.debug('NameMatcher.matchNames: Invalid or empty phrase provided.');
    return {
      status: ResolutionStatus.NONE,
      target: null,
      error: 'No target name specified.',
    };
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    logger.debug(
      `NameMatcher.matchNames: No candidates provided to match against phrase "${phrase}".`
    );
    return {
      status: ResolutionStatus.NOT_FOUND,
      target: null,
      error: `Nothing found to match "${phrase}".`,
    };
  }

  const normalizedPhrase = phrase.toLowerCase().trim();
  const exactMatches = [];
  const startsWithMatches = [];
  const substringMatches = [];

  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim() === ''
    ) {
      logger.warn(
        `NameMatcher.matchNames: Skipping invalid candidate: ${JSON.stringify(candidate)}`
      );
      continue;
    }
    const normalizedCandidateName = candidate.name.toLowerCase().trim(); // Also trim candidate name

    if (normalizedCandidateName === normalizedPhrase) {
      exactMatches.push(candidate);
    } else if (normalizedCandidateName.startsWith(normalizedPhrase)) {
      startsWithMatches.push(candidate);
    } else if (normalizedCandidateName.includes(normalizedPhrase)) {
      substringMatches.push(candidate);
    }
  }

  logger.debug(
    `NameMatcher.matchNames - Phrase: "${normalizedPhrase}" - Exact: ${exactMatches.length}, StartsWith: ${startsWithMatches.length}, Substring: ${substringMatches.length}`
  );

  /** @type {MatcherResult} */
  let result;

  const formatAmbiguousErrorMessage = (matchedItems, term, type) => {
    const ambiguousNames = matchedItems
      .map((c) => `"${c.name}"`)
      .slice(0, 3)
      .join(', ');
    let message = `Which ${type === 'exact' ? `"${term}"` : `${type} "${term}"`} did you mean? For example: ${ambiguousNames}`;
    if (matchedItems.length > 3) {
      message += ' or others...';
    }
    message += '.'; // Added period for consistency
    return message;
  };

  if (exactMatches.length === 1) {
    logger.debug(
      `NameMatcher.matchNames: Unique exact match found: ID "${exactMatches[0].id}", Name "${exactMatches[0].name}".`
    );
    result = {
      status: ResolutionStatus.FOUND_UNIQUE,
      target: exactMatches[0],
    };
  } else if (exactMatches.length > 1) {
    logger.debug(
      `NameMatcher.matchNames: Ambiguous exact matches found for "${normalizedPhrase}". Count: ${exactMatches.length}.`
    );
    result = {
      status: ResolutionStatus.AMBIGUOUS,
      target: null,
      candidates: exactMatches,
      error: formatAmbiguousErrorMessage(exactMatches, phrase, 'exact'),
    };
  } else if (startsWithMatches.length === 1) {
    logger.debug(
      `NameMatcher.matchNames: Unique startsWith match found: ID "${startsWithMatches[0].id}", Name "${startsWithMatches[0].name}".`
    );
    result = {
      status: ResolutionStatus.FOUND_UNIQUE,
      target: startsWithMatches[0],
    };
  } else if (startsWithMatches.length > 1) {
    logger.debug(
      `NameMatcher.matchNames: Ambiguous startsWith matches found for "${normalizedPhrase}". Count: ${startsWithMatches.length}.`
    );
    result = {
      status: ResolutionStatus.AMBIGUOUS,
      target: null,
      candidates: startsWithMatches,
      error: formatAmbiguousErrorMessage(
        startsWithMatches,
        phrase,
        'item starting with'
      ),
    };
  } else if (substringMatches.length === 1) {
    logger.debug(
      `NameMatcher.matchNames: Unique substring match found: ID "${substringMatches[0].id}", Name "${substringMatches[0].name}".`
    );
    result = {
      status: ResolutionStatus.FOUND_UNIQUE,
      target: substringMatches[0],
    };
  } else if (substringMatches.length > 1) {
    logger.debug(
      `NameMatcher.matchNames: Ambiguous substring matches found for "${normalizedPhrase}". Count: ${substringMatches.length}.`
    );
    result = {
      status: ResolutionStatus.AMBIGUOUS,
      target: null,
      candidates: substringMatches,
      error: formatAmbiguousErrorMessage(
        substringMatches,
        phrase,
        'item containing'
      ),
    };
  } else {
    logger.debug(
      `NameMatcher.matchNames: No matches found for phrase "${normalizedPhrase}".`
    );
    result = {
      status: ResolutionStatus.NOT_FOUND,
      target: null,
      error: `Nothing found to match "${phrase}".`,
    };
  }
  return result;
}
