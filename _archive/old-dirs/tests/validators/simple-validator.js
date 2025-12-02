// Validadores simples para tests
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

function validateRequired(data, requiredFields) {
    if (!data || typeof data !== 'object') return false;
    
    for (const field of requiredFields) {
        if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === '') {
            return false;
        }
    }
    return true;
}

function sanitizeInput(input) {
    if (input === null || input === undefined) return '';
    return String(input).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

module.exports = {
    validateEmail,
    validatePassword,
    validateRequired,
    sanitizeInput
};
