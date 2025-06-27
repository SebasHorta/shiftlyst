'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
} from 'firebase/firestore'

interface Shift {
  id: string
  role: string
  date: string
  startTime: string
  endTime: string
  payRate: number
  includesTips: boolean
  bonusAvailable: boolean
  overtimePay: boolean
  hidePay: boolean
  notes: string
  status: 'open' | 'pending' | 'confirmed'
  assignedTo?: string
  slots: number
  filledSlots: number
  assignedStaff: string[] // Array of user IDs who have accepted slots
  createdAt: Timestamp
}

// Utility function to format time with AM/PM
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Utility function to format date
function formatDate(dateString: string): string {
  // Parse the date string and ensure it's treated as local time
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed in Date constructor
  
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }
  return date.toLocaleDateString('en-US', options)
}

// Utility function to check if two shifts overlap
function shiftsOverlap(shift1: Shift, shift2: Shift): boolean {
  // If different dates, no overlap
  if (shift1.date !== shift2.date) return false
  
  // Convert times to minutes for easier comparison
  const start1 = timeToMinutes(shift1.startTime)
  const end1 = timeToMinutes(shift1.endTime)
  const start2 = timeToMinutes(shift2.startTime)
  const end2 = timeToMinutes(shift2.endTime)
  
  // Check for overlap: one shift starts before another ends
  return (start1 < end2 && start2 < end1)
}

