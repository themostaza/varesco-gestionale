'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, Users, Building2, ClipboardList, Factory, Truck, LogOut, LayoutDashboard,ArrowsUpFromLine,PrinterCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

interface NavItem {
  name: string;
  icon: React.ElementType;
  href: string;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const allNavItems: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Utenti', icon: Users, href: '/utenti' },
    { name: 'Clienti', icon: Building2, href: '/clienti' },
    { name: 'Ordini', icon: ClipboardList, href: '/ordini' },
    { name: 'Produzione', icon: Factory, href: '/produzione' },
    { name: 'Carichi', icon: Truck, href: '/carichi' },
    { name: 'Carichi del giorno', icon: ArrowsUpFromLine, href: '/carichidelgiorno' },
    { name: 'DDT', icon: PrinterCheck, href: '/ddt' }
  ];

  const collaboratorNavItems: NavItem[] = [
    { name: 'Produzione', icon: Factory, href: '/produzione' },
    { name: 'Carichi', icon: Truck, href: '/carichi' }
  ];

  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [visibleNavItems, setVisibleNavItems] = useState<NavItem[]>(allNavItems);


  console.log(userRole)
  useEffect(() => {
    setMounted(true);
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {

        setUserName(user.user_metadata?.user_name || 'Utente');
        const role = user.user_metadata?.role || '';
        setUserRole(role);
        
        // Set visible navigation items based on role
        if (role === 'collaboratore') {
          setVisibleNavItems(collaboratorNavItems);
        } else {
          setVisibleNavItems(allNavItems);
        }
      }
    };
    
    getUserData();
  }, []);

  const handleLogout = async () => {
    try {
      const result = await supabase.auth.signOut();
      
      if (result.error) {
        throw result.error;
      }

      router.push('/login');
      
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={`fixed top-0 left-0 h-screen bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} flex flex-col`}>
      <div className="p-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mb-4 hover:bg-gray-800"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </Button>

        <div className={`transition-opacity ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
          <h1 className="text-2xl font-bold">Varesco</h1>
          <p className="text-sm text-gray-400">Valore al legno dal 1947</p>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-2 py-3 my-1 rounded-lg transition-colors
              ${pathname === item.href ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
          >
            <item.icon className="h-5 w-5" />
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <Users className="h-5 w-5 mr-2" />
          {!isCollapsed && (userName || 'Utente')}
        </div>
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className={`mt-2 text-red-400 hover:text-red-300 hover:bg-gray-800 w-full flex items-center justify-${isCollapsed ? 'center' : 'start'}`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;