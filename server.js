
import "dotenv/config";

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, "public");

// Gemini configuration
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 45000
      }
    })
  : null;

app.use(express.json({ limit: "30kb" }));

// Prevent excessive AI requests
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "running",
    application: "STUDENT360 AI",
    geminiConfigured: Boolean(ai)
  });
});

// Student AI Assistant
app.post("/api/assistant", assistantLimiter, async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured in .env"
      });
    }

    const { message, studentContext = {} } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1500
    ) {
      return res.status(400).json({
        error: "Enter a question between 1 and 1500 characters."
      });
    }

    // Limit and validate the student information
    const context = {
      name: String(studentContext.name || "Student").slice(0, 40),
      budget: Number(studentContext.budget) || 0,

      tasks: Array.isArray(studentContext.tasks)
        ? studentContext.tasks.slice(0, 30).map(task => ({
            title: String(task.title || "").slice(0, 100),
            subject: String(task.subject || "").slice(0, 50),
            date: String(task.date || ""),
            hours: Number(task.hours) || 0,
            priority: String(task.priority || "Medium"),
            completed: Boolean(task.done)
          }))
        : [],

      expenses: Array.isArray(studentContext.expenses)
        ? studentContext.expenses.slice(0, 50).map(expense => ({
            title: String(expense.title || "").slice(0, 100),
            amount: Number(expense.amount) || 0,
            category: String(expense.category || "Other"),
            date: String(expense.date || "")
          }))
        : []
    };

    const prompt = `
You are STUDENT360 AI, a helpful assistant for college students.

Your role:
1. Help students plan their studies and deadlines.
2. Analyse their expense patterns.
3. Suggest realistic savings strategies.
4. Help balance academic and financial priorities.
5. Give friendly, practical and structured answers.

Rules:
- Use only the supplied student information.
- Never invent transactions, tasks or deadlines.
- Clearly distinguish facts from suggestions.
- Use Indian Rupees (₹).
- Do not claim that you have saved or changed anything.
- Do not give professional investment advice.
- Keep answers concise and easy to understand.

STUDENT DATA:
${JSON.stringify(context, null, 2)}

STUDENT QUESTION:
${message.trim()}
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: prompt
    });

    const reply = response.text?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("Gemini API error:", error.message);

    res.status(502).json({
      error: "AI assistant is temporarily unavailable. Please try again."
    });
  }
});

// Serve frontend
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tracker.html"));
});

// Start server
app.listen(PORT, () => {
  console.log("----------------------------------");
  console.log("       STUDENT360 AI");
  console.log("----------------------------------");
  console.log(`Server: http://localhost:${PORT}`);
  console.log("API:    /api/health");
  console.log("----------------------------------");
});
