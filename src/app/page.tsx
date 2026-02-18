
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, GraduationCap, Lock, ArrowRight, School } from 'lucide-react'
import { adminSignUp } from './actions/auth'

export default function LoginPage() {
  const [role, setRole] = useState<'teacher' | 'student' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 교사 로그인 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  // 학생 로그인 상태
  const [studentId, setStudentId] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [studentPassword, setStudentPassword] = useState('')

  // 현재 세션 상태 확인
  const [currentUser, setCurrentUser] = useState<any>(null)

  useState(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    checkUser()
  })

  const handleSignOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setCurrentUser(null)
    localStorage.removeItem('student_session')
    setLoading(false)
    window.location.reload() // 세션 정리를 위해 새로고침 강제
  }

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        // 클라이언트 signUp 대신 서버 액션 호출 (이메일 인증 우회)
        const result = await adminSignUp({ email, password, name: teacherName })

        if (!result.success) {
          throw new Error(result.error)
        }

        alert(result.message)
        setIsSignUp(false) // 로그인 화면으로 전환
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/teacher')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId, sessionCode, password: studentPassword }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '로그인 실패')

      // 세션 정보를 로컬스토리지에 저장
      localStorage.setItem('student_session', JSON.stringify({
        student: data.student,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt
      }))

      router.push('/student')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-slide-in">
          {currentUser && (
            <div className="mb-6 p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-blue-200 dark:border-blue-900/50 backdrop-blur-sm shadow-sm inline-flex items-center gap-3">
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">현재 로그인 계정</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{currentUser.email} ({currentUser.user_metadata?.role === 'teacher' ? '선생님' : '학생'})</span>
              </div>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="ml-2 p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-red-100"
              >
                <Lock className="w-3 h-3" />
                로그아웃
              </button>
            </div>
          )}
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl mb-6 transform hover:scale-105 transition-transform duration-300">
              <School className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 mb-3 tracking-tight">
              ClassEconomy
            </h1>
          </div>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-medium">학급 관리 프로그램</p>
        </div>

        <div className="glass-panel p-8 animate-slide-in" style={{ animationDelay: '0.1s' }}>
          {!role ? (
            <div className="space-y-4">
              <button
                onClick={() => setRole('teacher')}
                className="w-full p-4 flex items-center gap-4 rounded-xl border-2 border-transparent hover:border-blue-500 bg-white/50 dark:bg-slate-800/50 transition-all group"
              >
                <div className="p-3 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-900 dark:text-white">교사로 시작하기</h3>
                  <p className="text-sm text-slate-500">학급을 개설하고 관리합니다</p>
                </div>
                <ArrowRight className="w-5 h-5 ml-auto text-slate-400 group-hover:text-blue-500" />
              </button>

              <button
                onClick={() => setRole('student')}
                className="w-full p-4 flex items-center gap-4 rounded-xl border-2 border-transparent hover:border-emerald-500 bg-white/50 dark:bg-slate-800/50 transition-all group"
              >
                <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-900 dark:text-white">학생으로 입장하기</h3>
                  <p className="text-sm text-slate-500">우리 반 경제 활동에 참여합니다</p>
                </div>
                <ArrowRight className="w-5 h-5 ml-auto text-slate-400 group-hover:text-emerald-500" />
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setRole(null); setError(null); }}
                className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1"
              >
                ← 뒤로 가기
              </button>

              {role === 'teacher' ? (
                <form onSubmit={handleTeacherAuth} className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">{isSignUp ? '선생님 회원가입' : '선생님 로그인'}</h2>
                  {isSignUp && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                      <input
                        type="text"
                        required
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                        placeholder="홍길동"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                      placeholder="teacher@school.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-white/80"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary flex justify-center items-center gap-2"
                  >
                    {loading ? '처리중...' : (isSignUp ? '가입하기' : '로그인')}
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">학생 로그인</h2>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">학번</label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none bg-white/80"
                      placeholder="예: 20201 (2학년 2반 1번)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">세션 코드</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={sessionCode}
                        onChange={(e) => setSessionCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none bg-white/80"
                        placeholder="선생님이 주신 코드"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none bg-white/80"
                        placeholder="설정한 비밀번호 (기본: 1234)"
                      />
                    </div>
                  </div>

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary bg-gradient-to-r from-emerald-500 to-teal-600 flex justify-center items-center gap-2"
                  >
                    {loading ? '접속중...' : '교실 입장하기'}
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-4">
                    * 처음 접속 시 자동으로 학생 등록이 확인됩니다.
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
