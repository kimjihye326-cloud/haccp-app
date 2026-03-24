import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { uploadInspectionPhoto } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

export default function MetalForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [fe, setFe] = useState<boolean | null>(null)
  const [sus, setSus] = useState<boolean | null>(null)
  const [action, setAction] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))
  const [showFailModal, setShowFailModal] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(t)
  }, [])

  const isFail = fe !== null && sus !== null && (!fe || !sus)
  const isPass = fe === true && sus === true
  const bothSelected = fe !== null && sus !== null

  useEffect(() => { if (isFail) setShowFailModal(true) }, [fe, sus])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (fe === null || sus === null) return toast.error('Fe/Sus 감지 여부를 모두 선택해주세요.')
    if (isFail && !action.trim()) { setShowFailModal(true); return toast.error('조치사항을 입력해주세요.') }
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photo && user) photoUrl = await uploadInspectionPhoto(user.user_id, 'metal', photo)
      const { error } = await supabase.from('metal_logs').insert({
        inspector_id: user!.user_id, detector_name: '금속검출기',
        fe_detected: fe, sus_detected: sus, is_passed: isPass,
        corrective_action: isFail ? action : null, photo_url: photoUrl,
      })
      if (error) throw error
      toast.success('금속검출기 점검 저장 완료')
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-lg font-bold">금속검출기 점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>
      <div className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <section className="bg-white rounded-xl shadow-sm p-4 flex-1">
            <label className="block text-xs font-semibold mb-2 text-gray-700">Fe 시편 (2.0mm)</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setFe(true)}
                className={`flex-1 py-5 rounded-xl border-2 text-center transition-all cursor-pointer ${fe === true ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <span className={`block text-4xl font-extrabold ${fe === true ? 'text-green-600' : 'text-gray-400'}`}>O</span>
                <span className="block text-xs text-gray-500 mt-1">감지</span>
              </button>
              <button type="button" onClick={() => setFe(false)}
                className={`flex-1 py-5 rounded-xl border-2 text-center transition-all cursor-pointer ${fe === false ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <span className={`block text-4xl font-extrabold ${fe === false ? 'text-red-600' : 'text-gray-400'}`}>X</span>
                <span className="block text-xs text-gray-500 mt-1">미감지</span>
              </button>
            </div>
          </section>
          <section className="bg-white rounded-xl shadow-sm p-4 flex-1">
            <label className="block text-xs font-semibold mb-2 text-gray-700">Sus 시편 (2.5mm)</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSus(true)}
                className={`flex-1 py-5 rounded-xl border-2 text-center transition-all cursor-pointer ${sus === true ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <span className={`block text-4xl font-extrabold ${sus === true ? 'text-green-600' : 'text-gray-400'}`}>O</span>
                <span className="block text-xs text-gray-500 mt-1">감지</span>
              </button>
              <button type="button" onClick={() => setSus(false)}
                className={`flex-1 py-5 rounded-xl border-2 text-center transition-all cursor-pointer ${sus === false ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <span className={`block text-4xl font-extrabold ${sus === false ? 'text-red-600' : 'text-gray-400'}`}>X</span>
                <span className="block text-xs text-gray-500 mt-1">미감지</span>
              </button>
            </div>
          </section>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 py-2 px-4 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500">기록:</span>
            <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
          </div>
          {bothSelected && (
            <div className={`py-2 px-6 rounded-lg text-sm font-bold ${isPass ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {isPass ? '✓ 적합' : '✗ 부적합'}
            </div>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className={`py-3 px-8 text-base font-bold text-white rounded-xl transition-all active:scale-[0.98] ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
            {submitting ? '저장중' : '저장'}
          </button>
        </div>
      </div>
      {showFailModal && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-4 text-center">
              <div className="text-4xl mb-1">🚨</div>
              <h3 className="text-lg font-bold text-white">시편 미감지 — 즉시 조치 필요</h3>
              <p className="text-red-100 text-sm mt-1">{fe === false && sus === false ? 'Fe·Sus 모두 미감지' : fe === false ? 'Fe 미감지' : 'Sus 미감지'}</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">조치사항 *</label>
                <textarea value={action} onChange={e => setAction(e.target.value)} rows={3} placeholder="조치 내용을 입력하세요" className="w-full p-3 border border-gray-300 rounded-xl text-sm resize-y outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">사진 첨부</label>
                <label className="inline-flex items-center gap-2 py-2 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm cursor-pointer">
                  📷 촬영/선택<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </label>
                {photoPreview && <img src={photoPreview} alt="" className="mt-2 max-h-32 rounded-lg object-cover" />}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowFailModal(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-300 font-semibold text-gray-600 cursor-pointer">닫기</button>
                <button onClick={() => { if (!action.trim()) { toast.error('조치사항을 입력해주세요.'); return } setShowFailModal(false); toast.success('조치 입력 완료') }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold cursor-pointer">확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

