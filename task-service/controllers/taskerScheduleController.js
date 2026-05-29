const pool = require("../db");

// GET /taskers/:tasker_id/schedule
exports.getSchedule = async (req, res) => {
  const { tasker_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM tasker_schedules WHERE tasker_id = $1 ORDER BY day_of_week`,
      [tasker_id]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching tasker schedule:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /taskers/:tasker_id/schedule
// Body: [{ day_of_week, morning_available, afternoon_available, evening_available, is_active }]
exports.upsertSchedule = async (req, res) => {
  const { tasker_id } = req.params;
  const days = req.body;

  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: "Body must be a non-empty array of schedule days" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];
    for (const day of days) {
      const {
        day_of_week,
        morning_available = true,
        afternoon_available = true,
        evening_available = true,
        is_active = true,
      } = day;
      if (day_of_week === undefined) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each entry requires day_of_week" });
      }
      const row = await client.query(
        `INSERT INTO tasker_schedules (tasker_id, day_of_week, morning_available, afternoon_available, evening_available, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tasker_id, day_of_week)
         DO UPDATE SET
           morning_available = EXCLUDED.morning_available,
           afternoon_available = EXCLUDED.afternoon_available,
           evening_available = EXCLUDED.evening_available,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING *`,
        [tasker_id, day_of_week, morning_available, afternoon_available, evening_available, is_active]
      );
      results.push(row.rows[0]);
    }
    await client.query("COMMIT");
    return res.status(200).json(results);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error upserting tasker schedule:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// GET /taskers/:tasker_id/available-slots?date=YYYY-MM-DD
// Returns which time preferences (morning/afternoon/evening) are available for a given date.
exports.getAvailableSlots = async (req, res) => {
  const { tasker_id } = req.params;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const targetDate = new Date(date + "T00:00:00Z");
    const dayOfWeek = targetDate.getUTCDay(); // 0=Sun…6=Sat

    const scheduleResult = await pool.query(
      `SELECT morning_available, afternoon_available, evening_available, is_active
       FROM tasker_schedules
       WHERE tasker_id = $1 AND day_of_week = $2`,
      [tasker_id, dayOfWeek]
    );

    if (scheduleResult.rows.length === 0 || !scheduleResult.rows[0].is_active) {
      return res.status(200).json({
        available: false,
        morning: false,
        afternoon: false,
        evening: false,
        message: "Tasker is not available on this day",
      });
    }

    const s = scheduleResult.rows[0];

    // Find slots blocked by accepted/in_progress/completed tasks
    const bookedResult = await pool.query(
      `SELECT time_preference FROM tasks
       WHERE tasker_id = $1
         AND DATE(scheduled_at) = $2::date
         AND status IN ('accepted', 'in_progress', 'completed')
         AND time_preference IS NOT NULL`,
      [tasker_id, date]
    );
    const bookedSlots = new Set(bookedResult.rows.map(r => r.time_preference));

    // Count pending tasks per slot so customers can see "Full" slots
    const pendingResult = await pool.query(
      `SELECT time_preference, COUNT(*) AS cnt FROM tasks
       WHERE tasker_id = $1
         AND DATE(scheduled_at) = $2::date
         AND status = 'pending'
         AND time_preference IS NOT NULL
       GROUP BY time_preference`,
      [tasker_id, date]
    );
    const pendingCounts = {};
    for (const row of pendingResult.rows) {
      pendingCounts[row.time_preference] = parseInt(row.cnt);
    }

    const morning   = s.morning_available   && !bookedSlots.has('morning');
    const afternoon = s.afternoon_available && !bookedSlots.has('afternoon');
    const evening   = s.evening_available   && !bookedSlots.has('evening');

    return res.status(200).json({
      available: morning || afternoon || evening,
      morning,
      afternoon,
      evening,
      pending_count: {
        morning:   pendingCounts['morning']   ?? 0,
        afternoon: pendingCounts['afternoon'] ?? 0,
        evening:   pendingCounts['evening']   ?? 0,
      },
    });
  } catch (error) {
    console.error("Error fetching available time preferences:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
