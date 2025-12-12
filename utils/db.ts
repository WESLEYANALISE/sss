import { openDB, DBSchema } from 'idb';
import { BookData } from '../types';

interface BookDB extends DBSchema {
  books: {
    key: string;
    value: BookData;
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'gemini-book-reader-db';
const STORE_NAME = 'books';

export const initDB = async () => {
  return openDB<BookDB>(DB_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: 'id',
      });
      store.createIndex('by-date', 'createdAt');
    },
  });
};

export const saveBookToDB = async (book: BookData) => {
  const db = await initDB();
  await db.put(STORE_NAME, book);
};

export const getAllBooksFromDB = async (): Promise<BookData[]> => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'by-date');
};

export const getBookFromDB = async (id: string): Promise<BookData | undefined> => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const deleteBookFromDB = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};
