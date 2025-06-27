'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
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
  const [currentUser, setCurrentUser] = useState<any>(null)

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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 to-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg flex items-center justify-center">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Available Shifts
              </h1>
              <p className="text-gray-400 text-sm">Find and claim your next shift</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-red-300 px-6 py-3 rounded-xl hover:bg-red-500/30 transition-all duration-300"
          >
            Logout
          </button>
        </div>

        {/* Available Shifts */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">💼</span>
            </div>
            Open Shifts
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          )}

          {!loading && shifts.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📋</span>
              </div>
              <p className="text-gray-400">No open shifts available</p>
              <p className="text-gray-500 text-sm mt-1">Check back later for new opportunities</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 mb-6">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="grid gap-6">
            {shifts.map(shift => (
              <div
                key={shift.id}
                className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <span>📅</span>
                      <span className="font-medium">{shift.date}</span>
                      <span>•</span>
                      <span>{shift.startTime} - {shift.endTime}</span>
                    </div>
                    {shift.notes && (
                      <p className="text-gray-600 text-sm flex items-start gap-2">
                        <span className="mt-1">📝</span>
                        <span>{shift.notes}</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    {/* Pay Display */}
                    <div className="text-right">
                      <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
                        ${shift.payRate.toFixed(2)}/hr{shift.includesTips ? ' + tips' : ''}
                      </div>
                      {(shift.bonusAvailable || shift.overtimePay) && (
                        <div className="flex gap-1 justify-end">
                          {shift.bonusAvailable && (
                            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              💰 Bonus
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-gradient-to-r from-purple-400 to-pink-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              ⏰ OT
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Accept Button */}
                    <button
                      onClick={() => handleAcceptShift(shift.id)}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                    >
                      Accept Shift
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Shifts Section */}
        <div className="mt-8 backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">📅</span>
            </div>
            My Shifts
          </h2>
          
          {myShifts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">🎯</span>
              </div>
              <p className="text-gray-400">No accepted shifts yet</p>
              <p className="text-gray-500 text-sm mt-1">Accept a shift above to see it here</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {myShifts.map(shift => (
                <div
                  key={shift.id}
                  className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <span>📅</span>
                        <span className="font-medium">{shift.date}</span>
                        <span>•</span>
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                      {shift.notes && (
                        <p className="text-gray-600 text-sm flex items-start gap-2">
                          <span className="mt-1">📝</span>
                          <span>{shift.notes}</span>
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      {/* Pay Display */}
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
                          ${shift.payRate.toFixed(2)}/hr{shift.includesTips ? ' + tips' : ''}
                        </div>
                        {(shift.bonusAvailable || shift.overtimePay) && (
                          <div className="flex gap-1 justify-end">
                            {shift.bonusAvailable && (
                              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                                💰 Bonus
                              </span>
                            )}
                            {shift.overtimePay && (
                              <span className="bg-gradient-to-r from-purple-400 to-pink-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                                ⏰ OT
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Status Badge */}
                      <div>
                        {shift.status === 'pending' && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            🟡 Pending Confirmation
                          </span>
                        )}
                        {shift.status === 'confirmed' && (
                          <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            🟢 Confirmed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
} 