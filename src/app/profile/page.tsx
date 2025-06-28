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
                My Profile
              </h1>
              <p className="text-gray-300 text-xl font-light tracking-wide mb-1">Track your performance and achievements</p>
              <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Performance Analytics • Achievement Tracking</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02]"
          >
            Back
          </button>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-2 shadow-2xl mb-8">
          <div className="flex gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'badges', label: 'Badges', icon: '🏆' },
              { id: 'history', label: 'History', icon: '📅' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-[#D5001C]'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Enhanced Content */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
          {/* Subtle form glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20 relative z-10">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="relative z-10">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Enhanced Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-200/50 rounded-2xl p-6 text-center backdrop-blur-sm">
                      <div className="text-3xl mb-2">📊</div>
                      <div className="text-2xl font-bold text-blue-600">{stats.totalShifts}</div>
                      <div className="text-sm font-medium text-gray-600">Total Shifts</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-2 border-green-200/50 rounded-2xl p-6 text-center backdrop-blur-sm">
                      <div className="text-3xl mb-2">✅</div>
                      <div className="text-2xl font-bold text-green-600">{stats.completedShifts}</div>
                      <div className="text-sm font-medium text-gray-600">Completed</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-2 border-yellow-200/50 rounded-2xl p-6 text-center backdrop-blur-sm">
                      <div className="text-3xl mb-2">💰</div>
                      <div className="text-2xl font-bold text-yellow-600">${stats.totalEarnings.toFixed(0)}</div>
                      <div className="text-sm font-medium text-gray-600">Total Earnings</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-200/50 rounded-2xl p-6 text-center backdrop-blur-sm">
                      <div className="text-3xl mb-2">⭐</div>
                      <div className="text-2xl font-bold text-purple-600">{stats.averageRating.toFixed(1)}</div>
                      <div className="text-sm font-medium text-gray-600">Avg Rating</div>
                    </div>
                  </div>

                  {/* Enhanced Reliability Score */}
                  <div className="bg-gradient-to-br from-gray-50/80 to-gray-100/80 border-2 border-gray-200 rounded-2xl p-8 backdrop-blur-sm">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg font-bold">🎯</span>
                      </div>
                      Reliability Score
                    </h3>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-gray-200 flex items-center justify-center">
                          <div 
                            className="w-20 h-20 rounded-full bg-gradient-to-r from-[#D5001C] to-[#B0001A] flex items-center justify-center text-white font-bold text-lg"
                            style={{
                              background: `conic-gradient(from 0deg, ${getReliabilityColor(stats.reliabilityScore)}, ${getReliabilityColor(stats.reliabilityScore)} ${stats.reliabilityScore * 3.6}deg, #e5e7eb ${stats.reliabilityScore * 3.6}deg, #e5e7eb 360deg)`
                            }}
                          >
                            {stats.reliabilityScore.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">{getReliabilityLabel(stats.reliabilityScore)}</div>
                        <div className="text-gray-600 font-medium">Based on {stats.totalShifts} shifts completed</div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Badges Preview */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg font-bold">🏆</span>
                      </div>
                      Recent Achievements
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {earnedBadges.slice(0, 4).map((badge) => (
                        <div key={badge.id} className="bg-gradient-to-br from-gray-50/80 to-gray-100/80 border-2 border-gray-200 rounded-2xl p-4 text-center backdrop-blur-sm hover:border-[#D5001C]/30 transition-all duration-300 group">
                          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{badge.icon}</div>
                          <div className="font-bold text-gray-900 mb-1">{badge.name}</div>
                          <div className="text-xs text-gray-600">{badge.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'badges' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-bold">🏆</span>
                    </div>
                    All Badges
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableBadges.map((badge) => {
                      const isEarned = earnedBadges.some(earned => earned.id === badge.id)
                      return (
                        <div key={badge.id} className={`border-2 rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 group ${
                          isEarned 
                            ? 'bg-gradient-to-br from-gray-50/80 to-gray-100/80 border-[#D5001C]/30 hover:border-[#D5001C]/50' 
                            : 'bg-gray-50/50 border-gray-200 opacity-60'
                        }`}>
                          <div className="text-center">
                            <div className={`text-4xl mb-3 group-hover:scale-110 transition-transform duration-300 ${
                              isEarned ? '' : 'grayscale'
                            }`}>
                              {badge.icon}
                            </div>
                            <div className={`font-bold text-lg mb-2 ${
                              isEarned ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {badge.name}
                            </div>
                            <div className={`text-sm ${
                              isEarned ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {badge.description}
                            </div>
                            {isEarned && (
                              <div className="mt-3">
                                <span className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white text-xs font-bold px-3 py-1 rounded-full">
                                  Earned
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

              {activeTab === 'history' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-bold">📅</span>
                    </div>
                    Shift History
                  </h3>
                  <div className="space-y-4">
                    {shifts.map((shift) => (
                      <div key={shift.id} className="bg-gray-50/80 backdrop-blur-sm border-2 border-gray-200 rounded-2xl p-6 hover:border-[#D5001C]/30 transition-all duration-300 group">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">{shift.role}</h4>
                            <div className="flex items-center gap-6 text-gray-600 mb-2">
                              <span className="flex items-center gap-2">
                                <span>📅</span>
                                <span className="font-bold">{shift.date}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span>⏰</span>
                                <span className="font-bold">{shift.startTime} - {shift.endTime}</span>
                              </span>
                            </div>
                            {shift.notes && (
                              <p className="text-gray-600 text-sm bg-white/50 rounded-xl p-3">
                                📝 {shift.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white text-sm font-bold px-3 py-1 rounded-full">
                              ${shift.payRate}/hr
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                              shift.status === 'completed' 
                                ? 'bg-green-100/80 text-green-700 border-green-200' 
                                : shift.status === 'pending'
                                ? 'bg-yellow-100/80 text-yellow-700 border-yellow-200'
                                : 'bg-gray-100/80 text-gray-700 border-gray-200'
                            }`}>
                              {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                            </div>
                            {shift.rating && (
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-500">⭐</span>
                                <span className="text-sm font-bold text-gray-700">{shift.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
} 