export async function register() {
    // Edge 런타임에서는 node-cron 사용 불가 → skip
    // Node.js standalone 모드에서 NEXT_RUNTIME이 undefined일 수 있으므로
    // 'edge'가 아닌 경우에만 실행 (undefined 포함)
    if (process.env.NEXT_RUNTIME === 'edge') return;

    // Avoid double-registration in dev hot-reload: use a global flag
    const g = global as any;
    if (g.__cronRegistered) return;
    g.__cronRegistered = true;

    const cron = await import('node-cron');

    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const CRON_SECRET = process.env.CRON_SECRET;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (CRON_SECRET) headers['authorization'] = `Bearer ${CRON_SECRET}`;

    const callCron = async (path: string) => {
        try {
            const res = await fetch(`${BASE_URL}${path}`, { headers });
            const text = await res.text();
            console.log(`[cron] ${path} → ${res.status}: ${text.slice(0, 200)}`);
        } catch (err) {
            console.error(`[cron] ${path} failed:`, err);
        }
    };

    // 오전 8시 KST = UTC 23:00 전날
    // node-cron schedule: second minute hour day month weekday
    // "0 23 * * *" = every day at 23:00 UTC = 08:00 KST

    // 매일 오전 8시 KST: 오늘의 퀴즈 배포
    cron.default.schedule('0 23 * * *', () => {
        console.log('[cron] daily-quiz triggered');
        callCron('/api/cron/daily-quiz');
    }, { timezone: 'UTC' });

    // 매 시간: 시장 시세 동기화 (hourly 모드용 스냅샷 + 월요일 9시 UTC에 weekly 스냅샷도 업데이트)
    cron.default.schedule('0 * * * *', () => {
        console.log('[cron] market-sync triggered');
        callCron('/api/cron/market-sync');
    }, { timezone: 'UTC' });

    console.log('[cron] Scheduled: daily-quiz(23:00 UTC), market-sync(every hour)');
    console.log('[cron] weekly-salary is handled by Coolify Scheduled Task only');
}
