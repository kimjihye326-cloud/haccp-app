import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { uploadInspectionPhoto } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth-store'
import NumPad from '../../components/common/NumPad'

const LOCATIONS = ['원재료냉장창고', '완제품냉장창고']
const LOC_ICONS: Record<string, string> = { '원재료냉장창고': '📦', '완제품냉장창고': '🧊' }

export default function TemperatureForm() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [place, setPlace] = useState('')
  const [tempStr, setTempStr] = useState('')
  const [isMinus, setIsMinus] = useState(false)
  const [standard, setStandard] = useState<{ min: number; max: number } | null>(null)
  const [action, setAction] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('ko-KR')), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (place) loadStandard(place)
  }, [place])

  async function loadStandard(loc: string) {
    const { data } = await supabase
      .from('ccp_master')
      .select('min_limit, max_limit')
      .eq('process_type', 'TEMPERATURE')
      .ilike('parameter_name', `%${loc}%`)
      .limit(1)
      .maybeSingle()
    if (data) setStandard({ min: parseFloat(data.min_limit), max: parseFloat(data.max_limit) })
    else setStandard(null)
  }

  const resetInputs = () => {
    setTempStr(''); setIsMinus(false); setAction('')
    setPhoto(null); setPhotoPreview(''); setStandard(null)
  }

  const handleNumPad = useCallback((key: string) => {
    if (key === 'C') { setTempStr(''); setIsMinus(false) }
    else if (key === '←') setTempStr(p => p.slice(0, -1))
    else if (key === '-') setIsMinus(p => !p)
    else if (key === '.') { if (!tempStr.includes('.')) setTempStr(p => p + '.') }
    else setTempStr(p => p.length >= 6 ? p : p + key)
  }, [tempStr])

  const tempValue = tempStr ? parseFloat((isMinus ? '-' : '') + tempStr) : null
  const isPassed = tempValue !== null && standard ? tempValue >= standard.min && tempValue <= standard.max : null

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)) }
  }

  const handleSubmit = async () => {
    if (!place) return toast.error('측정 장소를 선택해주세요.')
    if (tempValue === null) return toast.error('온도를 입력해주세요.')
    if (isPassed === false && !action.trim()) return toast.error('부적합 시 조치사항을 입력해주세요.')
    setSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (photo && user) photoUrl = await uploadInspectionPhoto(user.user_id, 'temperature', photo)
      const now = new Date()
      const { error } = await supabase.from('temperature_logs').insert({
        inspector_id: user!.user_id,
        location: place,
        inspection_date: now.toISOString().slice(0, 10),
        inspection_time: now.toTimeString().slice(0, 8),
        temperature: tempValue,
        standard_min: standard?.min ?? null,
        standard_max: standard?.max ?? null,
        is_passed: isPassed,
        corrective_action: isPassed === false ? action : null,
        photo_url: photoUrl,
      })
      if (error) throw error
      toast.success(`${place} ${tempValue}°C 저장 완료`)
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err: any) { toast.error('저장 실패: ' + err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-3xl cursor-pointer">←</button>
        <h2 className="flex-1 text-2xl font-bold">온도 점검</h2>
        <span className="text-base font-bold text-blue-600 tabular-nums">
          {currentTime}
        </span>
      </header>

      <div className="p-4">
        {/* PC 레이아웃 */}
        <div className="hidden md:grid md:grid-cols-10 gap-5">

          {/* 측정 장소 (3 cols) */}
          <section className="col-span-3 bg-white rounded-2xl shadow-sm p-5">
            <label className="block text-lg font-bold mb-4 text-gray-700">측정 장소</label>
            <div className="flex flex-col gap-3">
              {LOCATIONS.map(loc => (
                <button key={loc} type="button"
                  onClick={() => { setPlace(loc); resetInputs() }}
                  className={`w-full py-6 rounded-2xl border-2 text-center font-bold text-2xl transition-all cursor-pointer ${place === loc ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="text-3xl">{LOC_ICONS[loc]}</span>
                  <span className="ml-2">{loc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 측정 온도 (4 cols) */}
          <section className="col-span-4 bg-white rounded-2xl shadow-sm p-5">
            <label className="block text-lg font-bold mb-4 text-gray-700">측정 온도</label>
            <div className="flex items-center gap-3 mb-5">
              <input type="text" value={(isMinus && tempStr ? '-' : '') + tempStr} readOnly placeholder="0.0"
                className="w-40 py-3 px-4 text-5xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" />
              <span className="text-2xl font-semibold text-gray-500">°C</span>
              {standard && (
                <span className="text-lg text-gray-400 font-semibold">({standard.min}~{standard.max})</span>
              )}
            </div>
            <NumPad onInput={handleNumPad} keys={['1','2','3','4','5','6','7','8','9','.','0','←','-','C']} compact />
          </section>

          {/* 판정 + 저장 (3 cols) */}
          <div className="col-span-3 flex flex-col gap-4">
            {tempValue !== null && isPassed !== null && (
              <div className={`rounded-2xl p-6 text-center ${isPassed ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-400'}`}>
                <span className="text-5xl block mb-2">{isPassed ? '✅' : '❌'}</span>
                <span className={`text-3xl font-bold ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
                  {isPassed ? '적합' : '부적합'}
                </span>
              </div>
            )}

            {isPassed === false && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <label className="block text-base font-bold text-red-700 mb-2">조치사항 *</label>
                <textarea value={action} onChange={e => setAction(e.target.value)} rows={3}
                  placeholder="부적합 조치 내용 입력"
                  className="w-full p-3 border border-red-200 rounded-xl text-base resize-none" />
                <label className="block text-base font-bold text-red-700 mt-3 mb-2">사진 첨부</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto}
                  className="w-full text-sm" />
                {photoPreview && (
                  <img src={photoPreview} alt="preview" className="mt-2 w-full h-32 object-cover rounded-xl" />
                )}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              className={`w-full py-5 text-2xl font-bold text-white rounded-2xl transition-all active:scale-[0.98] mt-auto ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
              {submitting ? '저장중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 모바일 레이아웃 */}
        <div className="md:hidden space-y-4">
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <label className="block text-lg font-bold mb-3 text-gray-700">측정 장소</label>
            <div className="grid grid-cols-2 gap-3">
              {LOCATIONS.map(loc => (
                <button key={loc} type="button"
                  onClick={() => { setPlace(loc); resetInputs() }}
                  className={`py-5 rounded-2xl border-2 text-center font-bold text-xl transition-all cursor-pointer ${place === loc ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'}`}>
                  <span className="text-2xl block">{LOC_ICONS[loc]}</span>
                  {loc}
                </button>
              ))}
            </div>
          </section>

          {place && (
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <label className="block text-lg font-bold mb-3 text-gray-700">측정 온도</label>
              <div className="flex items-center gap-2 mb-3">
                <input type="text" value={(isMinus && tempStr ? '-' : '') + tempStr} readOnly placeholder="0.0"
                  className="w-32 py-3 px-3 text-4xl font-bold text-right border-2 border-gray-200 rounded-xl bg-white tabular-nums outline-none" />
                <span className="text-xl font-semibold text-gray-500">°C</span>
                {standard && <span className="text-base text-gray-400">({standard.min}~{standard.max})</span>}
              </div>
              <NumPad onInput={handleNumPad} keys={['1','2','3','4','5','6','7','8','9','.','0','←','-','C']} compact />

              {tempValue !== null && isPassed !== null && (
                <div className={`mt-4 rounded-2xl p-4 text-center ${isPassed ? 'bg-green-50 border border-green-400' : 'bg-red-50 border border-red-400'}`}>
                  <span className="text-4xl">{isPassed ? '✅' : '❌'}</span>
                  <span className={`text-2xl font-bold ml-2 ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
                    {isPassed ? '적합' : '부적합'}
                  </span>
                </div>
              )}

              {isPassed === false && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
                  <textarea value={action} onChange={e => setAction(e.target.value)} rows={2}
                    placeholder="부적합 조치 내용 입력"
                    className="w-full p-2 border border-red-200 rounded-xl text-base resize-none" />
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhoto}
                    className="w-full text-sm mt-2" />
                  {photoPreview && <img src={photoPreview} alt="" className="mt-2 w-full h-28 object-cover rounded-xl" />}
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                className={`w-full py-4 text-xl font-bold text-white rounded-2xl mt-4 transition-all active:scale-[0.98] ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer'}`}>
                {submitting ? '저장중...' : '저장'}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}





