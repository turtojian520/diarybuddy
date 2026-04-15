'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpenText, FileText, History, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

const navItems = [
  { href: '/', label: '工作台', icon: BookOpenText },
  { href: '/preview', label: '预览', icon: FileText },
  { href: '/history', label: '历史', icon: History },
]

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="pointer-events-auto flex w-full max-w-fit items-center gap-1 rounded-full border border-[#d9ccb9]/90 bg-[#fffaf2]/90 p-1.5 shadow-[0_10px_35px_rgba(89,65,39,0.12)] backdrop-blur">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-all sm:px-4 ${
                isActive
                  ? 'bg-[#d4a373] text-white shadow-[0_8px_20px_rgba(212,163,115,0.3)]'
                  : 'text-[#6b5c4c] hover:bg-[#f2e7d6] hover:text-[#2b2a27]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={handleSignOut}
          title="退出登录"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#6b5c4c] transition-all hover:bg-[#f2e7d6] hover:text-[#2b2a27] sm:px-4"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">退出</span>
        </button>
      </nav>
    </div>
  )
}
