'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { Shift } from '../lib/types'
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

export default function AnalyticsPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week')

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        router.push('/')
        return
      }
    })

    // Get all shifts for analytics
    const shiftsQuery = query(
      collection(db, 'shifts'),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeShifts = onSnapshot(shiftsQuery, snapshot => {
      const shiftsData: Shift[] = []
      snapshot.forEach(doc => {
        const data = doc.data()
        shiftsData.push({
          id: doc.id,
          role: data.role,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          payRate: data.payRate,
          includesTips: data.includesTips || false,
          bonusAvailable: data.bonusAvailable || false,
          overtimePay: data.overtimePay || false,
          urgent: data.urgent || false,
          dynamicPricing: data.dynamicPricing || false,
          notes: data.notes,
          status: data.status || 'open',
          assignedTo: data.assignedTo,
          assignedAt: data.assignedAt,
          checkedInAt: data.checkedInAt,
          completedAt: data.completedAt,
          rating: data.rating,
          feedback: data.feedback,
          createdAt: data.createdAt?.toDate() || new Date(),
          templateId: data.templateId,
        })
      })
      setShifts(shiftsData)
      setLoading(false)
    })

    return () => {
      unsubscribeAuth()
      unsubscribeShifts()
    }
  }, [router])

  // Calculate analytics
  const analytics = {
    totalShifts: shifts.length,
    completedShifts: shifts.filter(s => s.status === 'completed').length,
    pendingShifts: shifts.filter(s => s.status === 'pending').length,
    openShifts: shifts.filter(s => s.status === 'open').length,
    noShows: shifts.filter(s => s.status === 'no-show').length,
    totalLaborCost: shifts
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => {
        const hours = calculateHours(s.startTime, s.endTime)
        return sum + (s.payRate * hours)
      }, 0),
    averagePayRate: shifts.length > 0 
      ? shifts.reduce((sum, s) => sum + s.payRate, 0) / shifts.length 
      : 0,
    reliabilityScore: shifts.length > 0 
      ? ((shifts.filter(s => s.status === 'completed').length / shifts.length) * 100)
      : 100,
    urgentShifts: shifts.filter(s => s.urgent).length,
    shiftsWithTips: shifts.filter(s => s.includesTips).length,
  }

  function calculateHours(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'from-green-400 to-green-600'
      case 'pending': return 'from-yellow-400 to-yellow-600'
      case 'open': return 'from-blue-400 to-blue-600'
      case 'no-show': return 'from-red-400 to-red-600'
      default: return 'from-gray-400 to-gray-600'
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
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

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <ShiftLystLogo size={60} className="mr-0" />
            <div>
              <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
                Shift<span className="text-[#D5001C]">Lyst</span> Analytics
              </h1>
              <p className="text-gray-300 text-xl font-light tracking-wide mb-1">Real-time business insights</p>
              <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Performance Metrics • Business Intelligence</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/manager')}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02]"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Enhanced Time Range Selector */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-2 shadow-2xl mb-8">
          <div className="flex gap-2">
            {[
              { id: 'week', label: 'This Week', icon: '📅' },
              { id: 'month', label: 'This Month', icon: '📊' },
              { id: 'quarter', label: 'This Quarter', icon: '📈' }
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id as any)}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold transition-all duration-300 ${
                  timeRange === range.id
                    ? 'bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-[#D5001C]'
                }`}
              >
                <span className="text-lg">{range.icon}</span>
                <span>{range.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Enhanced Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📅</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">{analytics.totalShifts}</span>
              </div>
              <h3 className="text-gray-700 font-bold mb-1">Total Shifts</h3>
              <p className="text-gray-600 text-sm font-medium">All time</p>
            </div>
          </div>

          {/* Completed Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">✅</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">{analytics.completedShifts}</span>
              </div>
              <h3 className="text-gray-700 font-bold mb-1">Completed</h3>
              <p className="text-gray-600 text-sm font-medium">Successfully finished</p>
            </div>
          </div>

          {/* Total Labor Cost */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">💰</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">${analytics.totalLaborCost.toFixed(0)}</span>
              </div>
              <h3 className="text-gray-700 font-bold mb-1">Labor Cost</h3>
              <p className="text-gray-600 text-sm font-medium">Total paid out</p>
            </div>
          </div>

          {/* Reliability Score */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">⭐</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">{analytics.reliabilityScore.toFixed(0)}%</span>
              </div>
              <h3 className="text-gray-700 font-bold mb-1">Reliability</h3>
              <p className="text-gray-600 text-sm font-medium">Completion rate</p>
            </div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Shift Status Breakdown */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
              Shift Status Breakdown
            </h2>
            
            <div className="space-y-4">
              {[
                { status: 'completed', count: analytics.completedShifts, label: 'Completed' },
                { status: 'pending', count: analytics.pendingShifts, label: 'Pending' },
                { status: 'open', count: analytics.openShifts, label: 'Open' },
                { status: 'no-show', count: analytics.noShows, label: 'No Shows' },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 bg-gradient-to-r ${getStatusColor(item.status)} rounded-full`}></div>
                    <span className="text-gray-700 font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold">{item.count}</span>
                    <span className="text-gray-600 text-sm">
                      ({((item.count / analytics.totalShifts) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pay Insights */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">💰</span>
              </div>
              Pay Insights
            </h2>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Average Pay Rate</span>
                <span className="text-gray-900 font-bold">${analytics.averagePayRate.toFixed(2)}/hr</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Shifts with Tips</span>
                <span className="text-gray-900 font-bold">{analytics.shiftsWithTips}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Urgent Shifts</span>
                <span className="text-gray-900 font-bold">{analytics.urgentShifts}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">No Shows</span>
                <span className="text-red-600 font-bold">{analytics.noShows}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">📈</span>
            </div>
            Recent Activity
          </h2>
          
          <div className="space-y-4">
            {shifts.slice(0, 5).map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 bg-gradient-to-r ${getStatusColor(shift.status)} rounded-full`}></div>
                  <div>
                    <p className="text-gray-900 font-medium">{shift.role}</p>
                    <p className="text-gray-600 text-sm">{shift.date} • {shift.startTime} - {shift.endTime}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 font-bold">${shift.payRate}/hr</p>
                  <p className="text-gray-600 text-sm capitalize">{shift.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
} 