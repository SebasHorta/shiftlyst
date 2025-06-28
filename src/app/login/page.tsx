'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '../lib/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth'
import Image from 'next/image'
import Link from 'next/link'

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

const securityFeatures = [
  { icon: '🔒', text: 'SOC 2 Compliant' },
  { icon: '🛡️', text: 'Bank-level Security' },
  { icon: '⚡', text: '99.9% Uptime' },
  { icon: '🔐', text: 'End-to-end Encryption' },
]

const benefits = [
  {
    title: 'Instant Access',
    description: 'Get started in seconds with your existing Google account or email.',
    icon: '⚡',
  },
  {
    title: 'Secure & Private',
    description: 'Your data is protected with enterprise-grade security measures.',
    icon: '🔒',
  },
  {
    title: 'Always Available',
    description: 'Access your shifts from anywhere, anytime, on any device.',
    icon: '📱',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        router.push('/dashboard')
      }
    })
    return unsubscribe
  }, [router])

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
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
    } catch (err: any) {
      setError(err.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-r from-[#D5001C]/5 to-purple-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-[#D5001C]/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className={`w-full max-w-md transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <ShiftLystLogo size={50} className="transform hover:scale-105 transition-transform duration-300" />
            </Link>
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
              Welcome back
            </h1>
            <p className="text-gray-600 font-light">
              {isSignUp ? 'Create your account to get started' : 'Sign in to your account'}
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">
            <form onSubmit={handleEmailAuth} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-200 font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder={isSignUp ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-200 font-medium"
                />
              </div>
              
              {isSignUp && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-200 font-medium"
                  />
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                  </div>
                ) : (
                  <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
                )}
              </button>
            </form>
            
            {/* Toggle */}
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setEmail('')
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="text-[#D5001C] hover:text-[#B0001A] font-medium transition-colors duration-200"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
            </div>
            
            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-gray-500 text-sm font-medium">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            
            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-[#D5001C]/30 transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isGoogleLoading ? (
                <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
              )}
              <span>{isGoogleLoading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>
          </div>
          
          {/* Security Features */}
          <div className="mt-8">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
              {securityFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span>{feature.icon}</span>
                  <span className="font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Hero Content */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#D5001C] to-[#B0001A] relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className={`relative z-10 flex flex-col justify-center px-12 py-16 text-white transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="mb-8">
            <h2 className="text-4xl font-black mb-6 tracking-tight">
              Transform Your Workforce Management
            </h2>
            <p className="text-xl text-red-100 font-light leading-relaxed mb-8">
              Join thousands of businesses that trust ShiftLyst to manage their most valuable asset—their people.
            </p>
          </div>
          
          <div className="space-y-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{benefit.title}</h3>
                  <p className="text-red-100 font-light">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex items-center gap-8 text-sm text-red-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>10,000+ businesses trust us</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>99.9% uptime guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 