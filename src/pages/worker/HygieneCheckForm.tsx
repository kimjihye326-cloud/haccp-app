import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

type Period = 'DAILY_B' | 'DAILY_D' | 'DAILY_A' | 'RECEIVE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
type Result = 'OK' | 'FAIL' | 'NA'

interface CheckItem { category: string; text: string; result: Result; action: string }

const PERIODS: { key: Period; label: string }[] = [
  { key: 'DAILY_B', label: '작업 전' },
  { key: 'DAILY_D', label: '작업 중' },
  { key: 'DAILY_A', label: '작업 후' },
  { key: 'RECEIVE', label: '입고 시' },
  { key: 'WEEKLY', label: '주간' },
  { key: 'MONTHLY', label: '월간' },
  { key: 'YEARLY', label: '연간' },
]

const CHECKLIST: Record<Period, { category: string; items: string[] }[]> = {
  DAILY_B: [
    { category: '개인위생', items: [
      '위생복장과 외출복장이 구분되어 보관되고 있는가?',
      '종사자의 건강상태가 양호하고 개인장신구 등을 소지하지 않으며, 청결한 위생복장을 착용하고 작업하고 있는가?',
      '위생설비(손세척기 등) 중 이상이 있으며, 종사자는 위생처리를 하고 입실하는가?',
    ]},
    { category: '방충방서', items: [
      '작업장은 밀폐가 잘 이루어지고 있으며, 방충시설(방충망·파손 등)에 이상이 없는가?',
    ]},
    { category: '설비', items: [
      '파손되거나 고장 난 제조설비가 있는가?',
    ]},
  ],
  DAILY_D: [
    { category: '공정관리', items: [
      '청결구역작업과 일반구역작업이 분리되어 있으며 오염되지 않도록 관리되고 있는가?',
      '소독·세정·공정이 적절히 관리되고 있는가?',
      '완제품의 포장상태가 양호한가?',
    ]},
    { category: '모니터링', items: [
      '모니터링장비(온도계 등)는 사용 전·후 세척·소독을 실시하고 있는가?',
    ]},
  ],
  DAILY_A: [
    { category: '정리정돈', items: [
      '작업장 주변의 폐기물은 잘 정리되어 보관되고, 주기적으로 반출되고 있는가?',
    ]},
    { category: '청소소독', items: [
      '작업장 바닥, 배수로, 위생시설, 제조설비의 청소·소독 상태는 양호한가?',
    ]},
    { category: '점검', items: [
      '중요관리점(CCP) 점검표를 작성하고, 한계기준 이탈 시 적절히 개선조치 하였는가?',
    ]},
  ],
  RECEIVE: [
    { category: '원부자재검수', items: [
      '원부재료 입고 시 시험성적서를 수령하거나, 육안검사를 실시하고 있는가?',
      '원부재료 입고 시 교차오염이 되지 않도록 올바르게 보관하는가?',
    ]},
    { category: '방충방서', items: [
      '해충요인 포획장치(날파리, 바퀴벌레 등)에 포획된 개체수는?',
    ]},
    { category: '냉장창고', items: [
      '냉장창고 내부 청소 상태는 양호한가?',
    ]},
  ],
  WEEKLY: [
    { category: '청소소독', items: [
      '작업장 벽, 배관(제품과 직접 닿지 않는 부분)에 대한 청소·소독 상태는 양호한가?',
      '위생복 세탁은 실시하였는가?',
    ]},
  ],
  MONTHLY: [
    { category: '청소교육', items: [
      '작업장 전체 청소 상태는 양호한가?',
    ]},
    { category: '교육', items: [
      '종사자 위생교육을 실시하였는가?',
    ]},
  ],
  YEARLY: [
    { category: '검증', items: [
      '중요관리공정(CCP) 점검표를 작성하였는가?',
    ]},
    { category: '검사', items: [
      '완제품에 대한 검사를 실시하였는가?',
      '금속검출기에 대한 정기점검을 실시하였는가?',
    ]},
  ],
}

