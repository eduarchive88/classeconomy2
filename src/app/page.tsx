
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, GraduationCap, Lock, ArrowRight, School } from 'lucide-react'

export default function LoginPage() {
  const [role, setRole] = useState<'teacher' | 'student' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Teacher Login State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  // Student Login State
  const [studentId, setStudentId] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [studentName, setStudentName] = useState('') // For first-time student setup if needed

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'teacher',
              name: teacherName || email.split('@')[0],
            }
          }
        })
        if (error) throw error
        alert('회원가입 확인 메일을 확인해주세요!')
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
      // Need a custom API endpoint/Edge Function to handle "Student ID + Session Code" login
      // Simulating logic or calling a server action would be better here.
      // For now, let's assume we have an API route /api/auth/student
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId, sessionCode }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '로그인 실패')

      // The API should handle setting the session or returning a custom token
      // If using Supabase Auth for students (anonymous or email-less), we might sign them in anonymously and update metadata
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg mb-4">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            학급 경제 나라
          </h1>
          <p className="text-slate-500 mt-2">우리 반의 작은 경제 사회</p>
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
                      placeholder="예: 10120 (1학년 1반 20번)"
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
