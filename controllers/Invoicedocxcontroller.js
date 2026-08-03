/* ------------------------------------------------------------------------
   invoiceDocxController.js
   ------------------------------------------------------------------------
   Unga actual InvoiceModel (MySQL, pool.query, findById already parses
   servicesPromised / deliverables JSON columns into arrays) oda exact
   match aaga fix pannirukken.

   Install (once, backend folder la):
     npm install docxtemplater pizzip

   Template location: public/templates/quotation-template.docx

   Template la placeholders (single curly — docxtemplater default):

     {invoiceNo}
     {status}
     {clientName}
     {eventType}
     {eventDate}
     {venue}
     {maxHours}
     {complimentary}
     {deliveryNote}
     {projectValue}

   Loop blocks (servicesPromised / deliverables) — type this as plain
   text in Word (no bullet list, just curly braces):

     {#servicesPromised}
     {serviceName} - Qty: {quantity}
     {/servicesPromised}

     {#deliverables}
     {name}
     {/deliverables}

   If unga existing template already has DOUBLE curly braces
   {{clientName}}, uncomment the "delimiters" line below instead of
   editing the Word file.
------------------------------------------------------------------------ */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const InvoiceModel = require("../models/invoiceModel");

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "public",
  "templates",
  "quotation-template.docx"
);

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const buildTemplateData = (invoice) => ({
  invoiceNo: invoice.invoiceNo || "",
  status: invoice.status || "",
  clientName: invoice.clientName || "",
  eventType: invoice.eventType || "",
  eventDate: invoice.eventDate || "",
  venue: invoice.venue || "",
  maxHours: invoice.maxHours ?? "",
  complimentary: invoice.complimentary || "",
  deliveryNote: invoice.deliveryNote || "",
  projectValue: formatCurrency(invoice.projectValue),

  servicesPromised: (invoice.servicesPromised || []).map((s) => ({
    serviceName: s.serviceName || "",
    quantity: s.quantity ?? 1,
  })),

  deliverables: (invoice.deliverables || []).map((d) => ({
    name: d.name || "",
    timeline: d.timeline || "",
  })),
});

/**
 * GET /api/invoices/:id/docx
 * Add this route in invoiceRoutes.js:
 *   router.get("/:id/docx", invoiceDocxController.generate);
 */
const generate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invoice = await InvoiceModel.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(500).json({
        message: `Template not found at ${TEMPLATE_PATH}. Check your public/templates folder.`,
      });
    }

    const content = fs.readFileSync(TEMPLATE_PATH, "binary");
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,

      // Uncomment ONLY if your template uses {{double}} curly braces:
      // delimiters: { start: "{{", end: "}}" },
    });

    const data = buildTemplateData(invoice);

    doc.render(data);

    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const fileName = `${data.invoiceNo || "Quotation"}.docx`;

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });

    return res.send(buffer);
  } catch (err) {
    console.error("Docx generation failed:", err);

    if (err.properties && err.properties.errors) {
      const details = err.properties.errors
        .map((e) => e.properties && e.properties.explanation)
        .filter(Boolean);
      return res.status(400).json({
        message: "Template placeholder mismatch — check the Word template",
        details,
      });
    }

    return next(err);
  }
};

module.exports = { generate };