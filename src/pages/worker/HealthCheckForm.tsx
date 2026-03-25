import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

const QUESTIONS = [
  '현재 또는 2주이내 설사를 한 적이 있습니까?',
  '기침 또는 발열(37.5°C 이상) 증상이 있습니까?',
  '복통이 있거나 구토를 합니까?',
  '눈, 귀 또는 코에서 진물이나 고름이 나옵니까?',
  '피부감염(화상, 화농성질환 또는 상처 등)이 있습니까?',
]

export default function HealthCheckForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [answers, setAnswers] = useState<boolean[]>(QUESTIONS.map(() => false))
  const [submitting, setSubmitting] = useState(false)
  const [existingData, setExistingData] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { checkExisting() }, [checkDate])

  async function checkExisting() {
    const { data } = await supabase.from('health_checks')
      .select('id').eq('check_date', checkDate).eq('inspector_id', user?.user_id).limit(1)
    setExistingData(!!(data && data.length > 0))
  }

  function toggle(idx: number) {
    setAnswers(prev => prev.map((v, i) => i === idx ? !v : v))
  }

  const allClear = answers.every(a => a === false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (existingData) {
        await supabase.from('health_checks').delete().eq('check_date', checkDate).eq('inspector_id', user!.user_id)
      }
      const rows = QUESTIONS.map((q, i) => ({
        inspector_id: user!.user_id,
        check_date: checkDate,
        question: q,
        answer: answers[i],
      }))
      const { error } = await supabase.from('health_checks').insert(rows)
      if (error) throw error
      toast.success('종사자위생점검 저장 완료')
      checkExisting()
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">종사자위생점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-base font-semibold" />
          <span className="text-base font-semibold text-gray-700">{user?.name}</span>
        </div>

        {existingData && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-base font-semibold">
            이 날짜에 이미 저장된 기록이 있습니다. 저장 시 덮어쓰기됩니다.
          </div>
        )}

        <div className="space-y-3">
          {QUESTIONS.map((q, idx) => (
            <button key={idx} onClick={() => toggle(idx)}
              className={`w-full rounded-2xl border-2 p-5 text-left transition-all cursor-pointer
                ${answers[idx]
                  ? 'border-red-400 bg-red-50'
                  : 'border-green-300 bg-white'}`}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-base font-semibold text-gray-800 flex-1">{q}</p>
                <div className={`w-14 h-8 rounded-full flex items-center transition-all ${answers[idx] ? 'bg-red-500 justify-end' : 'bg-green-500 justify-start'}`}>
                  <div className="w-6 h-6 bg-white rounded-full mx-1 shadow"></div>
                </div>
              </div>
              <p className={`mt-2 text-sm font-bold ${answers[idx] ? 'text-red-600' : 'text-green-600'}`}>
                {answers[idx] ? '예 (이상있음)' : '아니오 (정상)'}
              </p>
            </button>
          ))}
        </div>

        <div className={`mt-4 p-4 rounded-2xl text-center text-lg font-bold ${allClear ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {allClear ? '모든 항목 정상' : '이상 항목이 있습니다'}
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className={`w-full py-5 text-xl font-bold text-white rounded-2xl mt-4 transition-all active:scale-[0.98]
            ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
          {submitting ? '저장중...' : existingData ? '덮어쓰기 저장' : '저장'}
        </button>
      </div>
    </div>
  )
}
