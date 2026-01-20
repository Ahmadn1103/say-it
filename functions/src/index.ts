/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Initialize Firebase Admin
admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

/**
 * Scheduled function to delete database entries older than 15 minutes
 * Runs every 5 minutes
 */
export const cleanupOldData = onSchedule("every 5 minutes", async (event) => {
  const db = admin.database();
  const now = Date.now();
  const fifteenMinutesAgo = now - (15 * 60 * 1000); // 15 minutes in milliseconds

  logger.info("Starting cleanup of old data...", { timestamp: now });

  try {
    // Get reference to the root of your database
    const rootRef = db.ref();
    const snapshot = await rootRef.once("value");

    if (!snapshot.exists()) {
      logger.info("No data found in database");
      return;
    }

    const updates: { [key: string]: null } = {};
    let deleteCount = 0;

    // Iterate through all top-level keys
    snapshot.forEach((childSnapshot) => {
      const key = childSnapshot.key;
      const data = childSnapshot.val();

      // Check if data has a createdAt field and if it's older than 15 minutes
      if (data && typeof data === "object") {
        // Handle case where the node itself has a createdAt field
        if (data.createdAt && data.createdAt < fifteenMinutesAgo) {
          updates[`/${key}`] = null;
          deleteCount++;
          logger.info(`Marking for deletion: ${key}`, {
            createdAt: data.createdAt,
            age: (now - data.createdAt) / 1000 / 60,
          });
        } else {
          // Handle nested data - check children
          Object.keys(data).forEach((childKey) => {
            const childData = data[childKey];
            if (
              childData &&
              typeof childData === "object" &&
              childData.createdAt &&
              childData.createdAt < fifteenMinutesAgo
            ) {
              updates[`/${key}/${childKey}`] = null;
              deleteCount++;
              logger.info(`Marking for deletion: ${key}/${childKey}`, {
                createdAt: childData.createdAt,
                age: (now - childData.createdAt) / 1000 / 60,
              });
            }
          });
        }
      }
    });

    // Perform batch delete
    if (deleteCount > 0) {
      await rootRef.update(updates);
      logger.info(`Successfully deleted ${deleteCount} old entries`);
    } else {
      logger.info("No old data found to delete");
    }
  } catch (error) {
    logger.error("Error cleaning up old data:", error);
    throw error;
  }
});

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
