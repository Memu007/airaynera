#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-whatsapp-link-'));
process.env.DATA_DIR = tempDir;

const service = require('../services/whatsappLinkService');

function expectCode(action, code) {
  assert.throws(action, (error) => error?.code === code);
}

try {
  assert.equal(service.getLink('professional-a').status, 'unlinked');

  const pending = service.requestLink('professional-a', '11 2233-4455', {
    now: '2026-07-14T12:00:00.000Z',
  });
  assert.equal(pending.link.status, 'pending');
  assert.equal(pending.link.phoneNumber, '+5491122334455');
  assert.match(pending.command, /^VINCULAR \d{6}$/);

  expectCode(
    () => service.consumeCommand({
      messageId: 'wrong-phone',
      from: '+5491199999999',
      text: pending.command,
    }, { now: '2026-07-14T12:01:00.000Z' }),
    'PHONE_MISMATCH'
  );

  expectCode(
    () => service.requestLink('professional-b', '+5491122334455', {
      now: '2026-07-14T12:01:00.000Z',
    }),
    'PHONE_ALREADY_IN_USE'
  );

  const linked = service.consumeCommand({
    messageId: 'link-message-1',
    from: '+54 9 11 2233-4455',
    text: pending.command,
  }, { now: '2026-07-14T12:02:00.000Z' });
  assert.equal(linked.link.status, 'linked');
  assert.equal(linked.userId, 'professional-a');
  assert.equal(linked.deduplicated, false);

  const repeated = service.consumeCommand({
    messageId: 'link-message-1',
    from: '+5491122334455',
    text: pending.command,
  }, { now: '2026-07-14T12:03:00.000Z' });
  assert.equal(repeated.deduplicated, true);
  expectCode(
    () => service.consumeCommand({
      messageId: 'link-message-1',
      from: '+5491199999999',
      text: pending.command,
    }, { now: '2026-07-14T12:03:00.000Z' }),
    'PHONE_MISMATCH'
  );
  assert.equal(service.resolveUserId('+5491122334455'), 'professional-a');

  assert.equal(service.unlink('professional-a').status, 'unlinked');
  assert.equal(service.resolveUserId('+5491122334455'), null);
  const delayedRetry = service.consumeCommand({
    messageId: 'link-message-1',
    from: '+5491122334455',
    text: pending.command,
  }, { now: '2026-07-14T12:10:00.000Z' });
  assert.equal(delayedRetry.deduplicated, true);
  assert.equal(delayedRetry.link.status, 'linked');
  assert.equal(service.resolveUserId('+5491122334455'), null);

  service.requestLink('stale-owner', '+5491177777777', {
    now: '2026-07-14T12:30:00.000Z',
  });
  const reclaimed = service.requestLink('new-owner', '+5491177777777', {
    now: '2026-07-14T12:41:00.000Z',
  });
  assert.equal(reclaimed.link.status, 'pending');
  assert.equal(service.getLink('stale-owner').status, 'expired');
  service.unlink('new-owner');

  const expiring = service.requestLink('professional-a', '+5491166666666', {
    now: '2026-07-14T13:00:00.000Z',
  });
  expectCode(
    () => service.consumeCommand({
      messageId: 'expired-message',
      from: '+5491166666666',
      text: expiring.command,
    }, { now: '2026-07-14T13:11:00.000Z' }),
    'LINK_CODE_EXPIRED'
  );
  const expired = service.getLink('professional-a', { now: '2026-07-14T13:11:00.000Z' });
  assert.equal(expired.status, 'expired');
  assert.equal(expired.phoneNumber, null);

  const regenerated = service.requestLink('professional-a', '+5491166666666', {
    now: '2026-07-14T13:12:00.000Z',
  });
  assert.notEqual(regenerated.command, expiring.command);
  expectCode(
    () => service.consumeCommand({
      messageId: 'old-code-message',
      from: '+5491166666666',
      text: expiring.command,
    }, { now: '2026-07-14T13:13:00.000Z' }),
    'INVALID_LINK_CODE'
  );

  console.log('✅ WhatsApp linking handles identity, conflicts, deduplication and expiry');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
