import { Message, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
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

// Function to get context from AstraDB
async function getContext(message: string) {
  // Check if we have all the required environment variables
  if (
    !process.env.ASTRA_DB_APPLICATION_TOKEN ||
    !process.env.ASTRA_DB_API_ENDPOINT ||
    !process.env.ASTRADB_DB_COLLECTION ||
    !process.env.OPENAI_API_KEY
  ) {
    console.warn('Missing required environment variables for vector search')
    return ''
  }

  try {
    // Setup AstraDB client
    const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN)
    const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
      namespace: process.env.ASTRADB_DB_NAMESPACE || 'default_keyspace'
    })
    const collection = await db.collection(process.env.ASTRADB_DB_COLLECTION)
    
    // Create OpenAI client for embeddings
    const openaiClient = new OpenAIEmbeddings(process.env.OPENAI_API_KEY)
    const embedding = await openaiClient.embed(message)
    
    // Query the vector database
    const cursor = collection.find(null, {
      sort: {
        $vector: embedding
      },
      limit: 5
    })
    
    const documents = await cursor.toArray()
    const contexts = documents?.map(doc => doc.text) || []
    
    // Return context if documents were found
    if (contexts.length > 0) {
      return contexts.join('\n\n')
    }
    
    return ''
  } catch (error) {
    console.error('Error retrieving context:', error)
    return ''
  }
}

// OpenAI Embeddings class to handle embedding generation
class OpenAIEmbeddings {
  apiKey: string
  
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  
  async embed(text: string): Promise<number[]> {
    const openaiClient = new (await import('openai')).default({
      apiKey: this.apiKey
    })
    
    const embedding = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })
    
    return embedding.data[0].embedding
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    
    // Get the last message for context retrieval
    const lastMessage = messages[messages.length - 1]
    
    // Get context from AstraDB
    const context = await getContext(lastMessage.content)
    
    // Create system message
    const systemPrompt = {
      role: "system",
      content: `You are an AI assistant who knows everything about Formula 1.
      Use the below context to augment what you know about Formula One racing.
      
      ${context ? `START CONTEXT BLOCK
      ${context}
      END CONTEXT BLOCK` : ''}
      
      If the context doesn't include the information you need, answer based on
      your existing knowledge and don't mention the source of your information.
      Format responses using markdown where applicable and don't return images.`
    }
    
    // Use streamText from AI SDK to generate the response
    const response = await streamText({
      model: openai('gpt-4'),
      messages: [
        systemPrompt,
        ...messages.filter((message: Message) => message.role === "user")
      ]
    })
    
    // Convert the response to a data stream with CORS headers
    return response.toDataStreamResponse({
      headers: corsHeaders
    })
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}