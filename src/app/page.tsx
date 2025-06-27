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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-500/20 to-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
            Shifty
          </h1>
          <p className="text-gray-400 text-sm font-medium">Shift Management Reimagined</p>
        </div>

        {/* Glassmorphism login form */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Role Selection */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 block">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('manager')}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  selectedRole === 'manager'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 text-white'
                    : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">👔</div>
                  <div className="font-semibold">Manager</div>
                  <div className="text-xs opacity-80">Post & manage shifts</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  selectedRole === 'staff'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-400 text-white'
                    : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">💼</div>
                  <div className="font-semibold">Staff</div>
                  <div className="text-xs opacity-80">Find & accept shifts</div>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
            >
              Sign In as {selectedRole === 'manager' ? 'Manager' : 'Staff'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="px-4 text-gray-400 text-sm font-medium">or</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          {/* Google sign-in */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 font-medium hover:bg-white transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-3"
          >
            <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-xs">
            © 2024 Shifty. Premium shift management for modern teams.
          </p>
        </div>
      </div>
    </main>
  )
}
