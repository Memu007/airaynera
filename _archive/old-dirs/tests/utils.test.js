const crypto = require('crypto');

// Mock encryption utility
class MockEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    // Use a fixed salt for deterministic key generation in tests
    this.secretKey = crypto.scryptSync('test-secret', 'test-salt', 32);
  }

  encrypt(text) {
    if (!text) return '';
    
    // Use a fixed IV for deterministic encryption in tests
    const iv = Buffer.alloc(16, 0); 
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText) {
    if (!encryptedText) return '';
    
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const tag = Buffer.from(textParts.shift(), 'hex');
      const encrypted = textParts.join(':');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      // Return a specific error message for easier debugging in tests
      return 'decryption_failed';
    }
  }

  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verify(data, hash) {
    return this.hash(data) === hash;
  }
}

// Mock validators
const validators = {
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  validatePassword: (password) => {
    return password && password.length >= 8;
  },

  validatePhone: (phone) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone);
  },

  validateDNI: (dni) => {
    return dni && dni.length >= 7 && dni.length <= 8 && /^\d+$/.test(dni);
  },

  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }
};

// Mock date utilities
const dateUtils = {
  formatDate: (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  isValidDate: (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  },

  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  isWeekend: (date) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }
};

describe('Utility Functions Tests', () => {
  describe('Encryption Utilities', () => {
    let encryption;

    beforeEach(() => {
      encryption = new MockEncryption();
    });

    test('should encrypt and decrypt text successfully', () => {
      const originalText = 'sensitive patient data';
      const encrypted = encryption.encrypt(originalText);
      const decrypted = encryption.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    test('should handle empty strings', () => {
      expect(encryption.encrypt('')).toBe('');
      expect(encryption.decrypt('')).toBe('');
    });

    test('should create consistent hashes', () => {
      const data = 'test data';
      const hash1 = encryption.hash(data);
      const hash2 = encryption.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 character hex string
    });

    test('should verify hashes correctly', () => {
      const data = 'test data';
      const hash = encryption.hash(data);

      expect(encryption.verify(data, hash)).toBe(true);
      expect(encryption.verify('wrong data', hash)).toBe(false);
    });

    test('should produce different hashes for different inputs', () => {
      const hash1 = encryption.hash('data1');
      const hash2 = encryption.hash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Validation Utilities', () => {
    describe('Email validation', () => {
      test('should validate correct email formats', () => {
        expect(validators.validateEmail('test@example.com')).toBe(true);
        expect(validators.validateEmail('user.name@domain.co.uk')).toBe(true);
        expect(validators.validateEmail('user+tag@example.org')).toBe(true);
      });

      test('should reject invalid email formats', () => {
        expect(validators.validateEmail('invalid-email')).toBe(false);
        expect(validators.validateEmail('test@')).toBe(false);
        expect(validators.validateEmail('@example.com')).toBe(false);
        expect(validators.validateEmail('')).toBe(false);
      });
    });

    describe('Password validation', () => {
      test('should validate strong passwords', () => {
        expect(validators.validatePassword('password123')).toBe(true);
        expect(validators.validatePassword('mySecurePass')).toBe(true);
      });

      test('should reject weak passwords', () => {
        expect(validators.validatePassword('123')).toBe(false);
        expect(validators.validatePassword('short')).toBe(false);
        expect(validators.validatePassword('')).toBe(false);
        expect(validators.validatePassword(null)).toBe(false);
      });
    });

    describe('Phone validation', () => {
      test('should validate phone numbers', () => {
        expect(validators.validatePhone('+5491123456789')).toBe(true);
        expect(validators.validatePhone('011-1234-5678')).toBe(true);
        expect(validators.validatePhone('(011) 1234 5678')).toBe(true);
      });

      test('should reject invalid phone numbers', () => {
        expect(validators.validatePhone('abc123')).toBe(false);
        expect(validators.validatePhone('123abc')).toBe(false);
        expect(validators.validatePhone('')).toBe(false);
      });
    });

    describe('DNI validation', () => {
      test('should validate Argentine DNI format', () => {
        expect(validators.validateDNI('12345678')).toBe(true);
        expect(validators.validateDNI('1234567')).toBe(true);
      });

      test('should reject invalid DNI', () => {
        expect(validators.validateDNI('123456')).toBe(false); // too short
        expect(validators.validateDNI('123456789')).toBe(false); // too long
        expect(validators.validateDNI('12345abc')).toBe(false); // contains letters
        expect(validators.validateDNI('')).toBe(false);
      });
    });

    describe('Input sanitization', () => {
      test('should remove script tags', () => {
        const maliciousInput = '<script>alert("xss")</script>Hello';
        const sanitized = validators.sanitizeInput(maliciousInput);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toBe('Hello');
      });

      test('should remove HTML tags', () => {
        const htmlInput = '<div>Hello <b>World</b></div>';
        const sanitized = validators.sanitizeInput(htmlInput);
        
        expect(sanitized).toBe('divHello bWorld/b/div');
      });

      test('should trim whitespace', () => {
        const input = '  Hello World  ';
        const sanitized = validators.sanitizeInput(input);
        
        expect(sanitized).toBe('Hello World');
      });

      test('should handle non-string inputs', () => {
        expect(validators.sanitizeInput(123)).toBe(123);
        expect(validators.sanitizeInput(null)).toBe(null);
        expect(validators.sanitizeInput(undefined)).toBe(undefined);
      });
    });
  });

  describe('Date Utilities', () => {
    test('should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = dateUtils.formatDate(date);
      
      expect(formatted).toBe('2024-01-15');
    });

    test('should handle invalid dates', () => {
      expect(dateUtils.formatDate(null)).toBe('');
      expect(dateUtils.formatDate('')).toBe('');
    });

    test('should validate date strings', () => {
      expect(dateUtils.isValidDate('2024-01-15')).toBe(true);
      expect(dateUtils.isValidDate('2024-02-29')).toBe(true); // leap year
      expect(dateUtils.isValidDate('invalid-date')).toBe(false);
      expect(dateUtils.isValidDate('')).toBe(false);
    });

    test('should add days to dates', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 15)); // Use UTC for consistency
      const futureDate = dateUtils.addDays(baseDate, 5);
      
      expect(futureDate.getUTCDate()).toBe(20);
    });

    test('should identify weekends', () => {
      const saturday = new Date('2024-01-13T12:00:00Z'); // Saturday in UTC
      const sunday = new Date('2024-01-14T12:00:00Z');   // Sunday in UTC
      const monday = new Date('2024-01-15T12:00:00Z');   // Monday in UTC
      
      // Mock getDay to be getUTCDay for testing purposes if needed, but the Z indicates UTC
      expect(dateUtils.isWeekend(saturday)).toBe(true);
      expect(dateUtils.isWeekend(sunday)).toBe(true);
      expect(dateUtils.isWeekend(monday)).toBe(false);
    });
  });

  describe('Error Handling Utilities', () => {
    test('should create structured error responses', () => {
      const createErrorResponse = (message, code, statusCode) => ({
        error: message,
        code: code,
        statusCode: statusCode,
        timestamp: new Date().toISOString()
      });

      const error = createErrorResponse('User not found', 'USER_NOT_FOUND', 404);
      
      expect(error).toHaveProperty('error', 'User not found');
      expect(error).toHaveProperty('code', 'USER_NOT_FOUND');
      expect(error).toHaveProperty('statusCode', 404);
      expect(error).toHaveProperty('timestamp');
    });

    test('should handle async errors', async () => {
      const asyncFunction = async (shouldFail) => {
        if (shouldFail) {
          throw new Error('Async operation failed');
        }
        return 'success';
      };

      await expect(asyncFunction(true)).rejects.toThrow('Async operation failed');
      await expect(asyncFunction(false)).resolves.toBe('success');
    });
  });

  describe('Data Processing Utilities', () => {
    test('should paginate results', () => {
      const paginate = (array, page, limit) => {
        const offset = (page - 1) * limit;
        return {
          data: array.slice(offset, offset + limit),
          total: array.length,
          page: page,
          totalPages: Math.ceil(array.length / limit)
        };
      };

      const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = paginate(data, 2, 10);
      
      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(11);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    test('should filter and sort data', () => {
      const filterAndSort = (array, filterFn, sortFn) => {
        return array.filter(filterFn).sort(sortFn);
      };

      const patients = [
        { name: 'Juan Pérez', age: 30 },
        { name: 'María García', age: 25 },
        { name: 'Carlos López', age: 35 }
      ];

      const result = filterAndSort(
        patients,
        p => p.age >= 30,
        (a, b) => a.name.localeCompare(b.name)
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Carlos López');
      expect(result[1].name).toBe('Juan Pérez');
    });
  });
}); 