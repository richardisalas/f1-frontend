import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"

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
            const collection = await db.collection(ASTRADB_DB_COLLECTION)
            const cursor =collection.find(null, {
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
        
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [template, ...messages],
            stream: true
        })
        
        const stream = OpenAIStream(response)
        return new StreamingTextResponse(stream)
        
    } catch (error) {
        console.error("Error in chat API route:", error)
        return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        })
    }
}