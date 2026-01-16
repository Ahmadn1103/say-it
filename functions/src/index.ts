import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * Cleanup Drop It images that are older than 15 minutes or from ended rounds
 * Runs every 5 minutes
 */
export const cleanupDropItImages = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const fifteenMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 15 * 60 * 1000)
    );

    try {
      // Get all rooms
      const roomsSnapshot = await db.collection('rooms').get();

      for (const roomDoc of roomsSnapshot.docs) {
        const roomCode = roomDoc.id;
        
        // Get rounds for this room
        const roundsSnapshot = await db
          .collection('rooms')
          .doc(roomCode)
          .collection('rounds')
          .where('mode', '==', 'drop')
          .get();

        for (const roundDoc of roundsSnapshot.docs) {
          const round = roundDoc.data();
          
          // Check if round is old or revealed
          const shouldDelete = 
            round.revealedAt !== null || 
            (round.submissions && Object.values(round.submissions).some((sub: any) => 
              sub.submittedAt && sub.submittedAt < fifteenMinutesAgo
            ));

          if (shouldDelete && round.submissions) {
            // Delete images from storage
            for (const submission of Object.values(round.submissions)) {
              const sub = submission as any;
              if (sub.isImage && sub.content) {
                try {
                  const imageUrl = sub.content;
                  const pathMatch = imageUrl.match(/drop-it%2F[^?]+/);
                  if (pathMatch) {
                    const decodedPath = decodeURIComponent(pathMatch[0]);
                    await storage.bucket().file(decodedPath).delete();
                    console.log(`Deleted image: ${decodedPath}`);
                  }
                } catch (error) {
                  console.error('Error deleting image:', error);
                }
              }
            }
          }
        }
      }

      console.log('Drop It image cleanup completed');
      return null;
    } catch (error) {
      console.error('Error in cleanupDropItImages:', error);
      return null;
    }
  });

/**
 * Cleanup inactive rooms older than 24 hours
 * Runs every hour
 */
export const cleanupInactiveRooms = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    try {
      const inactiveRoomsSnapshot = await db
        .collection('rooms')
        .where('lastActivity', '<', twentyFourHoursAgo)
        .get();

      const batch = db.batch();
      let deletedCount = 0;

      for (const roomDoc of inactiveRoomsSnapshot.docs) {
        // Delete all rounds subcollection
        const roundsSnapshot = await roomDoc.ref.collection('rounds').get();
        roundsSnapshot.docs.forEach((roundDoc) => {
          batch.delete(roundDoc.ref);
        });

        // Delete the room
        batch.delete(roomDoc.ref);
        deletedCount++;
      }

      await batch.commit();
      console.log(`Deleted ${deletedCount} inactive rooms`);
      return null;
    } catch (error) {
      console.error('Error in cleanupInactiveRooms:', error);
      return null;
    }
  });

/**
 * Auto-hide reported content when threshold is reached
 * Triggered on report creation
 */
export const autoHideReportedContent = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const { roomCode, roundId, submissionIndex } = report;

    try {
      // Count reports for this submission
      const reportsSnapshot = await db
        .collection('reports')
        .where('roomCode', '==', roomCode)
        .where('roundId', '==', roundId)
        .where('submissionIndex', '==', submissionIndex)
        .get();

      const reportCount = reportsSnapshot.size;

      // Auto-hide if threshold reached (3 reports)
      if (reportCount >= 3) {
        const roundRef = db
          .collection('rooms')
          .doc(roomCode)
          .collection('rounds')
          .doc(roundId);

        await roundRef.update({
          [`submissions.${submissionIndex}.hidden`]: true,
        });

        console.log(
          `Auto-hidden content in room ${roomCode}, round ${roundId}, submission ${submissionIndex}`
        );
      }

      return null;
    } catch (error) {
      console.error('Error in autoHideReportedContent:', error);
      return null;
    }
  });

/**
 * Track and manage global capacity count
 * Optional: Can use Firebase Realtime Database or Firestore
 */
export const updateCapacityOnConnect = functions.https.onCall(
  async (data, context) => {
    const { action } = data; // 'increment' or 'decrement'

    try {
      const capacityRef = db.collection('global').doc('capacity');
      
      if (action === 'increment') {
        await capacityRef.set(
          {
            activeUsers: admin.firestore.FieldValue.increment(1),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else if (action === 'decrement') {
        await capacityRef.update({
          activeUsers: admin.firestore.FieldValue.increment(-1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating capacity:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update capacity');
    }
  }
);

/**
 * Initialize capacity document if it doesn't exist
 * One-time setup function
 */
export const initializeCapacity = functions.https.onCall(async (data, context) => {
  try {
    const capacityRef = db.collection('global').doc('capacity');
    await capacityRef.set({
      activeUsers: 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error initializing capacity:', error);
    throw new functions.https.HttpsError('internal', 'Failed to initialize capacity');
  }
});
