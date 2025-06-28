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
import Link from 'next/link'
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

const benefits = [
  {
    title: 'Fill Shifts Instantly',
    description: 'No more frantic calls or emails. Instantly broadcast open shifts to your entire staff and fill them in seconds.',
    icon: '⚡️',
  },
  {
    title: 'Empower Your Team',
    description: 'Staff can view, claim, and manage their shifts from anywhere. Total transparency, total control.',
    icon: '🤝',
  },
  {
    title: 'Seamless Scheduling',
    description: 'Automated reminders, smart conflict detection, and a beautiful calendar view make managing shifts a breeze.',
    icon: '📅',
  },
  {
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security and 99.99% uptime. Your data is safe, your team is always connected.',
    icon: '🔒',
  },
]

const testimonials = [
  {
    quote: 'ShiftLyst transformed how we manage our staff. Filling last-minute shifts is now effortless!',
    name: 'Sarah M.',
    role: 'HR Manager, MedCare',
  },
  {
    quote: 'Our team loves the transparency and flexibility. No more confusion or missed shifts!',
    name: 'James T.',
    role: 'Restaurant Owner',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <ShiftLystLogo size={50} className="mr-2" />
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">ShiftLyst</h1>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/login">
                <button className="bg-[#D5001C] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#B0001A] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#D5001C]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
              Fill Shifts.
              <br />
              <span className="text-[#D5001C]">Fast.</span>
            </h1>
            <p className="text-2xl text-gray-600 mb-10 max-w-3xl mx-auto font-light leading-relaxed">
              The modern platform for effortless shift management. Empower your team, eliminate chaos, and fill every shift—instantly.
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <Link href="/login">
              <button className="bg-[#D5001C] text-white px-10 py-4 rounded-2xl text-xl font-bold hover:bg-[#B0001A] transition-all duration-500 shadow-2xl hover:shadow-3xl transform hover:scale-105">
                Get Started
              </button>
            </Link>
            <div className="text-gray-500 text-sm font-medium">
              Trusted by 10,000+ businesses
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">Why ShiftLyst?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light">
              Designed for the modern workforce. Built for results.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="group bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">{benefit.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#D5001C] transition-colors duration-300">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light">
              Simple. Efficient. Powerful.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-[#D5001C] to-[#B0001A] text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">1</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Managers</h3>
              <p className="text-gray-600 leading-relaxed">Post open shifts, set requirements, and instantly notify your team.</p>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-br from-[#D5001C] to-[#B0001A] text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">2</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Staff</h3>
              <p className="text-gray-600 leading-relaxed">Browse, claim, and manage shifts from any device, anywhere.</p>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-br from-[#D5001C] to-[#B0001A] text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">3</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Done!</h3>
              <p className="text-gray-600 leading-relaxed">Shifts are filled, everyone is notified, and your schedule stays organized.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">What Our Users Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light">
              Real results from real businesses.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
                <div className="text-2xl text-[#D5001C] mb-4">"</div>
                <p className="text-gray-700 text-lg leading-relaxed mb-6 italic font-light">"{testimonial.quote}"</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center text-white font-bold text-lg mr-4 shadow-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{testimonial.name}</div>
                    <div className="text-gray-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-[#D5001C] to-[#B0001A] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-black text-white mb-4 tracking-tight">Ready to Transform Your Staffing?</h2>
          <p className="text-2xl text-red-100 mb-8 font-light">Join thousands of businesses that trust ShiftLyst</p>
          <Link href="/login">
            <button className="bg-white text-[#D5001C] px-12 py-5 rounded-2xl text-xl font-bold hover:bg-gray-50 transition-all duration-500 shadow-2xl hover:shadow-3xl transform hover:scale-105">
              Start Free Trial
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <ShiftLystLogo size={50} className="mr-2" />
              <h3 className="text-xl font-black text-white">ShiftLyst</h3>
            </div>
            <p className="text-gray-400 font-light">
              &copy; {new Date().getFullYear()} ShiftLyst. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
