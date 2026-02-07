const express = require("express");
const router = express.Router();
// const sql = require("mssql"); // Removed
const db = require("../db");

router.post("/accept", async (req, res) => {
  const { order_id, driver_id } = req.body;

  try {
    const pool = await db.getPool();
    await pool.execute(`
        UPDATE orders
        SET driver_id=?, status='ON_ROUTE'
        WHERE id=? AND status='WAITING'
      `,
      [driver_id, order_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
