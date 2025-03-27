'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/sidebar'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  
  const excludedPages = [
    '/login',
    '/',
    '/terms',
    '/privacy',
    '/auth/reset-password',
    '/primoaccesso',
    '/admin/x7k9m2p4v3'
  ]
  
  // Verifica se la pagina corrente è nella lista delle pagine escluse
  const shouldHideMenu = excludedPages.includes(pathname)

  // Se la pagina è nella lista delle escluse, mostra solo il contenuto
  if (shouldHideMenu) {
    return children
  }


  return (
    <div className="flex min-h-screen">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className={`${isCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300 flex-1`}>
        {children}
      </main>
    </div>
  )
}