import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { uploadInspectionPhoto } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'

export default function MetalForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [fe, setFe] = useState<boolean | null>(null)
  const [sus, setSus] = useState<boolean | null>(null)
  const [productOnly, setProductOnly] = useState<boolean | null>(null)
  const [productFe, setProductFe] = useState<boolean | null>(null)
  const [productSus, setProductSus] = useState<boolean | null>(null)
  const [passQty, setPassQty] = useState('')
  const [detectQty, setDetectQty] = useState('')
  const [firstPassTime, setFirstPassTime] = useState('')
  const [lastPassTime, setLastPassTime] = useState('')
  const [deviationLocation, setDeviationLocation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [action, setAction] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))
  const [showFailModal, setShowFailModal] = useState(false)

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000); return () => clearInterval(t) }, [])

  const step1AllSelected = fe !== null && sus !== null && productOnly !== null && productFe !== null && productSus !== null
  const step1Fail = step1AllSelected && (!fe || !sus || !productOnly || !productFe || !productSus)
  const step1Pass = step1AllSelected && fe && sus && productOnly && productFe && productSus

  useEffect(() => { if (step1Fail) setShowFailModal(true) }, [fe, sus, productOnly, productFe, productSus])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setPhoto(file)
    const reader = new FileReader(); reader.onload = (ev) => setPhotoPreview(ev.target?.result as string); reader.readAsDataURL(file)
  }

  const goStep2 = () => {
    if (!step1AllSelected) return toast.error('모든 항목을 선택해주세요.')
    if (step1Fail && !action.trim()) { setShowFailModal(true); return }
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!passQty) return toast.error('통과량을 입력해주세요.')
    if (!firstPassTime) return toast.error('최초통과시간을 기록해주세요.')
    if (!lastPassTime) return toast.error('통과종료시간을 기록해주세요.')
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photo && user) photoUrl = await uploadInspectionPhoto(user.user_id, 'metal', photo)
      const { error } = await supabase.from('metal_logs').insert({
        inspector_id: user!.user_id, detector_name: '금속검출기',
        fe_detected: fe, sus_detected: sus, is_passed: step1Pass,
        product_only_pass: productOnly, product_fe_pass: productFe, product_sus_pass: productSus,
        pass_quantity: parseFloat(passQty) || 0, detect_quantity: parseFloat(detectQty) || 0,
        first_pass_time: firstPassTime, last_pass_time: lastPassTime,
        deviation_location: deviationLocation || null, remarks: remarks || null,
        corrective_action: step1Fail ? action : null, photo_url: photoUrl,
      })
      if (error) throw error
      toast.success('CCP-2P 점검 저장 완료')
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const TestBtn = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) => (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-bold text-gray-700 mb-3">{label}</p>
      <div className="flex gap-3">
        <button onClick={() => onChange(true)} className={`flex-1 py-4 rounded-xl border-2 text-center cursor-pointer transition-all ${value === true ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}>
          <span className={`block text-3xl font-extrabold ${value === true ? 'text-green-600' : 'text-gray-400'}`}>O</span>
          <span className="block text-xs text-gray-500 mt-1">{label.includes('시편') ? '감지' : '통과'}</span>
        </button>
        <button onClick={() => onChange(false)} className={`flex-1 py-4 rounded-xl border-2 text-center cursor-pointer transition-all ${value === false ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <span className={`block text-3xl font-extrabold ${value === false ? 'text-red-600' : 'text-gray-400'}`}>X</span>
          <span className="block text-xs text-gray-500 mt-1">{label.includes('시편') ? '미감지' : '미통과'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(1) : navigate('/')} className="text-2xl cursor-pointer">←</button>
        <h2 className="flex-1 text-xl font-bold">CCP-2P 금속검출기 점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">{currentTime}</span>
      </header>
      <div className="p-4">
        {step === 1 && (<div className="space-y-3">
          <p className="text-sm font-semibold text-gray-500">1단계: 감지 테스트</p>
          <TestBtn label="Fe 시편 감지 (3.0mm)" value={fe} onChange={setFe} />
          <TestBtn label="Sus 시편 감지 (4.0mm)" value={sus} onChange={setSus} />
          <TestBtn label="제품만 통과" value={productOnly} onChange={setProductOnly} />
          <TestBtn label="제품 + Fe 시편(중간,하단) 통과" value={productFe} onChange={setProductFe} />
          <TestBtn label="제품 + Sus 시편(중간,하단) 통과" value={productSus} onChange={setProductSus} />
          {step1AllSelected && (<div className={`py-3 rounded-xl text-center text-lg font-bold ${step1Pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{step1Pass ? '적합' : '부적합'}</div>)}
          <button onClick={goStep2} className="w-full py-5 text-xl font-bold text-white rounded-2xl bg-blue-600 cursor-pointer active:scale-[0.98]">다음 (생산기록)</button>
        </div>)}
        {step === 2 && (<div className="space-y-4">
          <p className="text-sm font-semibold text-gray-500">2단계: 생산 기록</p>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">통과량 (kg)</label><input type="number" value={passQty} onChange={e => setPassQty(e.target.value)} placeholder="0" className="w-full p-3 border-2 border-gray-200 rounded-xl text-lg font-bold outline-none" /></div>
            <div className="flex gap-3">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">최초통과시간</label><button onClick={() => setFirstPassTime(new Date().toLocaleTimeString('ko-KR'))} className={`w-full p-3 rounded-xl border-2 text-lg font-bold cursor-pointer ${firstPassTime ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-400'}`}>{firstPassTime || '클릭하여 기록'}</button></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">통과종료시간</label><button onClick={() => setLastPassTime(new Date().toLocaleTimeString('ko-KR'))} className={`w-full p-3 rounded-xl border-2 text-lg font-bold cursor-pointer ${lastPassTime ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-400'}`}>{lastPassTime || '클릭하여 기록'}</button></div>
            </div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">검출량 (이탈제품)</label><input type="number" value={detectQty} onChange={e => setDetectQty(e.target.value)} placeholder="0 (없으면 비워두세요)" className="w-full p-3 border-2 border-gray-200 rounded-xl text-lg font-bold outline-none" /></div>
            {(detectQty && parseFloat(detectQty) > 0) && (<>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">이탈위치</label><input type="text" value={deviationLocation} onChange={e => setDeviationLocation(e.target.value)} placeholder="이탈 위치 입력" className="w-full p-3 border-2 border-red-300 rounded-xl text-base outline-none" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">특이사항</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="특이사항 입력" className="w-full p-3 border-2 border-red-300 rounded-xl text-base outline-none resize-y" /></div>
            </>)}
          </div>
          <button onClick={handleSubmit} disabled={submitting} className={`w-full py-5 text-xl font-bold text-white rounded-2xl active:scale-[0.98] ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>{submitting ? '저장중...' : '저장'}</button>
        </div>)}
      </div>
      {showFailModal && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-4 text-center">
              <h3 className="text-lg font-bold text-white">시편 미감지 — 즉시 조치 필요</h3>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">조치사항 *</label><textarea value={action} onChange={e => setAction(e.target.value)} rows={3} placeholder="조치 내용을 입력하세요" className="w-full p-3 border border-gray-300 rounded-xl text-sm resize-y outline-none focus:border-red-400" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">사진 첨부</label><label className="inline-flex items-center gap-2 py-2 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm cursor-pointer">촬영/선택<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" /></label>{photoPreview && <img src={photoPreview} alt="" className="mt-2 max-h-32 rounded-lg object-cover" />}</div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowFailModal(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-300 font-semibold text-gray-600 cursor-pointer">닫기</button>
                <button onClick={() => { if (!action.trim()) { toast.error('조치사항을 입력해주세요.'); return } setShowFailModal(false); toast.success('조치 입력 완료') }} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold cursor-pointer">확인</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}