function buildItems(period: Period): CheckItem[] {
  const groups = CHECKLIST[period]
  const items: CheckItem[] = []
  groups.forEach(g => g.items.forEach(t => items.push({ category: g.category, text: t, result: 'OK', action: '' })))
  return items
}

export default function HygieneCheckForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialPeriod = (searchParams.get('period') as Period) || 'DAILY_B'
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<CheckItem[]>(buildItems(initialPeriod))
  const [submitting, setSubmitting] = useState(false)
  const [existingData, setExistingData] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setItems(buildItems(period))
    checkExisting()
  }, [period, checkDate])

  async function checkExisting() {
    const { data } = await supabase.from('hygiene_checks')
      .select('check_id').eq('check_date', checkDate).eq('check_period', period).limit(1)
    setExistingData(!!(data && data.length > 0))
  }

  function toggleResult(idx: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const next: Result = item.result === 'OK' ? 'FAIL' : item.result === 'FAIL' ? 'NA' : 'OK'
      return { ...item, result: next, action: next === 'OK' ? '' : item.action }
    }))
  }

  function setAction(idx: number, action: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, action } : item))
  }

  const handleSubmit = async () => {
    const failWithoutAction = items.find(i => i.result === 'FAIL' && !i.action.trim())
    if (failWithoutAction) return toast.error('부적합 항목에 개선조치를 입력해주세요.')
    setSubmitting(true)
    try {
      if (existingData) {
        await supabase.from('hygiene_checks').delete().eq('check_date', checkDate).eq('check_period', period)
      }
      const rows = items.map(item => ({
        inspector_id: user!.user_id, check_date: checkDate, check_period: period,
        category: item.category, item_text: item.text, result: item.result,
        corrective_action: item.result === 'FAIL' ? item.action : null,
      }))
      const { error } = await supabase.from('hygiene_checks').insert(rows)
      if (error) throw error
      toast.success(`${PERIODS.find(p => p.key === period)?.label} 점검 저장 완료`)
      checkExisting()
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const okCount = items.filter(i => i.result === 'OK').length
  const failCount = items.filter(i => i.result === 'FAIL').length

  // 카테고리별 그룹핑
  const categories: { name: string; items: { idx: number; item: CheckItem }[] }[] = []
  items.forEach((item, idx) => {
    const last = categories[categories.length - 1]
    if (last && last.name === item.category) { last.items.push({ idx, item }) }
    else { categories.push({ name: item.category, items: [{ idx, item }] }) }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">일일위생점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-base font-semibold" />
          <span className="text-sm text-gray-500">{user?.name}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer
                ${period === p.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {existingData && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-sm font-semibold">
            이 날짜에 이미 저장된 기록이 있습니다. 저장 시 덮어쓰기됩니다.
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-bold text-sm">양호 {okCount}</span>
          <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold text-sm">불량 {failCount}</span>
        </div>

        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat.name} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-800">{cat.name}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {cat.items.map(({ idx, item }) => (
                  <div key={idx} className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
                      </div>
                      <button onClick={() => toggleResult(idx)}
                        className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all cursor-pointer
                          ${item.result === 'OK' ? 'bg-green-500 text-white' : item.result === 'FAIL' ? 'bg-red-500 text-white' : 'bg-gray-300 text-white'}`}>
                        {item.result === 'OK' ? '✓' : item.result === 'FAIL' ? '✗' : '-'}
                      </button>
                    </div>
                    {item.result === 'FAIL' && (
                      <input type="text" value={item.action} onChange={e => setAction(idx, e.target.value)}
                        placeholder="개선조치 내용 입력"
                        className="mt-3 w-full p-3 border-2 border-red-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className={`w-full py-5 text-xl font-bold text-white rounded-2xl mt-6 transition-all active:scale-[0.98]
            ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
          {submitting ? '저장중...' : existingData ? '덮어쓰기 저장' : '저장'}
        </button>
      </div>
    </div>
  )
}
