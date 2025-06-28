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
    title: 'Instant Shift Filling',
    description: 'Fill open shifts in seconds with intelligent notifications and smart matching algorithms.',
    icon: '⚡',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    title: 'Team Empowerment',
    description: 'Give your staff complete visibility and control over their schedules with real-time updates.',
    icon: '🤝',
    gradient: 'from-green-500 to-teal-600',
  },
  {
    title: 'Smart Scheduling',
    description: 'AI-powered conflict detection and automated reminders keep everyone on track.',
    icon: '📅',
    gradient: 'from-orange-500 to-red-600',
  },
  {
    title: 'Enterprise Security',
    description: 'Bank-level security with SOC 2 compliance and 99.99% uptime guarantee.',
    icon: '🔒',
    gradient: 'from-indigo-500 to-blue-600',
  },
]

const features = [
  {
    title: 'Real-time Notifications',
    description: 'Instant push notifications, SMS, and email alerts keep everyone informed.',
    icon: '📱',
  },
  {
    title: 'Conflict Detection',
    description: 'Automatically detect and prevent scheduling conflicts before they happen.',
    icon: '⚠️',
  },
  {
    title: 'Mobile-First Design',
    description: 'Optimized for every device with native mobile app performance.',
    icon: '📲',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Comprehensive insights into staffing patterns and efficiency metrics.',
    icon: '📊',
  },
  {
    title: 'API Integration',
    description: 'Seamlessly integrate with your existing HR and payroll systems.',
    icon: '🔗',
  },
  {
    title: '24/7 Support',
    description: 'Round-the-clock customer support with dedicated account managers.',
    icon: '🎧',
  },
]

const testimonials = [
  {
    quote: 'ShiftLyst has revolutionized our staffing process. What used to take hours now happens in minutes.',
    name: 'Sarah Chen',
    role: 'HR Director, MedCare Systems',
    company: 'Healthcare',
    avatar: 'SC',
  },
  {
    quote: 'Our team loves the transparency and flexibility. No more confusion or missed shifts!',
    name: 'James Thompson',
    role: 'Operations Manager',
    company: 'Restaurant Chain',
    avatar: 'JT',
  },
  {
    quote: 'The analytics alone have saved us thousands in overtime costs. Incredible ROI.',
    name: 'Maria Rodriguez',
    role: 'VP of Operations',
    company: 'Retail',
    avatar: 'MR',
  },
]

const stats = [
  { number: '10,000+', label: 'Businesses Trust Us' },
  { number: '500,000+', label: 'Shifts Filled' },
  { number: '99.9%', label: 'Uptime' },
  { number: '24/7', label: 'Support' },
]

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-100/50 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <ShiftLystLogo size={40} className="mr-3" />
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">ShiftLyst</h1>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium">Pricing</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium">About</a>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <button className="text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200">
                  Sign In
                </button>
              </Link>
              <Link href="/login">
                <button className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-6 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-[#D5001C]/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-[#D5001C]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-[#D5001C]/5 to-blue-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-[#D5001C]/10 to-purple-500/10 border border-[#D5001C]/20 mb-8">
              <span className="text-sm font-medium text-[#D5001C]">🚀 Now with AI-powered scheduling</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-gray-900 mb-8 tracking-tight leading-tight">
              Fill Shifts.
              <br />
              <span className="bg-gradient-to-r from-[#D5001C] to-purple-600 bg-clip-text text-transparent">
                Instantly.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto font-light leading-relaxed">
              The enterprise-grade platform that transforms shift management. 
              <span className="font-medium text-gray-900"> Zero chaos. Maximum efficiency.</span>
            </p>
          </div>
          
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Link href="/login">
              <button className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-10 py-4 rounded-2xl text-lg font-bold hover:shadow-2xl transition-all duration-500 transform hover:scale-105 group">
                Start Free Trial
                <span className="ml-2 group-hover:translate-x-1 transition-transform duration-200">→</span>
              </button>
            </Link>
            <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#D5001C] to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <span className="text-white text-xl">▶</span>
              </div>
              <span className="font-medium">Watch Demo</span>
            </button>
          </div>
          
          <div className={`mt-12 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Trusted by 10,000+ businesses</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>99.9% uptime guarantee</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>SOC 2 compliant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-3xl md:text-4xl font-black text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
              Why Leading Companies Choose ShiftLyst
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
              Built for scale, designed for efficiency, trusted by enterprise teams worldwide.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100/50">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${benefit.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <span className="text-2xl">{benefit.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-[#D5001C] transition-colors duration-300">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 leading-relaxed font-light">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              Powerful features that adapt to your workflow, not the other way around.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group p-6 rounded-xl hover:bg-gray-50 transition-all duration-300">
                <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-[#D5001C] transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
              Simple. Powerful. Effective.
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              Get started in minutes, see results immediately.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Post Shifts</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Create and publish open shifts with requirements, location, and compensation details.
              </p>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Staff Claims</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Team members browse, filter, and claim shifts that match their availability and skills.
              </p>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Automated</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Confirmations, notifications, and schedule updates happen automatically. Zero manual work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              See how ShiftLyst is transforming workforce management across industries.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <div className="text-3xl text-[#D5001C] mb-6">"</div>
                <p className="text-gray-700 text-lg leading-relaxed mb-8 italic font-light">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#D5001C] to-[#B0001A] rounded-xl flex items-center justify-center text-white font-bold text-lg mr-4 shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{testimonial.name}</div>
                    <div className="text-gray-500 font-medium">{testimonial.role}</div>
                    <div className="text-sm text-gray-400">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-[#D5001C] to-[#B0001A] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            Ready to Transform Your Workforce?
          </h2>
          <p className="text-xl md:text-2xl text-red-100 mb-10 font-light leading-relaxed">
            Join thousands of businesses that trust ShiftLyst to manage their most valuable asset—their people.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/login">
              <button className="bg-white text-[#D5001C] px-12 py-4 rounded-2xl text-lg font-bold hover:bg-gray-50 transition-all duration-500 shadow-2xl hover:shadow-3xl transform hover:scale-105 group">
                Start Free Trial
                <span className="ml-2 group-hover:translate-x-1 transition-transform duration-200">→</span>
              </button>
            </Link>
            <button className="text-white border-2 border-white/30 px-8 py-4 rounded-2xl font-medium hover:bg-white/10 transition-all duration-300">
              Schedule Demo
            </button>
          </div>
          <p className="text-red-200 text-sm mt-6 font-light">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center mb-6">
                <ShiftLystLogo size={40} className="mr-3" />
                <h3 className="text-xl font-black text-white">ShiftLyst</h3>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                The modern platform for effortless shift management. Built for scale, designed for efficiency.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-400 font-light">
              &copy; {new Date().getFullYear()} ShiftLyst. All rights reserved. | Privacy Policy | Terms of Service
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
