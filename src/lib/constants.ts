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
