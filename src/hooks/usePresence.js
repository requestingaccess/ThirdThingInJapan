import { useEffect } from 'react';
import { ref, onDisconnect, set, serverTimestamp, onValue } from 'firebase/database';
import { db } from '../firebase';

export function usePresence(roomId, userId) {
  useEffect(() => {
    if (!roomId || !userId) return;

    const userStatusRef = ref(db, `rooms/${roomId}/players/${userId}/presence`);
    const connectedRef = ref(db, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // I am online
        set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp()
        });

        // If I disconnect, the SERVER writes this for me
        onDisconnect(userStatusRef).set({
            state: 'offline',
            last_changed: serverTimestamp()
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, userId]);
}