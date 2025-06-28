'use client'

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createUserProfile } from '../lib/firestore'
import { User } from '../lib/types'
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

interface RoleSelectionProps {
  onComplete: () => void
}

export default function RoleSelection({ onComplete }: RoleSelectionProps) {
  const { user } = useAuth()
  const [selectedRole, setSelectedRole] = useState<'manager' | 'staff'>('manager')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    if (!user) {
      setError('No user found. Please sign in again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userData: Partial<User> = {
        email: user.email || '',
        name: name.trim(),
        role: selectedRole,
        reliabilityScore: 100,
        totalShifts: 0,
        completedShifts: 0,
        noShows: 0,
        averageRating: 0,
        badges: []
      }

      await createUserProfile(user.uid, userData)
      console.log('Profile created successfully')
      onComplete()
    } catch (err: any) {
      console.error('Error creating profile:', err)
      setError('Failed to create profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '3s'}}></div>
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
      </div>

      {/* Main container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <ShiftLystLogo size={60} className="transform hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-white tracking-tight">
              Shift<span className="text-[#D5001C]">Lyst</span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold tracking-widest uppercase">
              <span className="w-8 h-px bg-gradient-to-r from-transparent to-gray-400"></span>
              <span>Complete Your Profile</span>
              <span className="w-8 h-px bg-gradient-to-l from-transparent to-gray-400"></span>
            </div>
          </div>
          <p className="text-gray-300 text-lg font-light tracking-wide mt-3 mb-2">
            Let's get you set up
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('manager')}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 transform hover:scale-[1.02] ${
                    selectedRole === 'manager'
                      ? 'bg-gradient-to-br from-[#D5001C] to-[#B0001A] border-[#D5001C] text-white shadow-lg shadow-[#D5001C]/25'
                      : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100/80 hover:border-[#D5001C]/40 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">👔</div>
                    <div className="font-bold text-lg mb-1">Manager</div>
                    <div className="text-xs opacity-90 font-medium">Post & manage shifts</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('staff')}
                  className={`p-6 rounded-xl border-2 transition-all duration-500 transform hover:scale-[1.02] ${
                    selectedRole === 'staff'
                      ? 'bg-gradient-to-br from-[#D5001C] to-[#B0001A] border-[#D5001C] text-white shadow-lg shadow-[#D5001C]/25'
                      : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100/80 hover:border-[#D5001C]/40 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">💼</div>
                    <div className="font-bold text-lg mb-1">Staff</div>
                    <div className="text-xs opacity-90 font-medium">Find & accept shifts</div>
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50/80 border-2 border-red-200 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Setting up your account...</span>
                </div>
              ) : (
                <span>Complete Setup</span>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-400 text-xs font-medium tracking-wide">
            Welcome to ShiftLyst! 🎉
          </p>
        </div>
      </div>
    </div>
  )
} 