const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const mammoth = require("mammoth");
const puppeteer = require("puppeteer");
const InvoiceModel = require("../models/invoiceModel");
const { validateInvoicePayload } = require("../middleware/validators");

// Normalizes servicesPromised / deliverables arrays from the request body
const normalizeServicesPromised = (services = []) =>
  services.map((s) => ({
    serviceName: String(s.serviceName).trim(),
    quantity:
      s.quantity !== undefined && s.quantity !== null && s.quantity !== ""
        ? Number(s.quantity)
        : null,
  }));

const normalizeDeliverables = (deliverables = []) =>
  deliverables.map((d) => ({
    name: String(d.name).trim(),
    timeline: d.timeline ? String(d.timeline).trim() : null,
  }));

/* ------------------------------------------------------------------------
   TEMPLATE CONFIGURATION

   PDF PIPELINE (no LibreOffice / no OS-level install required):
     Rendered DOCX buffer
          -> mammoth converts DOCX -> HTML (keeps paragraphs, headings,
             bold/italic, tables, lists from the template)
          -> HTML wrapped with print CSS matching the quotation's look
          -> puppeteer (bundled headless Chromium, installed via npm,
             nothing to add to PATH) renders that HTML -> PDF

   This replaces the earlier LibreOffice("soffice")-based approach,
   which kept failing with ENOENT because soffice wasn't reachable on
   this machine. Puppeteer ships its own browser binary as part of
   `npm install puppeteer`, so there's no separate program to install
   or path to configure.
   ------------------------------------------------------------------------ */

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "public",
  "templates",
  "k&K.docx"
);

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

// ============================================================
// COMMON TEMPLATE DATA BUILDER - single source of truth.
// The PDF is produced FROM the same rendered DOCX, so this stays
// the only place that ever needs updating when a field changes.
// ============================================================
const buildTemplateData = (invoice) => ({
  invoiceNo: invoice.invoiceNo || "",
  clientName: invoice.clientName || "",
  eventType: invoice.eventType || "",
  eventDate: invoice.eventDate || "",
  venue: invoice.venue || "",
  maxHours: invoice.maxHours ?? "",
  projectValue: formatCurrency(invoice.projectValue),
  complimentary: invoice.complimentary || "",
  deliveryNote: invoice.deliveryNote || "",
  servicesPromised: (invoice.servicesPromised || []).map((s) => ({
    serviceName: s.serviceName || "",
    quantity: s.quantity !== undefined && s.quantity !== null ? s.quantity : null,
  })),
  deliverables: (invoice.deliverables || []).map((d) => ({
    name: d.name || "",
    timeline: d.timeline || "",
  })),
});

// ============================================================
// Renders the k&K.docx template for an invoice and returns a
// Buffer of the finished .docx file. Used by BOTH the DOCX
// download route and the PDF route (PDF converts this buffer).
// ============================================================
const renderInvoiceDocxBuffer = (invoice) => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    const err = new Error("Template file not found");
    err.code = "TEMPLATE_MISSING";
    throw err;
  }

  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const data = buildTemplateData(invoice);

  try {
    doc.render(data);
  } catch (renderError) {
    if (renderError.properties && renderError.properties.errors) {
      const wrapped = new Error("Template placeholder mismatch");
      wrapped.code = "TEMPLATE_MISMATCH";
      wrapped.details = renderError.properties.errors.map((e) => ({
        message: e.message || e.properties?.explanation || "Unknown error",
        id: e.id || "unknown",
      }));
      throw wrapped;
    }
    throw renderError;
  }

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
};

const TEMPLATE_MISMATCH_HINT =
  "Your k&K.docx template must contain these placeholders: " +
  "{{invoiceNo}}, {{clientName}}, {{eventType}}, {{eventDate}}, {{venue}}, " +
  "{{maxHours}}, {{projectValue}}, {{complimentary}}, {{deliveryNote}}, " +
  "{{#servicesPromised}}{{serviceName}} {{quantity}}{{/servicesPromised}}, " +
  "{{#deliverables}}{{name}} {{timeline}}{{/deliverables}}";

