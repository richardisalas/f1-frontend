import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from "next/server"

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

// OPTIONS handler - handles preflight requests
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

// POST handler - main handler for the chat API
export async function POST(request: Request) {
    // Define response headers
    const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
    };

    try {
        // Log request info
        console.log("API route called with POST request");
        
        // Validate environment variables
        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not configured");
        }

        // Parse the request body
        let body;
        try {
            body = await request.json();
        } catch (e) {
            throw new Error("Failed to parse request body");
        }
        
        const { messages } = body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Invalid messages format");
        }

        console.log("Received messages:", messages.length);
        
        // Extract the latest user message
        const latestMessage = messages[messages.length - 1]?.content;
        if (!latestMessage) {
            throw new Error("No message content found");
        }

        console.log("Latest message:", latestMessage);

        // Get context from vector database
        let docContext = ""
        try {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: latestMessage,
                encoding_format: "float"
            })
            console.log("Created embeddings successfully");

            if (db && ASTRADB_DB_COLLECTION) {
                const collection = await db.collection(ASTRADB_DB_COLLECTION)
                const cursor = collection.find(null, {
                    sort: {
                        $vector: embedding.data[0].embedding,
                    },
                    limit: 10
                })  

                const documents = await cursor.toArray()
                console.log("Retrieved documents count:", documents?.length || 0)
                
                const docsMap = documents?.map(doc => doc.text)
                docContext = JSON.stringify(docsMap)
            } else {
                console.warn("Database not initialized. Using empty context.")
            }
        } catch (error) {
            console.error("Error querying database:", error)
            docContext = ""
        }
        
        // Create system prompt with context
        const template = {
            role: "system",
            content: `You are an AI assistant who knows everything about Formula 1. 
            Use the below context to augment what you know about Formula One racing.
            The context will provide you with the most recent page data from wikipedia,
            the official F1 website and others.

            If the context doesn't include the information you need answer based on
            your existing knowledge and don't mention the source of your information or 
            what the context does or doesn't include.

            Format responses using markdown where applicable and don't return images.
            ----------
            START CONTEXT
            ${docContext}
            END CONTEXT
            ----------
            QUESTION: ${latestMessage}
            ----------
            `
        }
        
        // Generate AI response
        console.log("About to call OpenAI API with model: gpt-4");
        
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [template, ...messages],
                stream: true,
            });
            
            // Stream the response
            const stream = OpenAIStream(response);
            return new StreamingTextResponse(stream, { headers });
        } catch (openaiError) {
            console.error("OpenAI API call failed:", openaiError);
            throw openaiError;
        }
        
    } catch (error) {
        // Handle errors
        console.error("Error in chat API route:", error);
        
        const errorMessage = error instanceof Error ? error.message : "Failed to process chat request";
        const statusCode = 500;
        
        // Return error response
        return new Response(
            JSON.stringify({ 
                error: errorMessage,
                details: {
                    hasOpenAIKey: !!OPENAI_API_KEY
                }
            }), 
            {
                status: statusCode,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        );
    }
}