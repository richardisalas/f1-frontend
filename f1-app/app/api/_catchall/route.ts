import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  "Access-Control-Max-Age": "86400",
};

export const runtime = 'edge';

// Handle OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Default handler for any unhandled API routes
export async function GET(request: NextRequest) {
  console.log('Catch-all API route called', { 
    method: request.method, 
    url: request.url
  });
  
  return NextResponse.json(
    { 
      error: 'Invalid API route', 
      message: 'This endpoint does not exist or is not properly configured',
      requestedPath: request.url
    }, 
    { 
      status: 404,
      headers: corsHeaders
    }
  );
}

// Handle all other methods
export async function POST(request: NextRequest) {
  console.log('Catch-all POST called', { method: request.method, url: request.url });
  
  const url = new URL(request.url);
  if (url.pathname === '/api/chat') {
    // This shouldn't happen as the dedicated chat handler should take precedence
    return NextResponse.json(
      { error: 'API route conflict', message: 'The chat endpoint exists but did not handle this request' }, 
      { status: 500, headers: corsHeaders }
    );
  }
  
  return NextResponse.json(
    { error: 'Invalid API route', message: 'This endpoint does not exist or is not properly configured' }, 
    { status: 404, headers: corsHeaders }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'PUT method is not supported for this endpoint' }, 
    { status: 405, headers: corsHeaders }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'DELETE method is not supported for this endpoint' }, 
    { status: 405, headers: corsHeaders }
  );
} 