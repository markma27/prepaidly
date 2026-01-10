'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useMemo } from 'react';
import { xeroAuthApi } from '@/lib/api';
import { XeroConnection } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ListOrdered, 
  BarChart3, 
  Settings, 
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  ArrowLeft,
  User,
  LogOut
} from 'lucide-react';
import Skeleton from '@/components/Skeleton';

interface DashboardLayoutProps {
  children: React.ReactNode;
  tenantId: string;
}

export default function DashboardLayout({ children, tenantId }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;
  const CACHE_KEY = 'xero_connections_cache';
  
  // Get cached connections from sessionStorage
  const getCachedConnections = (): { data: XeroConnection[]; timestamp: number } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('Error reading connections cache:', e);
    }
    return null;
  };
  
  // Save connections to sessionStorage cache
  const setCachedConnections = (data: XeroConnection[]) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Error saving connections cache:', e);
    }
  };
  
  // Initialize from cache immediately
  const getInitialConnections = (): XeroConnection[] => {
    const cached = getCachedConnections();
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return [];
  };
  
  const initialConnections = getInitialConnections();
  const [connections, setConnections] = useState<XeroConnection[]>(initialConnections);
  const [currentConnection, setCurrentConnection] = useState<XeroConnection | null>(null);
  const [isEntityMenuOpen, setIsEntityMenuOpen] = useState(false);
  const [isLoadingConnections, setIsLoadingConnections] = useState(initialConnections.length === 0);
  const entityMenuRef = useRef<HTMLDivElement>(null);
  
  // User profile state
  const [userEmail, setUserEmail] = useState<string>('user@example.com');
  const [userName, setUserName] = useState<string>('User');
  const [userInitial, setUserInitial] = useState<string>('P');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Memoize current connection lookup to avoid recalculation
  const memoizedCurrentConnection = useMemo(() => {
    if (!tenantId || connections.length === 0) return null;
    
    let current = connections.find(c => c.tenantId === tenantId);
    if (!current) {
      current = connections.find(c => 
        c.tenantId.toLowerCase() === tenantId.toLowerCase()
      );
    }
    if (!current && connections.length > 0) {
      current = connections[0];
    }
    return current || null;
  }, [tenantId, connections]);
  
  // Update currentConnection when memoized value changes
  useEffect(() => {
    if (memoizedCurrentConnection) {
      setCurrentConnection(memoizedCurrentConnection);
    }
  }, [memoizedCurrentConnection]);

  // Fetch current user info from Supabase
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching user session:', error);
          return;
        }
        
        if (session?.user) {
          const email = session.user.email || 'user@example.com';
          const name = session.user.user_metadata?.full_name || 
                      session.user.user_metadata?.name || 
                      email.split('@')[0] || 
                      'User';
          const initial = name.charAt(0).toUpperCase() || 'P';
          
          setUserEmail(email);
          setUserName(name);
          setUserInitial(initial);
        }
      } catch (err) {
        console.error('Error loading user info:', err);
      }
    };
    
    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchConnectionsFromApi = async (validateTokens: boolean = false, showLoading: boolean = true) => {
      if (showLoading) {
        setIsLoadingConnections(true);
      }
      try {
        // Fast path: Get connections without token validation first (for immediate display)
        // This returns tenant names from database immediately
        const response = await xeroAuthApi.getStatus(undefined, validateTokens);
        
        if (response && response.connections) {
          // Update sessionStorage cache
          setCachedConnections(response.connections);
          setConnections(response.connections);
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
        // If fetch fails but we have cache, use cache
        const fallbackCache = getCachedConnections();
        if (fallbackCache) {
          setConnections(fallbackCache.data);
        }
      } finally {
        if (showLoading) {
          setIsLoadingConnections(false);
        }
      }
    };

    const fetchConnections = async () => {
      // Check sessionStorage cache first
      const now = Date.now();
      const cached = getCachedConnections();
      
      if (
        cached &&
        now - cached.timestamp < CACHE_DURATION &&
        cached.data.length > 0
      ) {
        // Show cached data immediately for fast UX
        // Don't show loading state if we have valid cache
        setConnections(cached.data);
        setIsLoadingConnections(false);
        // Still fetch in background to ensure we have latest data
        // but don't block UI and don't show loading - use fast path (no token validation)
        fetchConnectionsFromApi(false, false);
        return;
      }

      // Fetch if no cache or cache expired
      // Use fast path first (no token validation) for immediate display
      await fetchConnectionsFromApi(false, true);
      
      // Optionally validate tokens in background after initial load
      // This updates connection status without blocking UI or showing loading
      setTimeout(() => {
        fetchConnectionsFromApi(true, false).catch(err => {
          console.debug('Background token validation failed:', err);
          // Ignore errors - we already have the entity names displayed
        });
      }, 1000);
    };
    
    // Only fetch if tenantId exists and we don't have valid cached connections
    // This prevents unnecessary refetching when navigating between pages with same tenantId
    const cached = getCachedConnections();
    const now = Date.now();
    const hasValidCache = cached && 
                          now - cached.timestamp < CACHE_DURATION && 
                          cached.data.length > 0;
    
    if (tenantId) {
      if (hasValidCache) {
        // Use cache immediately, no loading state
        setConnections(cached.data);
        setIsLoadingConnections(false);
        // Silently refresh in background without showing loading
        fetchConnectionsFromApi(false, false);
      } else {
        // Only fetch if no valid cache
        fetchConnections();
      }
    } else {
      setIsLoadingConnections(false);
    }
    
    // Listen for storage events to detect when cache is cleared (e.g., after disconnect)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CACHE_KEY && e.newValue === null) {
        // Cache was cleared, refresh connections
        console.log('Connections cache cleared, refreshing...');
        fetchConnectionsFromApi(false, true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event for same-tab cache clearing
    const handleCacheClear = () => {
      console.log('Connections cache cleared via custom event, refreshing...');
      fetchConnectionsFromApi(false, true);
    };
    
    window.addEventListener('connections-cache-cleared', handleCacheClear);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('connections-cache-cleared', handleCacheClear);
    };
  }, [tenantId]);

  // Close entity menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (entityMenuRef.current && !entityMenuRef.current.contains(event.target as Node)) {
        setIsEntityMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isEntityMenuOpen || isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEntityMenuOpen, isUserMenuOpen]);

  const mainNavigation = [
    { name: 'Dashboard', href: `/app/dashboard?tenantId=${tenantId || ''}`, icon: LayoutDashboard, path: '/app/dashboard' },
    { name: 'New Schedule', href: `/app/schedules/new?tenantId=${tenantId || ''}`, icon: PlusCircle, path: '/app/schedules/new' },
    { name: 'Schedule Register', href: `/app/schedules/register?tenantId=${tenantId || ''}`, icon: ListOrdered, path: '/app/schedules/register' },
    { name: 'Analytics', href: `/app/dashboard?tenantId=${tenantId || ''}`, icon: BarChart3, path: '/app/dashboard' },
  ];

  const footerNavigation = [
    { name: 'Settings', href: `/app/settings?tenantId=${tenantId || ''}`, icon: Settings, path: '/app/settings' },
    { name: 'Help & Support', href: `/app/dashboard?tenantId=${tenantId || ''}`, icon: HelpCircle, path: '/app/dashboard' },
  ];

  const isActive = (itemPath: string, itemName: string) => {
    // Only Dashboard should be active when on dashboard page
    if (pathname === '/app/dashboard') {
      return itemName === 'Dashboard';
    }
    // For Schedule Register, match register page and detail pages (but not new schedule page)
    if (itemPath === '/app/schedules/register') {
      // Exact match for register page
      if (pathname === '/app/schedules/register') {
        return true;
      }
      // Match detail pages like /app/schedules/123 (but not /app/schedules/new)
      if (pathname.startsWith('/app/schedules/') && pathname !== '/app/schedules/new') {
        const pathParts = pathname.split('/').filter(p => p);
        // Should be: ['app', 'schedules', '123'] for detail pages
        // Should NOT be: ['app', 'schedules', 'new'] or ['app', 'schedules', 'register']
        if (pathParts.length === 3 && pathParts[0] === 'app' && pathParts[1] === 'schedules') {
          const lastPart = pathParts[2];
          // Check if it's a numeric ID (detail page)
          if (lastPart && !isNaN(Number(lastPart)) && lastPart !== 'new' && lastPart !== 'register') {
            return true;
          }
        }
      }
      return false;
    }
    // For other pages, match by pathname
    return pathname === itemPath;
  };

  const handleSwitchEntity = (newTenantId: string) => {
    setIsEntityMenuOpen(false);
    router.push(`/app/dashboard?tenantId=${newTenantId}`);
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
      
      // Redirect to login
      router.push('/auth/login');
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Get page title based on pathname
  const getPageTitle = () => {
    const activeItem = [...mainNavigation, ...footerNavigation].find(item => 
      isActive(item.path, item.name)
    );
    return activeItem?.name || 'Dashboard';
  };

  // Get page icon based on pathname
  const getPageIcon = () => {
    const activeItem = [...mainNavigation, ...footerNavigation].find(item => 
      isActive(item.path, item.name)
    );
    return activeItem?.icon || LayoutDashboard;
  };

  // Format current date
  const getCurrentDate = () => {
    const today = new Date();
    const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
    const day = today.getDate();
    const month = today.toLocaleDateString('en-US', { month: 'long' });
    const year = today.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  };

  const PageIcon = getPageIcon();

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-56 bg-[#F9FAFB] z-10 border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="px-3 py-4">
            <Link href={`/app/dashboard?tenantId=${tenantId}`} className="flex items-center justify-center gap-2">
              <img src="/Logo.svg" alt="Prepaidly Logo" className="h-12 w-auto" />
            </Link>
          </div>


          {/* Main Navigation */}
          <nav className="flex-1 px-2 space-y-1">
            {mainNavigation.map((item) => {
              const active = isActive(item.path, item.name);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-2.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2.5 ${active ? 'text-white' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer Navigation */}
          <div className="px-2 py-4 space-y-1">
            {footerNavigation.map((item) => {
              const active = isActive(item.path, item.name);
              const Icon = item.icon;
              return (
            <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-2.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-2.5 ${active ? 'text-white' : 'text-gray-400'}`} />
                  {item.name}
            </Link>
              );
            })}
            {/* Return to Entity List */}
            <Link
              href="/app"
              className="flex items-center px-2.5 py-2 text-[13px] font-medium rounded-lg transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2.5 text-gray-400" />
              Return to Entity List
            </Link>
          </div>

          {/* Divider above User Profile */}
          <div className="px-3 mt-auto mb-2">
            <div className="h-px bg-gray-200"></div>
          </div>

          {/* User Profile */}
          <div className="px-3 pb-4">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6d69ff] to-[#5a56e8] flex items-center justify-center text-white text-sm font-semibold shadow-sm flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex flex-col items-start justify-center flex-1 min-w-0 text-left">
                  <span className="text-[13px] font-semibold text-gray-900 leading-tight truncate w-full text-left">{userName}</span>
                  <span className="text-[11px] text-gray-500 leading-tight truncate w-full text-left mt-0.5">{userEmail}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute left-2 right-2 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  {/* User Info Section */}
                  <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6d69ff] to-[#5a56e8] flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        {userInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{userName}</div>
                        <div className="text-xs text-gray-500 truncate">{userEmail}</div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        // TODO: Navigate to profile page when implemented
                      }}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 mr-3 text-gray-400" />
                      Profile Settings
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-3 text-red-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="pl-56 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-10 bg-gradient-to-r from-white via-gray-50/50 to-white border-b border-gray-200/80 backdrop-blur-sm">
          <div className="px-8 py-2.5 flex items-center justify-between">
            {/* Breadcrumb and Title Section */}
            <div className="flex items-center gap-3">
              <div className="flex items-stretch gap-3">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#6d69ff]/10 to-[#6d69ff]/5 flex items-center justify-center self-stretch">
                  <PageIcon className="w-6 h-6 text-[#6d69ff]" />
                </div>
                <div className="flex flex-col justify-center">
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">{getPageTitle()}</h1>
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{getCurrentDate()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Entity Selector */}
            <div className="relative" ref={entityMenuRef}>
              <button 
                onClick={() => setIsEntityMenuOpen(!isEntityMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
              >
                  {isLoadingConnections || (connections.length === 0 && tenantId) ? (
                    <Skeleton className="h-4 w-32" variant="text" />
                  ) : (
                    <>
                      <span className="whitespace-nowrap text-[13px] font-medium text-gray-700">
                        {(() => {
                          // Use memoizedCurrentConnection for immediate display
                          const activeConnection = memoizedCurrentConnection || currentConnection;
                          
                          // First try active connection
                          if (activeConnection?.tenantName && 
                              activeConnection.tenantName !== 'Unknown' && 
                              activeConnection.tenantName !== activeConnection.tenantId) {
                            return activeConnection.tenantName;
                          }
                          // Then try finding in connections array
                          const conn = connections.find(c => c.tenantId === tenantId);
                          if (conn?.tenantName && 
                              conn.tenantName !== 'Unknown' && 
                              conn.tenantName !== conn.tenantId) {
                            return conn.tenantName;
                          }
                          // Show placeholder if no valid name found
                          return 'Select Entity';
                        })()}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isEntityMenuOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {isEntityMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[200px] max-w-md max-h-64 overflow-y-auto">
                    {connections.length > 0 ? (
                      connections.map((conn) => (
                        <button
                          key={conn.tenantId}
                          onClick={() => handleSwitchEntity(conn.tenantId)}
                          className={`w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors whitespace-nowrap ${
                            conn.tenantId === tenantId || conn.tenantId.toLowerCase() === tenantId.toLowerCase()
                              ? 'font-semibold text-blue-600 bg-blue-50' 
                              : 'text-gray-700'
                          }`}
                        >
                          {conn.tenantName}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-[13px] font-medium text-gray-500">No entities available</div>
                    )}
                  </div>
                )}
            </div>
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
