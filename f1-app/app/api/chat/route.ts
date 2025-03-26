import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from "next/server"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
};

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: Request) {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

const {
    ASTRADB_DB_NAMESPACE,
    ASTRADB_DB_COLLECTION,
    ASTRADB_DB_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
})

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRADB_DB_ENDPOINT, { namespace: ASTRADB_DB_NAMESPACE })

export const runtime = 'edge'

// Handle GET requests
export async function GET() {
    return NextResponse.json({ message: "Please use POST method for chat requests" }, { status: 405 })
}

// Handle POST requests
export async function POST(req: Request) {
    // Add CORS headers to all responses
    const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
    };

    try {
        console.log("API route called with request:", req.url);
        
        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not configured");
        }

        if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRADB_DB_ENDPOINT || !ASTRADB_DB_NAMESPACE || !ASTRADB_DB_COLLECTION) {
            throw new Error("Database configuration is incomplete");
        }

        const { messages } = await req.json();
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Invalid messages format");
        }

        console.log("Received messages:", messages.length);
        
        const latestMessage = messages[messages.length - 1]?.content;
        if (!latestMessage) {
            throw new Error("No message content found");
        }

        console.log("Latest message:", latestMessage);

        let docContext = ""

        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: latestMessage,
            encoding_format: "float"
        })
        console.log("Created embeddings successfully");

        try {
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
        
        console.log("Database connection status:", !!client && !!db ? "Connected" : "Not connected")
        console.log("Database details:", {
            namespace: ASTRADB_DB_NAMESPACE,
            collection: ASTRADB_DB_COLLECTION,
            endpoint: ASTRADB_DB_ENDPOINT?.substring(0, 20) + "...", // Truncate for security
        })
        
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
        
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [template, ...messages],
            stream: true
        })

        const stream = OpenAIStream(response)
        return new StreamingTextResponse(stream, { headers });
        
    } catch (error) {
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