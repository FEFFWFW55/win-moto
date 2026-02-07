const express = require("express");
const router = express.Router();
// const sql = require("mssql"); // Removed
const db = require("../db");

router.post("/location", async (req, res) => {
  const { driver_id, lat, lng } = req.body;

  const pool = await db.getPool();
  await pool.execute(
    `UPDATE driver_location
     SET lat=?, lng=?, updated_at=NOW()
     WHERE driver_id=?`,
    [lat, lng, driver_id]
  );

  res.json({ success: true });
});

module.exports = router;
