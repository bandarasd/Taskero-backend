const pool = require("../db");

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  const {
    email,
    first_name,
    last_name,
    phone_number,
    avatar_url,
    bio,
    dob,
    gender,
    address_line1,
    address_line2,
    city,
    postal_code,
    location,
    preferences,
    settings,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO users 
      (email, first_name, last_name, phone_number, avatar_url, bio, dob, gender, address_line1, address_line2, city, postal_code, location, preferences, settings)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        email,
        first_name,
        last_name,
        phone_number,
        avatar_url,
        bio,
        dob,
        gender,
        address_line1,
        address_line2,
        city,
        postal_code,
        location,
        preferences || {},
        settings || {},
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Database error" });
    }
  }
};

// Update a user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const setQuery = Object.keys(fields)
    .map((key, idx) => `${key} = $${idx + 1}`)
    .join(", ");
  const values = Object.values(fields);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setQuery}, updated_at = NOW() WHERE id = $${
        values.length + 1
      } RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted", user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};
