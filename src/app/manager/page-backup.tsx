// 'use client'

// import { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, Timestamp, getDocs } from 'firebase/firestore'
// import { db, auth } from '../lib/firebase'
// import { useAuth } from '../contexts/AuthContext'

// interface Shift {
//   id: string
//   role: string
//   date: string
//   startTime: string
//   endTime: string
//   payRate: number
//   includesTips: boolean
//   bonusAvailable: boolean
//   overtimePay: boolean
//   hidePay: boolean
//   notes: string
//   status: 'open' | 'pending' | 'confirmed'
//   assignedTo?: string
//   slots: number
//   filledSlots: number
//   assignedStaff: string[]
//   createdAt: Timestamp
// }

// function formatTime(time: string): string {
//   const [hours, minutes] = time.split(':')
//   const hour = parseInt(hours)
//   const ampm = hour >= 12 ? 'PM' : 'AM'
//   const displayHour = hour % 12 || 12
//   return `${displayHour}:${minutes} ${ampm}`
// }

// function formatDate(dateString: string): string {
//   const date = new Date(dateString)
//   return date.toLocaleDateString('en-US', { 
//     weekday: 'long', 
//     year: 'numeric', 
//     month: 'long', 
//     day: 'numeric' 
//   })
// }

// export default function ManagerDashboardPage() {
//   const { user, loading } = useAuth()
//   const router = useRouter()
//   const [shifts, setShifts] = useState<Shift[]>([])
//   const [dataLoading, setDataLoading] = useState(true)
//   const [error, setError] = useState('')

//   // Form state
//   const [role, setRole] = useState('')
//   const [date, setDate] = useState('')
//   const [startTime, setStartTime] = useState('')
//   const [endTime, setEndTime] = useState('')
//   const [payRate, setPayRate] = useState(18)
//   const [includesTips, setIncludesTips] = useState(false)
//   const [bonusAvailable, setBonusAvailable] = useState(false)
//   const [overtimePay, setOvertimePay] = useState(false)
//   const [hidePay, setHidePay] = useState(false)
//   const [notes, setNotes] = useState('')
//   const [slots, setSlots] = useState(1)

//   const roles = [
//     'Bartender',
//     'Server',
//     'Host/Hostess',
//     'Kitchen Staff',
//     'Busser',
//     'Barback',
//     'Manager',
//     'Security'
//   ]

//   useEffect(() => {
//     console.log('=== MANAGER PAGE MOUNTED ===')
//     console.log('Auth loading:', loading, 'User:', user ? `logged in: ${user.uid}` : 'not logged in')
    
//     // Wait for auth to be determined
//     if (loading) {
//       console.log('Waiting for auth to be determined...')
//       return
//     }
    
//     // Check if user is authenticated
//     if (!user) {
//       console.log('No user, redirecting to login')
//       router.push('/')
//       return
//     }
    
//     console.log('User authenticated, setting up Firebase listener...')
    
//     let retryCount = 0
//     const maxRetries = 3
//     let unsubscribeShifts: (() => void) | null = null
    
//     const setupFirestoreListener = () => {
//       console.log('=== SETTING UP FIRESTORE LISTENER ===')
      
//       try {
//         // Test database connection first
//         console.log('Testing database connection...')
//         console.log('Database instance:', db)
//         console.log('Database app:', db.app)
        
//         // Create the query
//         const q = query(
//           collection(db, 'shifts'),
//           orderBy('createdAt', 'desc')
//         )
        
//         console.log('=== FIRESTORE QUERY DEBUG ===')
//         console.log('Query path: shifts collection')
//         console.log('User ID:', user?.uid)
//         console.log('Auth state:', auth.currentUser?.uid)
//         console.log('Setting up listener...')
//         console.log('Query object:', q)
        
//         // Test: Try to get a simple collection reference
//         const testCollection = collection(db, 'shifts')
//         console.log('Test collection reference:', testCollection.path)
        
//         // Test: Try to get a document to see if we have access
//         console.log('Testing document access...')
        
//         // Test one-time read to see if we have access
//         console.log('Starting one-time read test...')
//         try {
//           const testPromise = getDocs(collection(db, 'shifts'))
//           console.log('getDocs promise created:', !!testPromise)
          
//           // Add timeout to detect hanging requests
//           const timeoutPromise = new Promise((_, reject) => {
//             setTimeout(() => reject(new Error('getDocs timeout after 10 seconds')), 10000)
//           })
          
//           Promise.race([testPromise, timeoutPromise])
//             .then((testSnapshot: any) => {
//               console.log('=== ONE-TIME READ TEST ===')
//               console.log('Test snapshot size:', testSnapshot.size)
//               console.log('Test snapshot empty:', testSnapshot.empty)
//               console.log('Test snapshot metadata:', testSnapshot.metadata)
//               console.log('Access test successful')
//             })
//             .catch((testError) => {
//               console.error('=== ACCESS TEST FAILED ===')
//               console.error('Test error:', testError)
//               console.error('This indicates a permissions or connection issue')
//             })
          
