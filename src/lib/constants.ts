export const INVESTMENT_SYMBOLS = [
    { symbol: '005930.KS', name: '삼성전자', type: 'stock' },
    { symbol: '000660.KS', name: 'SK하이닉스', type: 'stock' },
    { symbol: '005380.KS', name: '현대차', type: 'stock' },
    { symbol: '035420.KS', name: 'NAVER', type: 'stock' },
    { symbol: '005490.KS', name: 'POSCO홀딩스', type: 'stock' },
    { symbol: '003490.KS', name: '대한항공', type: 'stock' },
    { symbol: '066570.KS', name: 'LG전자', type: 'stock' },
    { symbol: '000270.KS', name: '기아', type: 'stock' },
    { symbol: '051910.KS', name: 'LG화학', type: 'stock' },
    { symbol: '068270.KS', name: '셀트리온', type: 'stock' },
    { symbol: 'AAPL', name: 'Apple', type: 'stock' },
    { symbol: 'AMZN', name: 'Amazon', type: 'stock' },
    { symbol: 'NFLX', name: 'Netflix', type: 'stock' },
    { symbol: 'TSLA', name: 'Tesla', type: 'stock' },
    { symbol: 'NVDA', name: 'NVIDIA', type: 'stock' },
    { symbol: 'MSFT', name: 'Microsoft', type: 'stock' },
    { symbol: 'META', name: 'Meta', type: 'stock' },
    { symbol: 'BTC-KRW', name: '비트코인', type: 'coin' },
    { symbol: 'ETH-KRW', name: '이더리움', type: 'coin' },
    { symbol: 'XRP-KRW', name: '리플', type: 'coin' },
    { symbol: 'DOGE-KRW', name: '도지코인', type: 'coin' },
    { symbol: 'SOL-KRW', name: '솔라나', type: 'coin' }
];

export type PriceMode = 'realtime' | 'hourly' | 'weekly';

// 투자 수량 정밀도: FLOAT 컬럼의 부동소수 오차(예: 2.22e-16주)를 정리하기 위한 기준
export const QTY_DECIMALS = 6;
// 이 값보다 작은 보유량은 오차 찌꺼기로 보고 0으로 취급
export const QTY_EPSILON = 1e-6;

// 수량을 QTY_DECIMALS 자리로 반올림 (부동소수 오차 제거)
export function roundQuantity(qty: number): number {
    const factor = 10 ** QTY_DECIMALS;
    return Math.round(qty * factor) / factor;
}

// DB 저장값 정규화 (소수 8자리: 과거 8자리 코인 수량을 보존하면서 FLOAT 오차만 제거)
export function normalizeStoredQuantity(qty: number): number {
    return Math.round(qty * 1e8) / 1e8;
}

// 화면 표시용 수량 문자열 (지수 표기/긴 소수 방지)
export function formatQuantity(qty: number): string {
    return roundQuantity(qty).toLocaleString('ko-KR', { maximumFractionDigits: QTY_DECIMALS });
}
