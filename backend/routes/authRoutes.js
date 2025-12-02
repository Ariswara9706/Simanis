// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userResult.rows[0];
    const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
    
    if (!passwordIsValid) return res.status(401).json({ message: 'Invalid Password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Catat Log
    await pool.query(
      `INSERT INTO activity_logs (user_id, action_type, description, ip_address) VALUES ($1, 'LOGIN', 'User logged in', $2)`,
      [user.id, req.ip]
    );

    res.status(200).json({
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        nama_lengkap: user.nama_lengkap
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;