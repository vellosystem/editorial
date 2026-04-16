import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Layout, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Instagram, 
  Facebook, 
  CheckCircle2, 
  Clock,
  LogOut,
  User,
  Trash2,
  MoreVertical,
  X,
  Edit2,
  Loader2,
  Image as ImageIcon,
  FileJson,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDocFromServer,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { generateEditorialLine, generateProjectStrategy, GeneratedContent, generateSingleVisualPrompt } from './services/gemini';
import { generateImagesFromPrompt, generateVideoFromPrompt } from './services/imageService';
import { uploadImageToDrive } from './services/driveService';
import ContentPage from './components/ContentPage';
import GalleryView from './components/GalleryView';
import AIChat from './components/AIChat';
import { optimizeImage } from './lib/imageUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';

// Error Handling Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Erro no Firestore: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h2>
          <p className="text-zinc-400 mb-6 max-w-md">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Project {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  toneOfVoice: string;
  mainGoals: string;
  contentPillars: string;
  competitors: string;
  keywords: string;
  brandValues?: string;
  avoidTopics?: string;
  logoLightImage?: { data: string; mimeType: string } | null;
  logoDarkImage?: { data: string; mimeType: string } | null;
  typographyImage?: { data: string; mimeType: string } | null;
  graphicElementsImage?: { data: string; mimeType: string } | null;
  referenceCreativeImages?: ({ data: string; mimeType: string } | null)[];
  artDirection?: string;
  userId: string;
  createdAt: any;
}

interface Content {
  id: string;
  projectId: string;
  date: string;
  title: string;
  caption: string;
  visualPromptImage?: string;
  visualPromptVideo?: string;
  platform: 'Instagram' | 'Facebook' | 'Both';
  format: 'Reel' | 'Post' | 'Story' | 'Carousel';
  userId: string;
  createdAt: any;
  savedCreatives?: ImageHistoryItem[];
  savedVideos?: VideoHistoryItem[];
  referenceImage?: { data: string; mimeType: string } | null;
  fontReferenceImage?: { data: string; mimeType: string } | null;
}

export interface ImageHistoryItem {
  feedUrl: string;
  storyUrl: string;
  timestamp: number;
}

