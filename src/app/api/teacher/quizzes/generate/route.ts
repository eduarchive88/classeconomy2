
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { prompt, apiKey } = await request.json();

    // 환경변수에서 API 키 우선 사용, 없으면 사용자 입력 API 키 사용
    const finalApiKey = process.env.GOOGLE_AI_API_KEY || apiKey;

    if (!finalApiKey) {
        return NextResponse.json({ error: 'API Key is missing. Please set GOOGLE_AI_API_KEY environment variable or provide an API key.' }, { status: 400 });
    }

    try {
        const genAI = new GoogleGenerativeAI(finalApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
      You are an economics teacher. Create 5 multiple choice quizzes about the following topic: "${prompt}".
      Target audience: Elementary/Middle school students.
      Format: JSON Array only. No markdown code blocks.
      Structure per object:
      {
        "question": "Question text",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "answer": 1 (Index 1-4 of correct option),
        "reward": 500
      }
      Language: Korean.
    `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const quizzes = JSON.parse(cleanText);

        return NextResponse.json({ quizzes });
    } catch (error: any) {
        console.error('AI Quiz Generation Error:', error);
        return NextResponse.json({ error: 'AI Error: ' + error.message }, { status: 500 });
    }
}
