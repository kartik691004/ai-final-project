const http = require("http");
const fs = require("fs");
const path = require("path");

const GEMINI_KEY = process.env.GEMINI_KEY;
const GROQ_KEY = process.env.GROQ_KEY;

const SYSTEM = `You are an AI assistant focused on the ETHICAL CHALLENGES OF ARTIFICIAL INTELLIGENCE IN EVERYDAY LIFE.
You help users think critically about AI ethics. Grounded in this article's themes, always be ready to discuss:
- Bias: AI learns human prejudice from data (e.g. hiring, facial recognition failing on minorities).
- Privacy: AI profiles us from searches/likes; risks if data leaks or is misused.
- High-stakes decisions: AI in hospitals/banks can err; machines lack human judgment/emotion.
- Automation & jobs: repetitive work displaced; widening inequality without retraining.
Be balanced: AI also helps healthcare and connection. Emphasize responsible, transparent, fair use and that users should stay informed.
Keep replies clear, conversational, and concise (like a friendly guide).`;

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    for await (const c of req) body += c;
    let payload;
    try { payload = JSON.parse(body); } catch { res.writeHead(400); return res.end("bad json"); }

    const history = payload.history || [];
    const model = payload.model;
    try {
      const reply = model === "gemini" ? await askGemini(history) : await askGroq(history);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reply }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // serve frontend
  fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

async function askGemini(history) {
  if (!GEMINI_KEY) throw new Error("GEMINI_KEY is not configured");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_KEY;
  const contents = history.map(m => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }]
  }));
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Gemini error");
  return d.candidates[0].content.parts[0].text;
}

async function askGroq(history) {
  if (!GROQ_KEY) throw new Error("GROQ_KEY is not configured");
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const messages = [{ role: "system", content: SYSTEM }];
  history.forEach(m => messages.push({ role: m.role, content: m.text }));
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_KEY },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Groq error");
  return d.choices[0].message.content;
}

server.listen(3000, () => console.log("AI Ethics Chat running at http://localhost:3000"));
