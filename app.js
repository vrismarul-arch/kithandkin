const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const clientRoutes = require("./routes/clientRoutes");
const businessRoutes = require("./routes/businessRoutes");
const leadRoutes = require("./routes/leadRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const authenticate = require("./middleware/authenticate");
const invoiceRoutes = require("./routes/invoiceRoutes");

const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// ===========================
// CORS
// ===========================
// List every frontend origin that's allowed to call this API.
// Add your deployed frontend URL here once it's live (e.g. Vercel/Netlify/Render URL).
const allowedOrigins = [
  "http://localhost:5173", // Vite dev server
  "https://kithandkin.netlify.app", // in case you also run CRA/other tooling
  // "https://your-frontend-domain.com", // 👈 add your production frontend URL here
];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
};

// NOTE: mounting cors() as global middleware is enough — it automatically
// intercepts and responds to OPTIONS preflight requests for every route.
// (No need for a separate app.options("*", ...) line — on Express 5 that
// wildcard syntax actually throws at startup and crashes the server.)
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Public
app.use("/api/auth", authRoutes);

// Protected — requires a valid Bearer token from /api/auth/login
app.use("/api/users", authenticate, userRoutes);
app.use("/api/clients", authenticate, clientRoutes);
app.use("/api/businesses", authenticate, businessRoutes);
app.use("/api/leads", authenticate, leadRoutes);
app.use("/api/services", authenticate, serviceRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;