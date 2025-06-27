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
  createdAt: Timestamp
}

export default function StaffPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

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
            hidePay: data.hidePay || false,
            notes: data.notes,
            status: data.status || 'open',
            assignedTo: data.assignedTo,
            createdAt: data.createdAt,
          })
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
      where('assignedTo', '==', currentUser?.uid || ''),
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
            role: data.role,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            payRate: data.payRate,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes,
            status: data.status || 'open',
            assignedTo: data.assignedTo,
            createdAt: data.createdAt,
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

  async function handleAcceptShift(shiftId: string) {
    if (!currentUser) return
    
    try {
      const shiftRef = doc(db, 'shifts', shiftId)
      await updateDoc(shiftRef, {
        status: 'pending',
        assignedTo: currentUser.uid,
        assignedAt: Timestamp.now()
      })
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
                ShiftLyst Staff
              </h1>
              <p className="text-gray-300 text-lg font-light tracking-wide">Find and claim your next shift</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-medium tracking-wide"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Available Shifts */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#D5001C] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">💼</span>
              </div>
              Open Shifts
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">📋</span>
                </div>
                <p className="text-gray-500 text-lg">No open shifts available</p>
                <p className="text-gray-400 text-sm mt-2">Check back later for new opportunities</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:border-[#D5001C]/30 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                        <div className="flex items-center gap-4 text-gray-600 mb-2">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="font-medium">{shift.date}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg">⏰</span>
                            <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                          </span>
                        </div>
                        {shift.notes && (
                          <p className="text-gray-600 text-sm flex items-start gap-2">
                            <span className="mt-1">📝</span>
                            <span>{shift.notes}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-3">
                        {!shift.hidePay && (
                          <div className="bg-[#D5001C] text-white text-sm font-bold px-4 py-2 rounded-full">
                            ${shift.payRate.toFixed(2)}/hr
                          </div>
                        )}
                        <div className="flex gap-2">
                          {shift.includesTips && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              💰 Tips
                            </span>
                          )}
                          {shift.bonusAvailable && (
                            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎁 Bonus
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏰ OT
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleAcceptShift(shift.id)}
                          className="bg-[#D5001C] hover:bg-[#B0001C] text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300 text-sm"
                        >
                          Accept Shift
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Shifts */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#D5001C] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">👤</span>
              </div>
              My Shifts
            </h2>

            {myShifts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">👤</span>
                </div>
                <p className="text-gray-500 text-lg">No shifts assigned yet</p>
                <p className="text-gray-400 text-sm mt-2">Accept shifts from the available list</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {myShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:border-[#D5001C]/30 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                        <div className="flex items-center gap-4 text-gray-600 mb-2">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="font-medium">{shift.date}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg">⏰</span>
                            <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                          </span>
                        </div>
                        {shift.notes && (
                          <p className="text-gray-600 text-sm flex items-start gap-2">
                            <span className="mt-1">📝</span>
                            <span>{shift.notes}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-3">
                        {!shift.hidePay && (
                          <div className="bg-[#D5001C] text-white text-sm font-bold px-4 py-2 rounded-full">
                            ${shift.payRate.toFixed(2)}/hr
                          </div>
                        )}
                        <div className="flex gap-2">
                          {shift.includesTips && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              💰 Tips
                            </span>
                          )}
                          {shift.bonusAvailable && (
                            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎁 Bonus
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏰ OT
                            </span>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          shift.status === 'open' 
                            ? 'bg-blue-100 text-blue-700' 
                            : shift.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                        </div>
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