const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { validateUser } = require('../middleware/validation');
const User = require('../models/user');

// Get all users (admin only)
router.get('/',
    auth.verifyToken,
    auth.isAdmin,
    asyncHandler(async (req, res) => {
        const users = await User.find().select('-password');
        res.json({ users });
    })
);

// Get user by ID
router.get('/:id',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    })
);

// Update user
router.put('/:id',
    auth.verifyToken,
    validateUser.update,
    asyncHandler(async (req, res) => {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    })
);

// Delete user
router.delete('/:id',
    auth.verifyToken,
    auth.isAdmin,
    asyncHandler(async (req, res) => {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    })
);

module.exports = router; 