import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="w-full py-6 mt-auto bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="container mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                <p className="mb-2">
                    만든 사람: 경기도 지구과학 교사 뀨짱
                </p>
                <div className="flex justify-center gap-4">
                    <a
                        href="https://open.kakao.com/o/s7hVU65h"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 transition-colors"
                    >
                        문의: 카카오톡 오픈채팅
                    </a>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <a
                        href="https://eduarchive.tistory.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-500 transition-colors"
                    >
                        블로그: 뀨짱쌤의 교육자료 아카이브
                    </a>
                </div>
            </div>
        </footer>
    );
}
