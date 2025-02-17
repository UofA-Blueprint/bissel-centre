// /src/tests/firebase.test.ts
import {auth, db, storage} from "../app/services/firebase"

describe('Firebase Initialization', () => {
  test('Firebase Auth should be initialized', () => {
    expect(auth).toBeDefined();
  });

  test('Firestore (db) should be initialized', () => {
    expect(db).toBeDefined();
  });

  test('Firebase Storage should be initialized', () => {
    expect(storage).toBeDefined();
  });
});
