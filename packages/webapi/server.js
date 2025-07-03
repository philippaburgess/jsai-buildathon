import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { AzureChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// LangChain AzureChatOpenAI client
const chatModel = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  temperature: 1,
  maxTokens: 4096,
});

// File setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const pdfPath = path.join(projectRoot, "data/employee_handbook.pdf");

let pdfText = null;
let pdfChunks = [];
const CHUNK_SIZE = 800;

async function loadPDF() {
  if (pdfText) return pdfText;
  if (!fs.existsSync(pdfPath)) return "PDF not found.";

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  pdfText = data.text;

  let currentChunk = "";
  const words = pdfText.split(/\s+/);
  for (const word of words) {
    if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      pdfChunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) pdfChunks.push(currentChunk);
  return pdfText;
}

function retrieveRelevantContent(query) {
  const queryTerms = query.toLowerCase().split(/\s+/)
    .filter(term => term.length > 3)
    .map(term => term.replace(/[.,?!;:()"']/g, ""));

  if (queryTerms.length === 0) return [];

  const scoredChunks = pdfChunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = chunkLower.match(regex);
      if (matches) score += matches.length;
    }
    return { chunk, score };
  });

  return scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.chunk);
}

// Memory session store
const sessionMemories = {};
function getSessionMemory(sessionId) {
  if (!sessionMemories[sessionId]) {
    const history = new ChatMessageHistory();
    sessionMemories[sessionId] = new BufferMemory({
      chatHistory: history,
      returnMessages: true,
      memoryKey: "chat_history",
    });
  }
  return sessionMemories[sessionId];
}

// POST /chat endpoint with RAG + memory
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const useRAG = req.body.useRAG ?? true;
  const sessionId = req.body.sessionId || "default";

  let sources = [];

  const memory = getSessionMemory(sessionId);
  const memoryVars = await memory.loadMemoryVariables({});

  if (useRAG) {
    await loadPDF();
    sources = retrieveRelevantContent(userMessage);
  }

  const systemMessage = useRAG
    ? {
        role: "system",
        content: sources.length > 0
          ? `You are a helpful assistant for Contoso Electronics. You must ONLY use the information provided below to answer.\n\n--- EMPLOYEE HANDBOOK EXCERPTS ---\n${sources.join('\n\n')}\n--- END OF EXCERPTS ---`
          : `You are a helpful assistant for Contoso Electronics. The excerpts do not contain relevant information for this question. Reply politely: "I'm sorry, I don't know. The employee handbook does not contain information about that."`,
      }
    : {
        role: "system",
        content: "You are a helpful and knowledgeable assistant. Answer the user's questions concisely and informatively.",
      };

  try {
    const messages = [
      systemMessage,
      ...(memoryVars.chat_history || []),
      { role: "user", content: userMessage },
    ];

    const response = await chatModel.invoke(messages);

    await memory.saveContext({ input: userMessage }, { output: response.content });

    res.json({
      reply: response.content,
      sources: useRAG ? sources : []
    });
  } catch (err) {
    console.error("Model error:", err.message);
    res.status(500).json({
      error: "Model call failed",
      message: err.message,
      reply: "Sorry, I encountered an error. Please try again."
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI API server running on port ${PORT}`);
});

