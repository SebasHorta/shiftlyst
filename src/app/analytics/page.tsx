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
      <main className="min-h-screen bg-black p-6 relative overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black p-6 relative overflow-hidden">
      {/* Porsche-style background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[#D5001C] rounded-2xl shadow-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-tight">📊</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Analytics Dashboard
              </h1>
              <p className="text-gray-400 text-lg font-light tracking-wide">Real-time business insights</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/manager')}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-semibold tracking-wide"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="mb-12">
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 tracking-wide ${
                  timeRange === range
                    ? 'bg-[#D5001C] text-white shadow-lg'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 border-2 border-white/20'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Shifts */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📅</span>
              </div>
              <span className="text-2xl font-bold text-white">{analytics.totalShifts}</span>
            </div>
            <h3 className="text-gray-300 font-semibold mb-1">Total Shifts</h3>
            <p className="text-gray-400 text-sm">All time</p>
          </div>

          {/* Completed Shifts */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">✅</span>
              </div>
              <span className="text-2xl font-bold text-white">{analytics.completedShifts}</span>
            </div>
            <h3 className="text-gray-300 font-semibold mb-1">Completed</h3>
            <p className="text-gray-400 text-sm">{((analytics.completedShifts / analytics.totalShifts) * 100).toFixed(1)}% success rate</p>
          </div>

          {/* Labor Cost */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">💰</span>
              </div>
              <span className="text-2xl font-bold text-white">${analytics.totalLaborCost.toFixed(0)}</span>
            </div>
            <h3 className="text-gray-300 font-semibold mb-1">Total Labor Cost</h3>
            <p className="text-gray-400 text-sm">Completed shifts only</p>
          </div>

          {/* Reliability Score */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⭐</span>
              </div>
              <span className="text-2xl font-bold text-white">{analytics.reliabilityScore.toFixed(1)}%</span>
            </div>
            <h3 className="text-gray-300 font-semibold mb-1">Reliability Score</h3>
            <p className="text-gray-400 text-sm">Team performance</p>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Shift Status Breakdown */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
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
                    <span className="text-gray-300 font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{item.count}</span>
                    <span className="text-gray-400 text-sm">
                      ({((item.count / analytics.totalShifts) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pay Insights */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">💰</span>
              </div>
              Pay Insights
            </h2>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Average Pay Rate</span>
                <span className="text-white font-bold">${analytics.averagePayRate.toFixed(2)}/hr</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Shifts with Tips</span>
                <span className="text-white font-bold">{analytics.shiftsWithTips}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Urgent Shifts</span>
                <span className="text-white font-bold">{analytics.urgentShifts}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">No Shows</span>
                <span className="text-red-400 font-bold">{analytics.noShows}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">📈</span>
            </div>
            Recent Activity
          </h2>
          
          <div className="space-y-4">
            {shifts.slice(0, 5).map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 bg-gradient-to-r ${getStatusColor(shift.status)} rounded-full`}></div>
                  <div>
                    <p className="text-white font-medium">{shift.role}</p>
                    <p className="text-gray-400 text-sm">{shift.date} • {shift.startTime} - {shift.endTime}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">${shift.payRate}/hr</p>
                  <p className="text-gray-400 text-sm capitalize">{shift.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
} 