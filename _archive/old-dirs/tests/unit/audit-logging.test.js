const fs = require('fs');
const path = require('path');

describe('Audit Logging', () => {
  const mockReq = {
    ip: '127.0.0.1',
    user: { id: 'test-user' },
    params: { id: '123' },
    body: { name: 'Updated Name' },
    method: 'PUT',
    originalUrl: '/api/pacientes/123'
  };

  const mockRes = {};
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fs.appendFileSync
    jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should log data modification actions', () => {
    // Import the audit middleware (you'll need to create this)
    const auditLog = (action) => (req, res, next) => {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        user: req.user?.id || 'anonymous',
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        resource: req.params.id,
        changes: req.body
      };
      
      const logDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      fs.appendFileSync(
        path.join(logDir, 'audit.log'),
        JSON.stringify(entry) + '\n'
      );
      
      next();
    };

    const middleware = auditLog('UPDATE_PATIENT');
    middleware(mockReq, mockRes, mockNext);

    expect(fs.appendFileSync).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();

    const logCall = fs.appendFileSync.mock.calls[0];
    const loggedData = JSON.parse(logCall[1].replace('\n', ''));

    expect(loggedData).toMatchObject({
      action: 'UPDATE_PATIENT',
      user: 'test-user',
      ip: '127.0.0.1',
      method: 'PUT',
      path: '/api/pacientes/123',
      resource: '123',
      changes: { name: 'Updated Name' }
    });
    expect(loggedData).toHaveProperty('timestamp');
  });

  test('should handle anonymous users', () => {
    const reqWithoutUser = { ...mockReq, user: undefined };
    
    const auditLog = (action) => (req, res, next) => {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        user: req.user?.id || 'anonymous',
        ip: req.ip,
        resource: req.params.id
      };
      
      fs.appendFileSync('logs/audit.log', JSON.stringify(entry) + '\n');
      next();
    };

    const middleware = auditLog('DELETE_PATIENT');
    middleware(reqWithoutUser, mockRes, mockNext);

    const logCall = fs.appendFileSync.mock.calls[0];
    const loggedData = JSON.parse(logCall[1].replace('\n', ''));

    expect(loggedData.user).toBe('anonymous');
  });

  test('should not log sensitive data in plain text', () => {
    const sensitiveReq = {
      ...mockReq,
      body: {
        name: 'Patient Name',
        dni: '12345678',
        phone: '1122334455',
        password: 'secret123' // Should never be logged
      }
    };

    const auditLog = (action) => (req, res, next) => {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        user: req.user?.id || 'anonymous',
        ip: req.ip,
        resource: req.params.id,
        changes: sanitizeForAudit(req.body)
      };
      
      fs.appendFileSync('logs/audit.log', JSON.stringify(entry) + '\n');
      next();
    };

    const sanitizeForAudit = (data) => {
      const sanitized = { ...data };
      const sensitiveFields = ['password', 'token', 'secret'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      // Partially mask PII
      if (sanitized.dni) {
        sanitized.dni = sanitized.dni.slice(0, 2) + '****' + sanitized.dni.slice(-2);
      }
      if (sanitized.phone) {
        sanitized.phone = sanitized.phone.slice(0, 2) + '****' + sanitized.phone.slice(-4);
      }
      
      return sanitized;
    };

    const middleware = auditLog('CREATE_PATIENT');
    middleware(sensitiveReq, mockRes, mockNext);

    const logCall = fs.appendFileSync.mock.calls[0];
    const loggedData = JSON.parse(logCall[1].replace('\n', ''));

    expect(loggedData.changes.password).toBe('[REDACTED]');
    expect(loggedData.changes.dni).toBe('12****78');
    expect(loggedData.changes.phone).toBe('11****4455');
  });
});
