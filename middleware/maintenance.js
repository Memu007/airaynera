function maintenanceGuard(req, res, next) {
  const on = String(process.env.MAINTENANCE || 'false').toLowerCase() === 'true';
  if (!on) return next();
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Maintenance window' });
}

module.exports = { maintenanceGuard };


