const ERROR_WINDOW_MS = parseInt(process.env.HEALTH_ERROR_WINDOW_MS || '60000', 10);
const ERROR_5XX_THRESHOLD = parseInt(process.env.HEALTH_5XX_THRESHOLD || '5', 10);

const metrics = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  responses2xx: 0,
  responses4xx: 0,
  responses5xx: 0,
  totalResponseMs: 0,
  rateLimited: 0,
  last5xxTimestamps: [],
};

function prune5xx(now) {
  const cutoff = now - ERROR_WINDOW_MS;
  while (metrics.last5xxTimestamps.length && metrics.last5xxTimestamps[0] < cutoff) {
    metrics.last5xxTimestamps.shift();
  }
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    metrics.totalRequests += 1;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.totalResponseMs += ms;
    const status = res.statusCode;
    if (status >= 200 && status < 300) metrics.responses2xx += 1;
    else if (status >= 400 && status < 500) metrics.responses4xx += 1;
    else if (status >= 500) {
      metrics.responses5xx += 1;
      const now = Date.now();
      metrics.last5xxTimestamps.push(now);
      prune5xx(now);
    }
  });
  next();
}

function getMetrics() {
  const avgMs = metrics.totalRequests > 0 ? metrics.totalResponseMs / metrics.totalRequests : 0;
  const now = Date.now();
  prune5xx(now);
  return { ...metrics, avgResponseMs: Math.round(avgMs), errorWindowMs: ERROR_WINDOW_MS, last5xxInWindow: metrics.last5xxTimestamps.length };
}

function incrementRateLimited() {
  metrics.rateLimited += 1;
}

function getHealthStatus() {
  const now = Date.now();
  prune5xx(now);
  const last5xx = metrics.last5xxTimestamps.length;
  const degraded = last5xx >= ERROR_5XX_THRESHOLD;
  return {
    status: degraded ? 'degraded' : 'ok',
    last5xxInWindow: last5xx,
    errorWindowMs: ERROR_WINDOW_MS,
    threshold: ERROR_5XX_THRESHOLD,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { metricsMiddleware, getMetrics, incrementRateLimited, getHealthStatus };


