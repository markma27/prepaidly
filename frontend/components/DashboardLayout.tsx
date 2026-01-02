'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { xeroAuthApi } from '@/lib/api';
import { XeroConnection } from '@/lib/types';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ListOrdered, 
  BarChart3, 
  Settings, 
  HelpCircle,
  ChevronDown,
  Sun
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  tenantId: string;
}

export default function DashboardLayout({ children, tenantId }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [connections, setConnections] = useState<XeroConnection[]>([]);
  const [currentConnection, setCurrentConnection] = useState<XeroConnection | null>(null);
  const [isEntityMenuOpen, setIsEntityMenuOpen] = useState(false);
  const entityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        console.log('Fetching connections for tenantId:', tenantId);
        const response = await xeroAuthApi.getStatus();
        console.log('API Response:', response);
        
        if (response && response.connections) {
          console.log('Connections found:', response.connections);
          console.log('Connection details:', response.connections.map(c => ({
            tenantId: c.tenantId,
            tenantName: c.tenantName,
            connected: c.connected
          })));
          
          setConnections(response.connections);
          // Try to find exact match first
          let current = response.connections.find(c => c.tenantId === tenantId);
          console.log('Exact match found:', current);
          
          // If no exact match, try case-insensitive match
          if (!current) {
            current = response.connections.find(c => 
              c.tenantId.toLowerCase() === tenantId.toLowerCase()
            );
            console.log('Case-insensitive match found:', current);
          }
          
          // If still no match, use first connection if available
          if (!current && response.connections.length > 0) {
            current = response.connections[0];
            console.log('Using first connection:', current);
          }
          
          if (current) {
            console.log('Setting current connection:', current);
            setCurrentConnection(current);
          } else if (response.connections.length === 0) {
            console.log('No connections available');
            // No connections available, create a placeholder
            setCurrentConnection({
              tenantId: tenantId,
              tenantName: tenantId || 'Unknown Entity',
              connected: false,
              message: 'No connections found'
            });
          }
        } else {
          console.warn('Invalid response structure:', response);
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
        // On error, create a fallback connection object
        setCurrentConnection({
          tenantId: tenantId,
          tenantName: tenantId || 'Unknown Entity',
          connected: false,
          message: 'Error loading connections'
        });
      }
    };
    if (tenantId) {
      fetchConnections();
    }
  }, [tenantId]);

  // Close entity menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (entityMenuRef.current && !entityMenuRef.current.contains(event.target as Node)) {
        setIsEntityMenuOpen(false);
      }
    };

    if (isEntityMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEntityMenuOpen]);

  const mainNavigation = [
    { name: 'Dashboard', href: `/app/dashboard?tenantId=${tenantId}`, icon: LayoutDashboard },
    { name: 'New Schedule', href: `/app/schedules/new?tenantId=${tenantId}`, icon: PlusCircle },
    { name: 'Schedule Register', href: `/app/dashboard?tenantId=${tenantId}`, icon: ListOrdered },
    { name: 'Analytics', href: `/app/dashboard?tenantId=${tenantId}`, icon: BarChart3 },
  ];

  const footerNavigation = [
    { name: 'Settings', href: `/app/settings?tenantId=${tenantId}`, icon: Settings },
    { name: 'Help & Support', href: `/app/dashboard?tenantId=${tenantId}`, icon: HelpCircle },
  ];

  const isActive = (href: string) => {
    const url = new URL(href, 'http://localhost');
    return pathname === url.pathname;
  };

  const handleSwitchEntity = (newTenantId: string) => {
    setIsEntityMenuOpen(false);
    router.push(`${pathname}?tenantId=${newTenantId}`);
  };

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-[#F9FAFB] z-10 border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="px-6 py-6">
            <Link href={`/app/dashboard?tenantId=${tenantId}`} className="flex items-center gap-2">
              <img src="/Logo.svg" alt="Prepaidly Logo" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Entity Selector */}
          <div className="px-4 mb-6 relative" ref={entityMenuRef}>
            <button 
              onClick={() => setIsEntityMenuOpen(!isEntityMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 bg-transparent hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex flex-col items-start overflow-hidden flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-normal">Entity</span>
                <span className="truncate w-full text-left text-sm font-medium text-gray-700">
                  {currentConnection?.tenantName && currentConnection.tenantName !== 'Unknown' 
                    ? currentConnection.tenantName 
                    : connections.find(c => c.tenantId === tenantId)?.tenantName && connections.find(c => c.tenantId === tenantId)?.tenantName !== 'Unknown'
                      ? connections.find(c => c.tenantId === tenantId)!.tenantName
                      : tenantId || 'Select Entity'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isEntityMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isEntityMenuOpen && (
              <div className="absolute left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                {connections.length > 0 ? (
                  connections.map((conn) => (
                    <button
                      key={conn.tenantId}
                      onClick={() => handleSwitchEntity(conn.tenantId)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        conn.tenantId === tenantId || conn.tenantId.toLowerCase() === tenantId.toLowerCase()
                          ? 'font-semibold text-blue-600 bg-blue-50' 
                          : 'text-gray-700'
                      }`}
                    >
                      {conn.tenantName}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">No entities available</div>
                )}
              </div>
            )}
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {mainNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer Navigation */}
          <div className="px-3 py-4 space-y-1 border-t border-gray-200">
            {footerNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold uppercase">
                {currentConnection?.tenantName?.charAt(0) || 'N'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 truncate w-24">mayinxing</span>
                <span className="text-xs text-gray-500 truncate w-24">mayinxing@gmail.com</span>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">Dashboard</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-gray-400 hover:text-gray-600">
              <Sun className="w-5 h-5" />
            </button>
            <button 
              onClick={() => router.push('/app')}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 bg-white p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
