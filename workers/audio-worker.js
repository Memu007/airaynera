#!/usr/bin/env node

const crypto = require('node:crypto');
const sql = require('../services/sqlite');
const audioDraftPipeline = require('../services/audioDraftPipeline');
const temporaryAudioStore = require('../services/audio/temporaryAudioStore');

function configuredPositiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function leaseMs() {
  return configuredPositiveNumber(
    'AUDIO_JOB_LEASE_MS',
    configuredPositiveNumber('AUDIO_PROCESSING_LEASE_MS', 5 * 60 * 1000)
  );
}

function pollMs() {
  return configuredPositiveNumber('AUDIO_WORKER_POLL_MS', 500);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function publicWorkerError(error) {
  return {
    errorCode: error?.code || 'AUDIO_JOB_FAILED',
    errorMessage: error?.message || 'Audio processing job failed',
  };
}

class AudioWorker {
  constructor(options = {}) {
    this.workerId = options.workerId || `audio-worker-${process.pid}-${crypto.randomUUID()}`;
    this.stopping = false;
    this.sweepCounter = 0;
  }

  cleanupMediaForUser(userId, draft) {
    if (!temporaryAudioStore.isUploadReference(draft?.mediaReference)) return;
    if (!draft.rawTranscript && !['ready', 'confirmed', 'cancelled'].includes(draft.status)) return;
    const removed = temporaryAudioStore.remove(draft.mediaReference);
    if (removed) sql.markSessionDraftMediaDeleted(userId, draft.id);
  }

  async sweepOrphans(force = false) {
    this.sweepCounter += 1;
    if (!force && this.sweepCounter % 120 !== 0) return 0;
    for (const expired of sql.listExpiredAudioUploads()) {
      const expiration = sql.expireAudioUpload(expired.userId, expired.draftId);
      if (!expiration.expired) continue;
      const removed = temporaryAudioStore.remove(expired.mediaReference);
      if (removed) sql.markSessionDraftMediaDeleted(expired.userId, expired.draftId);
    }
    for (const pending of sql.listAudioUploadsPendingCleanup()) {
      const removed = temporaryAudioStore.remove(pending.mediaReference);
      if (removed) sql.markSessionDraftMediaDeleted(pending.userId, pending.draftId);
    }
    return temporaryAudioStore.cleanupOrphans(
      sql.listRequiredAudioUploadReferences(),
      { olderThanMs: temporaryAudioStore.retentionMs() }
    );
  }

  async runOnce() {
    const currentLeaseMs = leaseMs();
    const job = sql.claimNextAudioProcessingJob(this.workerId, currentLeaseMs);
    if (!job) {
      await this.sweepOrphans();
      return null;
    }

    const heartbeat = setInterval(() => {
      sql.renewAudioProcessingJob(
        job.id,
        this.workerId,
        job.leaseToken,
        currentLeaseMs
      );
    }, Math.max(10, Math.min(1000, Math.floor(currentLeaseMs / 3))));
    heartbeat.unref?.();

    try {
      const result = await Promise.resolve(audioDraftPipeline.processDraft(
        job.userId,
        job.draftId,
        { jobLeaseToken: job.leaseToken }
      ));
      if (!result.draft) return { job, leaseLost: true };

      const finished = sql.finishAudioProcessingJob(
        job.id,
        this.workerId,
        job.leaseToken,
        result.failed
          ? {
              status: 'failed',
              errorCode: result.draft.failure?.code,
              errorMessage: result.draft.failure?.message,
            }
          : { status: 'completed' }
      );
      if (finished) this.cleanupMediaForUser(job.userId, result.draft);
      return { job, draft: result.draft, failed: Boolean(result.failed), leaseLost: !finished };
    } catch (error) {
      sql.renewAudioProcessingJob(
        job.id,
        this.workerId,
        job.leaseToken,
        currentLeaseMs
      );
      let draft = null;
      try {
        draft = audioDraftPipeline.failDraftFromWorker(
          job.userId,
          job.draftId,
          error,
          { jobLeaseToken: job.leaseToken }
        );
      } catch (_) {
        // The job still needs a terminal state even if draft recovery also fails.
      }
      const finished = sql.finishAudioProcessingJob(
        job.id,
        this.workerId,
        job.leaseToken,
        { status: 'failed', ...publicWorkerError(error) }
      );
      if (finished) this.cleanupMediaForUser(job.userId, draft);
      return { job, draft, error, leaseLost: !finished };
    } finally {
      clearInterval(heartbeat);
    }
  }

  async run() {
    await this.sweepOrphans(true);
    while (!this.stopping) {
      const result = await this.runOnce();
      if (!result && !this.stopping) await sleep(pollMs());
    }
  }

  stop() {
    this.stopping = true;
  }
}

async function main() {
  sql.getDb();
  const worker = new AudioWorker();
  if (process.argv.includes('--once')) {
    await worker.runOnce();
    return;
  }

  const stop = () => worker.stop();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  await worker.run();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Audio worker stopped:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  AudioWorker,
  leaseMs,
};
