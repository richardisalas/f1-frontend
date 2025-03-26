import { NextResponse } from "next/server";

export async function GET() {
  const {
    ASTRADB_DB_NAMESPACE,
    ASTRADB_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
  } = process.env;

  return NextResponse.json({
    status: "ok",
    config: {
      hasAstraNamespace: !!ASTRADB_DB_NAMESPACE,
      hasAstraCollection: !!ASTRADB_DB_COLLECTION,
      hasAstraEndpoint: !!ASTRA_DB_API_ENDPOINT,
      hasAstraToken: !!ASTRA_DB_APPLICATION_TOKEN,
      hasOpenAIKey: !!OPENAI_API_KEY,
      // Show first few chars of the namespace/collection as they're not sensitive
      astraNamespace: ASTRADB_DB_NAMESPACE?.substring(0, 4) + "...",
      astraCollection: ASTRADB_DB_COLLECTION?.substring(0, 4) + "..."
    }
  });
} 