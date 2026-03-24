import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { uploadInspectionPhoto } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'
import NumPad from '../../components/common/NumPad'
import type { CcpMaster } from '../../types/database'

const AREAS = ['전처리실', '세척실', '포장실', '기타']
const SANITIZERS = ['차아염소산나트륨', '이산화염소', '과산화수소']

export default function CleaningForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [area, setArea] = useState('')
  const [sanitizer, setSanitizer] = useState('')
  const [ppmStr, setPpmStr] = useState('')
  const [result, setResult] = useState<'pass' | 'fail' | ''>('')
  const [action, setAction] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])
  const [photoPreview, setPhotoPreview] = useState('')
  const [standard, setStandard] = useState<CcpMaster | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.from('ccp_master').select('*').eq('process_type', 'CLEANING')
      .ilike('parameter_name', '%농도%').limit(1).single()
      .then(({ data }) => { if (data) setStandard(data as CcpMaster) })
  }, [])

  // 자동 판정
  useEffect(() => {
    if (!ppmStr || !standard) { setResult(''); return }
    const ppm = parseFloat(ppmStr)
    if (isNaN(ppm)) { setResult(''); return }
    setResult(ppm >= standard.min_limit && ppm <= standard.max_limit ? 'pass' : 'fail')
  }, [ppmStr, standard])

  const handleNumPad = useCallback((key: string) => {
    if (key === 'C') { setPpmStr(''); setResult('') }
    else if (key === '←') setPpmStr(p => p.slice(0, -1))
    else setPpmStr(p => p.length >= 5 ? p : p + key)
  }, [])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!area) return toast.error('점검 구역을 선택해주세요.')
    if (!sanitizer) return toast.error('소독제를 선택해주세요.')
    if (!result) return toast.error('농도를 입력해주세요.')
    if (result === 'fail' && !action.trim()) return toast.error('부적합 시 조치사항을 입력해주세요.')
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photo && user) photoUrl = await uploadInspectionPhoto(user.user_id, 'cleaning', photo)
      const { error } = await supabase.from('cleaning_logs').insert({
        inspector_id: user!.user_id, area, sanitizer_type: sanitizer,
        concentration_ppm: parseFloat(ppmStr) || 0,
        standard_min_ppm: standard?.min_limit || 100, standard_max_ppm: standard?.max_limit || 200,
        is_passed: result === 'pass',
        corrective_action: result === 'fail' ? action : null, photo_url: photoUrl,
      })
      if (error) throw error
      toast.success('세척/소독 점검 저장 완료')
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const minPpm = standard?.min_limit ?? 100
  const maxPpm = standard?.max_limit ?? 200

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">세척/소독 점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>
      <div className="p-4">
        {step === 1 && (
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold mb-5">점검 구역을 선택하세요</h3>
            <div className="grid grid-cols-2 gap-5">
              {AREAS.map(a => (
                <button key={a} type="button" onClick={() => { setArea(a); setStep(2) }}
                  className={"py-12 rounded-2xl border-2 text-center font-bold text-xl transition-all cursor-pointer " + (area === a ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-200 bg-white hover:bg-gray-50")}>
                  {a}
                </button>
              ))}
            </div>
          </section>
        )}
        {step === 2 && (
          <div className="animate-slideDown">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
              <span className="text-sm text-blue-700">구역: <strong>{area}</strong></span>
              <button onClick={() => setStep(1)} className="text-xs text-blue-600 underline cursor-pointer">변경</button>
            </div>
            {/* PC: 3:4.5:2.5 */}
            <div className="hidden md:flex gap-4">
              {/* 소독제 30% */}
              <section className="w-[30%] bg-white rounded-xl shadow-sm p-5 shrink-0">
                <label className="block text-sm font-bold mb-3 text-gray-700">소독제 종류</label>
                <div className="flex flex-col gap-3">
                  {SANITIZERS.map(s => (
                    <button key={s} type="button" onClick={() => { setSanitizer(s); setPpmStr(''); setResult(''); setAction(''); setPhoto(null); setPhotoPreview('') }}
                      className={"w-full py-4 px-4 rounded-xl border-2 text-left font-bold text-base transition-all cursor-pointer " + (sanitizer === s ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-200 bg-white hover:bg-gray-50")}>
                      {s}
                    </button>
                  ))}
                </div>
              </section>
              {/* 농도 입력 45% */}
              <section className="w-[45%] bg-white rounded-xl shadow-sm p-5 shrink-0">
                <label className="block text-sm font-bold mb-3 text-gray-700">소독액 농도 (ppm)</label>
                <div className="flex items-center gap-3 mb-1">
                  <input type="text" value={ppmStr} readOnly placeholder="0"
                    className="w-36 py-3 px-4 text-3xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" />
                  <span className="text-xl font-bold text-gray-500">ppm</span>
                  <span className="text-sm text-gray-400">({minPpm}~{maxPpm})</span>
                </div>
                <NumPad onInput={handleNumPad} compact />
              </section>
              {/* 판정+저장 25% */}
              <div className="w-[25%] flex flex-col gap-4">
                <section className="bg-white rounded-xl shadow-sm p-5">
                  <label className="block text-sm font-bold mb-3 text-gray-700">판정</label>
                  {result ? (
                    <div className={`py-6 rounded-xl border-2 text-center text-xl font-bold ${result === 'pass' ? 'border-green-600 bg-green-50 text-green-700' : 'border-red-600 bg-red-50 text-red-700'}`}>
                      {result === 'pass' ? '✓ 적합' : '✗ 부적합'}
                    </div>
                  ) : (
                    <div className="py-6 rounded-xl border-2 border-gray-200 text-center text-base text-gray-400">
                      농도 입력 시 자동 판정
                    </div>
                  )}
                </section>
                <button onClick={handleSubmit} disabled={submitting}
                  className={`w-full py-4 text-lg font-bold text-white rounded-xl transition-all active:scale-[0.98] mt-auto ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
                  {submitting ? '저장중' : '저장'}
                </button>
              </div>
            </div>
            {/* 모바일 */}
            <div className="md:hidden space-y-4">
              <section className="bg-white rounded-xl shadow-sm p-4">
                <label className="block text-sm font-bold mb-2 text-gray-700">소독제</label>
                <div className="flex flex-col gap-2">
                  {SANITIZERS.map(s => (
                    <button key={s} type="button" onClick={() => { setSanitizer(s); setPpmStr(''); setResult(''); setAction(''); setPhoto(null); setPhotoPreview('') }}
                      className={"w-full py-3 px-4 rounded-xl border-2 text-left font-bold text-base cursor-pointer " + (sanitizer === s ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-200 bg-white")}>
                      {s}
                    </button>
                  ))}
                </div>
              </section>
              <section className="bg-white rounded-xl shadow-sm p-4">
                <label className="block text-sm font-bold mb-2 text-gray-700">소독액 농도 (ppm)</label>
                <div className="flex items-center gap-2 mb-2">
                  <input type="text" value={ppmStr} readOnly placeholder="0" className="w-32 py-3 px-3 text-3xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" />
                  <span className="text-lg font-bold text-gray-500">ppm</span>
                  <span className="text-xs text-gray-400">({minPpm}~{maxPpm})</span>
                </div>
                <NumPad onInput={handleNumPad} compact />
              </section>
              {result && (
                <div className={`py-4 rounded-xl border-2 text-center text-xl font-bold ${result === 'pass' ? 'border-green-600 bg-green-50 text-green-700' : 'border-red-600 bg-red-50 text-red-700'}`}>
                  {result === 'pass' ? '✓ 적합' : '✗ 부적합'}
                </div>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                className={`w-full py-4 text-lg font-bold text-white rounded-xl ${submitting ? 'bg-gray-400' : 'bg-blue-600 cursor-pointer'}`}>
                {submitting ? '저장중' : '저장'}
              </button>
            </div>
            {/* 부적합 모달 */}
            {result === 'fail' && (
              <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-5">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                  <div className="bg-red-600 px-6 py-4 text-center">
                    <div className="text-4xl mb-1">⚠️</div>
                    <h3 className="text-lg font-bold text-white">부적합 — 기준 이탈</h3>
                    <p className="text-red-100 text-sm mt-1">농도 {ppmStr}ppm (기준: {minPpm}~{maxPpm}ppm)</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">조치사항 *</label>
                      <textarea value={action} onChange={e => setAction(e.target.value)} rows={3} placeholder="조치 내용을 입력하세요"
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm resize-y outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">사진 첨부</label>
                      <label className="inline-flex items-center gap-2 py-2 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm cursor-pointer">
                        📷 촬영/선택<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                      </label>
                      {photoPreview && <img src={photoPreview} alt="" className="mt-2 max-h-32 rounded-lg object-cover" />}
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => { setResult(''); setPpmStr('') }} className="flex-1 py-3 rounded-xl border-2 border-gray-300 font-semibold text-gray-600 cursor-pointer">재측정</button>
                      <button onClick={() => { if (!action.trim()) { toast.error('조치사항을 입력해주세요.'); return } setResult('fail') }}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold cursor-pointer">조치 확인</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

