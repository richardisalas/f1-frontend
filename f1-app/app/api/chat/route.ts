import { OpenAIStream, StreamingTextResponse } from 'ai'
import OpenAI from 'openai'
import { DataAPIClient } from "@datastax/astra-db-ts"

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  "Access-Control-Max-Age": "86400",
};

// Export edge runtime
export const runtime = 'edge'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  })
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  // OpenAI Configuration
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  })

  // Create a context prompt only if we have DB credentials
  let contextPrompt = ''
  try {
    if (
      process.env.ASTRA_DB_APPLICATION_TOKEN &&
      process.env.ASTRA_DB_API_ENDPOINT &&
      process.env.ASTRADB_DB_COLLECTION
    ) {
      // Get the last user message
      const lastUserMessage = messages[messages.length - 1].content
      
      // Set up AstraDB client
      const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN)
      const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
        namespace: process.env.ASTRADB_DB_NAMESPACE || 'default_keyspace'
      })
      const collection = await db.collection(process.env.ASTRADB_DB_COLLECTION)
      
      // Generate embeddings
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: lastUserMessage,
        encoding_format: 'float'
      })
      
      // Query the vector database
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.data[0].embedding
        },
        limit: 5
      })
      
      const documents = await cursor.toArray()
      const contexts = documents?.map(doc => doc.text)
      
      // Format the context
      if (contexts && contexts.length > 0) {
        contextPrompt = `
START CONTEXT BLOCK
${contexts.join('\n\n')}
END CONTEXT BLOCK
        `
      }
    }
  } catch (error) {
    console.error('Error retrieving context:', error)
    // Continue without context if there's an error
  }

  // Create system message
  const systemMessage = {
    role: 'system',
    content: `You are an AI assistant who knows everything about Formula 1.
${contextPrompt ? contextPrompt : ''}
If the context doesn't include the information you need, answer based on
your existing knowledge and don't mention the source of your information.
Format responses using markdown where applicable and don't return images.`
  }

  // Create the response
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    stream: true,
    messages: [systemMessage, ...messages]
  })

  // Convert the response to a readable stream
  const stream = OpenAIStream(response)

  // Return the stream with CORS headers
  return new StreamingTextResponse(stream, { headers: corsHeaders })
}