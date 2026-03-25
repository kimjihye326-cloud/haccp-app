import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

const TARGETS = ['도마', '칼', '작업대', '발판']

export default function SanitationForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [results, setResults] = useState<Record<string, boolean>>(
    Object.fromEntries(TARGETS.map(t => [t, true]))
  )
  const [submitting, setSubmitting] = useState(false)
  const [existingData, setExistingData] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { checkExisting() }, [checkDate])

  async function checkExisting() {
    const { data } = await supabase.from('sanitation_logs')
      .select('id').eq('check_date', checkDate).eq('inspector_id', user?.user_id).limit(1)
    setExistingData(!!(data && data.length > 0))
  }

  function toggle(target: string) {
    setResults(prev => ({ ...prev, [target]: !prev[target] }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (existingData) {
        await supabase.from('sanitation_logs').delete().eq('check_date', checkDate).eq('inspector_id', user!.user_id)
      }
      const rows = TARGETS.map(t => ({
        inspector_id: user!.user_id,
        check_date: checkDate,
        target_name: t,
        is_done: results[t],
      }))
      const { error } = await supabase.from('sanitation_logs').insert(rows)
      if (error) throw error
      toast.success('조리시설기구소독 저장 완료')
      checkExisting()
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const allDone = Object.values(results).every(v => v)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">조리시설기구소독관리</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-base font-semibold" />
          <span className="text-base font-semibold text-gray-700">{user?.name}</span>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <p className="font-bold">소독액 기준</p>
          <p>소독액종류: 유한락스레귤러</p>
          <p>도마/칼/작업대: 물 2L + 유한락스 5mL</p>
          <p>발판: 물 4L + 유한락스 10mL</p>
          <p>시간: 작업 시작 전 (~9:00 전까지 수행완료)</p>
        </div>

        {existingData && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-base font-semibold">
            이 날짜에 이미 저장된 기록이 있습니다. 저장 시 덮어쓰기됩니다.
          </div>
        )}

        <div className="space-y-3">
          {TARGETS.map(target => (
            <button key={target} onClick={() => toggle(target)}
              className={`w-full rounded-2xl border-2 p-5 text-left transition-all cursor-pointer
                ${results[target] ? 'border-green-300 bg-white' : 'border-red-400 bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-gray-800">{target}</p>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white
                  ${results[target] ? 'bg-green-500' : 'bg-red-500'}`}>
                  {results[target] ? '✓' : '✗'}
                </div>
              </div>
              <p className={`mt-1 text-sm font-bold ${results[target] ? 'text-green-600' : 'text-red-600'}`}>
                {results[target] ? '소독 완료' : '미완료'}
              </p>
            </button>
          ))}
        </div>

        <div className={`mt-4 p-4 rounded-2xl text-center text-lg font-bold ${allDone ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {allDone ? '모든 기구 소독 완료' : '미완료 항목이 있습니다'}
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
