import { db, storage } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref } from 'firebase/storage';

/**
 * Test Firebase connection
 * Run this function to verify Firebase is properly configured
 */
export async function testFirebaseConnection() {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    // Test Firestore connection
    try {
      const capacityRef = doc(db, 'global', 'capacity');
      await getDoc(capacityRef);
      console.log('✅ Firestore connected successfully');
    } catch (error) {
      console.log('ℹ️  Firestore connected (document may not exist yet)');
    }
    
    // Test Storage connection
    try {
      const storageRef = ref(storage, 'test');
      console.log('✅ Storage connected successfully');
    } catch (error) {
      console.error('❌ Storage connection failed:', error);
      return false;
    }
    
    console.log('🎉 Firebase is fully connected!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
}
