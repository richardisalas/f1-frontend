import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
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

// POST handler for chat requests
export async function POST(request: Request) {
    try {
        // Parse the request body
        const body = await request.json();
        const { messages } = body;
        
        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: "Invalid messages format" }),
                { 
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Extract the latest user message
        const latestMessage = messages[messages.length - 1]?.content || "";
        
        // Get context from vector database
        let docContext = ""
        try {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: latestMessage,
                encoding_format: "float"
            });

            if (db && ASTRADB_DB_COLLECTION) {
                const collection = await db.collection(ASTRADB_DB_COLLECTION);
                const cursor = collection.find(null, {
                    sort: {
                        $vector: embedding.data[0].embedding,
                    },
                    limit: 10
                });  

                const documents = await cursor.toArray();
                const docsMap = documents?.map(doc => doc.text);
                docContext = JSON.stringify(docsMap);
            }
        } catch (error) {
            console.error("Error querying database:", error);
            docContext = "";
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
        };
        
        // Generate response
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [template, ...messages],
            stream: true,
        });
        
        // Create a streaming response
        const stream = OpenAIStream(response);
        return new StreamingTextResponse(stream, { headers: corsHeaders });
        
    } catch (error) {
        console.error("Error in chat API route:", error);
        
        return new Response(
            JSON.stringify({ 
                error: "Failed to process chat request",
                details: error instanceof Error ? error.message : "Unknown error"
            }), 
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        );
    }
}