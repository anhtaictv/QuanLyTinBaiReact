const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');

// Tất cả route ở đây đã được mount với verifyToken + isAdmin ở server.js

// GET /api/errors/unread-count
router.get('/unread-count', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT COUNT(*) as UnreadCount FROM dbo.ErrorLogs WHERE IsRead = 0');
        res.json({ count: result.recordset[0].UnreadCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/errors?unreadOnly=true&limit=50
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const unreadOnly = req.query.unreadOnly === 'true';
        const pool = await poolPromise;
        const result = await pool.request()
            .input('limit', limit)
            .query(`
                SELECT TOP (@limit) ErrorID, Source, Message, StackTrace, UserID, Method, Path, IsRead, CreatedAt
                FROM dbo.ErrorLogs
                ${unreadOnly ? 'WHERE IsRead = 0' : ''}
                ORDER BY CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/errors/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.id)
            .query('UPDATE dbo.ErrorLogs SET IsRead = 1 WHERE ErrorID = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/errors/read-all
router.put('/read-all', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request().query('UPDATE dbo.ErrorLogs SET IsRead = 1 WHERE IsRead = 0');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