// Print CSS applied around the mammoth-converted HTML so the PDF reads
// like a real document (margins, readable font, spaced-out headings,
// tidy tables) rather than raw unstyled HTML.
const PDF_PRINT_CSS = `
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
  }
  h1, h2, h3 { color: #2c3e50; margin: 0.6em 0 0.3em; }
  p { margin: 0.4em 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
  table, th, td { border: 1px solid #d9d9d9; }
  th, td { padding: 6px 10px; text-align: left; vertical-align: top; }
  ul, ol { margin: 0.4em 0; padding-left: 1.4em; }
  img { max-width: 100%; }
`;

// ============================================================
// Converts a rendered .docx buffer to a PDF buffer:
//   1. mammoth: DOCX -> HTML (paragraphs, headings, tables, lists)
//   2. wrap HTML with print CSS
//   3. puppeteer: load HTML in headless Chromium, print to PDF
// No LibreOffice / soffice binary involved anywhere in this path.
// ============================================================
const convertDocxBufferToPdf = async (docxBuffer) => {
  // 1. DOCX -> HTML
  const { value: bodyHtml, messages } = await mammoth.convertToHtml({ buffer: docxBuffer });
  if (messages?.length) {
    // Non-fatal: mammoth reports things like "unsupported style" — log, don't fail.
    console.warn("mammoth conversion notes:", messages.map((m) => m.message));
  }

  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PDF_PRINT_CSS}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`;

  // 2 & 3. HTML -> PDF via headless Chromium
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "22mm", bottom: "22mm", left: "18mm", right: "18mm" },
    });
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
};

const invoiceController = {
  async getAll(req, res, next) {
    try {
      const invoices = await InvoiceModel.findAll();
      res.json({ data: invoices });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const invoice = await InvoiceModel.findById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Quotation not found" });
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      validateInvoicePayload(req.body);

      const existing = await InvoiceModel.findByInvoiceNo(req.body.invoiceNo.trim());
      if (existing) {
        return res.status(409).json({
          errors: { invoiceNo: "This quotation number is already in use" },
        });
      }

      const invoice = await InvoiceModel.create({
        invoiceNo: req.body.invoiceNo.trim(),
        clientName: req.body.clientName.trim(),
        eventType: req.body.eventType,
        eventDate: req.body.eventDate,
        venue: req.body.venue.trim(),
        maxHours: req.body.maxHours != null ? Number(req.body.maxHours) : null,
        servicesPromised: normalizeServicesPromised(req.body.servicesPromised),
        deliverables: normalizeDeliverables(req.body.deliverables),
        complimentary: req.body.complimentary?.trim(),
        deliveryNote: req.body.deliveryNote?.trim(),
        projectValue: Number(req.body.projectValue),
        status: req.body.status || "Draft",
      });

      res.status(201).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const existingInvoice = await InvoiceModel.findById(id);
      if (!existingInvoice) return res.status(404).json({ message: "Quotation not found" });

      validateInvoicePayload(req.body);

      if (req.body.invoiceNo && req.body.invoiceNo.trim() !== existingInvoice.invoiceNo) {
        const clash = await InvoiceModel.findByInvoiceNo(req.body.invoiceNo.trim());
        if (clash) {
          return res.status(409).json({
            errors: { invoiceNo: "This quotation number is already in use" },
          });
        }
      }

      const updated = await InvoiceModel.update(id, {
        invoiceNo: req.body.invoiceNo?.trim(),
        clientName: req.body.clientName?.trim(),
        eventType: req.body.eventType,
        eventDate: req.body.eventDate,
        venue: req.body.venue?.trim(),
        maxHours: req.body.maxHours != null ? Number(req.body.maxHours) : undefined,
        servicesPromised:
          req.body.servicesPromised !== undefined
            ? normalizeServicesPromised(req.body.servicesPromised)
            : undefined,
        deliverables:
          req.body.deliverables !== undefined
            ? normalizeDeliverables(req.body.deliverables)
            : undefined,
        complimentary: req.body.complimentary?.trim(),
        deliveryNote: req.body.deliveryNote?.trim(),
        projectValue:
          req.body.projectValue !== undefined ? Number(req.body.projectValue) : undefined,
        status: req.body.status,
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await InvoiceModel.remove(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Quotation not found" });
      res.json({ message: "Quotation deleted" });
    } catch (err) {
      next(err);
    }
  },

  // ============================================================
  // GENERATE QUOTATION .DOCX
  // ============================================================
  async generateDocx(req, res, next) {
    try {
      const { id } = req.params;

      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      let buffer;
      try {
        buffer = renderInvoiceDocxBuffer(invoice);
      } catch (renderErr) {
        if (renderErr.code === "TEMPLATE_MISSING") {
          console.error(`Template not found at: ${TEMPLATE_PATH}`);
          return res.status(500).json({
            message: "Template file not found",
            details: "Please ensure k&K.docx exists in public/templates/ directory",
          });
        }
        if (renderErr.code === "TEMPLATE_MISMATCH") {
          console.error("DOCX Render Error:", renderErr.details);
          return res.status(400).json({
            message: "Template placeholder mismatch",
            errors: renderErr.details,
            hint: TEMPLATE_MISMATCH_HINT,
          });
        }
        throw renderErr;
      }

      const fileName = `${invoice.invoiceNo || "Quotation"}.docx`;

      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.length,
        "Cache-Control": "no-cache",
      });

      return res.send(buffer);
    } catch (err) {
      console.error("DOCX generation failed:", err);

      return res.status(500).json({
        message: "Failed to generate DOCX",
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },

  // ============================================================
  // GENERATE QUOTATION .PDF
  //
  //   Generate DOCX (renderInvoiceDocxBuffer)
  //        ↓
  //   mammoth: DOCX -> HTML
  //        ↓
  //   puppeteer: HTML -> PDF (bundled Chromium, no OS install needed)
  //        ↓
  //   Return PDF
  //
  // No LibreOffice/soffice binary required anywhere in this path —
  // avoids the ENOENT issue entirely since puppeteer's Chromium ships
  // with the npm package itself.
  // ============================================================
  async generatePdf(req, res, next) {
    try {
      const { id } = req.params;

      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      let docxBuffer;
      try {
        docxBuffer = renderInvoiceDocxBuffer(invoice);
      } catch (renderErr) {
        if (renderErr.code === "TEMPLATE_MISSING") {
          console.error(`Template not found at: ${TEMPLATE_PATH}`);
          return res.status(500).json({
            message: "Template file not found",
            details: "Please ensure k&K.docx exists in public/templates/ directory",
          });
        }
        if (renderErr.code === "TEMPLATE_MISMATCH") {
          console.error("PDF Render Error:", renderErr.details);
          return res.status(400).json({
            message: "Template placeholder mismatch",
            errors: renderErr.details,
            hint: TEMPLATE_MISMATCH_HINT,
          });
        }
        throw renderErr;
      }

      let pdfBuffer;
      try {
        pdfBuffer = await convertDocxBufferToPdf(docxBuffer);
      } catch (convertErr) {
        console.error("DOCX -> PDF conversion failed:", convertErr);
        return res.status(500).json({
          message: "Failed to convert quotation to PDF",
          error: convertErr.message,
        });
      }

      const fileName = `${invoice.invoiceNo || "Quotation"}.pdf`;

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "no-cache",
      });

      return res.send(pdfBuffer);
    } catch (err) {
      console.error("PDF generation failed:", err);
      return res.status(500).json({
        message: "Failed to generate PDF",
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
};

module.exports = invoiceController;
