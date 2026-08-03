const express = require("express");
const router = express.Router();
// routes/invoiceRoutes.js
const invoiceController = require("../controllers/invoiceController");
router.get("/", invoiceController.getAll);
router.get("/:id", invoiceController.getById);
router.post("/", invoiceController.create);
router.put("/:id", invoiceController.update);
router.delete("/:id", invoiceController.remove);
router.get("/:id/docx", invoiceController.generateDocx);
router.get("/:id/pdf", invoiceController.generatePdf);

/*  */
module.exports = router;
