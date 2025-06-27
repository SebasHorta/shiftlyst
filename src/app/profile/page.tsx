'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { Shift, Badge } from '../lib/types'

export default function ProfilePage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'history'>('overview')

  // Predefined badges
  const availableBadges: Badge[] = [
    {
      id: 'first_shift',
      name: 'First Shift',
      description: 'Complete your first shift',
      icon: '🎯',
      color: 'from-blue-400 to-blue-600',
      unlockedAt: new Date(),
    },
    {
      id: 'reliable_worker',
      name: 'Reliable Worker',
      description: 'Complete 10 shifts without any no-shows',
      icon: '⭐',
      color: 'from-yellow-400 to-yellow-600',
      unlockedAt: new Date(),
    },
    {
      id: 'weekend_warrior',
      name: 'Weekend Warrior',
      description: 'Work 5 weekend shifts',
      icon: '🌅',
      color: 'from-orange-400 to-orange-600',
      unlockedAt: new Date(),
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Complete 5 morning shifts (before 9 AM)',
      icon: '🐦',
      color: 'from-green-400 to-green-600',
      unlockedAt: new Date(),
    },
    {
      id: 'night_owl',
      name: 'Night Owl',
      description: 'Complete 5 late night shifts (after 10 PM)',
      icon: '🦉',
      color: 'from-purple-400 to-purple-600',
      unlockedAt: new Date(),
    },
    {
      id: 'high_earner',
      name: 'High Earner',
      description: 'Earn over $500 in a single week',
      icon: '💰',
      color: 'from-green-400 to-green-600',
      unlockedAt: new Date(),
    },
    {
      id: 'team_player',
      name: 'Team Player',
      description: 'Work 3 different roles',
      icon: '🤝',
      color: 'from-blue-400 to-purple-600',
      unlockedAt: new Date(),
    },
    {
      id: 'perfect_attendance',
      name: 'Perfect Attendance',
      description: 'Complete 20 shifts without any no-shows',
      icon: '🏆',
      color: 'from-yellow-400 to-orange-600',
      unlockedAt: new Date(),
    },
  ]

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/')
        return
      }

      // Get user's shifts
      const shiftsQuery = query(
        collection(db, 'shifts'),
        where('assignedTo', '==', firebaseUser.uid),
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
        unsubscribeShifts()
      }
    })

    return () => {
      unsubscribeAuth()
    }
  }, [router])

  // Calculate user stats
  const stats = {
    totalShifts: shifts.length,
    completedShifts: shifts.filter(s => s.status === 'completed').length,
    noShows: shifts.filter(s => s.status === 'no-show').length,
    totalEarnings: shifts
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => {
        const hours = calculateHours(s.startTime, s.endTime)
        return sum + (s.payRate * hours)
      }, 0),
    averageRating: shifts
      .filter(s => s.rating)
      .reduce((sum, s) => sum + (s.rating || 0), 0) / shifts.filter(s => s.rating).length || 0,
    reliabilityScore: shifts.length > 0 
      ? ((shifts.filter(s => s.status === 'completed').length / shifts.length) * 100)
      : 100,
    weekendShifts: shifts.filter(s => {
      const day = new Date(s.date).getDay()
      return day === 0 || day === 6 // Sunday or Saturday
    }).length,
    morningShifts: shifts.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0])
      return hour < 9
    }).length,
    nightShifts: shifts.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0])
      return hour >= 22
    }).length,
  }

  function calculateHours(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  }

  // Calculate earned badges based on stats
  const earnedBadges = availableBadges.filter(badge => {
    switch (badge.id) {
      case 'first_shift':
        return stats.completedShifts >= 1
      case 'reliable_worker':
        return stats.completedShifts >= 10 && stats.noShows === 0
      case 'weekend_warrior':
        return stats.weekendShifts >= 5
      case 'early_bird':
        return stats.morningShifts >= 5
      case 'night_owl':
        return stats.nightShifts >= 5
      case 'perfect_attendance':
        return stats.completedShifts >= 20 && stats.noShows === 0
      default:
        return false
    }
  })

  function getReliabilityColor(score: number) {
    if (score >= 95) return 'from-green-400 to-green-600'
    if (score >= 85) return 'from-yellow-400 to-yellow-600'
    if (score >= 70) return 'from-orange-400 to-orange-600'
    return 'from-red-400 to-red-600'
  }

  function getReliabilityLabel(score: number) {
    if (score >= 95) return 'Excellent'
    if (score >= 85) return 'Good'
    if (score >= 70) return 'Fair'
    return 'Needs Improvement'
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
      {/* Porsche-style subtle background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl shadow-xl flex items-center justify-center relative overflow-hidden">
              {/* Logo design - stylized "S" with shift arrow */}
              <div className="relative z-10 flex items-center justify-center">
                <div className="relative">
                  <div className="text-white font-bold text-xl tracking-tight">S</div>
                  {/* Shift arrow overlay */}
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t border-r border-white transform rotate-45"></div>
                </div>
              </div>
              {/* Geometric accents */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
              <div className="absolute bottom-1 left-1 w-1 h-1 bg-white/15 rounded-full"></div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                ShiftLyst Profile
              </h1>
              <p className="text-gray-300 text-lg font-light tracking-wide">Track your performance and achievements</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/staff')}
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-medium tracking-wide"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-12">
          {(['overview', 'badges', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 rounded-xl font-medium transition-all duration-300 tracking-wide ${
                activeTab === tab
                  ? 'bg-[#D5001C] text-white shadow-md'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Reliability Score */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-r ${getReliabilityColor(stats.reliabilityScore)} rounded-xl flex items-center justify-center`}>
                    <span className="text-white text-xl">⭐</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{stats.reliabilityScore.toFixed(1)}%</span>
                </div>
                <h3 className="text-gray-700 font-semibold mb-1">Reliability Score</h3>
                <p className="text-gray-600 text-sm">{getReliabilityLabel(stats.reliabilityScore)}</p>
              </div>

              {/* Total Shifts */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">📅</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{stats.totalShifts}</span>
                </div>
                <h3 className="text-gray-700 font-semibold mb-1">Total Shifts</h3>
                <p className="text-gray-600 text-sm">{stats.completedShifts} completed</p>
              </div>

              {/* Total Earnings */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">💰</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">${stats.totalEarnings.toFixed(0)}</span>
                </div>
                <h3 className="text-gray-700 font-semibold mb-1">Total Earnings</h3>
                <p className="text-gray-600 text-sm">All time</p>
              </div>

              {/* Average Rating */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">⭐</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</span>
                </div>
                <h3 className="text-gray-700 font-semibold mb-1">Average Rating</h3>
                <p className="text-gray-600 text-sm">From managers</p>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  Performance Breakdown
                </h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Completed Shifts</span>
                    <span className="text-gray-900 font-bold">{stats.completedShifts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">No Shows</span>
                    <span className="text-red-600 font-bold">{stats.noShows}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Weekend Shifts</span>
                    <span className="text-gray-900 font-bold">{stats.weekendShifts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Morning Shifts</span>
                    <span className="text-gray-900 font-bold">{stats.morningShifts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Night Shifts</span>
                    <span className="text-gray-900 font-bold">{stats.nightShifts}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🏆</span>
                  </div>
                  Recent Achievements
                </h2>
                
                <div className="space-y-4">
                  {earnedBadges.slice(0, 3).map((badge) => (
                    <div key={badge.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className={`w-10 h-10 bg-gradient-to-r ${badge.color} rounded-lg flex items-center justify-center`}>
                        <span className="text-white text-lg">{badge.icon}</span>
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold">{badge.name}</p>
                        <p className="text-gray-600 text-sm">{badge.description}</p>
                      </div>
                    </div>
                  ))}
                  {earnedBadges.length === 0 && (
                    <p className="text-gray-500 text-center py-8">Complete shifts to earn achievements!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🏆</span>
              </div>
              Achievements & Badges
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableBadges.map((badge) => {
                const isEarned = earnedBadges.some(earned => earned.id === badge.id)
                return (
                  <div
                    key={badge.id}
                    className={`p-6 rounded-2xl border transition-all duration-300 ${
                      isEarned
                        ? 'bg-white border-gray-200'
                        : 'bg-gray-50 border-gray-200 opacity-50'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-16 h-16 bg-gradient-to-r ${badge.color} rounded-full flex items-center justify-center mx-auto mb-4 ${
                        !isEarned && 'grayscale'
                      }`}>
                        <span className="text-white text-2xl">{badge.icon}</span>
                      </div>
                      <h3 className={`font-bold text-lg mb-2 ${
                        isEarned ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {badge.name}
                      </h3>
                      <p className={`text-sm ${
                        isEarned ? 'text-gray-600' : 'text-gray-500'
                      }`}>
                        {badge.description}
                      </p>
                      {isEarned && (
                        <div className="mt-3">
                          <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            ✓ Earned
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📈</span>
              </div>
              Shift History
            </h2>
            
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      shift.status === 'completed' ? 'bg-green-400' :
                      shift.status === 'pending' ? 'bg-yellow-400' :
                      shift.status === 'no-show' ? 'bg-red-400' :
                      'bg-blue-400'
                    }`}></div>
                    <div>
                      <p className="text-gray-900 font-medium">{shift.role}</p>
                      <p className="text-gray-600 text-sm">{shift.date} • {shift.startTime} - {shift.endTime}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-900 font-bold">${shift.payRate}/hr</p>
                    <p className="text-gray-600 text-sm capitalize">{shift.status}</p>
                    {shift.rating && (
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-gray-900 text-sm">{shift.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {shifts.length === 0 && (
                <p className="text-gray-500 text-center py-8">No shifts completed yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
} 