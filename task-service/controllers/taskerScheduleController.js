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
// Body: [{ day_of_week, start_time, end_time, buffer_minutes, is_active }]
exports.upsertSchedule = async (req, res) => {
  const { tasker_id } = req.params;
  const days = req.body;

  console.log("[schedule] upsert body:", JSON.stringify(days));
  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: "Body must be a non-empty array of schedule days" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];
    for (const day of days) {
      const { day_of_week, start_time, end_time, buffer_minutes = 30, is_active = true } = day;
      if (day_of_week === undefined || !start_time || !end_time) {
        console.error("[schedule] validation failed for entry:", JSON.stringify(day));
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each entry requires day_of_week, start_time, end_time" });
      }
      const row = await client.query(
        `INSERT INTO tasker_schedules (tasker_id, day_of_week, start_time, end_time, buffer_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tasker_id, day_of_week)
         DO UPDATE SET
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           buffer_minutes = EXCLUDED.buffer_minutes,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING *`,
        [tasker_id, day_of_week, start_time, end_time, buffer_minutes, is_active]
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
exports.getAvailableSlots = async (req, res) => {
  const { tasker_id } = req.params;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
  }

  try {
    const targetDate = new Date(date + "T00:00:00Z");
    const dayOfWeek = targetDate.getUTCDay(); // 0=Sun…6=Sat

    // Get tasker's schedule for this day
    const scheduleResult = await pool.query(
      `SELECT * FROM tasker_schedules WHERE tasker_id = $1 AND day_of_week = $2 AND is_active = true`,
      [tasker_id, dayOfWeek]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(200).json({
        schedule: null,
        available_slots: [],
        booked_slots: [],
        message: "Tasker is not available on this day",
      });
    }

    const schedule = scheduleResult.rows[0];
    const bufferMinutes = schedule.buffer_minutes;

    // Parse HH:MM times into minutes-since-midnight
    const parseTime = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const startMin = parseTime(schedule.start_time);
    const endMin = parseTime(schedule.end_time);

    // Get accepted/in_progress tasks for this tasker on this date
    const tasksResult = await pool.query(
      `SELECT due_date, estimated_duration_minutes
       FROM tasks
       WHERE tasker_id = $1
         AND status IN ('accepted', 'in_progress')
         AND due_date::date = $2::date`,
      [tasker_id, date]
    );

    // Build booked intervals [startMin, endMin) in minutes-since-midnight
    const bookedIntervals = tasksResult.rows.map((t) => {
      const d = new Date(t.due_date);
      const taskStartMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      const duration = t.estimated_duration_minutes || 60; // default 60 min if not set
      return { start: taskStartMin, end: taskStartMin + duration + bufferMinutes };
    });

    // Generate slots every 30 min within schedule window
    const SLOT_INTERVAL = 30;
    const availableSlots = [];
    const bookedSlots = [];

    for (let slotStart = startMin; slotStart + SLOT_INTERVAL <= endMin; slotStart += SLOT_INTERVAL) {
      const slotEnd = slotStart + SLOT_INTERVAL;
      const overlaps = bookedIntervals.some(
        (b) => slotStart < b.end && slotEnd > b.start
      );
      const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
      const mm = String(slotStart % 60).padStart(2, "0");
      const label = `${hh}:${mm}`;
      if (overlaps) {
        bookedSlots.push(label);
      } else {
        availableSlots.push(label);
      }
    }

    return res.status(200).json({
      schedule: {
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        buffer_minutes: bufferMinutes,
      },
      available_slots: availableSlots,
      booked_slots: bookedSlots,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
