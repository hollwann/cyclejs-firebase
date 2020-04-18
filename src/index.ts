import { adapt } from '@cycle/run/lib/adapt';
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import xs, { Stream } from 'xstream';

export type Query = {
  ref: string;
  tag: string;
  realtime?: boolean;
  multiple?: boolean;
};
export type FirestoreSource = Stream<any>;

function makeFirestoreDriver(config: object) {
  firebase.initializeApp(config);
  firebase.firestore().enablePersistence({ synchronizeTabs: true });
  const db = firebase.firestore();

  const getDocument = (ref: string, tag: string) =>
    xs.fromPromise(
      db
        .doc(ref)
        .get()
        .then((doc) => {
          return doc.exists ? { ...doc.data(), id: doc.id, tag } : null;
        })
    );
  const getDocumentSnapshot = (ref: string, tag: string) =>
    xs.create({
      start: (listener) =>
        db.doc(ref).onSnapshot((doc) => {
          listener.next(doc.exists ? { ...doc.data(), id: doc.id, tag } : null);
        }),
      stop: () => null
    });
  const getCollection = (ref: string, tag: string) =>
    xs.fromPromise(
      db
        .collection(ref)
        .get()
        .then((querySnapshot) => {
          return { docs: querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })), tag };
        })
    );
  const getCollectionSnapshot = (ref: string, tag: string) =>
    xs.create({
      start: (listener) =>
        db.collection(ref).onSnapshot((querySnapshot) => {
          listener.next({ docs: querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })), tag });
        }),
      stop: () => null
    });
    
  const executeQuery = (q: Query) => {
    if (q.multiple) return q.realtime ? getCollectionSnapshot(q.ref, q.tag) : getCollection(q.ref, q.tag);
    else return q.realtime ? getDocumentSnapshot(q.ref, q.tag) : getDocument(q.ref, q.tag);
  };
  const firestoreDriver = (queries$: Stream<Query>) => {
    const resultQueries$$: Stream<Stream<any>> = queries$.map(executeQuery);
    const resultFlatten$ = resultQueries$$.flatten();
    return adapt(resultFlatten$);
  };

  return firestoreDriver;
}

export { makeFirestoreDriver };
