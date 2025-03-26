import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /api/chat)
  const path = request.nextUrl.pathname;
  console.log(`Middleware for ${request.method} ${path}`);

  // Get origin from request headers
  const origin = request.headers.get('origin') || '*';
  
  // Set CORS headers for API routes
  const response = NextResponse.next();
  
  // Set CORS headers for browser requests
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  // Handle OPTIONS preflight request specially
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }
  
  return response;
}

// Only match API routes
export const config = {
  matcher: ['/api/:path*'],
}; 