//           console.log('One-time read test initiated')
//         } catch (setupError) {
//           console.error('=== SETUP ERROR DURING GETDOCS ===')
//           console.error('Error setting up getDocs test:', setupError)
//         }
        
//         unsubscribeShifts = onSnapshot(
//           q,
//           snapshot => {
//             console.log('=== SNAPSHOT CALLBACK TRIGGERED ===')
//             console.log(`Firebase snapshot received: ${snapshot.size} documents`)
//             console.log('Snapshot empty:', snapshot.empty)
//             console.log('Snapshot metadata:', snapshot.metadata)
//             console.log('Snapshot fromCache:', snapshot.metadata.fromCache)
//             console.log('Snapshot hasPendingWrites:', snapshot.metadata.hasPendingWrites)
            
//             if (snapshot.empty) {
//               console.log('=== NO DOCUMENTS FOUND ===')
//               console.log('This could be due to:')
//               console.log('1. Security rules blocking access')
//               console.log('2. Collection is empty')
//               console.log('3. Query path is wrong')
//               console.log('4. User permissions issue')
//             }
            
//             const shiftsData: Shift[] = []
            
//             snapshot.forEach(doc => {
//               const data = doc.data()
//               console.log(`Processing shift: ${doc.id}`, data)
              
//               // Handle missing fields gracefully for existing data
//               const shiftData: Shift = {
//                 id: doc.id,
//                 role: data.role || '',
//                 date: data.date || '',
//                 startTime: data.startTime || '',
//                 endTime: data.endTime || '',
//                 payRate: data.payRate || 0,
//                 includesTips: data.includesTips || false,
//                 bonusAvailable: data.bonusAvailable || false,
//                 overtimePay: data.overtimePay || false,
//                 hidePay: data.hidePay || false,
//                 notes: data.notes || '',
//                 status: data.status || 'open',
//                 assignedTo: data.assignedTo || undefined,
//                 slots: data.slots || 1,
//                 filledSlots: data.filledSlots || 0,
//                 assignedStaff: data.assignedStaff || [],
//                 createdAt: data.createdAt || Timestamp.now(),
//               }
              
//               shiftsData.push(shiftData)
//             })
            
//             console.log(`Setting ${shiftsData.length} shifts to state`)
//             setShifts(shiftsData)
//             setDataLoading(false)
//             console.log('Loading set to false, shifts should be visible now')
//           },
//           err => {
//             console.error('=== FIRESTORE ERROR ===')
//             console.error('Error code:', err.code)
//             console.error('Error message:', err.message)
//             console.error('Error details:', err)
//             console.error('Current user:', user?.uid)
//             console.error('Auth state:', auth.currentUser)
            
//             // Retry logic for network errors
//             if (retryCount < maxRetries && (err.code === 'unavailable' || err.code === 'deadline-exceeded' || err.message.includes('400'))) {
//               retryCount++
//               console.log(`Retrying Firestore connection (attempt ${retryCount}/${maxRetries})...`)
//               setTimeout(() => {
//                 setupFirestoreListener()
//               }, 1000 * retryCount) // Exponential backoff
//               return
//             }
            
//             setError(`Firestore error: ${err.code} - ${err.message}`)
//             setDataLoading(false)
//           }
//         )
        
//         console.log('=== LISTENER SETUP COMPLETE ===')
//         console.log('Unsubscribe function created:', !!unsubscribeShifts)
        
//       } catch (error) {
//         console.error('=== SETUP ERROR ===')
//         console.error('Error during listener setup:', error)
//         setError(`Setup error: ${error}`)
//         setDataLoading(false)
//       }
//     }
    
//     setupFirestoreListener()

//     return () => {
//       console.log('=== CLEANUP TRIGGERED ===')
//       console.log('Cleaning up Firebase listener')
//       console.log('Unsubscribe function exists:', !!unsubscribeShifts)
//       if (unsubscribeShifts) {
//         console.log('Calling unsubscribe function...')
//         unsubscribeShifts()
//         console.log('Unsubscribe function called')
//       }
//     }
//   }, [loading, user, router])

//   // Monitor shifts state changes
//   useEffect(() => {
//     console.log(`Shifts state changed: ${shifts.length} shifts`)
//     if (shifts.length > 0) {
//       console.log('Shifts in state:', shifts.map(s => `${s.role} on ${s.date}`))
//     }
//   }, [shifts])

//   // Monitor loading state changes
//   useEffect(() => {
//     console.log(`Loading state changed: ${dataLoading}`)
//   }, [dataLoading])

