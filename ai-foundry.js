import dotenv from 'dotenv';
import { AzureKeyCredential } from '@azure/core-auth';
import { OpenAIClient } from '@azure/openai';

dotenv.config();

const endpoint = process.env.AZURE_INFERENCE_SDK_ENDPOINT;
const apiKey = process.env.AZURE_INFERENCE_SDK_KEY;

const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));

const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What are 3 things to see in Seattle?" }
];

async function main() {
  const response = await client.getChatCompletions("gpt-4o", {
    messages,
    maxTokens: 512,
    temperature: 0.7,
  });

  console.log(response.choices[0].message.content);
}

main().catch(console.error);
