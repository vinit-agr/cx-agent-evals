import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    keys: {
      langsmith: !!process.env.LANGSMITH_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      cohere: !!process.env.COHERE_API_KEY,
    },
  });
}
