import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'
import { supabase } from '../../lib/supabase'

interface Counts { health: number; hygiene: number; ccp1: number; ccp2: number; warehouse: number; sanitation: number; inventory: number }

export default function WorkerDashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Counts>({ health: 0, hygiene: 0, ccp1: 0, ccp2: 0, warehouse: 0, sanitation: 0, inventory: 0 })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (user) loadCounts() }, [user])

  async function loadCounts() {
    const [hy, c, m, t, inv] = await Promise.all([
      supabase.from('hygiene_checks').select('check_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('check_date', today),
      supabase.from('cleaning_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('metal_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('temperature_logs').select('log_id', { count: 'exact', head: true }).eq('inspector_id', user!.user_id).eq('inspection_date', today),
      supabase.from('inventory_logs').select('log_id', { count: 'exact', head: true }).eq('recorded_by', user!.user_id).eq('log_date', today),
    ])
    setCounts({ health: 0, hygiene: hy.count || 0, ccp1: c.count || 0, ccp2: m.count || 0, warehouse: t.count || 0, sanitation: 0, inventory: inv.count || 0 })
  }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  const cards: { key: keyof Counts; title: string; desc: string; path: string; color: string }[] = [
    { key: 'health', title: '종사자위생점검', desc: '건강상태 및 위생 확인', path: '/inspect/health', color: 'border-red-200 bg-red-50' },
    { key: 'hygiene', title: '일일위생점검', desc: '일반위생관리 및 공정점검', path: '/inspect/hygiene', color: 'border-purple-200 bg-purple-50' },
    { key: 'ccp1', title: 'CCP-1B', desc: '세척/소독 점검', path: '/inspect/cleaning', color: 'border-blue-200 bg-blue-50' },
    { key: 'ccp2', title: 'CCP-2P', desc: '금속검출기 점검', path: '/inspect/metal', color: 'border-pink-200 bg-pink-50' },
    { key: 'warehouse', title: '창고관리점검', desc: '냉장창고 온도 및 관리', path: '/inspect/warehouse', color: 'border-green-200 bg-green-50' },
    { key: 'sanitation', title: '조리시설기구소독관리', desc: '도마/칼/작업대/발판 소독', path: '/inspect/sanitation', color: 'border-amber-200 bg-amber-50' },
    { key: 'inventory', title: '수불부', desc: '입출고 기록', path: '/inventory', color: 'border-gray-200 bg-gray-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{user?.name}님</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{today}</span>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm font-semibold cursor-pointer active:bg-gray-200">로그아웃</button>
        </div>
      </header>
      <div className="p-4 space-y-3">
        {cards.map(card => (
          <button key={card.key} onClick={() => navigate(card.path)}
            className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${card.color}`}>
            <div className="text-left">
              <h3 className="text-lg font-bold text-gray-900">{card.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{card.desc}</p>
            </div>
            <span className="text-blue-600 font-bold text-base">{counts[card.key]}건</span>
          </button>
        ))}
      </div>
    </div>
  )
}
