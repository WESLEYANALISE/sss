import React, { useState, useEffect, useCallback } from 'react';
import { BookData, AppState, QueueItem } from './types';
import FileUploader from './components/FileUploader';
import BookReader from './components/BookReader';
import { parsePdfToBook } from './services/geminiService';
import { saveBookToDB, getAllBooksFromDB, deleteBookFromDB } from './utils/db';
import { Book, Loader2, CheckCircle, XCircle, Trash2, Clock, PlayCircle, BookOpen, RefreshCw, Wand2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.DASHBOARD);
  const [currentBook, setCurrentBook] = useState<BookData | null>(null);
  
  // Queue & Library State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [library, setLibrary] = useState<BookData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load Library on Mount
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const books = await getAllBooksFromDB();
    // Sort by date descending
    setLibrary(books.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleDeleteBook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este livro?')) {
      await deleteBookFromDB(id);
      loadLibrary();
    }
  };

  const handleFilesSelect = (files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'PENDING',
      progress: 0,
      fileName: file.name
    }));

    setQueue(prev => [...prev, ...newItems]);
  };

  const retryQueueItem = (id: string) => {
    setQueue(prev => prev.map(q => 
      q.id === id ? { ...q, status: 'PENDING', error: undefined, progress: 0 } : q
    ));
  };

  // Background Processing Loop
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing) return;

      const nextItemIndex = queue.findIndex(item => item.status === 'PENDING');
      if (nextItemIndex === -1) return;

      setIsProcessing(true);
      const item = queue[nextItemIndex];

      // Update status to processing
      setQueue(prev => prev.map((q, i) => i === nextItemIndex ? { ...q, status: 'PROCESSING' } : q));

      try {
        const bookDataPartial = await parsePdfToBook(item.file, (percent) => {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: percent } : q));
        });

        // Construct full book data
        const newBook: BookData = {
          ...bookDataPartial,
          id: item.id,
          createdAt: Date.now(),
          // Ensure title fallback if Gemini fails to find one
          title: bookDataPartial.title || item.fileName.replace('.pdf', '')
        };

        // Save to DB
        await saveBookToDB(newBook);
        
        // Update Queue Status
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'COMPLETED', progress: 100 } : q));
        
        // Refresh Library
        loadLibrary();

      } catch (error: any) {
        console.error("Queue Processing Error:", error);
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: 'ERROR', 
          error: error.message || 'Falha ao processar' 
        } : q));
      } finally {
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [queue, isProcessing]);

  const openBook = (book: BookData) => {
    setCurrentBook(book);
    setAppState(AppState.READING);
  };

  const backToDashboard = () => {
    setCurrentBook(null);
    setAppState(AppState.DASHBOARD);
  };

  // Helper to render Queue Items
  const renderQueueItem = (item: QueueItem) => {
    return (
      <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={`p-2 rounded-full flex-shrink-0 ${
            item.status === 'PENDING' ? 'bg-gray-100 text-gray-500' :
            item.status === 'PROCESSING' ? 'bg-blue-50 text-blue-600' :
            item.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
            'bg-red-50 text-red-600'
          }`}>
            {item.status === 'PENDING' && <Clock size={16} />}
            {item.status === 'PROCESSING' && <Loader2 size={16} className="animate-spin" />}
            {item.status === 'COMPLETED' && <CheckCircle size={16} />}
            {item.status === 'ERROR' && <XCircle size={16} />}
          </div>
          <div className="flex-1 min-w-0">
             <p className="font-medium text-sm text-gray-900 truncate">{item.fileName}</p>
             <div className="flex items-center text-xs text-gray-500 mt-1">
               {item.status === 'PENDING' && <span>Aguardando...</span>}
               {item.status === 'PROCESSING' && (
                 <div className="w-full">
                   <div className="flex justify-between items-center mb-1">
                      <span>
                        {item.progress < 15 ? 'Iniciando...' : 
                         item.progress < 20 ? 'Extraindo Imagens...' :
                         item.progress < 60 ? 'Fase 1: Leitura Estrutural' : 
                         'Fase 2: A Gêmea (Refinamento)'}
                      </span>
                      <span>{item.progress}%</span>
                   </div>
                   <div className="w-full max-w-[200px] bg-gray-200 rounded-full h-1.5">
                     <div className={`h-1.5 rounded-full transition-all duration-300 ${item.progress >= 60 ? 'bg-purple-600' : 'bg-blue-600'}`} style={{ width: `${item.progress}%` }}></div>
                   </div>
                 </div>
               )}
               {item.status === 'COMPLETED' && <span className="text-green-600 flex items-center"><Wand2 size={12} className="mr-1"/> Processamento Completo</span>}
               {item.status === 'ERROR' && (
                 <div className="flex items-center space-x-2">
                   <span className="text-red-500 truncate max-w-[150px]" title={item.error}>{item.error}</span>
                   <button 
                     onClick={() => retryQueueItem(item.id)}
                     className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium hover:underline ml-2"
                     title="Tentar processar novamente"
                   >
                     <RefreshCw size={12} className="mr-1" /> Tentar Novamente
                   </button>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    );
  };

  if (appState === AppState.READING && currentBook) {
    return <BookReader book={currentBook} onBack={backToDashboard} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md">
               <Book size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Leitor Gemini</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload & Queue */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold mb-4 text-gray-800">Adicionar Livros</h2>
              <FileUploader onFilesSelect={handleFilesSelect} />
            </div>

            {queue.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-800">Fila de Processamento</h2>
                  <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                    {queue.filter(i => i.status === 'PENDING' || i.status === 'PROCESSING').length} restantes
                  </span>
                </div>
                <div className="max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {queue.slice().reverse().map(renderQueueItem)}
                </div>
                {queue.length > 0 && (
                   <button 
                     onClick={() => setQueue([])}
                     className="mt-2 text-xs text-red-600 hover:text-red-800 underline w-full text-center"
                   >
                     Limpar Fila Completa
                   </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Library */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sua Biblioteca</h2>
            
            {library.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Sua biblioteca está vazia</h3>
                <p className="mt-1 text-gray-500">Faça upload de PDFs para começar a montar sua coleção.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {library.map((book) => (
                  <div 
                    key={book.id} 
                    onClick={() => openBook(book)}
                    className="group bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-bold text-gray-900 truncate text-lg group-hover:text-indigo-700 transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {book.author || 'Autor Desconhecido'}
                        </p>
                        <div className="flex items-center mt-3 space-x-4 text-xs text-gray-400">
                           <span className="flex items-center"><Clock size={12} className="mr-1"/> {new Date(book.createdAt).toLocaleDateString()}</span>
                           <span>{book.pages.length} Páginas</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteBook(book.id, e)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                        title="Excluir livro"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                       <span className="flex items-center text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          Ler agora <PlayCircle size={16} className="ml-2" />
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
