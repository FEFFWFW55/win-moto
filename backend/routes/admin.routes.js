const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('No token provided');

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, decoded) => {
        if (err) return res.status(403).send('Invalid token');
        if (decoded.role !== 'admin') return res.status(403).send('Not authorized');
        req.user = decoded;
        next();
    });
};

// Get all users
router.get('/users', isAdmin, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute('SELECT id, name, phone, password as passwordHash, role FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
