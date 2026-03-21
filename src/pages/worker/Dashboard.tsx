import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'
import { supabase } from '../../lib/supabase'

interface Counts { cleaning: number; metal: number; temperature: number; inventory: number }

export default function WorkerDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Counts>({ cleaning: 0, metal: 0, temperature: 0, inventory: 0 })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (user) loadCounts() }, [user])

  async function loadCounts() {
    const [c, m, t, inv] = await Promise.all([
      supabase.from('cleaning_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('metal_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('temperature_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('inventory_logs').select('log_id', { count: 'exact', head: true }).eq('recorded_by', user!.user_id).eq('log_date', today),
    ])
    setCounts({ cleaning: c.count || 0, metal: m.count || 0, temperature: t.count || 0, inventory: inv.count || 0 })
  }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  const cards = [
    { key: 'cleaning' as const, icon: '🧴', bg: 'bg-blue-50', title: '세척/소독 점검', desc: '소독액 농도 측정 및 기록', path: '/inspect/cleaning' },
    { key: 'metal' as const, icon: '🔍', bg: 'bg-pink-50', title: '금속검출기 점검', desc: 'Fe/Sus 시편 감지 테스트', path: '/inspect/metal' },
    { key: 'temperature' as const, icon: '🌡️', bg: 'bg-green-50', title: '온도 점검', desc: '작업장/창고 온도 측정', path: '/inspect/temperature' },
    { key: 'inventory' as const, icon: '📦', bg: 'bg-amber-50', title: '수불부', desc: '양파·감자·생강 입출고 기록', path: '/inventory' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{user?.name}님, 오늘의 점검</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{today}</span>
          <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg cursor-pointer active:bg-gray-200">⏻</button>
        </div>
      </header>
      <div className="p-5 grid grid-cols-2 gap-4">
        {cards.map(card => (
          <button key={card.key} onClick={() => navigate(card.path)}
            className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl shadow-sm cursor-pointer transition-all active:scale-[0.97] active:shadow-md text-center min-h-[180px]">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${card.bg}`}>{card.icon}</div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{card.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </div>
            <span className="bg-blue-50 text-blue-600 font-bold text-sm px-3.5 py-1.5 rounded-full">{counts[card.key]}건</span>
          </button>
        ))}
      </div>
    </div>
  )
}
