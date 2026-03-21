interface NumPadProps {
  onInput: (key: string) => void
  keys?: string[]
  compact?: boolean
}

export default function NumPad({
  onInput,
  keys = ['1','2','3','4','5','6','7','8','9','C','0','←'],
  compact = false,
}: NumPadProps) {
  return (
    <div className={`grid grid-cols-3 gap-2 ${compact ? 'max-w-[260px]' : 'max-w-[320px]'}`}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onInput(key)}
          className={`
            ${compact ? 'py-3 text-lg' : 'py-4 text-xl'}
            font-semibold rounded-xl border transition-all
            active:scale-95 active:bg-blue-600 active:text-white cursor-pointer select-none
            ${key === 'C' || key === '←'
              ? 'bg-gray-100 text-red-500 text-base border-gray-200'
              : key === '−'
              ? 'bg-gray-100 text-gray-700 border-gray-200'
              : 'bg-white border-gray-200 hover:bg-gray-50'
            }
          `}
        >
          {key}
        </button>
      ))}
    </div>
  )
}
