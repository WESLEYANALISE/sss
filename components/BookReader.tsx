import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, ChevronRight, FileDown, BookOpen, ArrowLeft, Bookmark } from 'lucide-react';
import { BookData } from '../types';
import { exportBookToExcel } from '../utils/excelUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface BookReaderProps {
  book: BookData;
  onBack: () => void;
}

const BookReader: React.FC<BookReaderProps> = ({ book, onBack }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const totalPages = book.pages.length;

  const currentPage = book.pages[currentPageIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, onBack]);

  const nextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const handleExport = () => {
    exportBookToExcel(book);
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            title="Voltar para Biblioteca"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <BookOpen size={20} />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-gray-800 text-lg leading-tight truncate max-w-[200px] sm:max-w-md">
                {book.title}
              </h1>
              <p className="text-xs text-gray-500 font-medium truncate">
                 {book.author || 'Autor Desconhecido'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center">
           <button 
            onClick={handleExport}
            className="flex items-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors text-sm font-medium border border-green-200"
            title="Exportar para Excel"
          >
            <FileDown size={18} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Reader Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-4 sm:p-8">
        
        <div className="w-full max-w-4xl relative aspect-[3/4] sm:aspect-auto sm:h-[80vh] flex">
          
          {/* Previous Page Button */}
          <button 
            onClick={prevPage}
            disabled={currentPageIndex === 0}
            className={`absolute left-0 sm:-left-12 md:-left-16 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white shadow-lg text-gray-600 hover:text-indigo-600 transition-all z-20
              ${currentPageIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:scale-110'}
            `}
            title="Página Anterior"
          >
            <ChevronLeft size={32} />
          </button>

          {/* Book Page */}
          <div className="relative w-full h-full bg-paper shadow-2xl rounded-sm overflow-hidden border-l-4 border-l-gray-300 flex flex-col">
             
             {/* Page Header (Chapter info) */}
             <div className="h-10 border-b border-gray-100 flex items-center justify-between px-6 bg-paper-dark/30 text-indigo-800 text-xs font-semibold tracking-wide uppercase">
                <span className="flex items-center truncate">
                  <Bookmark size={12} className="mr-2" />
                  {currentPage.chapterTitle || 'Capítulo Geral'}
                </span>
                <span className="opacity-50">{book.title}</span>
             </div>

             {/* Page Content Container */}
             <AnimatePresence mode="wait">
                <motion.div 
                  key={currentPageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex-1 px-8 sm:px-12 py-8 overflow-y-auto custom-scrollbar"
                >
                   <article className="prose prose-slate prose-lg max-w-none font-serif text-gray-800 leading-relaxed">
                      <ReactMarkdown 
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-6 text-gray-900 border-b-2 border-gray-200 pb-2 mt-2" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-800" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-6 mb-3 text-gray-700" {...props} />,
                          p: ({node, ...props}) => <p className="mb-4 text-justify" {...props} />,
                          blockquote: ({node, ...props}) => (
                            <blockquote className="border-l-4 border-indigo-400 pl-4 italic bg-indigo-50/50 py-3 pr-2 my-6 rounded-r-md text-gray-700 shadow-sm" {...props} />
                          ),
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                          a: ({node, ...props}) => <a className="text-indigo-600 hover:underline" {...props} />,
                          img: ({node, ...props}) => (
                            <span className="block my-6 text-center">
                              <img 
                                className="inline-block max-w-full h-auto rounded-lg shadow-md border border-gray-200"
                                {...props} 
                                alt={props.alt || 'Imagem do livro'}
                              />
                              {props.alt && <span className="block mt-2 text-sm text-gray-500 italic">{props.alt}</span>}
                            </span>
                          ),
                        }}
                      >
                        {currentPage?.content || ''}
                      </ReactMarkdown>
                   </article>
                </motion.div>
             </AnimatePresence>

             {/* Page Footer */}
             <div className="h-10 border-t border-gray-100 flex items-center justify-between px-8 bg-paper-dark text-gray-500 text-sm font-sans">
                <span></span>
                <span>{currentPage.pageNumber}</span>
                <span></span>
             </div>
          </div>

          {/* Next Page Button */}
          <button 
            onClick={nextPage}
            disabled={currentPageIndex === totalPages - 1}
            className={`absolute right-0 sm:-right-12 md:-right-16 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white shadow-lg text-gray-600 hover:text-indigo-600 transition-all z-20
              ${currentPageIndex === totalPages - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:scale-110'}
            `}
            title="Próxima Página"
          >
            <ChevronRight size={32} />
          </button>

        </div>
      </div>
    </div>
  );
};

export default BookReader;
