import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, X, Minimize2, Maximize2, Loader2, Paperclip, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { optimizeImage } from '../lib/imageUtils';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AIChatProps {
  activeProject: any;
  contents: any[];
  onUpdateProject: (data: any) => Promise<void>;
  onUpdateContent: (contentId: string, data: any) => Promise<void>;
  onGenerateContent: (date: string, theme: string) => Promise<void>;
}

export default function AIChat({ 
  activeProject, 
  contents, 
  onUpdateProject, 
  onUpdateContent, 
  onGenerateContent 
}: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Olá! Sou seu assistente estratégico. Como posso ajudar com seu projeto ou conteúdos hoje?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimized = await optimizeImage(file, 800, 0.7);
      setAttachedImage(optimized);
    } catch (error) {
      console.error("Error attaching image:", error);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMessage = input.trim();
    const currentImage = attachedImage;
    
    setInput('');
    setAttachedImage(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage || (currentImage ? "[Imagem Anexada]" : "") }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const systemInstruction = `
        Você é um assistente estratégico de marketing e criação de conteúdo para a plataforma "Editorial AI & Criativo".
        Seu objetivo é ajudar o usuário a gerenciar seu projeto e conteúdos.
        
        NOVO RECURSO: Importação de Conteúdo via JSON
        O usuário agora pode subir múltiplos conteúdos de uma vez usando um arquivo JSON.
        Se o usuário perguntar sobre o formato ou como subir, explique que:
        1. Existe um botão "Importar" (ícone de arquivo JSON) e um botão "Baixar Template" (ícone de download) no cabeçalho do calendário quando um projeto está ativo.
        2. O formato JSON deve ser um array de objetos com os campos: "date" (YYYY-MM-DD), "title", "caption", "platform" (Instagram/Facebook/Both) e "format" (Reel/Post/Story/Carousel).
        Exemplo: [{"date": "2026-04-05", "title": "Meu Post", "caption": "Legenda aqui", "platform": "Instagram", "format": "Post"}]

        PROJETO ATIVO:
        - Nome: ${activeProject?.name}
        - Descrição: ${activeProject?.description}
        - Tom de Voz: ${activeProject?.toneOfVoice}
        - Público: ${activeProject?.targetAudience}
        
        CONTEÚDOS ATUAIS:
        ${contents.map(c => `- ID: ${c.id}, Título: ${c.title}, Data: ${c.date}`).join('\n')}

        Você pode receber imagens do usuário. Use-as como referência para suas sugestões ou análises.
        Você pode realizar ações como atualizar o projeto, atualizar conteúdos específicos ou sugerir novos conteúdos usando as ferramentas fornecidas.
        Sempre confirme com o usuário o que você fez.
        Se o usuário pedir para mudar algo, use a ferramenta apropriada.
      `;

      const tools = [
        {
          functionDeclarations: [
            {
              name: "updateProject",
              description: "Atualiza as informações do projeto ativo",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  targetAudience: { type: Type.STRING },
                  toneOfVoice: { type: Type.STRING },
                  mainGoals: { type: Type.STRING },
                  contentPillars: { type: Type.STRING },
                  competitors: { type: Type.STRING },
                  keywords: { type: Type.STRING },
                  brandValues: { type: Type.STRING },
                  avoidTopics: { type: Type.STRING },
                  artDirection: { type: Type.STRING }
                }
              }
            },
            {
              name: "updateContent",
              description: "Atualiza um item de conteúdo específico",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  contentId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  caption: { type: Type.STRING },
                  format: { type: Type.STRING, enum: ["Reel", "Post", "Story", "Carousel"] },
                  platform: { type: Type.STRING, enum: ["Instagram", "Facebook", "Both"] }
                },
                required: ["contentId"]
              }
            },
            {
              name: "generateContentForDate",
              description: "Gera uma nova sugestão de conteúdo para uma data específica",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
                  theme: { type: Type.STRING, description: "Tema ou assunto do conteúdo" }
                },
                required: ["date", "theme"]
              }
            }
          ]
        }
      ];

      const userParts: any[] = [];
      if (userMessage) userParts.push({ text: userMessage });
      if (currentImage) {
        userParts.push({
          inlineData: {
            data: currentImage.data,
            mimeType: currentImage.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: userParts }
        ],
        config: {
          systemInstruction,
          tools,
        }
      });

      const functionCalls = response.functionCalls;
      
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'updateProject') {
            await onUpdateProject(call.args);
          } else if (call.name === 'updateContent') {
            const { contentId, ...data } = call.args as any;
            await onUpdateContent(contentId, data);
          } else if (call.name === 'generateContentForDate') {
            const { date, theme } = call.args as any;
            await onGenerateContent(date, theme);
          }
        }

        // Get a final text response after function calls
        const followUp = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
            { role: 'user', parts: [{ text: userMessage }] },
            { role: 'model', parts: [{ text: "Ação realizada com sucesso." }] } // Simplified context
          ],
          config: { systemInstruction }
        });
        
        setMessages(prev => [...prev, { role: 'model', content: followUp.text || 'Ação concluída com sucesso!' }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', content: response.text || 'Desculpe, não consegui processar sua solicitação.' }]);
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', content: 'Ops, ocorreu um erro ao processar sua mensagem. Tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-white text-black rounded-full shadow-2xl flex items-center justify-center hover:bg-zinc-200 transition-colors z-50 group"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '64px' : '600px',
              width: '400px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Assistente IA</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  {messages.map((msg, i) => (
                    <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        msg.role === 'user' ? "bg-zinc-800" : "bg-white"
                      )}>
                        {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Bot className="w-4 h-4 text-black" />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-2xl text-sm",
                        msg.role === 'user' 
                          ? "bg-white text-black rounded-tr-none" 
                          : "bg-zinc-800 text-zinc-200 rounded-tl-none"
                      )}>
                        <div className="markdown-body">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-black" />
                      </div>
                      <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        <span className="text-sm text-zinc-400">Pensando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                  {attachedImage && (
                    <div className="mb-3 relative inline-block">
                      <img 
                        src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} 
                        alt="Preview" 
                        className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                      />
                      <button 
                        onClick={() => setAttachedImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="relative flex items-center gap-2">
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Anexar imagem"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Como posso ajudar?"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={(!input.trim() && !attachedImage) || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-black rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center mt-3">
                    IA pode cometer erros. Verifique informações importantes.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
