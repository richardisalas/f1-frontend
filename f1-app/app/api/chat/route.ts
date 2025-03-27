import { Message } from 'ai'
import { DataAPIClient } from "@datastax/astra-db-ts"
import OpenAI from 'openai'

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
    // Initialize OpenAI client for embeddings
    const openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Setup AstraDB client
    const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN)
    const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
      namespace: process.env.ASTRADB_DB_NAMESPACE || 'default_keyspace'
    })
    const collection = await db.collection(process.env.ASTRADB_DB_COLLECTION)
    
    // Generate embeddings
    const embedding = await openAIClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
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

export async function POST(req: Request) {
  try {
    // Initialize OpenAI with API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Parse JSON request body
    let messages
    try {
      const body = await req.json()
      messages = body.messages
      
      if (!messages || !Array.isArray(messages)) {
        throw new Error('Invalid messages format')
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }
    
    // Get the last message for context retrieval
    const lastMessage = messages[messages.length - 1]
    
    // Get context from AstraDB
    let context = ''
    try {
      context = await getContext(lastMessage.content)
    } catch (error) {
      console.error('Error getting context:', error)
      // Continue without context on error
    }
    
    // Create system message with context
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
    
    try {
      // Create a new ReadableStream with a controller that we can manually append to
      const encoder = new TextEncoder()
      let counter = 0
      
      const stream = new ReadableStream({
        async start(controller) {
          const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [systemPrompt, ...messages],
            stream: true,
          })
          
          // Process the stream
          for await (const chunk of chatCompletion) {
            counter++
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              // Important: The AI SDK expects the "content" field (not "text")
              const formattedChunk = JSON.stringify({ content })
              controller.enqueue(encoder.encode(`data: ${formattedChunk}\n\n`))
            }
          }
          
          // Send the final [DONE] marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      })
      
      // Return the stream with SSE headers
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error in chat API:', error)
    // Return detailed error for debugging
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
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