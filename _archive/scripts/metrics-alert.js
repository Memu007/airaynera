#!/usr/bin/env node
const axios = require('axios');

async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const errorRateThreshold = Number(process.env.ERROR_RATE_THRESHOLD || '0.01'); // 1%
  const rateLimitThreshold = Number(process.env.RATELIMIT_THRESHOLD || '10'); // hits por ventana
  const avgMsThreshold = Number(process.env.AVG_MS_THRESHOLD || '350');

  try {
    const { data } = await axios.get(`${baseUrl}/metrics`, { timeout: 5000 });
    const total = data.totalRequests || 0;
    const e5xx = data.responses5xx || 0;
    const rl = data.rateLimited || 0;
    const avgMs = data.avgResponseMs || 0;

    const errRate = total > 0 ? e5xx / total : 0;

    const problems = [];
    if (errRate > errorRateThreshold) problems.push(`5xx rate ${(errRate * 100).toFixed(2)}% > ${(errorRateThreshold*100)}%`);
    if (rl > rateLimitThreshold) problems.push(`rateLimited ${rl} > ${rateLimitThreshold}`);
    if (avgMs > avgMsThreshold) problems.push(`avgResponseMs ${avgMs}ms > ${avgMsThreshold}ms`);

    if (problems.length > 0) {
      console.error('ALERT:', problems.join(' | '));
      process.exit(2);
    }
    console.log('OK metrics:', { total, e5xx, rl, avgMs });
    process.exit(0);
  } catch (err) {
    console.error('METRICS_CHECK_FAILED:', err.message);
    process.exit(1);
  }
}

main();


