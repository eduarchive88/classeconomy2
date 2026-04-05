
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { prompt, apiKey, difficulty, count } = await request.json();
    const supabase = createClient();

    // 1. 현재 로그인한 교사의 API 키 조회
    let finalApiKey = null;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: settings } = await supabase
            .from('teacher_settings')
            .select('google_ai_api_key')
            .eq('teacher_id', user.id)
            .maybeSingle();

        // 교사 설정에 API 키가 있으면 우선 사용
        if (settings?.google_ai_api_key) {
            finalApiKey = settings.google_ai_api_key;
        }
    }

    // 2. 폴백: 환경변수
    if (!finalApiKey) {
        finalApiKey = process.env.GOOGLE_AI_API_KEY;
    }

    // 3. 폴백: 사용자 입력 API 키
    if (!finalApiKey) {
        finalApiKey = apiKey;
    }

    if (!finalApiKey) {
        return NextResponse.json({
            error: 'API 키가 필요합니다. 시스템 설정에서 API 키를 등록하거나 직접 입력해주세요.'
        }, { status: 400 });
    }

    try {
        const genAI = new GoogleGenerativeAI(finalApiKey);
        // 뀨짱쌤 요청에 따라 gemini-2.5-flash 모델로 원복합니다.
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const countNum = count || 5; // 기본 5문제

        const systemPrompt = `
      You are an economics teacher. Create ${countNum} multiple choice quizzes about the following topic: "${prompt}".
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

        // JSON 추출 로직 강화 (마크다운 블록 및 불필요한 텍스트 제거)
        let cleanText = text.trim();
        if (cleanText.includes('```json')) {
            cleanText = cleanText.split('```json')[1].split('```')[0].trim();
        } else if (cleanText.includes('```')) {
            cleanText = cleanText.split('```')[1].split('```')[0].trim();
        }

        try {
            const quizzes = JSON.parse(cleanText);
            return NextResponse.json({ quizzes });
        } catch (parseError) {
            console.error('JSON Parse Error. Cleaned text:', cleanText);
            return NextResponse.json({ 
                error: 'AI가 생성한 데이터 형식이 올바르지 않습니다.',
                rawResponse: text // 디버깅을 위해 원본 포함
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('AI Quiz Generation Error:', error);
        return NextResponse.json({ error: 'AI Error: ' + error.message }, { status: 500 });
    }
}
