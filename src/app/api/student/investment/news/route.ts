import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 캐시: class_id별로 뉴스를 캐시하여 API 호출 최적화
const newsCache: Record<string, { timestamp: number, data: any[] }> = {};
const CACHE_DURATION = 1000 * 60 * 30; // 30분

/**
 * 학생의 class_id를 기반으로 해당 교사의 Google AI API 키를 조회
 * 우선순위: 교사 설정 → 환경변수 폴백
 */
async function getApiKeyByClassId(classId: string): Promise<string | null> {
    const supabase = createClient();

    // 1. class_id로 해당 학급의 교사 ID 조회
    const { data: classData } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .maybeSingle();

    if (classData?.teacher_id) {
        // 2. 교사 설정에서 API 키 조회
        const { data: settings } = await supabase
            .from('teacher_settings')
            .select('google_ai_api_key')
            .eq('teacher_id', classData.teacher_id)
            .maybeSingle();

        if (settings?.google_ai_api_key) {
            return settings.google_ai_api_key;
        }
    }

    // 3. 폴백: 환경변수
    return process.env.GOOGLE_AI_API_KEY || null;
}

export async function GET(request: Request) {
    try {
        // URL에서 class_id 파라미터 가져오기
        const { searchParams } = new URL(request.url);
        const classId = searchParams.get('classId');

        // 캐시 확인 (class_id별)
        const cacheKey = classId || 'default';
        if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_DURATION) {
            return NextResponse.json({ news: newsCache[cacheKey].data });
        }

        // 교사별 API 키 조회
        let apiKey: string | null = null;
        if (classId) {
            apiKey = await getApiKeyByClassId(classId);
        } else {
            // class_id가 없으면 환경변수 폴백
            apiKey = process.env.GOOGLE_AI_API_KEY || null;
        }

        // RSS 뉴스 파싱
        const parser = new Parser();
        const feed = await parser.parseURL('https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR%3Ako');
        const topItems = feed.items.slice(0, 5);

        // API 키가 없으면 AI 요약 없이 원본 뉴스만 반환
        if (!apiKey) {
            const basicNews = topItems.map((item: any) => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                summary: item.contentSnippet?.slice(0, 100) + '...' || '요약 정보를 제공하려면 교사 설정에서 AI API 키를 등록해주세요.'
            }));

            newsCache[cacheKey] = { timestamp: Date.now(), data: basicNews };
            return NextResponse.json({ news: basicNews });
        }

        // AI를 이용한 뉴스 요약
        const genAI = new GoogleGenerativeAI(apiKey);
        const summarizedNews = await Promise.all(topItems.map(async (item: any) => {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const prompt = `다음 뉴스 기사 제목과 내용을 초등학생도 이해하기 쉽게 2문장으로 요약해줘. 이모지 하나를 앞에 붙여줘.\n\n제목: ${item.title}\n내용: ${item.contentSnippet || item.content || ''}`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const summary = response.text();

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    summary: summary
                };
            } catch (err) {
                // AI 실패 시 원본 스니펫 사용
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    summary: item.contentSnippet?.slice(0, 100) + '...'
                };
            }
        }));

        // 캐시 업데이트
        newsCache[cacheKey] = {
            timestamp: Date.now(),
            data: summarizedNews
        };

        return NextResponse.json({ news: summarizedNews });

    } catch (error) {
        console.error('News Error:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
