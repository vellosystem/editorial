import React, { useState, useEffect, useCallback } from 'react';
import { X, Instagram, Facebook, Sparkles, Download, Loader2, Heart, Copy, Trash2, Layout, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import useEmblaCarousel from 'embla-carousel-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ImageHistoryItem {
  feedUrl: string;
  storyUrl: string;
  timestamp: number;
}

interface VideoHistoryItem {
  videoUrl: string;
  timestamp: number;
  aspectRatio?: '16:9' | '9:16';
}

interface ContentPageProps {
  content: any;
  project: any;
  onBack: () => void;
  onDelete: () => void;
  onCopyCaption: () => void;
  imageHistory: ImageHistoryItem[];
  videoHistory: VideoHistoryItem[];
  isGenerating: boolean;
  isGeneratingVideo: boolean;
  videoProgress: number;
  imageProgress: number;
  onGenerateImages: () => void;
  onGenerateVideo: (options: { aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' }) => void;
  onSaveImage: (historyItem: ImageHistoryItem) => void;
  onUpdateVisualPrompt: (type: 'image' | 'video') => Promise<void>;
  onUploadReferenceImage: (file: File) => Promise<void>;
  onRemoveReferenceImage: () => Promise<void>;
  onUploadFontReferenceImage: (file: File) => Promise<void>;
  onRemoveFontReferenceImage: () => Promise<void>;
}

export default function ContentPage({ 
  content, 
  project, 
  onBack, 
  onDelete, 
  onCopyCaption, 
  imageHistory, 
  videoHistory,
  isGenerating, 
  isGeneratingVideo,
  videoProgress,
  imageProgress,
  onGenerateImages, 
  onGenerateVideo,
  onSaveImage, 
  onUpdateVisualPrompt,
  onUploadReferenceImage,
  onRemoveReferenceImage,
  onUploadFontReferenceImage,
  onRemoveFontReferenceImage
}: ContentPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const [hasKey, setHasKey] = useState(true);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
  const [promptView, setPromptView] = useState<'image' | 'video'>('image');

  useEffect(() => {
    setSelectedIndex(0);
  }, [imageHistory.length]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleGenerateClick = () => {
    if (!hasKey) {
      alert("Sua chave de API não tem permissão para gerar imagens (precisa ser um projeto com faturamento ativado). Por favor, selecione uma chave válida.");
      return;
    }
    onGenerateImages();
  };

  const handleGenerateVideoClick = () => {
    if (!hasKey) {
      alert("Sua chave de API não tem permissão para gerar vídeos (precisa ser um projeto com faturamento ativado). Por favor, selecione uma chave válida.");
      return;
    }
    onGenerateVideo({ aspectRatio: videoAspectRatio, resolution: videoResolution });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadReferenceImage(file);
    }
  };

  const handleFontFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadFontReferenceImage(file);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    // If it's already a blob or data URL, we can download it directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    try {
      // For remote URLs, try to fetch to get a blob (allows renaming the file)
      // This will fail if CORS is not configured on the remote server
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: If fetch fails (likely CORS), open in a new tab
      // We use a link with target="_blank" which is more reliable than window.open
      console.warn("Fetch failed (likely CORS), falling back to direct link:", error);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRegeneratePrompt = async () => {
    if (!hasKey) {
      alert("Sua chave de API não tem permissão para gerar prompts. Por favor, selecione uma chave válida.");
      return;
    }
    setIsRegeneratingPrompt(true);
    try {
      await onUpdateVisualPrompt(promptView);
    } finally {
      setIsRegeneratingPrompt(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col h-full bg-[#09090b] relative z-20 overflow-hidden"
    >
      {/* Header */}
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-2 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            <span className="font-medium text-sm hidden sm:inline">Voltar</span>
          </button>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-2.5 rounded-xl shadow-inner",
              content.platform === 'Instagram' ? "bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 text-fuchsia-400 border border-fuchsia-500/20" : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/20"
            )}>
              {content.platform === 'Instagram' ? <Instagram size={20} /> : <Facebook size={20} />}
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-xl tracking-tight line-clamp-2">{content.title}</h2>
              <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold mt-1 flex items-center gap-2">
                <span className="text-violet-400">{content.format}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                {format(parseISO(content.date), 'dd MMMM yyyy', { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onCopyCaption}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
          >
            <Copy size={16} /> Copiar Legenda
          </button>
          <button 
            onClick={onDelete}
            className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500/20 transition-colors flex items-center gap-2 text-sm"
          >
            <Trash2 size={16} /> Excluir
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left Column: Content Details */}
        <div className="w-full lg:w-5/12 h-full overflow-y-auto p-8 space-y-8 border-r border-white/5 custom-scrollbar bg-black/20">
          
          <div className="space-y-4">
            <h5 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Legenda do Post</h5>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 shadow-inner">
              <div className="prose prose-invert prose-violet max-w-none whitespace-pre-wrap text-zinc-300 leading-relaxed text-[15px]">
                <Markdown>{content.caption}</Markdown>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => setPromptView('image')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                    promptView === 'image' ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Imagem
                </button>
                <button 
                  onClick={() => setPromptView('video')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                    promptView === 'video' ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Vídeo
                </button>
              </div>

              <button 
                onClick={handleRegeneratePrompt}
                disabled={isRegeneratingPrompt}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {isRegeneratingPrompt ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {(promptView === 'image' ? content.visualPromptImage : content.visualPromptVideo) ? "Recriar" : "Gerar"}
              </button>
            </div>

            <div className="relative z-10">
              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 flex items-center gap-2">
                <Sparkles size={12} className={promptView === 'image' ? "text-violet-400" : "text-fuchsia-400"} />
                Prompt Visual Sugerido ({promptView === 'image' ? 'Imagem' : 'Vídeo'})
              </h5>
              
              {isRegeneratingPrompt ? (
                <div className="py-4 flex flex-col items-center justify-center space-y-2">
                  <Loader2 size={24} className="animate-spin text-violet-400" />
                  <span className="text-xs text-violet-300 font-medium">Analisando conteúdo e {(promptView === 'image' ? content.visualPromptImage : content.visualPromptVideo) ? 'recriando' : 'gerando'} prompt...</span>
                </div>
              ) : (promptView === 'image' ? content.visualPromptImage : content.visualPromptVideo) ? (
                <p className="text-sm text-zinc-300 italic leading-relaxed">
                  {promptView === 'image' ? content.visualPromptImage : content.visualPromptVideo}
                </p>
              ) : (
                <p className="text-sm text-zinc-500 italic">
                  Nenhum prompt visual de {promptView === 'image' ? 'imagem' : 'vídeo'} gerado ainda. Clique em "Gerar" para criar um.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Creative Generation */}
        <div className="w-full lg:w-7/12 h-full overflow-y-auto p-8 bg-transparent custom-scrollbar flex flex-col relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-[0.02] mix-blend-screen pointer-events-none" />
          
          <div className="relative z-10 flex-1 flex flex-col">
            {/* Reference Image Upload */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Imagem de Referência Específica</h5>
                  {content.referenceImage && (
                    <button 
                      onClick={onRemoveReferenceImage}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-tighter"
                    >
                      Remover
                    </button>
                  )}
                </div>
                
                {content.referenceImage ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/40">
                    <img 
                      src={`data:${content.referenceImage.mimeType};base64,${content.referenceImage.data}`} 
                      className="w-full h-full object-cover" 
                      alt="Referência específica" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
                        <RefreshCw size={20} className="text-white" />
                        <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-xl hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer group h-full min-h-[120px]">
                    <Download size={24} className="text-zinc-500 group-hover:text-violet-400 mb-2" />
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-violet-400 uppercase tracking-widest text-center">Anexar Foto Real ou Elemento</span>
                    <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
                  </label>
                )}
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Referência de Fonte (Tipografia)</h5>
                  {content.fontReferenceImage && (
                    <button 
                      onClick={onRemoveFontReferenceImage}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-tighter"
                    >
                      Remover
                    </button>
                  )}
                </div>
                
                {content.fontReferenceImage ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/40">
                    <img 
                      src={`data:${content.fontReferenceImage.mimeType};base64,${content.fontReferenceImage.data}`} 
                      className="w-full h-full object-cover" 
                      alt="Referência de fonte" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
                        <RefreshCw size={20} className="text-white" />
                        <input type="file" onChange={handleFontFileChange} className="hidden" accept="image/*" />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/10 rounded-xl hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 transition-all cursor-pointer group h-full min-h-[120px]">
                    <Download size={24} className="text-zinc-500 group-hover:text-fuchsia-400 mb-2" />
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-fuchsia-400 uppercase tracking-widest text-center">Anexar Referência de Fonte</span>
                    <input type="file" onChange={handleFontFileChange} className="hidden" accept="image/*" />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-8">
              <h4 className="font-display font-bold flex items-center gap-2 text-2xl text-white">
                <Sparkles className="text-violet-400" size={24} />
                Estúdio Criativo
              </h4>
              {imageHistory.length > 0 && !isGenerating && (
                <button
                  onClick={handleGenerateClick}
                  className="text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-white shadow-lg"
                >
                  <Sparkles size={16} className="text-violet-400" />
                  Gerar Nova Versão
                </button>
              )}
            </div>

            {!hasKey && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center space-y-4 mb-6">
                <p className="text-sm text-amber-500/90 font-medium">
                  Para gerar imagens, selecione uma chave de API do Gemini de um projeto com faturamento ativado.
                </p>
                <button 
                  onClick={handleSelectKey}
                  className="px-6 py-2.5 bg-amber-500 text-black text-sm font-bold rounded-xl hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Selecionar Chave
                </button>
              </div>
            )}

            {isGenerating && imageHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] border-2 border-dashed border-white/10 rounded-3xl p-8 text-center space-y-6 bg-black/40 shadow-inner">
                <div className="relative">
                  <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                  <Loader2 className="animate-spin text-violet-400 relative z-10" size={48} />
                </div>
                <div className="w-full max-w-md space-y-4">
                  <p className="font-display font-bold text-white text-2xl">Gerando Criativos... {Math.round(imageProgress)}%</p>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${imageProgress}%` }}
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    />
                  </div>
                  <p className="text-zinc-400 mt-3 max-w-[350px] mx-auto leading-relaxed text-sm">
                    Nossa IA está analisando sua identidade visual e criando as melhores opções. Você pode voltar para o calendário, a geração continuará em segundo plano.
                  </p>
                </div>
              </div>
            ) : imageHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] border-2 border-dashed border-white/10 rounded-3xl p-8 text-center space-y-8 bg-black/40 shadow-inner">
                <div className="p-6 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full text-violet-400 shadow-xl shadow-violet-500/10 relative">
                  <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 rounded-full"></div>
                  <Sparkles size={48} className="relative z-10" />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-2xl">Gerar Artes para este Post</p>
                  <p className="text-zinc-400 mt-3 max-w-[350px] mx-auto leading-relaxed">
                    A IA usará a identidade visual do projeto e o prompt sugerido para criar os formatos Feed e Story com qualidade profissional.
                  </p>
                </div>
                <button 
                  onClick={handleGenerateClick}
                  disabled={!hasKey || !content.visualPromptImage}
                  className="w-full max-w-md py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-violet-500/20 disabled:shadow-none hover:-translate-y-1"
                >
                  <Sparkles size={20} />
                  Gerar Imagens Agora
                </button>
              </div>
            ) : (
              <div className="space-y-8 flex-1 flex flex-col">
                {isGenerating && (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-2 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-violet-500/20 rounded-full">
                        <Loader2 className="animate-spin text-violet-400" size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-white">Gerando nova versão... {Math.round(imageProgress)}%</p>
                        <p className="text-xs text-zinc-400">As versões anteriores continuam disponíveis abaixo.</p>
                      </div>
                    </div>
                    <div className="w-full sm:w-48 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${imageProgress}%` }}
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      />
                    </div>
                  </div>
                )}
                
                {imageHistory.length > 1 && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Histórico de Versões</span>
                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                      {imageHistory.map((historyItem, idx) => (
                        <button
                          key={`${historyItem.timestamp}-${idx}`}
                          onClick={() => scrollTo(idx)}
                          className={cn(
                            "relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all",
                            selectedIndex === idx ? "border-violet-500 shadow-lg shadow-violet-500/30 scale-105" : "border-transparent opacity-50 hover:opacity-100"
                          )}
                        >
                          <img src={historyItem.feedUrl} alt={`Versão ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <div className="absolute top-0 right-0 bg-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-xl">
                              NOVO
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex">
                      {imageHistory.map((historyItem, idx) => (
                        <div key={`${historyItem.timestamp}-${idx}`} className="flex-[0_0_100%] min-w-0 px-4">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {historyItem.feedUrl && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-white flex items-center gap-2">
                                    <Layout size={16} className="text-violet-400" /> 
                                    Feed (4:5)
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => onSaveImage(historyItem)}
                                      className={cn(
                                        "p-2 rounded-lg transition-all",
                                        content.savedCreatives?.some((s: any) => s.timestamp === historyItem.timestamp) 
                                          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30" 
                                          : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                      )}
                                      title="Salvar Imagem"
                                    >
                                      <Heart size={18} className={content.savedCreatives?.some((s: any) => s.timestamp === historyItem.timestamp) ? "fill-rose-400" : ""} />
                                    </button>
                                    <button 
                                      onClick={() => downloadImage(historyItem.feedUrl, 'feed-creative.png')}
                                      className="p-2 bg-white/5 text-violet-400 hover:bg-white/10 hover:text-violet-300 rounded-lg transition-all"
                                      title="Baixar Imagem"
                                    >
                                      <Download size={18} />
                                    </button>
                                  </div>
                                </div>
                                <div className="relative group rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
                                  <img src={historyItem.feedUrl} alt="Feed Creative" className="w-full aspect-[4/5] object-cover transition-transform duration-700 group-hover:scale-105" />
                                </div>
                              </div>
                            )}
                            
                            {historyItem.storyUrl && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-white flex items-center gap-2">
                                    <Layout size={16} className="text-violet-400" /> 
                                    Story (9:16)
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => onSaveImage(historyItem)}
                                      className={cn(
                                        "p-2 rounded-lg transition-all",
                                        content.savedCreatives?.some((s: any) => s.timestamp === historyItem.timestamp) 
                                          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30" 
                                          : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                      )}
                                      title="Salvar Imagem"
                                    >
                                      <Heart size={18} className={content.savedCreatives?.some((s: any) => s.timestamp === historyItem.timestamp) ? "fill-rose-400" : ""} />
                                    </button>
                                    <button 
                                      onClick={() => downloadImage(historyItem.storyUrl, 'story-creative.png')}
                                      className="p-2 bg-white/5 text-violet-400 hover:bg-white/10 hover:text-violet-300 rounded-lg transition-all"
                                      title="Baixar Imagem"
                                    >
                                      <Download size={18} />
                                    </button>
                                  </div>
                                </div>
                                <div className="relative group rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 max-w-[360px] mx-auto xl:mx-0">
                                  <img src={historyItem.storyUrl} alt="Story Creative" className="w-full aspect-[9/16] object-cover transition-transform duration-700 group-hover:scale-105" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {imageHistory.length > 1 && (
                    <>
                      <button
                        onClick={scrollPrev}
                        disabled={selectedIndex === 0}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-violet-500 hover:border-violet-500 transition-all disabled:opacity-0 disabled:pointer-events-none z-10"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={scrollNext}
                        disabled={selectedIndex === imageHistory.length - 1}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-violet-500 hover:border-violet-500 transition-all disabled:opacity-0 disabled:pointer-events-none z-10"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Video Section */}
            <div className="mt-12 pt-12 border-t border-white/5 relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-display font-bold flex items-center gap-2 text-2xl text-white">
                  <Video className="text-fuchsia-400" size={24} />
                  Vídeo com Veo 3.1
                </h4>
                {videoHistory.length > 0 && !isGeneratingVideo && (
                  <button
                    onClick={handleGenerateVideoClick}
                    className="text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-white shadow-lg"
                  >
                    <Sparkles size={16} className="text-fuchsia-400" />
                    Gerar Novo Vídeo
                  </button>
                )}
              </div>

              {isGeneratingVideo ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-3xl p-8 text-center space-y-6 bg-black/40 shadow-inner">
                  <div className="relative">
                    <div className="absolute inset-0 bg-fuchsia-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <Loader2 className="animate-spin text-fuchsia-400 relative z-10" size={48} />
                  </div>
                  <div className="w-full max-w-md space-y-4">
                    <p className="font-display font-bold text-white text-2xl">Gerando Vídeo... {Math.round(videoProgress)}%</p>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${videoProgress}%` }}
                        className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500"
                      />
                    </div>
                    <p className="text-zinc-400 mt-3 max-w-[350px] mx-auto leading-relaxed text-sm">
                      O Veo 3.1 está criando seu vídeo cinematográfico. Isso pode levar cerca de 1-2 minutos.
                    </p>
                  </div>
                </div>
              ) : videoHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 rounded-3xl p-8 text-center space-y-8 bg-black/40 shadow-inner">
                  <div className="p-6 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 rounded-full text-fuchsia-400 shadow-xl shadow-fuchsia-500/10 relative">
                    <div className="absolute inset-0 bg-fuchsia-500 blur-2xl opacity-20 rounded-full"></div>
                    <Video size={48} className="relative z-10" />
                  </div>
                  
                  <div className="w-full max-w-md space-y-6">
                    <div>
                      <p className="font-display font-bold text-white text-2xl">Gerar Vídeo para este Post</p>
                      <p className="text-zinc-400 mt-3 leading-relaxed">
                        Crie um vídeo cinematográfico de alta qualidade usando o modelo Veo 3.1 baseado no seu prompt visual.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Proporção</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setVideoAspectRatio('16:9')}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                              videoAspectRatio === '16:9' ? "bg-fuchsia-500 border-fuchsia-400 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                            )}
                          >
                            16:9 (Horizontal)
                          </button>
                          <button 
                            onClick={() => setVideoAspectRatio('9:16')}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                              videoAspectRatio === '9:16' ? "bg-fuchsia-500 border-fuchsia-400 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                            )}
                          >
                            9:16 (Vertical)
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resolução</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setVideoResolution('720p')}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                              videoResolution === '720p' ? "bg-fuchsia-500 border-fuchsia-400 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                            )}
                          >
                            720p
                          </button>
                          <button 
                            onClick={() => setVideoResolution('1080p')}
                            className={cn(
                              "flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all",
                              videoResolution === '1080p' ? "bg-fuchsia-500 border-fuchsia-400 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                            )}
                          >
                            1080p
                          </button>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerateVideoClick}
                      disabled={!hasKey || !content.visualPromptVideo}
                      className="w-full py-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-fuchsia-500/20 disabled:shadow-none hover:-translate-y-1"
                    >
                      <Video size={20} />
                      Gerar Vídeo Agora
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {videoHistory.map((videoItem, idx) => (
                    <div key={`${videoItem.timestamp}-${idx}`} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <Video size={16} className="text-fuchsia-400" /> 
                          Vídeo Gerado {idx === 0 && <span className="text-[10px] bg-fuchsia-500 px-1.5 py-0.5 rounded text-white ml-2">NOVO</span>}
                        </span>
                        <button 
                          onClick={() => downloadImage(videoItem.videoUrl, `video-${idx}.mp4`)}
                          className="p-2 bg-white/5 text-fuchsia-400 hover:bg-white/10 hover:text-fuchsia-300 rounded-lg transition-all"
                          title="Baixar Vídeo"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                      <div className={cn(
                        "relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/40",
                        videoItem.aspectRatio === '9:16' ? "aspect-[9/16] max-w-[300px] mx-auto" : "aspect-video"
                      )}>
                        <video 
                          src={videoItem.videoUrl} 
                          controls 
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