// Utility function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export default function StaffPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [sortBy, setSortBy] = useState<'closest' | 'date' | 'role'>('closest')

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        router.push('/')
        return
      }
      setCurrentUser(user)
    })

    // Listen for open shifts
    const openShiftsQuery = query(
      collection(db, 'shifts'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeOpenShifts = onSnapshot(
      openShiftsQuery,
      snapshot => {
        const shiftsData: Shift[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          // Handle missing fields gracefully for existing data
          const shiftData: Shift = {
            id: doc.id,
            role: data.role || '',
            date: data.date || '',
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            payRate: data.payRate || 0,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes || '',
            status: data.status || 'open',
            assignedTo: data.assignedTo || undefined,
            slots: data.slots || 1,
            filledSlots: data.filledSlots || 0,
            assignedStaff: data.assignedStaff || [],
            createdAt: data.createdAt || Timestamp.now(),
          }
          shiftsData.push(shiftData)
        })
        setShifts(shiftsData)
        setLoading(false)
      },
      err => {
        setError('Failed to load shifts')
        setLoading(false)
      }
    )

    // Listen for user's accepted shifts (pending and confirmed)
    const myShiftsQuery = query(
      collection(db, 'shifts'),
      where('assignedStaff', 'array-contains', currentUser?.uid || ''),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeMyShifts = onSnapshot(
      myShiftsQuery,
      snapshot => {
        const myShiftsData: Shift[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          myShiftsData.push({
            id: doc.id,
            role: data.role || '',
            date: data.date || '',
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            payRate: data.payRate || 0,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes || '',
            status: data.status || 'open',
            assignedTo: data.assignedTo || undefined,
            slots: data.slots || 1,
            filledSlots: data.filledSlots || 0,
            assignedStaff: data.assignedStaff || [],
            createdAt: data.createdAt || Timestamp.now(),
          })
        })
        setMyShifts(myShiftsData)
      },
      err => {
        console.error('Failed to load my shifts:', err)
      }
    )

    return () => {
      unsubscribeAuth()
      unsubscribeOpenShifts()
      unsubscribeMyShifts()
    }
  }, [router, currentUser?.uid])

  // Function to check if a shift conflicts with existing shifts
  function checkForConflicts(newShift: Shift): Shift | null {
    for (const existingShift of myShifts) {
      if (shiftsOverlap(newShift, existingShift)) {
        return existingShift
      }
    }
    return null
  }

  // Function to sort shifts based on selected criteria
  function sortShifts(shiftsToSort: Shift[]): Shift[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison

    // Helper function to parse date string consistently
    function parseDate(dateString: string): Date {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    }

    return [...shiftsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'closest':
          // Sort by closest upcoming date, then by start time
          const dateA = parseDate(a.date)
          const dateB = parseDate(b.date)
          const timeDiffA = dateA.getTime() - today.getTime()
          const timeDiffB = dateB.getTime() - today.getTime()
          
          // If both dates are in the past, sort by most recent first
          if (timeDiffA < 0 && timeDiffB < 0) {
            return timeDiffB - timeDiffA
          }
          // If one is in the past and one is in the future, future comes first
          if (timeDiffA < 0) return 1
          if (timeDiffB < 0) return -1
          // If both are in the future, closest comes first
          if (timeDiffA !== timeDiffB) {
            return timeDiffA - timeDiffB
          }
          // If same date, sort by start time
          return a.startTime.localeCompare(b.startTime)
          
        case 'date':
          // Sort by date, then by start time
          const dateCompare = a.date.localeCompare(b.date)
          return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime)
          
        case 'role':
          // Sort by role, then by date
          const roleCompare = a.role.localeCompare(b.role)
          return roleCompare !== 0 ? roleCompare : a.date.localeCompare(b.date)
          
        default:
          return 0
      }
    })
  }

  async function handleAcceptShift(shiftId: string) {
    if (!currentUser) return
    
    // Find the shift to accept
    const shiftToAccept = shifts.find(s => s.id === shiftId)
    if (!shiftToAccept) {
      setError('Shift not found')
      return
    }
    
    // Check if user has already accepted this shift
    const assignedStaff = shiftToAccept.assignedStaff || []
    if (assignedStaff.includes(currentUser.uid)) {
      setError('You have already accepted this shift.')
      return
    }
    
    // Check if slots are available
    const currentFilledSlots = shiftToAccept.filledSlots || 0
    const totalSlots = shiftToAccept.slots || 1
    if (currentFilledSlots >= totalSlots) {
      setError('Sorry, all positions for this shift have been filled.')
      return
    }
    
    // Check for conflicts
    const conflictingShift = checkForConflicts(shiftToAccept)
    if (conflictingShift) {
      setError(`Schedule conflict! You already have a ${conflictingShift.role} shift on ${formatDate(conflictingShift.date)} from ${formatTime(conflictingShift.startTime)} to ${formatTime(conflictingShift.endTime)}.`)
      return
    }
    
    try {
      const shiftRef = doc(db, 'shifts', shiftId)
      await updateDoc(shiftRef, {
        filledSlots: currentFilledSlots + 1,
        assignedStaff: [...assignedStaff, currentUser.uid],
        status: 'pending',
        assignedAt: Timestamp.now()
      })
      setError('') // Clear any previous errors
      setSuccess(`Successfully accepted ${shiftToAccept.role} shift!`)
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to accept shift')
    }
  }

  async function handleLogout() {
    await signOut(auth)
    router.push('/')
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

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Success Toast */}
        {success && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold transition-all duration-300 z-[100] animate-fade-in backdrop-blur-sm border border-green-400/20">
            {success}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold transition-all duration-300 z-[100] animate-fade-in backdrop-blur-sm border border-red-400/20">
            {error}
          </div>
        )}
        
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden group hover:shadow-[#D5001C]/25 transition-all duration-500">
              {/* Animated glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Logo design - stylized "S" with shift arrow */}
              <div className="relative z-10 flex items-center justify-center">
                <div className="relative">
                  <div className="text-white font-bold text-2xl tracking-tight group-hover:scale-110 transition-transform duration-300">S</div>
                  {/* Shift arrow overlay */}
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t border-r border-white transform rotate-45 group-hover:scale-110 transition-transform duration-300"></div>
                </div>
              </div>
              {/* Enhanced geometric accents */}
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors duration-300"></div>
              <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-white/15 rounded-full group-hover:bg-white/25 transition-colors duration-300"></div>
            </div>
            <div>
              <h1 className="text-5xl font-bold text-white mb-3 tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                ShiftLyst Staff
              </h1>
              <p className="text-gray-300 text-xl font-light tracking-wide mb-1">Find and claim your next shift</p>
              <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Premium Opportunities • Real-time Updates</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02]"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Enhanced Available Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle form glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">💼</span>
              </div>
              Available Shifts
            </h2>

            {/* Sort Controls */}
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Sort by:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'closest' | 'date' | 'role')}
                  className="bg-gray-50/80 border-2 border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                >
                  <option value="closest">Closest Upcoming</option>
                  <option value="date">Date</option>
                  <option value="role">Role</option>
                </select>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {shifts.length} shift{shifts.length !== 1 ? 's' : ''} available
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 relative z-10">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-gray-400 text-3xl">🔍</span>
                </div>
                <p className="text-gray-600 text-xl font-bold mb-2">No shifts available</p>
                <p className="text-gray-400 text-sm font-medium tracking-wide">Check back later for new opportunities</p>
              </div>
            ) : (
              <div className="space-y-6 relative z-10 max-h-96 overflow-y-auto pr-2">
                {sortShifts(shifts).map((shift) => {
                  const conflictingShift = checkForConflicts(shift)
                  const hasConflict = conflictingShift !== null
                  
                  return (
                    <div
                      key={shift.id}
                      className={`bg-gradient-to-br from-gray-50/90 to-white/90 backdrop-blur-sm border-2 rounded-3xl p-8 transition-all duration-300 group ${
                        hasConflict 
                          ? 'border-red-200/80 hover:border-red-300/80 bg-red-50/30' 
                          : 'border-gray-200/80 hover:border-[#D5001C]/40 hover:shadow-xl'
                      }`}
                    >
                      {/* Header with role and pay */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">
                            {shift.role}
                          </h3>
                          <div className="flex items-center gap-4 text-gray-600">
                            <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-semibold text-sm">
                                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-50/80 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="text-blue-700 font-semibold text-sm">
                                {shift.filledSlots || 0}/{shift.slots || 1} positions filled
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {!shift.hidePay && (
                          <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-4 py-2 rounded-xl shadow-lg">
                            <div className="text-xs font-medium opacity-90">Pay Rate</div>
                            <div className="text-lg font-bold">${shift.payRate.toFixed(2)}/hr</div>
                          </div>
                        )}
                      </div>

                      {/* Conflict warning */}
                      {hasConflict && (
                        <div className="bg-red-50/80 border-2 border-red-200 rounded-2xl p-4 mb-6">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                              <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Schedule Conflict</div>
                              <p className="text-red-700 text-sm font-medium">
                                You already have a {conflictingShift!.role} shift on {formatDate(conflictingShift!.date)} from {formatTime(conflictingShift!.startTime)} to {formatTime(conflictingShift!.endTime)}.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Benefits badges */}
                      {(shift.includesTips || shift.bonusAvailable || shift.overtimePay) && (
                        <div className="flex gap-2 mb-6">
                          {shift.includesTips && (
                            <span className="bg-green-100/80 text-green-700 text-xs font-bold px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                              <span>💰</span>
                              <span>Tips Included</span>
                            </span>
                          )}
                          {shift.bonusAvailable && (
                            <span className="bg-yellow-100/80 text-yellow-700 text-xs font-bold px-3 py-2 rounded-xl border border-yellow-200 flex items-center gap-1">
                              <span>🎁</span>
                              <span>Bonus Available</span>
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-purple-100/80 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1">
                              <span>⏰</span>
                              <span>Overtime Pay</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes section */}
                      {shift.notes && (
                        <div className="bg-white/70 rounded-2xl p-4 mb-6 border border-gray-100">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</div>
                              <p className="text-gray-700 font-medium">{shift.notes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleAcceptShift(shift.id)}
                          disabled={hasConflict || (shift.filledSlots || 0) >= (shift.slots || 1) || (shift.assignedStaff || []).includes(currentUser?.uid || '')}
                          className={`font-bold py-3 px-8 rounded-xl shadow-lg transition-all duration-300 text-sm ${
                            hasConflict || (shift.filledSlots || 0) >= (shift.slots || 1) || (shift.assignedStaff || []).includes(currentUser?.uid || '')
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white hover:shadow-xl transform hover:scale-[1.02]'
                          }`}
                        >
                          {hasConflict 
                            ? 'Schedule Conflict' 
                            : (shift.filledSlots || 0) >= (shift.slots || 1)
                            ? 'All Positions Filled'
                            : (shift.assignedStaff || []).includes(currentUser?.uid || '')
                            ? 'Already Accepted'
                            : 'Accept Shift'
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Enhanced My Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle form glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">📋</span>
              </div>
              My Shifts
            </h2>

            {myShifts.length === 0 ? (
              <div className="text-center py-12 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-gray-400 text-3xl">📅</span>
                </div>
                <p className="text-gray-600 text-xl font-bold mb-2">No shifts accepted yet</p>
                <p className="text-gray-400 text-sm font-medium tracking-wide">Accept a shift from the left to get started</p>
              </div>
            ) : (
              <div className="space-y-6 relative z-10">
                {myShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gradient-to-br from-gray-50/90 to-white/90 backdrop-blur-sm border-2 border-gray-200/80 rounded-3xl p-8 hover:border-[#D5001C]/40 hover:shadow-xl transition-all duration-300 group"
                  >
                    {/* Header with role and pay */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">
                          {shift.role}
                        </h3>
                        <div className="flex items-center gap-4 text-gray-600">
                          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-sm">
                              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {!shift.hidePay && (
                        <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-4 py-2 rounded-xl shadow-lg">
                          <div className="text-xs font-medium opacity-90">Pay Rate</div>
                          <div className="text-lg font-bold">${shift.payRate.toFixed(2)}/hr</div>
                        </div>
                      )}
                    </div>

                    {/* Benefits badges */}
                    {(shift.includesTips || shift.bonusAvailable || shift.overtimePay) && (
                      <div className="flex gap-2 mb-6">
                        {shift.includesTips && (
                          <span className="bg-green-100/80 text-green-700 text-xs font-bold px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                            <span>💰</span>
                            <span>Tips Included</span>
                          </span>
                        )}
                        {shift.bonusAvailable && (
                          <span className="bg-yellow-100/80 text-yellow-700 text-xs font-bold px-3 py-2 rounded-xl border border-yellow-200 flex items-center gap-1">
                            <span>🎁</span>
                            <span>Bonus Available</span>
                          </span>
                        )}
                        {shift.overtimePay && (
                          <span className="bg-purple-100/80 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1">
                            <span>⏰</span>
                            <span>Overtime Pay</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Notes section */}
                    {shift.notes && (
                      <div className="bg-white/70 rounded-2xl p-4 mb-6 border border-gray-100">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</div>
                            <p className="text-gray-700 font-medium">{shift.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="flex justify-end">
                      <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                        shift.status === 'pending' 
                          ? 'bg-yellow-100/80 text-yellow-700 border-yellow-200'
                          : 'bg-green-100/80 text-green-700 border-green-200'
                      }`}>
                        {shift.status === 'pending' ? '⏳ Pending Approval' : '✅ Confirmed'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
} 