'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '../lib/firebase'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth'
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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState<'manager' | 'staff'>('manager')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        // Route based on selected role
        if (selectedRole === 'manager') {
          router.push('/manager')
        } else {
          router.push('/staff')
        }
      }
    })
    return unsubscribe
  }, [router, selectedRole])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Role routing is handled in useEffect
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setIsGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // Role routing is handled in useEffect
    } catch (err: any) {
      setError(err.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Enhanced Porsche-style background with animated particles */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        {/* Animated floating particles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        {/* Additional subtle particles */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '3s'}}></div>
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
      </div>
      {/* Main login container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Enhanced Logo/Brand section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <ShiftLystLogo size={60} className="transform hover:scale-105 transition-transform duration-300" />
          </div>
          {/* Enhanced Typography */}
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-white tracking-tight">
              Shift<span className="text-[#D5001C]">Lyst</span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold tracking-widest uppercase">
              <span className="w-8 h-px bg-gradient-to-r from-transparent to-gray-400"></span>
              <span>Premium Shift Management</span>
              <span className="w-8 h-px bg-gradient-to-l from-transparent to-gray-400"></span>
            </div>
          </div>
          {/* Tagline */}
          <p className="text-gray-300 text-lg font-light tracking-wide mt-3 mb-2">
            Fill shifts. Fast.
          </p>
          {/* Brand attributes */}
          <div className="flex items-center justify-center gap-4 text-gray-400 text-xs font-medium tracking-wider uppercase">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#D5001C] rounded-full"></div>
              Secure
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#D5001C] rounded-full"></div>
              Efficient
            </span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-[#D5001C] rounded-full"></div>
              Reliable
            </span>
          </div>
        </div>
        {/* Enhanced Porsche-style login form */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          {/* Subtle form glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          {/* Role Selection */}
          <div className="mb-6 relative z-10">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4 block">
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
          <form onSubmit={handleEmailLogin} className="space-y-5 relative z-10">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
              />
            </div>
            {error && (
              <div className="bg-red-50/80 border-2 border-red-200 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </div>
              ) : (
                <span>Sign In as {selectedRole === 'manager' ? 'Manager' : 'Staff'}</span>
              )}
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            </button>
          </form>
          {/* Enhanced Divider */}
          <div className="flex items-center my-6 relative z-10">
            <div className="flex-1 border-t-2 border-gray-200/50"></div>
            <span className="px-4 text-gray-500 text-sm font-bold tracking-widest uppercase">or</span>
            <div className="flex-1 border-t-2 border-gray-200/50"></div>
          </div>
          {/* Enhanced Google sign-in */}
          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-xl p-4 text-gray-700 font-bold hover:bg-gray-100/80 hover:border-[#D5001C]/30 transform hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative z-10"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div>
            ) : (
              <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
            )}
            <span>{isGoogleLoading ? 'Signing In...' : 'Sign in with Google'}</span>
          </button>
        </div>
        {/* Enhanced Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-400 text-xs font-medium tracking-wide">
            © 2024 ShiftLyst. Premium shift management for modern teams.
          </p>
          <p className="text-gray-500 text-xs mt-1 tracking-wider uppercase">
            Enterprise-grade security • 99.9% uptime
            {/* • 24/7 support */}
          </p>
        </div>
      </div>
    </main>
  )
} 