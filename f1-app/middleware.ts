import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // If it's an API request, add CORS headers
  if (path.startsWith('/api/')) {
    // Create a NextResponse
    const response = NextResponse.next();
    
    // Add the CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set(
      'Access-Control-Allow-Methods', 
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
    
    console.log('Middleware applied CORS headers to', path);
    
    return response;
  }
  
  // For non-API routes, continue without modification
  return NextResponse.next();
}

// Configure the matcher to run on API routes
export const config = {
  matcher: ['/api/:path*'],
}; 