import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ message: "API is working" })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    return NextResponse.json({ 
      message: "Received data successfully", 
      data: body 
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to parse request body" }, { status: 400 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  })
} 