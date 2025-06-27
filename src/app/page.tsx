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
    <main className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Porsche-style background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      {/* Main login container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo/Brand section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#D5001C] rounded-full shadow-2xl mb-8">
            <span className="text-4xl font-bold text-white tracking-tight">S</span>
          </div>
          <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
            Shifty
          </h1>
          <p className="text-gray-400 text-xl font-light tracking-wide">Shift Management Reimagined</p>
        </div>

        {/* Porsche-style login form */}
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-10 shadow-2xl">
          {/* Role Selection */}
          <div className="mb-10">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest mb-6 block">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => setSelectedRole('manager')}
                className={`p-8 rounded-xl border-2 transition-all duration-300 ${
                  selectedRole === 'manager'
                    ? 'bg-[#D5001C] border-[#D5001C] text-white shadow-lg'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-[#D5001C]/30 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">👔</div>
                  <div className="font-bold text-lg mb-2">Manager</div>
                  <div className="text-sm opacity-80">Post & manage shifts</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className={`p-8 rounded-xl border-2 transition-all duration-300 ${
                  selectedRole === 'staff'
                    ? 'bg-[#D5001C] border-[#D5001C] text-white shadow-lg'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-[#D5001C]/30 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">💼</div>
                  <div className="font-bold text-lg mb-2">Staff</div>
                  <div className="text-sm opacity-80">Find & accept shifts</div>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
              />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-bold py-5 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-lg tracking-wide"
            >
              Sign In as {selectedRole === 'manager' ? 'Manager' : 'Staff'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-10">
            <div className="flex-1 border-t-2 border-gray-200"></div>
            <span className="px-6 text-gray-500 text-sm font-semibold uppercase tracking-widest">or</span>
            <div className="flex-1 border-t-2 border-gray-200"></div>
          </div>

          {/* Google sign-in */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-gray-200 rounded-xl p-5 text-gray-700 font-semibold hover:border-[#D5001C]/30 hover:bg-gray-50 transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-4 text-lg"
          >
            <img src="/google-logo.svg" alt="Google" className="h-6 w-6" />
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm font-light tracking-wide">
            © 2024 Shifty. Premium shift management for modern teams.
          </p>
        </div>
      </div>
    </main>
  )
}
