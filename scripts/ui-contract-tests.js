#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const inlineJavaScript = Array.from(
  html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi),
  (match) => match[1]
).join('\n');

const controls = [
  ['sessionClinicalDate', 'clinicalDate'],
  ['sessionType', 'sessionType'],
  ['sessionDurationMinutes', 'durationMinutes'],
  ['sessionCareModality', 'careModality'],
  ['sessionRequiresFollowUp', 'requiresFollowUp'],
];

function assertControl(id, canonicalField) {
  assert.match(
    html,
    new RegExp(`\\bid=["']${id}["']`),
    `index.html must expose #${id}`
  );
  const directPayloadBinding = new RegExp(
    `\\b${canonicalField}\\s*:\\s*[^,;\\n]{0,200}\\b${id}\\b`
  );
  const localValueBinding = new RegExp(
    `\\b${canonicalField}\\s*=\\s*[^;\\n]{0,200}\\b${id}\\b`
  );
  assert.ok(
    directPayloadBinding.test(inlineJavaScript) || localValueBinding.test(inlineJavaScript),
    `the canonical field ${canonicalField} must be sourced from #${id}`
  );
}

try {
  for (const [id, canonicalField] of controls) assertControl(id, canonicalField);
  assert.match(
    html,
    /<input\b(?=[^>]*\bid=["']sessionRequiresFollowUp["'])(?=[^>]*\btype=["']checkbox["'])[^>]*>/i,
    '#sessionRequiresFollowUp must be an explicit checkbox'
  );
  assert.doesNotMatch(
    inlineJavaScript,
    /requiresFollowUp\s*[:=]\s*[^,;\n]*(?:moodAssessment|\bmood\b)/i,
    'requiresFollowUp must come from #sessionRequiresFollowUp, not be inferred from mood'
  );
  console.log('UI contract check passed for the explicit session fields.');
} catch (error) {
  console.error(`UI contract check failed: ${error.message}`);
  process.exitCode = 1;
}
