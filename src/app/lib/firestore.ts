import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore'
import { db } from './firebase'
import { User } from './types'

// Create or update user profile
export async function createUserProfile(userId: string, userData: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    const userDoc = {
      ...userData,
      id: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reliabilityScore: userData.reliabilityScore || 100,
      totalShifts: userData.totalShifts || 0,
      completedShifts: userData.completedShifts || 0,
      noShows: userData.noShows || 0,
      averageRating: userData.averageRating || 0,
      badges: userData.badges || []
    }
    
    await setDoc(userRef, userDoc, { merge: true })
    console.log('User profile created/updated successfully')
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}

// Get user profile by ID
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      const data = userSnap.data()
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        reliabilityScore: data.reliabilityScore || 100,
        totalShifts: data.totalShifts || 0,
        completedShifts: data.completedShifts || 0,
        noShows: data.noShows || 0,
        averageRating: data.averageRating || 0,
        badges: data.badges || [],
        createdAt: data.createdAt?.toDate() || new Date()
      } as User
    } else {
      console.log('No user profile found for:', userId)
      return null
    }
  } catch (error) {
    console.error('Error getting user profile:', error)
    throw error
  }
}

// Update user profile
export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId)
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
    console.log('User profile updated successfully')
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error
  }
}

// Get all users (for admin purposes)
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef)
    const querySnapshot = await getDocs(q)
    
    const users: User[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      users.push({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        reliabilityScore: data.reliabilityScore || 100,
        totalShifts: data.totalShifts || 0,
        completedShifts: data.completedShifts || 0,
        noShows: data.noShows || 0,
        averageRating: data.averageRating || 0,
        badges: data.badges || [],
        createdAt: data.createdAt?.toDate() || new Date()
      } as User)
    })
    
    return users
  } catch (error) {
    console.error('Error getting all users:', error)
    throw error
  }
}

// Get users by role
export async function getUsersByRole(role: 'manager' | 'staff'): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('role', '==', role))
    const querySnapshot = await getDocs(q)
    
    const users: User[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      users.push({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        reliabilityScore: data.reliabilityScore || 100,
        totalShifts: data.totalShifts || 0,
        completedShifts: data.completedShifts || 0,
        noShows: data.noShows || 0,
        averageRating: data.averageRating || 0,
        badges: data.badges || [],
        createdAt: data.createdAt?.toDate() || new Date()
      } as User)
    })
    
    return users
  } catch (error) {
    console.error('Error getting users by role:', error)
    throw error
  }
} 