//   async function handleAddShift(e: React.FormEvent) {
//     e.preventDefault()
//     setError('')
//     if (!role || !date || !startTime || !endTime) {
//       setError('Please fill out all required fields')
//       return
//     }

//     try {
//       await addDoc(collection(db, 'shifts'), {
//         role,
//         date,
//         startTime,
//         endTime,
//         payRate,
//         includesTips,
//         bonusAvailable,
//         overtimePay,
//         hidePay,
//         notes,
//         slots,
//         filledSlots: 0,
//         assignedStaff: [],
//         status: 'open',
//         createdAt: Timestamp.now(),
//       })
//       setRole('')
//       setDate('')
//       setStartTime('')
//       setEndTime('')
//       setPayRate(18)
//       setIncludesTips(false)
//       setBonusAvailable(false)
//       setOvertimePay(false)
//       setHidePay(false)
//       setNotes('')
//       setSlots(1)
//     } catch (error) {
//       console.error('Error adding shift:', error)
//       setError('Failed to add shift')
//     }
//   }

//   async function handleDeleteShift(shiftId: string) {
//     try {
//       await deleteDoc(doc(db, 'shifts', shiftId))
//     } catch (error) {
//       console.error('Error deleting shift:', error)
//       setError('Failed to delete shift')
//     }
//   }

//   async function handleLogout() {
//     try {
//       await auth.signOut()
//       router.push('/')
//     } catch (error) {
//       console.error('Error signing out:', error)
//     }
//   }

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
//       <div className="max-w-4xl mx-auto">
//         <div className="flex justify-between items-center mb-8">
//           <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
//           <button
//             onClick={handleLogout}
//             className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
//           >
//             Logout
//           </button>
//         </div>

//         {error && (
//           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
//             {error}
//           </div>
//         )}

//         <div className="grid md:grid-cols-2 gap-8">
//           {/* Add Shift Form */}
//           <div className="bg-white rounded-lg p-6 shadow-lg">
//             <h2 className="text-xl font-bold mb-4">Add New Shift</h2>
            
//             <form onSubmit={handleAddShift} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-bold mb-2">Role *</label>
//                 <select
//                   value={role}
//                   onChange={(e) => setRole(e.target.value)}
//                   className="w-full border rounded px-3 py-2"
//                   required
//                 >
//                   <option value="">Select a role</option>
//                   {roles.map((roleOption) => (
//                     <option key={roleOption} value={roleOption}>
//                       {roleOption}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-bold mb-2">Date *</label>
//                 <input
//                   type="date"
//                   value={date}
//                   onChange={(e) => setDate(e.target.value)}
//                   className="w-full border rounded px-3 py-2"
//                   required
//                 />
//               </div>

//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-sm font-bold mb-2">Start Time *</label>
//                   <input
//                     type="time"
//                     value={startTime}
//                     onChange={(e) => setStartTime(e.target.value)}
//                     className="w-full border rounded px-3 py-2"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-bold mb-2">End Time *</label>
//                   <input
//                     type="time"
//                     value={endTime}
//                     onChange={(e) => setEndTime(e.target.value)}
//                     className="w-full border rounded px-3 py-2"
//                     required
//                   />
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-bold mb-2">Pay Rate ($/hr)</label>
//                 <input
//                   type="number"
//                   value={payRate}
//                   onChange={(e) => setPayRate(Number(e.target.value))}
//                   min="0"
//                   step="0.01"
//                   className="w-full border rounded px-3 py-2"
//                 />
//               </div>

//               <button
//                 type="submit"
//                 className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-bold py-2 px-4 rounded"
//               >
//                 Add Shift
//               </button>
//             </form>
//           </div>

//           {/* Shifts List */}
//           <div className="bg-white rounded-lg p-6 shadow-lg">
//             <h2 className="text-xl font-bold mb-4">All Shifts</h2>
            
//             {dataLoading ? (
//               <div className="flex items-center justify-center py-8">
//                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5001C]"></div>
//               </div>
//             ) : shifts.length === 0 ? (
//               <div className="text-center py-8 text-gray-500">
//                 <p>No shifts yet</p>
//                 <p>Add your first shift using the form on the left</p>
//               </div>
//             ) : (
//               <div className="space-y-4">
//                 {shifts.map((shift) => (
//                   <div key={shift.id} className="border rounded-lg p-4">
//                     <div className="flex justify-between items-start">
//                       <div>
//                         <h3 className="font-bold text-lg">{shift.role}</h3>
//                         <p className="text-gray-600">{formatDate(shift.date)}</p>
//                         <p className="text-gray-600">
//                           {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
//                         </p>
//                         <p className="text-gray-600">${shift.payRate}/hr</p>
//                       </div>
//                       <button
//                         onClick={() => handleDeleteShift(shift.id)}
//                         className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
//                       >
//                         Delete
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }
