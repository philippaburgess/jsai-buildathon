import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()  # Load from .env

client = AzureOpenAI(
    api_version=os.getenv("AZURE_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_API_KEY")
)

response = client.chat.completions.create(
    messages=[
        { "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": "What are 3 things to see in Seattle?" }
    ],
    model=os.getenv("AZURE_DEPLOYMENT_NAME"),
    max_completion_tokens=800,
    temperature=0.7,
    top_p=1.0,
    frequency_penalty=0.0,
    presence_penalty=0.0
)

print(response.choices[0].message.content)
