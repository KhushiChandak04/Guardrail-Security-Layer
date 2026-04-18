import { collection, limit as queryLimit, onSnapshot, orderBy, query } from "firebase/firestore"

import { getFirestoreDb } from "./firebase"

export function listenToInteractions({ onData, onError, limit = 50 }) {
  const db = getFirestoreDb()
  if (!db) {
    onData([])
    return () => {}
  }

  const interactionsQuery = query(
    collection(db, "interactions"),
    orderBy("timestamp", "desc"),
    queryLimit(limit)
  )

  return onSnapshot(
    interactionsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => typeof item?.input_text === "string" && item.input_text.length > 0)
      onData(items)
    },
    (error) => {
      if (onError) {
        onError(error)
      }
    }
  )
}