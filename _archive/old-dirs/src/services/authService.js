const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

class AuthService {
    constructor() {
        this.db = getDb();
        this.usersCollection = this.db.collection('users');
        this.sessionsCollection = this.db.collection('sessions');
        // Security: JWT secrets are now required - NO fallback secrets for security
        this.JWT_SECRET = process.env.JWT_SECRET;
        this.REFRESH_SECRET = process.env.REFRESH_SECRET;

        if (!this.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is required for security');
        }
        if (!this.REFRESH_SECRET) {
            throw new Error('REFRESH_SECRET environment variable is required for security');
        }
    }

    async register(userData) {
        const { email, password, name, role = 'user' } = userData;

        if (!email || !password || !name) {
            throw new Error('Email, password, and name are required');
        }

        // Check if user already exists
        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            email,
            password: hashedPassword,
            name,
            role,
            isActive: true,
            isLocked: false,
            failedLoginAttempts: 0,
            lastFailedAttempt: null,
            lastLogin: null,
            lastLoginIP: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await this.usersCollection.add(user);
        const userId = docRef.id;

        return {
            id: userId,
            email,
            name,
            role,
            isActive: true
        };
    }

    async login(email, password, ipAddress = 'unknown') {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const user = await this.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }

        if (user.isLocked) {
            throw new Error('Account is locked');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            await this.recordFailedAttempt(user.id);
            throw new Error('Invalid credentials');
        }

        await this.resetFailedAttempts(user.id);
        await this.updateLastLogin(user.id, ipAddress);

        const tokens = await this.generateTokens(user);
        await this.createSession(user.id, tokens.refreshToken, ipAddress);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            tokens
        };
    }

    async findByEmail(email) {
        const snapshot = await this.usersCollection
            .where('email', '==', email)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return {
            id: doc.id,
            ...doc.data()
        };
    }

    async findById(userId) {
        const doc = await this.usersCollection.doc(userId).get();
        if (!doc.exists) {
            return null;
        }
        return {
            id: doc.id,
            ...doc.data()
        };
    }

    async recordFailedAttempt(userId) {
        const user = await this.findById(userId);
        if (!user) return;

        const failedAttempts = (user.failedLoginAttempts || 0) + 1;
        const shouldLock = failedAttempts >= 5;

        await this.usersCollection.doc(userId).update({
            failedLoginAttempts: failedAttempts,
            lastFailedAttempt: new Date().toISOString(),
            isLocked: shouldLock
        });
    }

    async resetFailedAttempts(userId) {
        await this.usersCollection.doc(userId).update({
            failedLoginAttempts: 0,
            lastFailedAttempt: null
        });
    }

    async updateLastLogin(userId, ipAddress) {
        await this.usersCollection.doc(userId).update({
            lastLogin: new Date().toISOString(),
            lastLoginIP: ipAddress
        });
    }

    async generateTokens(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        const accessToken = jwt.sign(payload, this.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign(payload, this.REFRESH_SECRET, { expiresIn: '7d' });

        return {
            accessToken,
            refreshToken
        };
    }

    async createSession(userId, refreshToken, ipAddress, userAgent = 'unknown') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.sessionsCollection.add({
            userId,
            refreshToken,
            ipAddress,
            userAgent,
            isActive: true,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        });
    }

    async findSessionByToken(refreshToken) {
        try {
            const snapshot = await this.sessionsCollection
                .where('refreshToken', '==', refreshToken)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Error finding session:', error);
            return null;
        }
    }

    async invalidateSession(refreshToken) {
        const session = await this.findSessionByToken(refreshToken);
        if (!session) return;

        const batch = this.db.batch();
        const sessionRef = this.sessionsCollection.doc(session.id);
        batch.update(sessionRef, { isActive: false });

        await batch.commit();
    }

    async refreshToken(refreshToken) {
        if (!refreshToken) {
            throw new Error('Refresh token is required');
        }

        try {
            const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET);
            const session = await this.findSessionByToken(refreshToken);

            if (!session) {
                throw new Error('Invalid refresh token');
            }

            const user = await this.findById(decoded.id);
            if (!user) {
                throw new Error('User not found');
            }

            const newTokens = await this.generateTokens(user);
            await this.invalidateSession(refreshToken);
            await this.createSession(user.id, newTokens.refreshToken, session.ipAddress);

            return newTokens;
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async deactivateUser(userId) {
        await this.usersCollection.doc(userId).update({
            isActive: false,
            updatedAt: new Date().toISOString()
        });
    }

    async activateUser(userId) {
        await this.usersCollection.doc(userId).update({
            isActive: true,
            isLocked: false,
            failedLoginAttempts: 0,
            updatedAt: new Date().toISOString()
        });
    }

    async lockUser(userId) {
        await this.usersCollection.doc(userId).update({
            isLocked: true,
            updatedAt: new Date().toISOString()
        });
    }

    async unlockUser(userId) {
        await this.usersCollection.doc(userId).update({
            isLocked: false,
            failedLoginAttempts: 0,
            updatedAt: new Date().toISOString()
        });
    }

    async changePassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.usersCollection.doc(userId).update({
            password: hashedPassword,
            updatedAt: new Date().toISOString()
        });
    }

    async getUserSessions(userId) {
        const snapshot = await this.sessionsCollection
            .where('userId', '==', userId)
            .where('isActive', '==', true)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async invalidateAllSessions(userId) {
        const snapshot = await this.sessionsCollection
            .where('userId', '==', userId)
            .where('isActive', '==', true)
            .get();

        const batch = this.db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isActive: false });
        });

        await batch.commit();
    }
}

module.exports = new AuthService();
