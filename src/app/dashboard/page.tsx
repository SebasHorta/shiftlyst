'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getUserProfile } from '../lib/firestore'
import { User } from '../lib/types'
import RoleSelection from '../components/RoleSelection'
import Image from 'next/image'

// Reusable Logo Component
const ShiftLystLogo = ({ size = 80, className = '' }: { size?: number; className?: string }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image
      src="/assets/shiftlyst_logo.png"
      alt="ShiftLyst Logo"
      width={size}
      height={size}
      className="object-contain rounded-lg"
      priority
    />
  </div>
)

export default function Dashboard() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user && !loading) {
        try {
          console.log('Loading profile for user:', user.uid)
          const profile = await getUserProfile(user.uid)
          console.log('Profile loaded:', profile)
          setUserProfile(profile)
          if (!profile) {
            console.log('No profile found, showing role selection')
            setShowRoleSelection(true)
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
          setError('Failed to load profile')
        } finally {
          setProfileLoading(false)
        }
      } else if (!user && !loading) {
        setProfileLoading(false)
      }
    }

    loadUserProfile()
  }, [user, loading])

  // Handle routing when profile is loaded
  useEffect(() => {
    if (userProfile && !showRoleSelection) {
      if (userProfile.role === 'manager') {
        router.push('/manager')
      } else {
        router.push('/staff')
      }
    }
  }, [userProfile, showRoleSelection, router])

  const handleProfileComplete = () => {
    setShowRoleSelection(false)
    // Reload the profile
    if (user) {
      getUserProfile(user.uid).then(setUserProfile)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  // Show loading state
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>
        
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <ShiftLystLogo size={60} className="transform hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="text-2xl text-white mb-2 font-light">
            {loading ? 'Checking authentication...' : 'Loading profile...'}
          </div>
          <div className="text-gray-400 text-sm">
            Please wait while we set up your experience
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        </div>
        
        <div className="relative z-10 text-center">
          <div className="text-2xl text-red-400 mb-2 font-light">Error</div>
          <div className="text-gray-400 text-sm mb-6">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#D5001C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#B0001A] transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        </div>
        
        <div className="relative z-10 text-center">
          <div className="text-2xl text-gray-400 mb-2 font-light">Not authenticated</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-[#D5001C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#B0001A] transition-all duration-300"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (showRoleSelection) {
    return <RoleSelection onComplete={handleProfileComplete} />
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        </div>
        
        <div className="relative z-10 text-center">
          <div className="text-2xl text-gray-400 mb-2 font-light">Loading profile...</div>
          <div className="text-gray-500 text-sm">Setting up your account</div>
        </div>
      </div>
    )
  }

  // Show a brief welcome screen while redirecting
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>
      
      <div className="relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <ShiftLystLogo size={60} className="transform hover:scale-105 transition-transform duration-300" />
        </div>
        <div className="text-2xl text-white mb-2 font-light">
          Welcome, {userProfile.name || user.email}!
        </div>
        <div className="text-gray-400 text-sm mb-4">
          Redirecting you to your {userProfile.role === 'manager' ? 'Manager' : 'Staff'} dashboard...
        </div>
        <div className="w-8 h-8 border-2 border-[#D5001C]/30 border-t-[#D5001C] rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
} 