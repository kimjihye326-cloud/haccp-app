import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { uploadInspectionPhoto } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'
import NumPad from '../../components/common/NumPad'
import type { CcpMaster } from '../../types/database'

export default function CleaningForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [ppmStr, setPpmStr] = useState('')
  const [result, setResult] = useState<'pass' | 'fail' | ''>('')
  const [action, setAction] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [standard, setStandard] = useState<CcpMaster | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.from('ccp_master').select('*').eq('process_type', 'CLEANING')
      .ilike('parameter_name', '%농도%').limit(1).single()
      .then(({ data }) => { if (data) setStandard(data as CcpMaster) })
  }, [])

  useEffect(() => {
    if (!ppmStr || !standard) { setResult(''); return }
    const ppm = parseFloat(ppmStr)
    if (isNaN(ppm)) { setResult(''); return }
    setResult(ppm >= parseFloat(String(standard.min_limit)) && ppm <= parseFloat(String(standard.max_limit)) ? 'pass' : 'fail')
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
    if (!result) return toast.error('농도를 입력해주세요.')
    if (result === 'fail' && !action.trim()) return toast.error('부적합 시 조치사항을 입력해주세요.')
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photo && user) photoUrl = await uploadInspectionPhoto(user.user_id, 'cleaning', photo)
      const { error } = await supabase.from('cleaning_logs').insert({
        inspector_id: user!.user_id, area: '손깐생강', sanitizer_type: '차아염소산나트륨',
        concentration_ppm: parseFloat(ppmStr) || 0,
        standard_min_ppm: standard?.min_limit || 100, standard_max_ppm: standard?.max_limit || 200,
        is_passed: result === 'pass',
        corrective_action: result === 'fail' ? action : null, photo_url: photoUrl,
      })
      if (error) throw error
      toast.success('CCP-1B 점검 저장 완료')
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const minPpm = standard?.min_limit ?? 100
  const maxPpm = standard?.max_limit ?? 200

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">CCP-1B 세척/소독 점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>

      <div className="p-4">
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-base font-bold text-blue-800">품목: 손깐생강</p>
          <p className="text-sm text-blue-700 mt-1">소독제: 차아염소산나트륨 | 기준: {minPpm}~{maxPpm}ppm</p>
          <p className="text-sm text-blue-700">원료량: 20kg이하 | 소독수량: 40L | 소독액양: 180ml</p>
          <p className="text-sm text-blue-700">소독시간: 5분 | 교체주기: 5회(100kg)</p>
        </div>

        <section className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <label className="block text-base font-bold mb-3 text-gray-700">소독액 농도 측정</label>
          <div className="flex items-center gap-3 mb-3">
            <input type="text" value={ppmStr} readOnly placeholder="0"
              className="w-40 py-3 px-4 text-4xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" />
            <span className="text-xl font-bold text-gray-500">ppm</span>
            <span className="text-base text-gray-400">({minPpm}~{maxPpm})</span>
          </div>
          <NumPad onInput={handleNumPad} compact />
        </section>

        {result && (
          <div className={`mb-4 py-4 rounded-xl border-2 text-center text-xl font-bold
            ${result === 'pass' ? 'border-green-600 bg-green-50 text-green-700' : 'border-red-600 bg-red-50 text-red-700'}`}>
            {result === 'pass' ? '적합' : '부적합'}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting}
          className={`w-full py-5 text-xl font-bold text-white rounded-2xl transition-all active:scale-[0.98]
            ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
          {submitting ? '저장중...' : '저장'}
        </button>
      </div>

      {result === 'fail' && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-4 text-center">
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
                  촬영/선택<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </label>
                {photoPreview && <img src={photoPreview} alt="" className="mt-2 max-h-32 rounded-lg object-cover" />}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setResult(''); setPpmStr('') }} className="flex-1 py-3 rounded-xl border-2 border-gray-300 font-semibold text-gray-600 cursor-pointer">재측정</button>
                <button onClick={() => { if (!action.trim()) { toast.error('조치사항을 입력해주세요.'); return } }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold cursor-pointer">조치 확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

