import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

const WAREHOUSES = ['원재료냉장창고', '완제품냉장창고']
const CHECKLIST = [
  { category: '원재료냉장창고', items: ['품목, 품명, 규격별 정리정돈이 되어 있는가?','선입선출은 관리되고 있으며 장기보관으로 인한 부적합품은 없는가?','부적합품은 별도 구분되어 있으며 식별표시는 규정대로 표기되어 있는가?','적재물이 넘어져 파손의 위험은 없는가?','적재물이 바닥, 벽과는 충분한 거리로 이격 관리되어 있는가?','항상 청결하게 유지되는가?'] },
  { category: '완제품냉장창고', items: ['품목, 품명, 규격별 정리정돈이 되어 있는가?','선입선출은 관리되고 있으며 장기보관으로 인한 부적합품은 없는가?','부적합품은 별도 구분되어 있으며 식별표시는 규정대로 표기되어 있는가?','적재물이 넘어져 파손의 위험은 없는가?','적재물이 바닥, 벽과는 충분한 거리로 이격 관리되어 있는가?','항상 청결하게 유지되는가?'] },
]

export default function WarehouseCheckForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [temps, setTemps] = useState<Record<string, string>>(Object.fromEntries(WAREHOUSES.map(w => [w, ''])))
  const [standards, setStandards] = useState<Record<string, { min: number; max: number }>>({})
  const [checkItems, setCheckItems] = useState(CHECKLIST.flatMap(g => g.items.map(t => ({ category: g.category, text: t, ok: true }))))
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))
  const [isMinus, setIsMinus] = useState<Record<string, boolean>>(Object.fromEntries(WAREHOUSES.map(w => [w, false])))
  const [activeWh, setActiveWh] = useState(WAREHOUSES[0])

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    WAREHOUSES.forEach(async (wh) => {
      const { data } = await supabase.from('ccp_master').select('min_limit, max_limit').eq('process_type', 'TEMPERATURE').ilike('parameter_name', `%${wh}%`).limit(1).maybeSingle()
      if (data) setStandards(prev => ({ ...prev, [wh]: { min: parseFloat(data.min_limit), max: parseFloat(data.max_limit) } }))
    })
  }, [])

  const handleNumPad = useCallback((key: string) => {
    if (key === 'C') { setTemps(p => ({ ...p, [activeWh]: '' })); setIsMinus(p => ({ ...p, [activeWh]: false })) }
    else if (key === '←') setTemps(p => ({ ...p, [activeWh]: p[activeWh].slice(0, -1) }))
    else if (key === '-') setIsMinus(p => ({ ...p, [activeWh]: !p[activeWh] }))
    else if (key === '.') { if (!temps[activeWh].includes('.')) setTemps(p => ({ ...p, [activeWh]: p[activeWh] + '.' })) }
    else setTemps(p => ({ ...p, [activeWh]: p[activeWh].length >= 5 ? p[activeWh] : p[activeWh] + key }))
  }, [activeWh, temps])

  const toggleCheck = (idx: number) => setCheckItems(p => p.map((item, i) => i === idx ? { ...item, ok: !item.ok } : item))

  const handleSubmit = async () => {
    const emptyTemp = WAREHOUSES.find(w => !temps[w])
    if (step === 1 && emptyTemp) return toast.error(emptyTemp + ' 온도를 입력해주세요.')
    if (step === 1) { setStep(2); return }
    setSubmitting(true)
    try {
      const now = new Date()
      for (const wh of WAREHOUSES) {
        const tv = parseFloat((isMinus[wh] ? '-' : '') + temps[wh])
        const std = standards[wh]
        const passed = std ? tv >= std.min && tv <= std.max : true
        const { error } = await supabase.from('temperature_logs').insert({ inspector_id: user!.user_id, inspection_date: now.toISOString().split('T')[0], inspection_time: now.toTimeString().slice(0, 8), location: wh, temperature: tv, standard_min: std?.min ?? null, standard_max: std?.max ?? null, is_passed: passed, corrective_action: !passed ? '기준 이탈' : null })
        if (error) throw error
      }
      toast.success('창고관리점검 저장 완료')
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const NK = [['1','2','3'],['4','5','6'],['7','8','9'],['.','0','←'],['-','C','']]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(1) : navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">창고관리점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>
      <div className="p-4">
        {step === 1 && (<div className="space-y-4">
          <p className="text-sm font-semibold text-gray-500">1단계: 냉장창고 온도 기록</p>
          <div className="flex gap-2 mb-2">{WAREHOUSES.map(wh => (<button key={wh} onClick={() => setActiveWh(wh)} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm cursor-pointer ${activeWh === wh ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'}`}>{wh}</button>))}</div>
          {WAREHOUSES.map(wh => (<div key={wh} className={`bg-white rounded-2xl border border-gray-200 p-5 ${activeWh !== wh ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-base font-bold">{wh}</h3>{standards[wh] && <span className="text-sm text-gray-400">기준: {standards[wh].min}~{standards[wh].max}°C</span>}</div>
            <div className="flex items-center gap-2 mb-4"><span className="text-sm text-gray-500">{isMinus[wh] ? '-' : ''}</span><input type="text" value={temps[wh]} readOnly placeholder="0" className="w-32 py-3 px-4 text-4xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" /><span className="text-xl font-bold text-gray-500">°C</span></div>
            <div className="grid grid-cols-3 gap-2">{NK.map((row, ri) => row.map((key, ci) => key ? (<button key={ri+'-'+ci} onClick={() => handleNumPad(key)} className="py-4 rounded-xl border border-gray-200 text-xl font-bold bg-white cursor-pointer active:bg-gray-100">{key}</button>) : <div key={ri+'-'+ci} />))}</div>
          </div>))}
          <div className="flex gap-3">{WAREHOUSES.map(wh => { const v=temps[wh]; const std=standards[wh]; const tv=v?parseFloat((isMinus[wh]?'-':'')+v):null; const ok=tv!==null&&std?tv>=std.min&&tv<=std.max:null; return (<div key={wh} className={`flex-1 p-3 rounded-xl text-center text-sm font-bold ${!v?'bg-gray-100 text-gray-400':ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{wh}: {v?(isMinus[wh]?'-':'')+v+'°C':'미입력'}{ok!==null&&(ok?' (적합)':' (이탈)')}</div>) })}</div>
          <button onClick={handleSubmit} className="w-full py-5 text-xl font-bold text-white rounded-2xl bg-blue-600 cursor-pointer active:scale-[0.98]">다음 (점검표)</button>
        </div>)}
        {step === 2 && (<div className="space-y-4">
          <p className="text-sm font-semibold text-gray-500">2단계: 창고관리 점검표</p>
          {CHECKLIST.map(cat => (<div key={cat.category} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200"><h3 className="text-base font-bold text-gray-800">{cat.category}</h3></div>
            <div className="divide-y divide-gray-100">{cat.items.map((text, ci) => { const gi=checkItems.findIndex(item=>item.category===cat.category&&item.text===text); const item=checkItems[gi]; return (<div key={ci} className="px-5 py-4 flex items-start gap-4"><p className="flex-1 text-sm text-gray-700 leading-relaxed">{text}</p><button onClick={()=>toggleCheck(gi)} className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold cursor-pointer ${item.ok?'bg-green-500 text-white':'bg-red-500 text-white'}`}>{item.ok?'✓':'✗'}</button></div>) })}</div>
          </div>))}
          <button onClick={handleSubmit} disabled={submitting} className={`w-full py-5 text-xl font-bold text-white rounded-2xl active:scale-[0.98] ${submitting?'bg-gray-400 cursor-not-allowed':'bg-blue-600 cursor-pointer'}`}>{submitting?'저장중...':'저장'}</button>
        </div>)}
      </div>
    </div>
  )
}