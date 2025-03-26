import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from "next/server"

// CORS headers to allow requests from any origin
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
};

// Environment variables
const {
    ASTRADB_DB_NAMESPACE,
    ASTRADB_DB_COLLECTION,
    ASTRADB_DB_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
})

// Initialize AstraDB client
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRADB_DB_ENDPOINT, { namespace: ASTRADB_DB_NAMESPACE })

export const runtime = 'edge'

// Handle preflight requests
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

// Main API handler
export async function POST(req: Request) {
    // Define response headers
    const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
    };

    try {
        // Log request info
        console.log("API route called with request:", req.url);
        
        // Validate environment variables
        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not configured");
        }

        if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRADB_DB_ENDPOINT || !ASTRADB_DB_NAMESPACE || !ASTRADB_DB_COLLECTION) {
            throw new Error("Database configuration is incomplete");
        }

        // Parse the request body
        const body = await req.json();
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
            
            console.log("docContext (first 200 chars):", docContext.substring(0, 200))
            console.log("docContext length:", docContext.length)
            
            if (docContext.length < 5) {
                console.warn("Warning: Empty or very small docContext. Database may be empty or query returned no results.")
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
            The contect will provide you tih the most recent page data from wikipedia,
            the official F1 website and others.

            If the context doesn't include the information you need answer based on
            your existing knowlege and don't mention the source of your information or 
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
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [template, ...messages],
            stream: true
        })

        // Stream the response
        const stream = OpenAIStream(response)
        return new StreamingTextResponse(stream, { headers });
        
    } catch (error) {
        // Handle errors
        console.error("Error in chat API route:", error);
        
        let errorMessage = "Failed to process chat request";
        let statusCode = 500;
        
        if (error instanceof Error) {
            errorMessage = error.message;
            
            if (errorMessage.includes("API key")) {
                statusCode = 401;
            } else if (errorMessage.includes("Invalid") || errorMessage.includes("No message")) {
                statusCode = 400;
            }
        }
        
        // Return error response
        return new Response(
            JSON.stringify({ 
                error: errorMessage,
                details: {
                    dbConnected: !!client && !!db,
                    hasOpenAIKey: !!OPENAI_API_KEY,
                    hasAstraDBConfig: !!(ASTRADB_DB_NAMESPACE && ASTRADB_DB_COLLECTION && ASTRADB_DB_ENDPOINT && ASTRA_DB_APPLICATION_TOKEN)
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