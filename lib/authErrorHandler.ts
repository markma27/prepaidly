import { createClient } from './supabaseClient'

export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const handleAuthError = async (error: any) => {
  // Check if it's a Supabase auth error
  if (error?.message?.includes('Refresh Token Not Found') || 
      error?.message?.includes('Invalid Refresh Token') ||
      error?.code === 'INVALID_REFRESH_TOKEN') {
    
    console.warn('Auth token expired or invalid, clearing session and redirecting to login')
    
    // Clear the session
    const supabase = createClient()
    await supabase.auth.signOut()
    
    // Clear localStorage
    localStorage.removeItem('selectedEntityId')
    
    // Redirect to login
    window.location.href = '/login'
    
    throw new AuthError('Session expired. Please log in again.', 'SESSION_EXPIRED')
  }
  
  // Check for other auth-related errors
  if (error?.status === 401 || error?.statusCode === 401) {
    console.warn('Unauthorized access, redirecting to login')
    window.location.href = '/login'
    throw new AuthError('Unauthorized access. Please log in again.', 'UNAUTHORIZED')
  }
  
  // Re-throw the original error if it's not auth-related
  throw error
}

export const withAuthErrorHandling = async <T>(
  apiCall: () => Promise<T>
): Promise<T> => {
  try {
    return await apiCall()
  } catch (error) {
    return handleAuthError(error)
  }
} 