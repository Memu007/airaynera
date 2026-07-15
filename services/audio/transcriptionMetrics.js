function normalizeTranscript(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistance(referenceTokens, hypothesisTokens) {
  const previous = Array.from({ length: hypothesisTokens.length + 1 }, (_, index) => index);
  for (let row = 1; row <= referenceTokens.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= hypothesisTokens.length; column += 1) {
      const substitution = previous[column - 1]
        + (referenceTokens[row - 1] === hypothesisTokens[column - 1] ? 0 : 1);
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        substitution
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[hypothesisTokens.length];
}

function tokenErrorRate(reference, hypothesis, granularity) {
  const normalizedReference = normalizeTranscript(reference);
  const normalizedHypothesis = normalizeTranscript(hypothesis);
  const referenceTokens = granularity === 'character'
    ? [...normalizedReference.replace(/ /g, '')]
    : normalizedReference.split(' ').filter(Boolean);
  const hypothesisTokens = granularity === 'character'
    ? [...normalizedHypothesis.replace(/ /g, '')]
    : normalizedHypothesis.split(' ').filter(Boolean);
  const edits = editDistance(referenceTokens, hypothesisTokens);
  return {
    edits,
    referenceUnits: referenceTokens.length,
    rate: referenceTokens.length ? edits / referenceTokens.length : (edits ? 1 : 0),
  };
}

function scoreCriticalSpans(hypothesis, spans = []) {
  const normalizedHypothesis = normalizeTranscript(hypothesis);
  return spans.map((span) => {
    const accepted = Array.isArray(span.accepted) ? span.accepted : [span.accepted];
    const matchedVariant = accepted.find((variant) => {
      const normalizedVariant = normalizeTranscript(variant);
      return normalizedVariant && normalizedHypothesis.includes(normalizedVariant);
    });
    const hypothesisWithoutAccepted = accepted.reduce(
      (value, variant) => value.replaceAll(normalizeTranscript(variant), ' '),
      normalizedHypothesis
    );
    const forbidden = Array.isArray(span.forbidden) ? span.forbidden : [];
    const contradictionDetected = forbidden.some((variant) => {
      const normalizedVariant = normalizeTranscript(variant);
      return normalizedVariant && normalizeTranscript(hypothesisWithoutAccepted).includes(normalizedVariant);
    });
    return {
      id: span.id,
      kind: span.kind || 'clinical',
      matched: Boolean(matchedVariant) && !contradictionDetected,
      contradictionDetected,
    };
  });
}

function scoreTranscription(reference, hypothesis, criticalSpans = []) {
  return {
    wer: tokenErrorRate(reference, hypothesis, 'word'),
    cer: tokenErrorRate(reference, hypothesis, 'character'),
    criticalSpans: scoreCriticalSpans(hypothesis, criticalSpans),
  };
}

function aggregateScores(entries) {
  const totals = entries.reduce((accumulator, entry) => {
    accumulator.wordEdits += entry.wer.edits;
    accumulator.referenceWords += entry.wer.referenceUnits;
    accumulator.characterEdits += entry.cer.edits;
    accumulator.referenceCharacters += entry.cer.referenceUnits;
    for (const span of entry.criticalSpans) {
      accumulator.criticalTotal += 1;
      if (span.matched) accumulator.criticalMatched += 1;
      if (span.kind === 'negation') {
        accumulator.negationTotal += 1;
        if (span.matched) accumulator.negationMatched += 1;
      }
    }
    return accumulator;
  }, {
    wordEdits: 0,
    referenceWords: 0,
    characterEdits: 0,
    referenceCharacters: 0,
    criticalTotal: 0,
    criticalMatched: 0,
    negationTotal: 0,
    negationMatched: 0,
  });
  return {
    wer: totals.referenceWords ? totals.wordEdits / totals.referenceWords : 0,
    cer: totals.referenceCharacters ? totals.characterEdits / totals.referenceCharacters : 0,
    criticalAccuracy: totals.criticalTotal
      ? totals.criticalMatched / totals.criticalTotal
      : 1,
    negationAccuracy: totals.negationTotal
      ? totals.negationMatched / totals.negationTotal
      : 1,
    ...totals,
  };
}

module.exports = {
  aggregateScores,
  editDistance,
  normalizeTranscript,
  scoreCriticalSpans,
  scoreTranscription,
  tokenErrorRate,
};
