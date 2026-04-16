import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, Loader2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GalleryViewProps {
  userId: string;
}

interface GalleryItem {
  type: 'image' | 'video';
  url: string;
  storyUrl?: string;
  timestamp: number;
  contentTitle: string;
  contentId: string;
}

export default function GalleryView({ userId }: GalleryViewProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const q = query(collection(db, 'contents'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const allItems: GalleryItem[] = [];

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          
          // Add images
          if (data.savedCreatives && Array.isArray(data.savedCreatives)) {
            data.savedCreatives.forEach((creative: any) => {
              allItems.push({
                type: 'image',
                url: creative.feedUrl,
                storyUrl: creative.storyUrl,
                timestamp: creative.timestamp,
                contentTitle: data.title || 'Sem título',
                contentId: doc.id
              });
            });
          }

          // Add videos
          if (data.savedVideos && Array.isArray(data.savedVideos)) {
            data.savedVideos.forEach((video: any) => {
              allItems.push({
                type: 'video',
                url: video.videoUrl,
                timestamp: video.timestamp,
                contentTitle: data.title || 'Sem título',
                contentId: doc.id
              });
            });
          }
        });

        // Sort by timestamp descending
        allItems.sort((a, b) => b.timestamp - a.timestamp);
        setItems(allItems);
      } catch (error) {
        console.error("Error fetching gallery items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [userId]);

  const downloadItem = async (url: string, filename: string) => {
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 max-w-3xl mx-auto mt-10">
        <ImageIcon className="mx-auto h-12 w-12 text-zinc-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Nenhum item encontrado</h3>
        <p className="text-zinc-400">As imagens e vídeos que você gerar e salvar aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto relative z-10">
      {items.map((item, idx) => (
        <div key={`${item.contentId}-${item.timestamp}-${idx}`} className="bg-black/20 rounded-3xl border border-white/10 overflow-hidden flex flex-col group">
          <div className="relative aspect-[4/5] overflow-hidden bg-zinc-900">
            {item.type === 'image' ? (
              <img 
                src={item.url} 
                alt={item.contentTitle} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <video 
                src={item.url} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
              {item.type === 'image' ? (
                <>
                  <button 
                    onClick={() => downloadItem(item.url, `feed-${item.timestamp}.png`)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-colors"
                  >
                    <Download size={16} /> Feed (4:5)
                  </button>
                  {item.storyUrl && (
                    <button 
                      onClick={() => downloadItem(item.storyUrl, `story-${item.timestamp}.png`)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-colors"
                    >
                      <Download size={16} /> Story (9:16)
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => downloadItem(item.url, `video-${item.timestamp}.mp4`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-colors"
                >
                  <Download size={16} /> Baixar Vídeo
                </button>
              )}
            </div>
            
            {item.type === 'video' && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse" />
                VÍDEO
              </div>
            )}
          </div>
          <div className="p-4">
            <h4 className="text-sm font-bold text-white truncate" title={item.contentTitle}>
              {item.contentTitle}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {format(new Date(item.timestamp), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
