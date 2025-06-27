'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
// import { auth } from '../lib/firebase'
import { auth } from './lib/firebase'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState<'manager' | 'staff'>('manager')

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
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Role routing is handled in useEffect
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // Role routing is handled in useEffect
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Porsche-style subtle background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      {/* Main login container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo/Brand section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-3xl shadow-xl mb-8 relative overflow-hidden">
            {/* Main logo design */}
            <div className="relative z-10 flex items-center justify-center">
              {/* Stylized "S" with shift arrow */}
              <div className="relative">
                <div className="text-white font-bold text-3xl tracking-tight">S</div>
                {/* Shift arrow overlay */}
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white transform rotate-45"></div>
              </div>
            </div>
            {/* Geometric accents */}
            <div className="absolute top-2 right-2 w-3 h-3 bg-white/20 rounded-full"></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 bg-white/15 rounded-full"></div>
            <div className="absolute top-1/2 left-1 w-1 h-1 bg-white/10 rounded-full transform -translate-y-1/2"></div>
            <div className="absolute top-1/2 right-1 w-1 h-1 bg-white/10 rounded-full transform -translate-y-1/2"></div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            ShiftLyst
          </h1>
          <p className="text-gray-300 text-lg font-light tracking-wide">Shift Management Reimagined</p>
        </div>

        {/* Porsche-style login form */}
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-10 shadow-xl">
          {/* Role Selection */}
          <div className="mb-8">
            <label className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-4 block">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedRole('manager')}
                className={`p-6 rounded-xl border transition-all duration-300 ${
                  selectedRole === 'manager'
                    ? 'bg-[#D5001C] border-[#D5001C] text-white shadow-md'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-[#D5001C]/30'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-3">👔</div>
                  <div className="font-semibold text-lg">Manager</div>
                  <div className="text-sm opacity-80 mt-1">Post & manage shifts</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className={`p-6 rounded-xl border transition-all duration-300 ${
                  selectedRole === 'staff'
                    ? 'bg-[#D5001C] border-[#D5001C] text-white shadow-md'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-[#D5001C]/30'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-3">💼</div>
                  <div className="font-semibold text-lg">Staff</div>
                  <div className="text-sm opacity-80 mt-1">Find & accept shifts</div>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-semibold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300"
            >
              Sign In as {selectedRole === 'manager' ? 'Manager' : 'Staff'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-8">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-gray-500 text-sm font-medium">or</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Google sign-in */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 font-medium hover:bg-gray-100 transform hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-3"
          >
            <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            © 2024 Shifty. Premium shift management for modern teams.
          </p>
        </div>
      </div>
    </main>
  )
}
