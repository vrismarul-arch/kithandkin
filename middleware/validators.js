const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9]{10}$/;

const STAFF_ROLES = ["Admin", "Manager", "Editor", "Viewer"];
const CLIENT_ROLES = ["Client Admin", "Client User"];
const BUSINESS_ACCOUNT_TYPES = ["Individual", "Business"];
const STATUSES = ["Active", "Inactive"];

function throwValidation(errors) {
  const err = new Error("Validation failed");
  err.errors = errors;
  err.status = 422;
  throw err;
}

function validateStaffPayload(body, { isUpdate = false } = {}) {
  const errors = {};

  if (!body.role || !STAFF_ROLES.includes(body.role)) {
    errors.role = "Please select a valid role";
  }
  if (!body.name || !String(body.name).trim()) {
    errors.name = "Please enter the name";
  }
  if (!body.email || !String(body.email).trim()) {
    errors.email = "Please enter the email";
  } else if (!EMAIL_RE.test(body.email)) {
    errors.email = "Enter a valid email";
  }
  if (!body.mobileNumber || !String(body.mobileNumber).trim()) {
    errors.mobileNumber = "Please enter the mobile number";
  } else if (!MOBILE_RE.test(body.mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number";
  }
  if (!isUpdate || body.password) {
    if (!body.password) {
      errors.password = "Please enter a password";
    } else if (String(body.password).length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
  }
  if (body.status && !STATUSES.includes(body.status)) {
    errors.status = "Please select a valid status";
  }

  if (Object.keys(errors).length) throwValidation(errors);
}

function validateClientPayload(body, { isUpdate = false } = {}) {
  const errors = {};

  if (!body.role || !CLIENT_ROLES.includes(body.role)) {
    errors.role = "Please select a valid role";
  }
  if (!body.businessAccount || !BUSINESS_ACCOUNT_TYPES.includes(body.businessAccount)) {
    errors.businessAccount = "Please select an account type";
  }
  if (body.businessAccount === "Business" && !body.business) {
    errors.business = "Please select a business";
  }
  if (!body.name || !String(body.name).trim()) {
    errors.name = "Please enter the name";
  }
  if (!body.email || !String(body.email).trim()) {
    errors.email = "Please enter the email";
  } else if (!EMAIL_RE.test(body.email)) {
    errors.email = "Enter a valid email";
  }
  if (!body.mobileNumber || !String(body.mobileNumber).trim()) {
    errors.mobileNumber = "Please enter the mobile number";
  } else if (!MOBILE_RE.test(body.mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number";
  }
  if (!isUpdate || body.password) {
    if (!body.password) {
      errors.password = "Please enter a password";
    } else if (String(body.password).length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
  }
  if (body.status && !STATUSES.includes(body.status)) {
    errors.status = "Please select a valid status";
  }

  if (Object.keys(errors).length) throwValidation(errors);
}

function validateBusinessPayload(body) {
  const errors = {};
  if (!body.name || !String(body.name).trim()) {
    errors.name = "Please enter the business name";
  }
  if (Object.keys(errors).length) throwValidation(errors);
}

const LEAD_TYPES = ["Wedding", "Engagement", "Pre-Wedding", "Corporate Event", "Other"];
const ACCOUNT_STATUSES = [
  "Target Leads",
  "Lead",
  "Enquiry",
  "Quotations Sent",
  "Converted",
  "Closed Accounts",
];
const SOURCE_TYPES = ["Referral", "Social Media", "Website", "Walk-in", "Advertisement", "Vrism"];
const PINCODE_RE = /^[0-9]{6}$/;

function validateLeadPayload(body) {
  const errors = {};

  if (!body.primaryContactName || !String(body.primaryContactName).trim()) {
    errors.primaryContactName = "Please enter the contact name";
  }
  if (!body.email || !String(body.email).trim()) {
    errors.email = "Please enter the email";
  } else if (!EMAIL_RE.test(body.email)) {
    errors.email = "Enter a valid email";
  }
  if (!body.mobileNumber || !String(body.mobileNumber).trim()) {
    errors.mobileNumber = "Please enter the mobile number";
  } else if (!MOBILE_RE.test(body.mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number";
  }
  if (!body.typeOfLeads || !LEAD_TYPES.includes(body.typeOfLeads)) {
    errors.typeOfLeads = "Please select the lead type";
  }
  if (!body.addressLine1 || !String(body.addressLine1).trim()) {
    errors.addressLine1 = "Please enter address line 1";
  }
  if (!body.city || !String(body.city).trim()) {
    errors.city = "Please enter city";
  }
  if (!body.state || !String(body.state).trim()) {
    errors.state = "Please enter state";
  }
  if (!body.pincode || !String(body.pincode).trim()) {
    errors.pincode = "Please enter pincode";
  } else if (!PINCODE_RE.test(body.pincode)) {
    errors.pincode = "Enter a valid 6-digit pincode";
  }
  if (!body.country || !String(body.country).trim()) {
    errors.country = "Please enter country";
  }
  if (!body.accountStatus || !ACCOUNT_STATUSES.includes(body.accountStatus)) {
    errors.accountStatus = "Please select account status";
  }
  if (!body.sourceType || !SOURCE_TYPES.includes(body.sourceType)) {
    errors.sourceType = "Please select source type";
  }
  if (body.sourceType === "Referral" && !String(body.referralPersonName || "").trim()) {
    errors.referralPersonName = "Please enter the referral person's name";
  }

  if (Object.keys(errors).length) throwValidation(errors);
}

const CATEGORIES = ["Basic Service", "Add-on Service"];

function validatePromiseItem(item, index, errors) {
  if (!item || typeof item !== "object") {
    errors[`promises.${index}`] = "Invalid item entry";
    return;
  }
  if (!item.item || !String(item.item).trim()) {
    errors[`promises.${index}.item`] = "Item name required";
  }
  // Quantity is optional — only validate it if a value was actually given
  if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
    if (Number.isNaN(Number(item.quantity)) || Number(item.quantity) < 1) {
      errors[`promises.${index}.quantity`] = "Enter a valid quantity";
    }
  }
}

function validateDeliverable(item, index, errors) {
  if (!item || typeof item !== "object") {
    errors[`deliverables.${index}`] = "Invalid deliverable entry";
    return;
  }
  if (!item.name || !String(item.name).trim()) {
    errors[`deliverables.${index}.name`] = "Deliverable name required";
  }
  // Timeline is optional now
}

function validateServicePayload(body) {
  const errors = {};

  if (!body.serviceName || !String(body.serviceName).trim()) {
    errors.serviceName = "Please enter the service name";
  }
  if (!body.category || !CATEGORIES.includes(body.category)) {
    errors.category = "Please select a category";
  }
  if (body.status && !STATUSES.includes(body.status)) {
    errors.status = "Please select a valid status";
  }
  // Both are optional now — plenty of services (e.g. simple add-ons like
  // "Drone / Helicam") are just a name with no sub-items. Only validate the
  // shape of whatever rows were actually provided.
  if (body.promises !== undefined) {
    if (!Array.isArray(body.promises)) {
      errors.promises = "Promised items must be a list";
    } else {
      body.promises.forEach((item, idx) => validatePromiseItem(item, idx, errors));
    }
  }
  if (body.deliverables !== undefined) {
    if (!Array.isArray(body.deliverables)) {
      errors.deliverables = "Deliverables must be a list";
    } else {
      body.deliverables.forEach((item, idx) => validateDeliverable(item, idx, errors));
    }
  }

  if (Object.keys(errors).length) throwValidation(errors);
}

// ---------------------------------------------------------------------------
// Invoices / Quotations
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "Wedding",
  "Pre-Wedding",
  "Engagement",
  "Baby Shower",
  "Birthday",
  "Corporate Event",
  "Other",
];
const INVOICE_STATUSES = ["Draft", "Sent", "Accepted", "Paid", "Overdue"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateServicePromisedItem(item, index, errors) {
  if (!item || typeof item !== "object") {
    errors[`servicesPromised.${index}`] = "Invalid service entry";
    return;
  }
  if (!item.serviceName || !String(item.serviceName).trim()) {
    errors[`servicesPromised.${index}.serviceName`] = "Service name required";
  }
  // Quantity is optional — only validate it if a value was actually given
  if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
    if (Number.isNaN(Number(item.quantity)) || Number(item.quantity) < 1) {
      errors[`servicesPromised.${index}.quantity`] = "Enter a valid quantity";
    }
  }
}

function validateDeliverableItem(item, index, errors) {
  if (!item || typeof item !== "object") {
    errors[`deliverables.${index}`] = "Invalid deliverable entry";
    return;
  }
  if (!item.name || !String(item.name).trim()) {
    errors[`deliverables.${index}.name`] = "Deliverable name required";
  }
  // Timeline is optional now
}

function validateInvoicePayload(body) {
  const errors = {};

  if (!body.invoiceNo || !String(body.invoiceNo).trim()) {
    errors.invoiceNo = "Please enter the quotation number";
  }
  if (!body.clientName || !String(body.clientName).trim()) {
    errors.clientName = "Please enter the client name";
  }
  if (!body.eventType || !EVENT_TYPES.includes(body.eventType)) {
    errors.eventType = "Please select the event type";
  }
  if (!body.eventDate || !String(body.eventDate).trim()) {
    errors.eventDate = "Please select the event date";
  } else if (!DATE_RE.test(String(body.eventDate).slice(0, 10))) {
    errors.eventDate = "Enter a valid date";
  }
  if (!body.venue || !String(body.venue).trim()) {
    errors.venue = "Please enter the venue";
  }
  if (
    body.maxHours !== undefined &&
    body.maxHours !== null &&
    body.maxHours !== "" &&
    (Number.isNaN(Number(body.maxHours)) || Number(body.maxHours) < 1)
  ) {
    errors.maxHours = "Enter a valid number of hours";
  }
  if (!Array.isArray(body.servicesPromised) || body.servicesPromised.length === 0) {
    errors.servicesPromised = "Please add at least one service";
  } else {
    body.servicesPromised.forEach((item, idx) =>
      validateServicePromisedItem(item, idx, errors)
    );
  }
  if (!Array.isArray(body.deliverables) || body.deliverables.length === 0) {
    errors.deliverables = "Please add at least one deliverable";
  } else {
    body.deliverables.forEach((item, idx) => validateDeliverableItem(item, idx, errors));
  }
  if (body.projectValue === undefined || body.projectValue === null || body.projectValue === "") {
    errors.projectValue = "Please enter the project value";
  } else if (Number.isNaN(Number(body.projectValue)) || Number(body.projectValue) < 0) {
    errors.projectValue = "Enter a valid project value";
  }
  if (body.status && !INVOICE_STATUSES.includes(body.status)) {
    errors.status = "Please select a valid status";
  }

  if (Object.keys(errors).length) throwValidation(errors);
}

module.exports = {
  validateStaffPayload,
  validateClientPayload,
  validateBusinessPayload,
  validateLeadPayload,
  validateServicePayload,
  validateInvoicePayload,
  throwValidation,
};