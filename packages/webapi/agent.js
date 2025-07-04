import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runAgentConversation() {
  const project = new AIProjectClient(
    process.env.AZURE_AI_PROJECT_ENDPOINT,
    new DefaultAzureCredential());
  
  const agent = await project.agents.getAgent(process.env.AZURE_AI_AGENT_ID);
  console.log(`Retrieved agent: ${agent.name}`);
  
  const thread = await project.agents.threads.create();
  console.log(`Created thread, ID: ${thread.id}`);
  
  const message = await project.agents.messages.create(thread.id, {
    role: "user",
    content: "Give me a summary of this year's Keynote at Microsoft Build",
  });
  console.log(`Created message, ID: ${message.id}`);
  
  // Create run
  let run = await project.agents.runs.create(thread.id, agent.id);
  
  // Poll until the run reaches a terminal status
  while (run.status === "queued" || run.status === "in_progress") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    run = await project.agents.runs.get(thread.id, run.id);
  }
  
  if (run.status === "failed") {
    console.error(`Run failed: `, run.lastError);
  }
  console.log(`Run completed with status: ${run.status}`);
  
  // Retrieve messages
  const messages = await project.agents.messages.list(thread.id, { order: "asc" });
  
  // Display messages
  for await (const m of messages) {
    const content = m.content.find((c) => c.type === "text" && "text" in c);
    if (content) {
      console.log(`${m.role}: ${content.text.value}`);
    }
  }
}

// Main execution
runAgentConversation().catch(error => {
  console.error("An error occurred:", error);
});