import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

// Load token
const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "meta/llama-3.2-90b-vision-instruct";
const imagePath = path.resolve("contoso_layout_sketch.jpg");

export async function main() {
  // Debug: token length
  console.log("Token length:", token?.length);
  if (!token || token.trim() === "") {
    throw new Error("GITHUB_TOKEN is missing or empty in your .env file.");
  }

  // Check image exists
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found at path: ${imagePath}`);
  }

  const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
  console.log("Image base64 length:", imageBase64.length);

  const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;

  // Create client
  const client = ModelClient(endpoint, new AzureKeyCredential(token));

  console.log("Sending request to model:", model);

  // Send multimodal request
  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role: "system", content: "You are a helpful web developer." },
        {
          role: "user",
          content: [
            { type: "text", text: "Write clean, professional HTML and CSS for this layout." },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ],
      model: model,
      temperature: 0.8,
      top_p: 0.95,
      max_tokens: 2000
    }
  });

  if (isUnexpected(response)) {
    console.error("Unexpected response status:", response.status);
    console.error("Response body:", response.body);
    throw new Error("API call failed.");
  }

  // Output result
  console.log("\nAI Response:\n");
  console.log(response.body.choices?.[0]?.message?.content || "No response message found.");
}

main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
