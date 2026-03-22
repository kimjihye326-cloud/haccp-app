import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth-store'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const { loginWithPin, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleNum = useCallback(async (num: string) => {
    if (isLoading) return

    if (num === 'clear') {
      setPin('')
      setError('')
      return
    }
    if (num === 'back') {
      setPin(p => p.slice(0, -1))
      setError('')
      return
    }

    const newPin = pin + num
    if (newPin.length > 4) return
    setPin(newPin)

    if (newPin.length === 4) {
      setError('')
      const success = await loginWithPin(newPin)
      if (success) {
        navigate('/', { replace: true })
      } else {
        setError('등록되지 않은 PIN입니다.')
        setTimeout(() => setPin(''), 500)
      }
    }
  }, [pin, loginWithPin, navigate, isLoading])

  const numButtons = ['1','2','3','4','5','6','7','8','9','clear','0','back']

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex items-center gap-1 mb-4">
          <img src="/logo.png" alt="회사 로고" className="h-28 object-contain mix-blend-multiply -mr-6" />
          <h1 className="text-xl font-semibold leading-relaxed text-gray-900 text-left">
            농산물 전처리 작업장<br/>HACCP 점검 시스템
          </h1>
        </div>

        {/* PIN 표시 */}
        <p className="text-center text-sm text-gray-500 mb-3">PIN 번호 입력</p>
        <div className="flex justify-center gap-4 mb-6">
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all duration-200
                ${i < pin.length
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-gray-300'
                }`}
            />
          ))}
        </div>

        {/* 에러 */}
        {error && <p className="text-center text-red-600 text-sm mb-4">{error}</p>}

        {/* 키패드 */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {numButtons.map(num => (
            <button
              key={num}
              onClick={() => handleNum(num)}
              disabled={isLoading}
              className={`py-5 text-xl font-semibold rounded-xl border transition-all
                active:scale-95 active:bg-blue-600 active:text-white
                ${num === 'clear'
                  ? 'bg-gray-100 text-red-500 text-base border-gray-200'
                  : num === 'back'
                  ? 'bg-gray-100 text-gray-600 text-base border-gray-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {num === 'clear' ? '지움' : num === 'back' ? '←' : num}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center mt-6">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}


