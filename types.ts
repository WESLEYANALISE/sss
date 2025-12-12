
export interface BookPage {
  pageNumber: number;
  content: string;
  chapterTitle?: string;
}

export interface BookData {
  id: string;
  title: string;
  author?: string;
  createdAt: number;
  pages: BookPage[];
}

export interface QueueItem {
  id: string;
  file: File;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  progress: number;
  error?: string;
  fileName: string;
}

export enum AppState {
  DASHBOARD = 'DASHBOARD',
  READING = 'READING'
}
