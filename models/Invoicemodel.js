const pool = require("../config/db");

const TABLE = "invoices";

// mysql2 auto-parses JSON columns, but guard against null/legacy string rows,
// same pattern as serviceModel.js and leadModel.js.
function normalizeRow(row) {
  if (!row) return row;

  const parseJsonArray = (val) => (Array.isArray(val) ? val : val ? JSON.parse(val) : []);

  // MySQL DATE/DATETIME columns can come back as JS Date objects
  // (depending on driver config), which serialize/display as
  // "Mon Aug 03 2026 00:00:00 GMT+0530 (India Standard Time)".
  // Force them to a plain "YYYY-MM-DD" string instead, regardless
  // of whether the driver handed us a Date object or an ISO string.
  const toDateOnly = (val) => {
    if (!val) return val;
    if (val instanceof Date) {
      return val.toISOString().split("T")[0]; // "2026-08-03"
    }
    if (typeof val === "string") {
      return val.split("T")[0]; // already a string (ISO or plain) -> strip time part if present
    }
    return val;
  };

  return {
    ...row,
    servicesPromised: parseJsonArray(row.servicesPromised),
    deliverables: parseJsonArray(row.deliverables),
    eventDate: toDateOnly(row.eventDate),
  };
}

const InvoiceModel = {
  async findAll() {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} ORDER BY createdAt DESC`);
    return rows.map(normalizeRow);
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`, [id]);
    return normalizeRow(rows[0]) || null;
  },

  async findByInvoiceNo(invoiceNo) {
    const [rows] = await pool.query(
      `SELECT * FROM ${TABLE} WHERE invoiceNo = ? LIMIT 1`,
      [invoiceNo]
    );
    return normalizeRow(rows[0]) || null;
  },

  async create({
    invoiceNo,
    clientName,
    eventType,
    eventDate,
    venue,
    maxHours,
    servicesPromised,
    deliverables,
    complimentary,
    deliveryNote,
    projectValue,
    status,
  }) {
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} (
        invoiceNo, clientName, eventType, eventDate, venue, maxHours,
        servicesPromised, deliverables, complimentary, deliveryNote,
        projectValue, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        clientName,
        eventType,
        eventDate,
        venue,
        maxHours || null,
        JSON.stringify(servicesPromised || []),
        JSON.stringify(deliverables || []),
        complimentary || null,
        deliveryNote || null,
        projectValue,
        status || "Draft",
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = [
      "invoiceNo",
      "clientName",
      "eventType",
      "eventDate",
      "venue",
      "maxHours",
      "servicesPromised",
      "deliverables",
      "complimentary",
      "deliveryNote",
      "projectValue",
      "status",
    ];

    const keys = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined);
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => {
      if (k === "servicesPromised" || k === "deliverables") {
        return JSON.stringify(data[k] || []);
      }
      return data[k];
    });
    values.push(id);

    await pool.query(`UPDATE ${TABLE} SET ${setClause} WHERE id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = InvoiceModel;