export interface VideoHistoryItem {
  videoUrl: string;
  timestamp: number;
  aspectRatio?: '16:9' | '9:16';
}

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [view, setView] = useState<'projects' | 'calendar' | 'gallery'>('projects');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectStep, setNewProjectStep] = useState(1);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    targetAudience: '',
    toneOfVoice: '',
    mainGoals: '',
    contentPillars: '',
    competitors: '',
    keywords: '',
    brandValues: '',
    avoidTopics: '',
    logoLightImage: null as { data: string; mimeType: string } | null,
    logoDarkImage: null as { data: string; mimeType: string } | null,
    typographyImage: null as { data: string; mimeType: string } | null,
    graphicElementsImage: null as { data: string; mimeType: string } | null,
    referenceCreativeImages: [null, null, null] as ({ data: string; mimeType: string } | null)[],
    artDirection: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [imageHistory, setImageHistory] = useState<Record<string, ImageHistoryItem[]>>({});
  const [videoHistory, setVideoHistory] = useState<Record<string, VideoHistoryItem[]>>({});
  const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set());
  const [generatingVideoIds, setGeneratingVideoIds] = useState<Set<string>>(new Set());
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
  const [imageProgress, setImageProgress] = useState<Record<string, number>>({});
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Test Firestore Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch Projects
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });
    return unsubscribe;
  }, [user]);

  // Fetch Contents
  useEffect(() => {
    if (!user || !activeProject) return;
    const q = query(
      collection(db, 'contents'),
      where('projectId', '==', activeProject.id),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedContents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Content));
      setContents(fetchedContents);
      
      // Populate imageHistory with savedCreatives if they exist and aren't already in history
      setImageHistory(prev => {
        const next = { ...prev };
        fetchedContents.forEach(content => {
          if (content.savedCreatives && content.savedCreatives.length > 0) {
            const existingHistory = next[content.id] || [];
            // Add saved creatives that aren't already in the history (by timestamp)
            const newSaved = content.savedCreatives.filter(
              saved => !existingHistory.some(h => h.timestamp === saved.timestamp)
            );
            if (newSaved.length > 0) {
              next[content.id] = [...existingHistory, ...newSaved].sort((a, b) => b.timestamp - a.timestamp);
            }
          }
        });
        return next;
      });

      // Populate videoHistory with savedVideos
      setVideoHistory(prev => {
        const next = { ...prev };
        fetchedContents.forEach(content => {
          if (content.savedVideos && content.savedVideos.length > 0) {
            const existingHistory = next[content.id] || [];
            const newSaved = content.savedVideos.filter(
              saved => !existingHistory.some(h => h.timestamp === saved.timestamp)
            );
            if (newSaved.length > 0) {
              next[content.id] = [...existingHistory, ...newSaved].sort((a, b) => b.timestamp - a.timestamp);
            }
          }
        });
        return next;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contents');
    });
    return unsubscribe;
  }, [user, activeProject]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login error", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setToast({ message: "Login cancelado. Por favor, tente novamente.", type: 'error' });
      } else {
        setToast({ message: "Erro ao fazer login. Tente novamente.", type: 'error' });
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSaveProject = async () => {
    if (!user) return;
    try {
      if (editingProjectId) {
        const projectRef = doc(db, 'projects', editingProjectId);
        await updateDoc(projectRef, {
          name: newProjectData.name,
          description: newProjectData.description,
          targetAudience: newProjectData.targetAudience,
          toneOfVoice: newProjectData.toneOfVoice,
          mainGoals: newProjectData.mainGoals,
          contentPillars: newProjectData.contentPillars,
          competitors: newProjectData.competitors,
          keywords: newProjectData.keywords,
          brandValues: newProjectData.brandValues,
          avoidTopics: newProjectData.avoidTopics,
          logoLightImage: newProjectData.logoLightImage,
          logoDarkImage: newProjectData.logoDarkImage,
          typographyImage: newProjectData.typographyImage,
          graphicElementsImage: newProjectData.graphicElementsImage,
          referenceCreativeImages: newProjectData.referenceCreativeImages,
          artDirection: newProjectData.artDirection
        });
        
        if (activeProject?.id === editingProjectId) {
          setActiveProject(prev => prev ? { ...prev, ...newProjectData } : null);
        }
        setToast({ message: "Projeto atualizado com sucesso!", type: 'success' });
      } else {
        const newProject = {
          ...newProjectData,
          userId: user.uid,
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'projects'), newProject);
        setActiveProject({ id: docRef.id, ...newProject } as Project);
        setView('calendar');
        setToast({ message: "Projeto criado com sucesso!", type: 'success' });
      }
      
      setIsProjectModalOpen(false);
      setEditingProjectId(null);
      setNewProjectStep(1);
      setNewProjectData({ 
        name: '', 
        description: '', 
        targetAudience: '', 
        toneOfVoice: '', 
        mainGoals: '', 
        contentPillars: '', 
        competitors: '', 
        keywords: '', 
        brandValues: '',
        avoidTopics: '',
        logoLightImage: null, 
        logoDarkImage: null,
        typographyImage: null, 
        graphicElementsImage: null, 
        referenceCreativeImages: [null, null, null], 
        artDirection: '' 
      });
    } catch (error) {
      handleFirestoreError(error, editingProjectId ? OperationType.UPDATE : OperationType.CREATE, 'projects');
    }
  };

  const handleEditProject = (project: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNewProjectData({
      name: project.name,
      description: project.description,
      targetAudience: project.targetAudience,
      toneOfVoice: project.toneOfVoice,
      mainGoals: project.mainGoals,
      contentPillars: project.contentPillars,
      competitors: project.competitors,
      keywords: project.keywords,
      brandValues: project.brandValues || '',
      avoidTopics: project.avoidTopics || '',
      logoLightImage: project.logoLightImage || null,
      logoDarkImage: project.logoDarkImage || null,
      typographyImage: project.typographyImage || null,
      graphicElementsImage: project.graphicElementsImage || null,
      referenceCreativeImages: project.referenceCreativeImages || [null, null, null],
      artDirection: project.artDirection || ''
    });
    setEditingProjectId(project.id);
    setNewProjectStep(1);
    setIsProjectModalOpen(true);
  };

  const handleGenerateStrategy = async () => {
    if (!newProjectData.name || !newProjectData.description) return;
    setIsGeneratingStrategy(true);
    try {
      const images = [
        newProjectData.logoLightImage,
        newProjectData.logoDarkImage,
        newProjectData.typographyImage,
        newProjectData.graphicElementsImage,
        ...newProjectData.referenceCreativeImages
      ].filter((img): img is { data: string; mimeType: string } => img !== null);

      const strategy = await generateProjectStrategy(newProjectData.name, newProjectData.description, images);
      setNewProjectData(prev => ({
        ...prev,
        targetAudience: strategy.targetAudience || prev.targetAudience,
        toneOfVoice: strategy.toneOfVoice || prev.toneOfVoice,
        mainGoals: strategy.mainGoals || prev.mainGoals,
        contentPillars: strategy.contentPillars || prev.contentPillars,
        competitors: strategy.competitors || prev.competitors,
        keywords: strategy.keywords || prev.keywords,
        brandValues: strategy.brandValues || prev.brandValues,
        avoidTopics: strategy.avoidTopics || prev.avoidTopics,
        artDirection: strategy.artDirection || prev.artDirection,
      }));
      setToast({ message: "Estratégia gerada com sucesso!", type: 'success' });
      setNewProjectStep(2);
    } catch (error) {
      console.error("Error generating strategy", error);
      setToast({ message: "Erro ao gerar estratégia.", type: 'error' });
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  const handleGenerateContentImages = async (content: Content, project: Project) => {
    if (!user) return;
    setGeneratingContentIds(prev => new Set(prev).add(content.id));
    setImageProgress(prev => ({ ...prev, [content.id]: 0 }));
    try {
      const images = await generateImagesFromPrompt(
        {
          logoLightImage: project.logoLightImage,
          logoDarkImage: project.logoDarkImage,
          typographyImage: project.typographyImage,
          graphicElementsImage: project.graphicElementsImage,
          referenceCreativeImages: project.referenceCreativeImages
        },
        content.visualPromptImage || '',
        content.title,
        project.artDirection || '',
        content.caption,
        (progress) => {
          setImageProgress(prev => ({ ...prev, [content.id]: progress }));
        },
        content.referenceImage,
        content.fontReferenceImage
      );
      
      const timestamp = Date.now();
      let feedDownloadUrl = images.feedImageUrl;
      let storyDownloadUrl = images.storyImageUrl;

      // Upload to Firebase Storage automatically
      setToast({ message: "Imagens geradas! Salvando na nuvem...", type: 'success' });
      
      const uploadWithTimeout = async (refObj: any, dataString: string) => {
        return Promise.race([
          uploadString(refObj, dataString, 'data_url'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
        ]);
      };

      try {
        if (images.feedImageUrl.startsWith('data:image')) {
          const feedRef = ref(storage, `users/${user.uid}/contents/${content.id}/feed_${timestamp}.png`);
          await uploadWithTimeout(feedRef, images.feedImageUrl);
          feedDownloadUrl = await getDownloadURL(feedRef);
        }
        
        if (images.storyImageUrl.startsWith('data:image')) {
          const storyRef = ref(storage, `users/${user.uid}/contents/${content.id}/story_${timestamp}.png`);
          await uploadWithTimeout(storyRef, images.storyImageUrl);
          storyDownloadUrl = await getDownloadURL(storyRef);
        }
      } catch (uploadError: any) {
        console.error("Erro ao fazer upload para o Storage:", uploadError);
        const isTimeout = uploadError.message === 'timeout';
        setToast({ 
          message: isTimeout 
            ? "O upload demorou muito. Verifique se o Storage está configurado com as regras corretas no console do Firebase." 
            : "Imagens geradas, mas o Storage não está configurado corretamente. Salvo localmente.", 
          type: 'error' 
        });
        // Fallback to base64 URLs if upload fails/hangs
        feedDownloadUrl = images.feedImageUrl;
        storyDownloadUrl = images.storyImageUrl;
      }

      const newHistoryItem = {
        feedUrl: feedDownloadUrl,
        storyUrl: storyDownloadUrl,
        timestamp
      };

      // Add to image history
      setImageHistory(prev => {
        const existing = prev[content.id] || [];
        return {
          ...prev,
          [content.id]: [newHistoryItem, ...existing]
        };
      });

      // Automatically save to content.savedCreatives ONLY if we successfully uploaded to Storage
      // (Base64 strings are too large for Firestore's 1MB limit)
      if (!feedDownloadUrl.startsWith('data:image') && !storyDownloadUrl.startsWith('data:image')) {
        const updatedSavedCreatives = [...(content.savedCreatives || []), newHistoryItem];
        await updateDoc(doc(db, 'contents', content.id), {
          savedCreatives: updatedSavedCreatives
        });
        setSelectedContent(prev => prev ? { ...prev, savedCreatives: updatedSavedCreatives } : null);
        setToast({ message: "Imagens geradas e salvas na nuvem com sucesso!", type: 'success' });
      } else {
        setToast({ message: "Imagens geradas! (Não salvas na nuvem pois o Storage não está ativo)", type: 'error' });
      }

    } catch (error: any) {
      console.error("Error generating creatives", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("Requested entity was not found")) {
        alert("Sua chave de API não tem permissão para gerar imagens (precisa ser um projeto com faturamento ativado). Por favor, selecione uma chave válida.");
      } else {
        alert("Erro ao gerar criativos. Tente novamente.");
      }
    } finally {
      setGeneratingContentIds(prev => {
        const next = new Set(prev);
        next.delete(content.id);
        return next;
      });
    }
  };

  const handleGenerateVideo = async (content: Content, project: Project, options: { aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' }) => {
    if (generatingVideoIds.has(content.id)) return;
    
    setGeneratingVideoIds(prev => new Set(prev).add(content.id));
    setVideoProgress(prev => ({ ...prev, [content.id]: 0 }));

    try {
      const videoUrl = await generateVideoFromPrompt(
        content.visualPromptVideo || "",
        content.title,
        project.artDirection || "",
        {
          aspectRatio: options.aspectRatio,
          resolution: options.resolution,
          logoLightImage: project.logoLightImage,
          logoDarkImage: project.logoDarkImage,
          referenceImage: content.referenceImage,
          fontReferenceImage: content.fontReferenceImage
        },
        (progress) => {
          setVideoProgress(prev => ({ ...prev, [content.id]: progress }));
        }
      );

      const timestamp = Date.now();
      const newVideoItem: VideoHistoryItem = {
        videoUrl,
        timestamp,
        aspectRatio: options.aspectRatio
      };

      // Save to Firestore
      const updatedSavedVideos = [...(content.savedVideos || []), newVideoItem];
      await updateDoc(doc(db, 'contents', content.id), {
        savedVideos: updatedSavedVideos
      });

      setVideoHistory(prev => ({
        ...prev,
        [content.id]: [newVideoItem, ...(prev[content.id] || [])]
      }));

      setToast({ message: "Vídeo gerado com sucesso!", type: 'success' });
    } catch (error: any) {
      console.error("Error generating video:", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("PERMISSION_DENIED")) {
        alert("Sua chave de API não tem permissão para gerar vídeos (precisa ser um projeto com faturamento ativado). Por favor, selecione uma chave válida.");
        if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
        }
      } else {
        setToast({ message: `Erro ao gerar vídeo: ${errorMessage}`, type: 'error' });
      }
    } finally {
      setGeneratingVideoIds(prev => {
        const next = new Set(prev);
        next.delete(content.id);
        return next;
      });
    }
  };

  const handleSaveImage = async (content: Content, historyItem: ImageHistoryItem) => {
    if (!user) return;
    
    const isAlreadySaved = content.savedCreatives?.some(s => s.timestamp === historyItem.timestamp);
    
    if (isAlreadySaved) {
      try {
        const updatedSavedCreatives = content.savedCreatives!.filter(s => s.timestamp !== historyItem.timestamp);
        await updateDoc(doc(db, 'contents', content.id), {
          savedCreatives: updatedSavedCreatives
        });
        setSelectedContent(prev => prev ? { ...prev, savedCreatives: updatedSavedCreatives } : null);
        setToast({ message: "Imagem removida dos salvos.", type: 'success' });
      } catch (error) {
        console.error("Error removing saved image", error);
        setToast({ message: "Erro ao remover imagem.", type: 'error' });
      }
      return;
    }
    
    try {
      setToast({ message: "Salvando imagens...", type: 'success' });
      
      let feedDownloadUrl = historyItem.feedUrl;
      let storyDownloadUrl = historyItem.storyUrl;
      
      const uploadWithTimeout = async (refObj: any, dataString: string) => {
        return Promise.race([
          uploadString(refObj, dataString, 'data_url'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
        ]);
      };

      try {
        // Upload feed image if it's base64
        if (historyItem.feedUrl.startsWith('data:image')) {
          const feedRef = ref(storage, `users/${user.uid}/contents/${content.id}/feed_${historyItem.timestamp}.png`);
          await uploadWithTimeout(feedRef, historyItem.feedUrl);
          feedDownloadUrl = await getDownloadURL(feedRef);
        }
        
        // Upload story image if it's base64
        if (historyItem.storyUrl.startsWith('data:image')) {
          const storyRef = ref(storage, `users/${user.uid}/contents/${content.id}/story_${historyItem.timestamp}.png`);
          await uploadWithTimeout(storyRef, historyItem.storyUrl);
          storyDownloadUrl = await getDownloadURL(storyRef);
        }
      } catch (uploadError) {
        console.error("Erro ao fazer upload para o Storage:", uploadError);
        setToast({ message: "Erro: O Firebase Storage não está ativado no seu projeto.", type: 'error' });
        return; // Stop saving if upload fails
      }
      
      if (feedDownloadUrl.startsWith('data:image') || storyDownloadUrl.startsWith('data:image')) {
        setToast({ message: "Erro: Imagens muito grandes para salvar sem o Storage ativado.", type: 'error' });
        return;
      }

      const savedItem: ImageHistoryItem = {
        feedUrl: feedDownloadUrl,
        storyUrl: storyDownloadUrl,
        timestamp: historyItem.timestamp
      };
      
      const updatedSavedCreatives = [...(content.savedCreatives || []), savedItem];
      
      await updateDoc(doc(db, 'contents', content.id), {
        savedCreatives: updatedSavedCreatives
      });
      
      setToast({ message: "Imagens salvas com sucesso!", type: 'success' });
      
      // Update local state to reflect the saved item
      setSelectedContent(prev => prev ? { ...prev, savedCreatives: updatedSavedCreatives } : null);
      
    } catch (error: any) {
      console.error("Error saving images", error);
      setToast({ message: "Erro ao salvar imagens.", type: 'error' });
    }
  };

  const handleGenerateContent = async (days: number) => {
    if (!activeProject || !user) return;
    setIsGenerating(true);
    try {
      // Determine start date based on currentMonth
      let startDateObj = new Date();
      if (days === 30) {
        // Full month: start from the first day of currentMonth
        startDateObj = startOfMonth(currentMonth);
      } else {
        // 7 days: start from today if today is in currentMonth, otherwise start from the first day of currentMonth
        if (!isSameMonth(new Date(), currentMonth)) {
          startDateObj = startOfMonth(currentMonth);
        }
      }
      
      const startDate = format(startDateObj, 'yyyy-MM-dd');
      const generated = await generateEditorialLine(activeProject, startDate, days);
      
      for (const item of generated) {
        try {
          await addDoc(collection(db, 'contents'), {
            ...item,
            projectId: activeProject.id,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'contents');
        }
      }
      setToast({ message: "Conteúdo gerado com sucesso!", type: 'success' });
    } catch (error) {
      console.error("Error generating content", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Excluir Projeto",
      message: "Tem certeza que deseja excluir este projeto e todos os seus conteúdos?",
      onConfirm: async () => {
        try {
          // Delete contents first
          const q = query(collection(db, 'contents'), where('projectId', '==', id));
          const snapshot = await getDocs(q);
          for (const d of snapshot.docs) {
            await deleteDoc(doc(db, 'contents', d.id));
          }
          await deleteDoc(doc(db, 'projects', id));
          if (activeProject?.id === id) setActiveProject(null);
          setToast({ message: "Projeto excluído com sucesso!", type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'projects');
        }
      }
    });
  };

  const handleUpdateProjectAI = async (data: any) => {
    if (!activeProject) return;
    try {
      const projectRef = doc(db, 'projects', activeProject.id);
      await updateDoc(projectRef, data);
      setActiveProject(prev => prev ? { ...prev, ...data } : null);
      setToast({ message: "Projeto atualizado pela IA!", type: 'success' });
    } catch (error) {
      console.error("AI Update Project Error:", error);
    }
  };

  const handleUpdateContentAI = async (contentId: string, data: any) => {
    try {
      const contentRef = doc(db, 'contents', contentId);
      await updateDoc(contentRef, data);
      setToast({ message: "Conteúdo atualizado pela IA!", type: 'success' });
    } catch (error) {
      console.error("AI Update Content Error:", error);
    }
  };

  const handleGenerateContentAI = async (date: string, theme: string) => {
    if (!activeProject || !user) return;
    try {
      setToast({ message: "IA gerando nova sugestão...", type: 'success' });
      const generated = await generateEditorialLine(activeProject, date, 1);
      if (generated.length > 0) {
        const item = generated[0];
        // Override with theme if provided
        await addDoc(collection(db, 'contents'), {
          ...item,
          title: theme || item.title,
          projectId: activeProject.id,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        setToast({ message: "Nova sugestão gerada!", type: 'success' });
      }
    } catch (error) {
      console.error("AI Generate Content Error:", error);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!activeProject || !user) {
      setToast({ message: "Selecione um projeto antes de importar.", type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);
        
        if (!Array.isArray(json)) {
          setToast({ message: "O arquivo deve ser um array de conteúdos.", type: 'error' });
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const item of json) {
          // Basic validation
          if (item.date && item.title) {
            try {
              let date = String(item.date).trim();
              
              // Replace any dashes or dots with slashes for normalization if it looks like DD-MM-YYYY or DD.MM.YYYY
              if (date.match(/^\d{1,2}[-.]\d{1,2}[-.]\d{4}$/)) {
                date = date.replace(/[-.]/g, '/');
              }

              // Normalize date if it's in DD/MM/YYYY format
              if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) {
                  if (parts[2].length === 4) {
                    date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  } else if (parts[0].length === 4) {
                    date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                  }
                }
              }

              // Also handle YYYY/MM/DD
              if (date.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
                date = date.replace(/\//g, '-');
                const parts = date.split('-');
                date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              }

              const parsedDate = parseISO(date);
              if (isNaN(parsedDate.getTime()) || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.error("Data inválida ou formato incorreto:", item.date, "->", date);
                skippedCount++;
                continue;
              }

              const newContent = {
                projectId: activeProject.id,
                date: date,
                title: String(item.title).trim().substring(0, 200),
                caption: item.caption ? String(item.caption).trim().substring(0, 5000) : '',
                platform: item.platform ? String(item.platform).trim() : 'Instagram',
                format: item.format ? String(item.format).trim() : 'Post',
                userId: user.uid,
                createdAt: serverTimestamp(),
              };
              await addDoc(collection(db, 'contents'), newContent);
              importedCount++;
            } catch (err) {
              console.error("Erro ao adicionar documento:", err);
              skippedCount++;
            }
          } else {
            console.warn("Item ignorado por falta de data ou título:", item);
            skippedCount++;
          }
        }
        
        if (importedCount > 0) {
          setToast({ 
            message: `${importedCount} conteúdos importados!${skippedCount > 0 ? ` (${skippedCount} ignorados por erro/formato)` : ''}`, 
            type: 'success' 
          });
        } else {
          setToast({ message: "Nenhum conteúdo válido encontrado no arquivo.", type: 'error' });
        }
      } catch (error) {
        console.error("Erro ao importar JSON:", error);
        setToast({ message: "Erro ao ler o arquivo JSON. Verifique se o formato é válido.", type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        date: format(new Date(), 'yyyy-MM-dd'),
        title: "Exemplo de Título",
        caption: "Exemplo de Legenda",
        platform: "Instagram",
        format: "Post"
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_conteudo.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpecificImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImage(file, 800, 0.7);
      const dataUrl = `data:${optimized.mimeType};base64,${optimized.data}`;
      
      if (index !== undefined) {
        setNewProjectData(prev => {
          const newRefs = [...(prev.referenceCreativeImages || [null, null, null])];
          newRefs[index] = { data: optimized.data, mimeType: optimized.mimeType };
          return { ...prev, referenceCreativeImages: newRefs };
        });
      } else {
        setNewProjectData(prev => ({
          ...prev,
          [field]: { data: optimized.data, mimeType: optimized.mimeType }
        }));
      }
    } catch (error) {
      console.error("Error optimizing image:", error);
      setToast({ message: "Erro ao processar imagem.", type: 'error' });
    }
  };

  const removeSpecificImage = (field: string, index?: number) => {
    if (index !== undefined) {
      setNewProjectData(prev => {
        const newRefs = [...(prev.referenceCreativeImages || [null, null, null])];
        newRefs[index] = null;
        return { ...prev, referenceCreativeImages: newRefs };
      });
    } else {
      setNewProjectData(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#09090b] text-white"><Loader2 className="animate-spin text-violet-500" size={32} /></div>;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/50 to-[#09090b]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 relative z-10 glass-panel p-12 rounded-3xl"
        >
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="text-white" size={32} />
            </div>
            <h1 className="text-5xl font-display font-bold tracking-tight text-white">Editorial AI</h1>
            <p className="text-zinc-400 font-medium">Sua linha editorial estratégica em segundos.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            <User size={20} /> Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent text-zinc-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col p-6 space-y-8 relative z-20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="text-white" size={16} />
          </div>
          <span className="text-xl font-display font-bold tracking-tight text-white">Editorial AI</span>
        </div>

        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setView('projects')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium",
              view === 'projects' ? "bg-white/10 text-white shadow-sm border border-white/5" : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Layout size={18} /> Projetos
          </button>
          <button 
            onClick={() => setView('gallery')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium",
              view === 'gallery' ? "bg-white/10 text-white shadow-sm border border-white/5" : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <ImageIcon size={18} /> Galeria
          </button>
          {activeProject && (
            <button 
              onClick={() => setView('calendar')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium",
                view === 'calendar' ? "bg-white/10 text-white shadow-sm border border-white/5" : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <CalendarIcon size={18} /> Calendário
            </button>
          )}
        </nav>

        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-9 h-9 rounded-full border border-white/10" alt="" referrerPolicy="no-referrer" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user.displayName}</p>
            </div>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-rose-400 transition-colors p-2 hover:bg-rose-500/10 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {selectedContent ? (
          <ContentPage 
            key="content-page"
            content={selectedContent}
            project={activeProject}
            onBack={() => setSelectedContent(null)}
            onCopyCaption={() => {
              navigator.clipboard.writeText(selectedContent.caption);
              setToast({ message: "Legenda copiada!", type: 'success' });
            }}
            onDelete={() => {
              setConfirmModal({
                isOpen: true,
                title: "Excluir Conteúdo",
                message: "Deseja excluir este conteúdo?",
                onConfirm: async () => {
                  try {
                    await deleteDoc(doc(db, 'contents', selectedContent.id));
                    setSelectedContent(null);
                    setConfirmModal(null);
                    setToast({ message: "Conteúdo excluído!", type: 'success' });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `contents/${selectedContent.id}`);
                  }
                }
              });
            }}
            imageHistory={imageHistory[selectedContent.id] || []}
            videoHistory={videoHistory[selectedContent.id] || []}
            isGenerating={generatingContentIds.has(selectedContent.id)}
            isGeneratingVideo={generatingVideoIds.has(selectedContent.id)}
            videoProgress={videoProgress[selectedContent.id] || 0}
            imageProgress={imageProgress[selectedContent.id] || 0}
            onGenerateImages={() => handleGenerateContentImages(selectedContent, activeProject!)}
            onGenerateVideo={(options) => handleGenerateVideo(selectedContent, activeProject!, options)}
            onSaveImage={(historyItem) => handleSaveImage(selectedContent, historyItem)}
            onUpdateVisualPrompt={async (type: 'image' | 'video') => {
              try {
                const newPrompt = await generateSingleVisualPrompt(activeProject, selectedContent.title, selectedContent.caption, type, selectedContent.referenceImage, selectedContent.fontReferenceImage);
                if (newPrompt) {
                  const updateData = type === 'image' 
                    ? { visualPromptImage: newPrompt } 
                    : { visualPromptVideo: newPrompt };
                  
                  await updateDoc(doc(db, 'contents', selectedContent.id), updateData);
                  setSelectedContent({ ...selectedContent, ...updateData });
                  setToast({ message: `Prompt visual de ${type === 'image' ? 'imagem' : 'vídeo'} recriado com sucesso!`, type: 'success' });
                }
              } catch (error) {
                console.error("Error regenerating prompt:", error);
                setToast({ message: "Erro ao recriar prompt. Tente novamente.", type: 'error' });
              }
            }}
            onUploadReferenceImage={async (file) => {
              if (!selectedContent) return;
              try {
                const optimized = await optimizeImage(file, 800, 0.7);
                
                await updateDoc(doc(db, 'contents', selectedContent.id), {
                  referenceImage: optimized
                });
                setSelectedContent({ ...selectedContent, referenceImage: optimized });
                setToast({ message: "Imagem de referência otimizada e anexada!", type: 'success' });
              } catch (error) {
                console.error("Error optimizing reference image:", error);
                setToast({ message: "Erro ao otimizar imagem.", type: 'error' });
              }
            }}
            onRemoveReferenceImage={async () => {
              if (!selectedContent) return;
              await updateDoc(doc(db, 'contents', selectedContent.id), {
                referenceImage: deleteField()
              });
              const { referenceImage, ...rest } = selectedContent;
              setSelectedContent(rest as Content);
              setToast({ message: "Imagem de referência removida.", type: 'success' });
            }}
            onUploadFontReferenceImage={async (file) => {
              if (!selectedContent) return;
              try {
                const optimized = await optimizeImage(file, 800, 0.7);
                await updateDoc(doc(db, 'contents', selectedContent.id), {
                  fontReferenceImage: optimized
                });
                setSelectedContent({ ...selectedContent, fontReferenceImage: optimized });
                setToast({ message: "Referência de fonte atualizada!", type: 'success' });
              } catch (error) {
                console.error("Error uploading font reference image:", error);
                setToast({ message: "Erro ao carregar imagem.", type: 'error' });
              }
            }}
            onRemoveFontReferenceImage={async () => {
              if (!selectedContent) return;
              await updateDoc(doc(db, 'contents', selectedContent.id), {
                fontReferenceImage: deleteField()
              });
              const { fontReferenceImage, ...rest } = selectedContent;
              setSelectedContent(rest as Content);
              setToast({ message: "Referência de fonte removida.", type: 'success' });
            }}
          />
        ) : (
          <motion.main 
            key="main-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden relative z-10"
          >
        <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md px-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-display font-bold flex items-center gap-3 text-white">
              {view === 'projects' ? 'Meus Projetos' : view === 'gallery' ? 'Galeria' : activeProject?.name}
              {view === 'calendar' && activeProject && (
                <button 
                  onClick={() => handleEditProject(activeProject)} 
                  className="p-2 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/5"
                  title="Editar Projeto"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </h2>
            
            {view === 'calendar' && activeProject && (
              <div className="flex items-center gap-4 ml-4">
                <div className="w-px h-8 bg-white/10" />
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-display font-bold capitalize text-white min-w-[160px]">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                  <div className="flex glass-panel rounded-xl overflow-hidden border border-white/5">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/10 text-zinc-400 transition-colors"><ChevronLeft size={18} /></button>
                    <div className="w-px bg-white/10" />
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/10 text-zinc-400 transition-colors"><ChevronRight size={18} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {view === 'calendar' && activeProject && (
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                id="json-import" 
                className="hidden" 
                accept=".json"
                onChange={handleImportJSON}
              />
              <button 
                onClick={() => document.getElementById('json-import')?.click()}
                className="p-2.5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5 flex items-center gap-2"
                title="Importar JSON"
              >
                <FileJson size={18} />
                <span className="text-xs font-bold">Importar</span>
              </button>
              <button 
                onClick={handleDownloadTemplate}
                className="p-2.5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5"
                title="Baixar Template JSON"
              >
                <Download size={18} />
              </button>
              <div className="w-px h-8 bg-white/10 mx-2" />
              <button 
                onClick={() => handleGenerateContent(7)}
                disabled={isGenerating}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-500/20"
              >
                {isGenerating ? <Clock className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Gerar 7 Dias
              </button>
              <button 
                onClick={() => handleGenerateContent(30)}
                disabled={isGenerating}
                className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
              >
                {isGenerating ? <Clock className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Gerar Mês Completo
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8 relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-[0.02] mix-blend-screen pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {view === 'projects' ? (
              <motion.div 
                key="projects-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto relative z-10"
              >
                <button 
                  onClick={() => {
                    setEditingProjectId(null);
                    setNewProjectData({ 
                      name: '', 
                      description: '', 
                      targetAudience: '', 
                      toneOfVoice: '', 
                      mainGoals: '', 
                      contentPillars: '', 
                      competitors: '', 
                      keywords: '', 
                      brandValues: '',
                      avoidTopics: '',
                      logoLightImage: null, 
                      logoDarkImage: null,
                      typographyImage: null, 
                      graphicElementsImage: null, 
                      referenceCreativeImages: [null, null, null], 
                      artDirection: '' 
                    });
                    setIsProjectModalOpen(true);
                  }}
                  className="h-56 glass-card rounded-2xl flex flex-col items-center justify-center gap-4 text-zinc-400 hover:text-white transition-all group border-dashed"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-white/10">
                    <Plus size={24} />
                  </div>
                  <span className="font-display font-bold text-lg">Novo Projeto</span>
                </button>

                {projects.map(project => (
                  <div 
                    key={project.id}
                    className={cn(
                      "h-56 p-6 rounded-2xl transition-all cursor-pointer group relative flex flex-col glass-card",
                      activeProject?.id === project.id ? "border-violet-500/50 shadow-[0_0_30px_-10px_rgba(139,92,246,0.3)]" : ""
                    )}
                    onClick={() => {
                      setActiveProject(project);
                      setView('calendar');
                    }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-display font-bold text-white line-clamp-2 pr-8">{project.name}</h3>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all bg-black/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
                        <button 
                          onClick={(e) => handleEditProject(project, e)}
                          className="p-1.5 text-zinc-400 hover:text-white transition-all rounded-md hover:bg-white/10"
                          title="Editar Projeto"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 transition-all rounded-md hover:bg-rose-500/10"
                          title="Excluir Projeto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-3 mb-4 flex-1">{project.description}</p>
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {format(project.createdAt?.toDate() || new Date(), 'dd MMM yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : view === 'gallery' ? (
              <motion.div 
                key="gallery-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col relative z-10"
              >
                <GalleryView userId={user.uid} />
              </motion.div>
            ) : (
              <motion.div 
                key="calendar-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col relative z-10 min-h-fit"
              >
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 glass-panel rounded-2xl border border-white/5 mb-20">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="p-4 border-r border-b border-white/5 bg-black/40 text-xs font-bold uppercase tracking-widest text-zinc-500 text-center">
                      {day}
                    </div>
                  ))}
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(monthStart);
                    const startDate = startOfWeek(monthStart);
                    const endDate = endOfWeek(monthEnd);
                    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                    return calendarDays.map((day) => {
                      const dayStr = day.toISOString();
                      const dayContents = contents.filter(c => isSameDay(parseISO(c.date), day));
                      const isCurrentMonth = isSameMonth(day, monthStart);

                      return (
                        <div 
                          key={dayStr}
                          className={cn(
                            "min-h-[140px] p-2 border-r border-b border-white/5 transition-colors flex flex-col gap-1",
                            !isCurrentMonth ? "bg-black/20" : "bg-transparent hover:bg-white/[0.02]",
                            isSameDay(day, new Date()) && "bg-violet-500/5"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-bold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full",
                            isSameDay(day, new Date()) ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" : "text-zinc-500"
                          )}>
                            {format(day, 'd')}
                          </span>
                          
                          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
                            {dayContents.map(content => (
                              <button 
                                key={content.id}
                                onClick={() => setSelectedContent(content)}
                                className="text-[10px] text-left p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group shadow-sm flex flex-col gap-1 w-full overflow-hidden"
                              >
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {content.platform === 'Instagram' ? <Instagram size={10} className="text-fuchsia-400" /> : <Facebook size={10} className="text-blue-400" />}
                                  <span className="text-zinc-400 font-bold uppercase tracking-tighter">{content.format}</span>
                                </div>
                                <span className="font-medium text-white line-clamp-2 w-full group-hover:text-violet-300 transition-colors leading-tight">{content.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* New Project Modal */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsProjectModalOpen(false);
                setEditingProjectId(null);
                setNewProjectStep(1);
                setNewProjectData({ 
                  name: '', 
                  description: '', 
                  targetAudience: '', 
                  toneOfVoice: '', 
                  mainGoals: '', 
                  contentPillars: '', 
                  competitors: '', 
                  keywords: '', 
                  brandValues: '',
                  avoidTopics: '',
                  logoLightImage: null, 
                  logoDarkImage: null,
                  typographyImage: null, 
                  graphicElementsImage: null, 
                  referenceCreativeImages: [null, null, null], 
                  artDirection: '' 
                });
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl glass-panel rounded-3xl p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-4xl font-display font-bold text-white">{editingProjectId ? "Editar Projeto" : "Novo Projeto Estratégico"}</h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(step => (
                    <div key={step} className={cn("h-2 w-12 rounded-full transition-all", newProjectStep >= step ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20" : "bg-white/10")} />
                  ))}
                </div>
              </div>
              
              <div className="space-y-8">
                {newProjectStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Nome da Marca</label>
                        <input 
                          value={newProjectData.name}
                          onChange={e => setNewProjectData({...newProjectData, name: e.target.value})}
                          placeholder="Ex: Café Gourmet"
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors text-white placeholder:text-zinc-600 text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">O que a marca faz?</label>
                        <textarea 
                          value={newProjectData.description}
                          onChange={e => setNewProjectData({...newProjectData, description: e.target.value})}
                          rows={6}
                          placeholder="Descreva detalhadamente os produtos, serviços e o propósito da marca..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600 leading-relaxed"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-center items-center p-10 bg-violet-500/10 rounded-[2rem] border border-violet-500/20 text-center space-y-8 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/40 relative z-10">
                        <Sparkles size={48} className="text-white" />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-2xl font-display font-bold text-white mb-3">Estratégia com IA</h4>
                        <p className="text-zinc-400 text-base leading-relaxed max-w-xs">Nossa IA analisará sua marca e criará uma estratégia completa: público, tom de voz, objetivos e pilares.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={handleGenerateStrategy}
                        disabled={isGeneratingStrategy || !newProjectData.name || !newProjectData.description}
                        className="w-full py-5 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl relative z-10 text-lg"
                      >
                        {isGeneratingStrategy ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                        {isGeneratingStrategy ? "Analisando marca..." : "Gerar Estratégia Mágica"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {newProjectStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Público-Alvo</label>
                        <textarea 
                          value={newProjectData.targetAudience}
                          onChange={e => setNewProjectData({...newProjectData, targetAudience: e.target.value})}
                          rows={3}
                          placeholder="Ex: Jovens 20-30 anos, interessados em tecnologia e sustentabilidade..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tom de Voz</label>
                        <textarea 
                          value={newProjectData.toneOfVoice}
                          onChange={e => setNewProjectData({...newProjectData, toneOfVoice: e.target.value})}
                          rows={3}
                          placeholder="Ex: Descontraído, Profissional, Inspirador..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Valores da Marca</label>
                        <textarea 
                          value={newProjectData.brandValues}
                          onChange={e => setNewProjectData({...newProjectData, brandValues: e.target.value})}
                          rows={3}
                          placeholder="Ex: Sustentabilidade, Inovação, Transparência..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Concorrentes / Referências</label>
                        <textarea 
                          value={newProjectData.competitors}
                          onChange={e => setNewProjectData({...newProjectData, competitors: e.target.value})}
                          rows={3}
                          placeholder="Ex: @marca_x, @marca_y, @referencia_z"
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {newProjectStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Objetivos Principais</label>
                        <textarea 
                          value={newProjectData.mainGoals}
                          onChange={e => setNewProjectData({...newProjectData, mainGoals: e.target.value})}
                          rows={3}
                          placeholder="Ex: Aumentar vendas em 20%, Melhorar engajamento..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Pilares de Conteúdo</label>
                        <textarea 
                          value={newProjectData.contentPillars}
                          onChange={e => setNewProjectData({...newProjectData, contentPillars: e.target.value})}
                          rows={3}
                          placeholder="Ex: Dicas, Bastidores, Ofertas, Prova Social..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Palavras-Chave</label>
                        <textarea 
                          value={newProjectData.keywords}
                          onChange={e => setNewProjectData({...newProjectData, keywords: e.target.value})}
                          rows={3}
                          placeholder="Ex: sustentabilidade, luxo, café, artesanal..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">O que EVITAR (Temas/Abordagens)</label>
                        <textarea 
                          value={newProjectData.avoidTopics}
                          onChange={e => setNewProjectData({...newProjectData, avoidTopics: e.target.value})}
                          rows={3}
                          placeholder="Ex: Política, Humor ácido, Comparação direta com concorrentes..."
                          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {newProjectStep === 4 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Direcionamento de Arte e Design</label>
                      <textarea 
                        value={newProjectData.artDirection}
                        onChange={e => setNewProjectData({...newProjectData, artDirection: e.target.value})}
                        rows={4}
                        placeholder="Ex: Misturar fotografias de pessoas reais com elementos gráficos 2D. Usar tipografia bold exclusiva da marca. Cores vibrantes e alto contraste. Estilo colagem moderna."
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-violet-500 transition-colors resize-none text-white placeholder:text-zinc-600 leading-relaxed"
                      />
                      <p className="text-xs text-zinc-500 mt-1">Isso guiará a IA na hora de gerar as artes e os prompts visuais.</p>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ativos Visuais da Marca</label>
                        <p className="text-sm text-zinc-400">Faça upload de referências específicas para guiar a IA.</p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Logo Light */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">1. Logo (Light Mode)</label>
                          {newProjectData.logoLightImage ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-white/5">
                              <img src={`data:${newProjectData.logoLightImage.mimeType};base64,${newProjectData.logoLightImage.data}`} className="w-full h-full object-contain p-2" alt="Logo Light" referrerPolicy="no-referrer" />
                              <button onClick={() => removeSpecificImage('logoLightImage')} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                            </div>
                          ) : (
                            <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer bg-black/20">
                              <Plus size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">Logo Light</span>
                              <input type="file" onChange={(e) => handleSpecificImageUpload(e, 'logoLightImage')} className="hidden" accept="image/*" />
                            </label>
                          )}
                        </div>

                        {/* Logo Dark */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">2. Logo (Dark Mode)</label>
                          {newProjectData.logoDarkImage ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/20">
                              <img src={`data:${newProjectData.logoDarkImage.mimeType};base64,${newProjectData.logoDarkImage.data}`} className="w-full h-full object-contain p-2" alt="Logo Dark" referrerPolicy="no-referrer" />
                              <button onClick={() => removeSpecificImage('logoDarkImage')} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                            </div>
                          ) : (
                            <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer bg-black/20">
                              <Plus size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">Logo Dark</span>
                              <input type="file" onChange={(e) => handleSpecificImageUpload(e, 'logoDarkImage')} className="hidden" accept="image/*" />
                            </label>
                          )}
                        </div>

                        {/* Typography */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">3. Tipografia / Fontes</label>
                          {newProjectData.typographyImage ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/20">
                              <img src={`data:${newProjectData.typographyImage.mimeType};base64,${newProjectData.typographyImage.data}`} className="w-full h-full object-cover" alt="Tipografia" referrerPolicy="no-referrer" />
                              <button onClick={() => removeSpecificImage('typographyImage')} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                            </div>
                          ) : (
                            <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer bg-black/20">
                              <Plus size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">Upload Fonte</span>
                              <input type="file" onChange={(e) => handleSpecificImageUpload(e, 'typographyImage')} className="hidden" accept="image/*" />
                            </label>
                          )}
                        </div>

                        {/* Graphic Elements */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">4. Elementos Gráficos</label>
                          {newProjectData.graphicElementsImage ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/20">
                              <img src={`data:${newProjectData.graphicElementsImage.mimeType};base64,${newProjectData.graphicElementsImage.data}`} className="w-full h-full object-cover" alt="Elementos" referrerPolicy="no-referrer" />
                              <button onClick={() => removeSpecificImage('graphicElementsImage')} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                            </div>
                          ) : (
                            <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer bg-black/20">
                              <Plus size={20} />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">Upload Elementos</span>
                              <input type="file" onChange={(e) => handleSpecificImageUpload(e, 'graphicElementsImage')} className="hidden" accept="image/*" />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">5. Criativos de Referência (Até 3)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {newProjectData.referenceCreativeImages.map((img, idx) => (
                            <div key={idx} className="space-y-2">
                              {img ? (
                                <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group bg-black/20">
                                  <img src={`data:${img.mimeType};base64,${img.data}`} className="w-full h-full object-cover" alt={`Referência ${idx + 1}`} referrerPolicy="no-referrer" />
                                  <button onClick={() => removeSpecificImage('referenceCreativeImages', idx)} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                                </div>
                              ) : (
                                <label className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer bg-black/20">
                                  <Plus size={20} />
                                  <span className="text-[10px] font-bold uppercase tracking-tighter">Upload Ref {idx + 1}</span>
                                  <input type="file" onChange={(e) => handleSpecificImageUpload(e, 'referenceCreativeImages', idx)} className="hidden" accept="image/*" />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-4 pt-10 border-t border-white/10">
                  {newProjectStep > 1 && (
                    <button 
                      type="button"
                      onClick={() => setNewProjectStep(prev => prev - 1)}
                      className="px-8 py-4 border border-white/10 rounded-2xl font-bold hover:bg-white/5 transition-colors text-white"
                    >
                      Voltar
                    </button>
                  )}
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setIsProjectModalOpen(false);
                      setEditingProjectId(null);
                      setNewProjectStep(1);
                      setNewProjectData({ 
                        name: '', 
                        description: '', 
                        targetAudience: '', 
                        toneOfVoice: '', 
                        mainGoals: '', 
                        contentPillars: '', 
                        competitors: '', 
                        keywords: '', 
                        brandValues: '',
                        avoidTopics: '',
                        logoLightImage: null, 
                        logoDarkImage: null,
                        typographyImage: null, 
                        graphicElementsImage: null, 
                        referenceCreativeImages: [null, null, null], 
                        artDirection: '' 
                      });
                    }}
                    className={cn(
                      "py-4 border border-white/10 rounded-2xl font-bold hover:bg-white/5 transition-colors text-zinc-500 hover:text-white",
                      newProjectStep === 1 ? "flex-1" : "px-8"
                    )}
                  >
                    Cancelar
                  </button>
                  
                  {newProjectStep < 4 ? (
                    <button 
                      type="button"
                      onClick={() => setNewProjectStep(prev => prev + 1)}
                      disabled={newProjectStep === 1 && (!newProjectData.name || !newProjectData.description)}
                      className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-violet-500/20 disabled:opacity-50 disabled:shadow-none text-lg"
                    >
                      Próximo Passo
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleSaveProject}
                      disabled={!newProjectData.name || !newProjectData.description}
                      className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-violet-500/20 disabled:opacity-50 disabled:shadow-none text-lg"
                    >
                      {editingProjectId ? "Salvar Alterações" : "Finalizar e Criar Projeto"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-display font-bold mb-2 text-white">{confirmModal.title}</h3>
              <p className="text-zinc-400 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2 border border-white/10 rounded-lg text-sm font-bold hover:bg-white/5 transition-colors text-white"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 z-[70] px-6 py-3 rounded-full shadow-lg flex items-center gap-2",
              toast.type === 'success' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Chat */}
      {user && activeProject && (
        <AIChat 
          activeProject={activeProject}
          contents={contents}
          onUpdateProject={handleUpdateProjectAI}
          onUpdateContent={handleUpdateContentAI}
          onGenerateContent={handleGenerateContentAI}
        />
      )}
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
