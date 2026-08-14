import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Helper to instantiate Gemini AI client safely
  function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // Health check API
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Chat endpoint for Manager Portal & Citizen Assistant
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, reportsContext, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const ai = getGeminiClient();
      
      const systemInstruction = `你是 CivicMap Taiwan (台灣全民通報與市政管理平台) 的 AI 智慧市政助理。
你的任務是協助政府管理者與民眾：
1. 分析通報案件（如災害 Disaster、設施損壞 Facility issue、道路毀損 Road damage、建物損壞 Building damage、環境髒亂 Environmental issue）。
2. 提供各縣市（基隆、台北、新北、桃園、新竹、苗栗、台中、彰化、南投、雲林、嘉義、台南、高雄、屏東、宜蘭、花蓮、台東、澎湖、金門、連江等）的熱點分析與處理優先順序建議。
3. 回答管理者的數據提問，並能協助擬定「派工單 (Work Order)」。
4. 說話語氣專業、簡潔、有禮貌、注重數據與公共效率，使用繁體中文。

當前案件背景數據資訊：
${JSON.stringify(reportsContext || [], null, 2)}`;

      const formattedContents = [];
      if (history && Array.isArray(history)) {
        for (const msg of history) {
          formattedContents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.text }],
          });
        }
      }
      formattedContents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text || "已完成分析。" });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ 
        error: "AI 助理回應失敗", 
        details: error?.message || "請檢查 API Key 或網路連線。" 
      });
    }
  });

  // AI Analysis & Summary Report Generator Endpoint
  app.post("/api/ai/analyze-reports", async (req, res) => {
    try {
      const { reports } = req.body;
      const ai = getGeminiClient();

      const prompt = `請分析以下台灣各地區通報案件數據，並給出一份繁體中文的簡短 AI 智慧分析報告。
包含：
1. 熱點區域觀察（如中山區、信義區等回報激增的區域與問題類型）
2. 優先建議（高優先級緊急處置項目）
3. 建議指派處理的單位

通報數據：
${JSON.stringify(reports || [], null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: "你是 CivicMap Taiwan 智慧分析系統，請輸出結構清晰、重點突出的繁體中文簡報。",
          temperature: 0.4,
        },
      });

      res.json({
        summary: response.text,
        generatedAt: new Date().toLocaleDateString("zh-TW"),
      });
    } catch (error: any) {
      console.error("AI Analyze Error:", error);
      res.status(500).json({
        error: "無法產出智慧分析報告",
        details: error?.message || "伺服器錯誤",
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicMap Taiwan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
