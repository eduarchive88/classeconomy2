export default function MovedPage() {
    const NEW_URL = 'https://classeconomy.eduarchive.duckdns.org'

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                background: 'white',
                borderRadius: '20px',
                padding: '48px 40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                textAlign: 'center'
            }}>
                {/* 아이콘 */}
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '36px'
                }}>
                    🏫
                </div>

                <h1 style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px'
                }}>
                    ClassEconomy
                </h1>

                <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '32px' }}>
                    학급 경제 관리 프로그램
                </p>

                {/* 안내 박스 */}
                <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '28px',
                    textAlign: 'left'
                }}>
                    <p style={{ fontWeight: 700, color: '#92400e', fontSize: '15px', marginBottom: '8px' }}>
                        📢 서버 이전 안내
                    </p>
                    <p style={{ color: '#78350f', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
                        사용량 증가로 인한 서버 비용 부담으로 인해 <strong>새로운 서버로 이전</strong>하였습니다.
                        <br /><br />
                        이 주소에서는 더 이상 서비스가 제공되지 않습니다.
                        아래 버튼을 클릭하여 <strong>새로운 주소</strong>로 접속해 주세요.
                    </p>
                </div>

                {/* 즐겨찾기 안내 */}
                <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '28px',
                    textAlign: 'left'
                }}>
                    <p style={{ color: '#1e40af', fontSize: '13px', lineHeight: '1.7', margin: 0 }}>
                        ⭐ <strong>다음부터는 새로운 주소를 즐겨찾기에 추가</strong>하여
                        새로운 주소로 바로 접속해 주세요.
                    </p>
                </div>

                {/* 이동 버튼 */}
                <a
                    href={NEW_URL}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                        color: 'white',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                >
                    새로운 사이트로 이동하기 →
                </a>

                <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '20px', wordBreak: 'break-all' }}>
                    {NEW_URL}
                </p>
            </div>
        </div>
    )
}
