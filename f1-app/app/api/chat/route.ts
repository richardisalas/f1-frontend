import { Message } from "ai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { DataAPIClient } from "@datastax/astra-db-ts"

// CORS headers to allow requests from any origin
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
    "Access-Control-Max-Age": "86400",
};

// Environment variables
const {
    ASTRADB_DB_NAMESPACE,
    ASTRADB_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY || ""
})

// Initialize AstraDB client if credentials are available
const client = ASTRA_DB_APPLICATION_TOKEN ? new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN) : null
const db = client && ASTRA_DB_API_ENDPOINT ? client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRADB_DB_NAMESPACE || "default_keyspace" }) : null

export const runtime = 'edge'

// OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

// Helper function to get embeddings
async function getEmbedding(text: string) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
    });
    return response.data[0].embedding;
}

// Helper function to get context from database
async function getContext(message: string) {
    try {
        if (!db || !ASTRADB_DB_COLLECTION) return "";
        
        const embedding = await getEmbedding(message);
        const collection = await db.collection(ASTRADB_DB_COLLECTION);
        const cursor = collection.find(null, {
            sort: {
                $vector: embedding,
            },
            limit: 10
        });  
        
        const documents = await cursor.toArray();
        const docsContent = documents?.map(doc => doc.text);
        return JSON.stringify(docsContent);
    } catch (error) {
        console.error("Error getting context:", error);
        return "";
    }
}

// POST handler for chat requests
export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        
        // Get the last message
        const lastMessage = messages[messages.length - 1];
        
        // Get context for the last message
        const context = await getContext(lastMessage.content);
        
        // Create the system prompt with context
        const systemPrompt = {
            role: "system",
            content: `You are an AI assistant who knows everything about Formula 1.
            Use the below context to augment what you know about Formula One racing.
            The context will provide you with the most recent page data from wikipedia,
            the official F1 website and others.
            
            START CONTEXT BLOCK
            ${context}
            END CONTEXT BLOCK
            
            If the context doesn't include the information you need, answer based on
            your existing knowledge and don't mention the source of your information or
            what the context does or doesn't include.
            
            Format responses using markdown where applicable and don't return images.`
        };
        
        // Get OpenAI streaming response
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [systemPrompt, ...messages],
            stream: true,
        });
        
        // Convert to a stream compatible with StreamingTextResponse
        const stream = OpenAIStream(response);
        
        // Return response as a stream with CORS headers
        return new StreamingTextResponse(stream, {
            headers: corsHeaders
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ 
                error: "Failed to process request",
                details: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );
    }
}