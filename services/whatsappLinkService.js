const crypto = require('node:crypto');
const sql = require('./sqlite');

const CODE_TTL_MS = 10 * 60 * 1000;

function domainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return `+549${digits}`;
  if (digits.length < 8 || digits.length > 15) {
    throw domainError('INVALID_PHONE', 'Ingresá un número de teléfono válido');
  }
  return `+${digits}`;
}

function maskPhone(phone) {
  if (!phone) return null;
  const visible = phone.slice(-4);
  return `${phone.slice(0, Math.max(3, phone.length - 7))}***${visible}`;
}

function publicLink(link, options = {}) {
  if (!link) {
    return {
      status: 'unlinked',
      phoneNumber: null,
      phoneMasked: null,
      expiresAt: null,
      linkedAt: null,
    };
  }

  return {
    status: link.status,
    phoneNumber: link.phoneNumber,
    phoneMasked: maskPhone(link.phoneNumber),
    expiresAt: link.codeExpiresAt,
    linkedAt: link.linkedAt,
    ...(options.includeCode && link.linkCode ? { code: link.linkCode } : {}),
  };
}

function getLink(userId, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  let link = sql.getWhatsappLink(userId);
  if (link?.status === 'pending' && new Date(link.codeExpiresAt) <= now) {
    link = sql.expireWhatsappLink(userId, now.toISOString());
  }
  return publicLink(link, { includeCode: Boolean(options.includeCode) });
}

function requestLink(userId, inputPhone, options = {}) {
  const phoneNumber = normalizePhone(inputPhone);
  const now = options.now ? new Date(options.now) : new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  const previousCode = sql.getWhatsappLink(userId)?.linkCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (code === previousCode) continue;
    try {
      const link = sql.requestWhatsappLink(
        userId,
        phoneNumber,
        code,
        expiresAt,
        now.toISOString()
      );
      return {
        link: publicLink(link, { includeCode: true }),
        command: `VINCULAR ${code}`,
      };
    } catch (error) {
      if (error.code !== 'LINK_CODE_CONFLICT' || attempt === 4) throw error;
    }
  }
  throw domainError('LINK_CODE_CONFLICT', 'No se pudo generar un código único');
}

function consumeCommand({ messageId, from, text }, options = {}) {
  const match = /^VINCULAR\s+(\d{6})$/i.exec(String(text || '').trim());
  if (!match) throw domainError('INVALID_LINK_COMMAND', 'Usá VINCULAR seguido del código de 6 dígitos');

  const now = options.now ? new Date(options.now) : new Date();
  const result = sql.consumeWhatsappLinkCode({
    messageId: String(messageId || ''),
    phoneNumber: normalizePhone(from),
    code: match[1],
    now: now.toISOString(),
  });

  return {
    link: publicLink(result.link),
    userId: result.link.userId,
    deduplicated: result.deduplicated,
  };
}

function resolveUserId(phone, options = {}) {
  const phoneNumber = normalizePhone(phone);
  const now = options.now ? new Date(options.now).toISOString() : new Date().toISOString();
  const link = sql.getLinkedWhatsappByPhone(phoneNumber);
  if (!link) return null;
  sql.touchWhatsappLink(link.userId, now);
  return link.userId;
}

function unlink(userId, options = {}) {
  const now = options.now ? new Date(options.now).toISOString() : new Date().toISOString();
  return publicLink(sql.unlinkWhatsapp(userId, now));
}

module.exports = {
  CODE_TTL_MS,
  normalizePhone,
  getLink,
  requestLink,
  consumeCommand,
  resolveUserId,
  unlink,
};
