import { NextResponse } from "next/server";

// CORS headers to allow requests from any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  "Access-Control-Max-Age": "86400",
};

export const runtime = 'edge';

// OPTIONS handler
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// GET handler - provide API info
export async function GET() {
  return NextResponse.json(
    { 
      status: "ok",
      message: "F1-GPT API is running. POST requests should be sent to /api/chat.",
      availableEndpoints: ["/api/chat"],
      version: "1.0" 
    },
    { headers: corsHeaders }
  );
}

// POST handler
export async function POST() {
  return NextResponse.json(
    { 
      error: "Not found",
      message: "To use the chat API, send POST requests to /api/chat" 
    },
    { 
      status: 404,
      headers: corsHeaders 
    }
  );
} 