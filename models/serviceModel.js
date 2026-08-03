const pool = require("../config/db");

const TABLE = "services";

// mysql2 auto-parses JSON columns, but guard against null/legacy string rows.
function normalizeRow(row) {
  if (!row) return row;

  const parseJsonArray = (val) => (Array.isArray(val) ? val : val ? JSON.parse(val) : []);

  return {
    ...row,
    promises: parseJsonArray(row.promises),
    deliverables: parseJsonArray(row.deliverables),
  };
}

const ServiceModel = {
  async findAll() {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} ORDER BY createdAt DESC`);
    return rows.map(normalizeRow);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
    return normalizeRow(rows[0]) || null;
  },

  async create({ serviceName, category, status, promises, deliverables }) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (serviceName, category, status, promises, deliverables)
       VALUES (?, ?, ?, ?, ?)`,
      [
        serviceName,
        category,
        status || "Active",
        JSON.stringify(promises || []),
        JSON.stringify(deliverables || []),
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, { serviceName, category, status, promises, deliverables }) {
    const fields = [];
    const values = [];

    if (serviceName !== undefined) {
      fields.push("serviceName = ?");
      values.push(serviceName);
    }
    if (category !== undefined) {
      fields.push("category = ?");
      values.push(category);
    }
    if (status !== undefined) {
      fields.push("status = ?");
      values.push(status);
    }
    if (promises !== undefined) {
      fields.push("promises = ?");
      values.push(JSON.stringify(promises || []));
    }
    if (deliverables !== undefined) {
      fields.push("deliverables = ?");
      values.push(JSON.stringify(deliverables || []));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = ServiceModel;