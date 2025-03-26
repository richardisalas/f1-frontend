import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Log request details for debugging
  console.log(`Middleware processing: ${request.method} ${request.nextUrl.pathname}`);

  // Get origin from request headers or use wildcard
  const origin = request.headers.get('origin') || '*';
  
  // Create the response
  const response = NextResponse.next();
  
  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  // Special handling for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }
  
  return response;
}

// Only apply this middleware to API routes
export const config = {
  matcher: '/api/:path*',
}; 