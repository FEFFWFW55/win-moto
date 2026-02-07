const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');

router.post('/register', async (req, res) => {
  try {
    const { phone, password, role } = req.body;
    if (!phone || !password || !role) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    const displayName = req.body.name || 'User';
    const hash = await bcrypt.hash(password, 10);

    const pool = await getPool();
    const [result] = await pool.execute(
      'INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)',
      [displayName, phone, hash, role]
    );

    const token = jwt.sign(
      { id: result.insertId, role, name: displayName },
      process.env.JWT_SECRET || 'secret_key'
    );

    res.json({
      message: 'REGISTER_SUCCESS',
      token,
      role,
      name: displayName,
      phone
    });
  } catch (err) {
    console.error('Register Error:', err);
    if (err.message.includes('unique') || err.message.includes('Violation of UNIQUE KEY constraint') || err.message.includes('Duplicate entry')) {
      return res.status(400).json({ message: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
    }
    res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'กรุณากรอกเบอร์โทรและรหัสผ่าน' });
    }

    const pool = await getPool();
    const [rows] = await pool.execute('SELECT * FROM users WHERE phone = ?', [phone]);

    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret_key'
    );

    res.json({ token, role: user.role, name: user.name, phone: user.phone });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

module.exports = router;
