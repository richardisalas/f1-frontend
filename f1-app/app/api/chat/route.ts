import { Message } from 'ai';
import OpenAI from 'openai';
import { DataAPIClient } from "@datastax/astra-db-ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  "Access-Control-Max-Age": "86400",
};

// Export edge runtime
export const runtime = 'edge';

// Initialize OpenAI client with environment variable
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize DataStax AstraDB client
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, { 
  namespace: process.env.ASTRADB_DB_NAMESPACE 
});

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
export async function POST(req: Request) {
    try {
        const {messages} = await req.json()
        const lastestMessage = messages[messages?.length - 1]?.content

        let docContext = ""

        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: lastestMessage,
            encoding_format: "float"
        })

        try {
            const collection = await db.collection(process.env.ASTRADB_DB_COLLECTION)
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding.data[0].embedding,
                },
                limit: 10
            })  

            const documents = await cursor.toArray()
            const docsMap = documents?.map(doc => doc.text)
            docContext = JSON.stringify(docsMap)
        } catch (error) {
            console.log("Error querying database:", error)
            docContext = ""
        }
        
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
            QUESTION: ${lastestMessage}
            ----------
            `
        }
        
        // Enable streaming
        const stream = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [template, ...messages],
            stream: true
        })
        
        // Return streaming response with proper format
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const chunk of stream) {
                            const content = chunk.choices[0]?.delta?.content || "";
                            if (content) {
                                // Format exactly as expected by the AI SDK
                                const formattedMessage = JSON.stringify({
                                    id: Math.random().toString(36).substring(2, 12),
                                    role: "assistant",
                                    content: content,
                                    createdAt: new Date()
                                });
                                controller.enqueue(encoder.encode(`data: ${formattedMessage}\n\n`));
                            }
                        }
                        // Send proper end marker
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    } catch (error) {
                        console.error("Error in stream:", error);
                        // Send a properly formatted error message
                        const errorMessage = JSON.stringify({
                            id: Math.random().toString(36).substring(2, 12),
                            role: "assistant",
                            content: "An error occurred while generating the response.",
                            createdAt: new Date()
                        });
                        controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    } finally {
                        controller.close();
                    }
                }
            }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive"
                }
            }
        );
        
    } catch (error) {
        console.error("Error in chat API route:", error)
        return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        })
    }
}