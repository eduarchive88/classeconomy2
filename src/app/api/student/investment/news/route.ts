import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEN_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEN_AI_API_KEY);

// Cache news to avoid hitting quotas
let newsCache: { timestamp: number, data: any[] } | null = null;
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export async function GET() {
    try {
        // Check Cache
        if (newsCache && Date.now() - newsCache.timestamp < CACHE_DURATION) {
            return NextResponse.json({ news: newsCache.data });
        }

        const parser = new Parser();
        // Google News Economy (Korea)
        const feed = await parser.parseURL('https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR%3Ako');

        // Take top 5 items
        const topItems = feed.items.slice(0, 5);

        const summarizedNews = await Promise.all(topItems.map(async (item) => {
            try {
                // Use Gemini to summarize
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
                // Fallback if AI fails
                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    summary: item.contentSnippet?.slice(0, 100) + '...'
                };
            }
        }));

        // Update Cache
        newsCache = {
            timestamp: Date.now(),
            data: summarizedNews
        };

        return NextResponse.json({ news: summarizedNews });

    } catch (error) {
        console.error('News Error:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
