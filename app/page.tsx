"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, AudioLines, Check, ChevronDown, CircleHelp, FileImage, Globe2,
  ImagePlus, LogOut, Menu, MessageSquare, Moon, MoreHorizontal, Plus, Search, Send, Settings2,
  ShieldCheck, Sparkles, Sun, Trash2, UserRound, WandSparkles, X, AlertCircle, PanelLeftClose,
} from "lucide-react";

type User = { id: string; username: string };
type Conversation = { id: string; title: string; preview?: string | null; updated_at?: string };
type Message = { id: string; role: "user" | "assistant"; content: string; metadata?: { type?: string; imageUrl?: string; prompt?: string; enhancedPrompt?: string }; streaming?: boolean };
type Mode = "chat" | "image" | "classify" | "language";
type Preferences = { theme: "dark" | "light"; improveImagePrompts: boolean };

async function apiJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Erro HTTP ${response.status}`) as Error & { data?: any };
    error.data = payload;
    throw error;
  }
  return payload;
}
function cookieExists(name: string) {
  return typeof document !== "undefined" && document.cookie.split(";").some((x) => x.trim().startsWith(`${name}=`));
}
function saveConsent(value: "accepted" | "essential") {
  document.cookie = `shyna_cookie_consent=${value}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
function formatTime(value?: string) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); } catch { return ""; }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [improvePrompt, setImprovePrompt] = useState(true);
  const [cookieBanner, setCookieBanner] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [classifyResult, setClassifyResult] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    const data = await apiJson("/api/conversations");
    setConversations(data.conversations || []);
  }, []);

  const loadPreferences = useCallback(async () => {
    const data = await apiJson("/api/preferences");
    const prefs = (data.preferences || {}) as Partial<Preferences>;
    if (prefs.theme === "dark" || prefs.theme === "light") setTheme(prefs.theme);
    if (typeof prefs.improveImagePrompts === "boolean") setImprovePrompt(prefs.improveImagePrompts);
  }, []);

  useEffect(() => {
    setCookieBanner(!cookieExists("shyna_cookie_consent"));
    apiJson("/api/auth/me").then(async (data) => {
      setUser(data.user || null);
      if (data.user) {
        await Promise.all([loadConversations().catch(() => undefined), loadPreferences().catch(() => undefined)]);
      }
    }).catch(() => undefined).finally(() => setAuthChecked(true));
  }, [loadConversations, loadPreferences]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: sending ? "smooth" : "auto", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => !term || `${c.title} ${c.preview || ""}`.toLowerCase().includes(term));
  }, [conversations, search]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await apiJson(`/api/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
      setPassword("");
      await Promise.all([loadConversations().catch(() => undefined), loadPreferences().catch(() => undefined)]);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.");
    } finally { setAuthLoading(false); }
  }

  async function logout() {
    try { await apiJson("/api/auth/logout", { method: "POST" }); } catch { /* encerra a sessão visual mesmo se a rede falhar */ }
    setUser(null); setMessages([]); setConversations([]); setActiveConversationId(null); setShowAccountMenu(false);
  }

  function newChat() {
    setActiveConversationId(null); setMessages([]); setInput(""); setPageError(""); setClassifyResult(""); setMode("chat"); setSidebarOpen(false); textareaRef.current?.focus();
  }

  async function openConversation(conversationId: string) {
    setPageError(""); setSidebarOpen(false); setActiveConversationId(conversationId); setMode("chat"); setClassifyResult("");
    try {
      const data = await apiJson(`/api/conversations/${conversationId}`);
      setMessages((data.messages || []).map((m: Message) => ({ ...m, metadata: m.metadata || {} })));
    } catch (error) { setPageError(error instanceof Error ? error.message : "Não foi possível abrir a conversa."); }
  }

  async function deleteConversation(conversationId: string) {
    if (!confirm("Excluir esta conversa permanentemente?")) return;
    try {
      await apiJson(`/api/conversations/${conversationId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) newChat();
    } catch (error) { setPageError(error instanceof Error ? error.message : "Não foi possível excluir."); }
  }

  async function clearAllConversations() {
    if (!confirm("Apagar todas as conversas salvas? Esta ação não pode ser desfeita.")) return;
    try { await apiJson("/api/conversations", { method: "DELETE" }); setConversations([]); newChat(); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Não foi possível limpar as conversas."); }
  }

  async function savePref(patch: Partial<Preferences>) {
    const next = { theme, improveImagePrompts: improvePrompt, ...patch };
    setTheme(next.theme); setImprovePrompt(next.improveImagePrompts);
    try { await apiJson("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Não foi possível salvar as preferências."); }
  }

  async function sendChat(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setInput(""); setPageError(""); setSending(true);
    const placeholderId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: trimmed }, { id: placeholderId, role: "assistant", content: "", streaming: true }]);
    let gotMeta = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: trimmed, conversationId: activeConversationId }), cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.conversationId) {
          setActiveConversationId(payload.conversationId);
          setConversations((prev) => prev.some((c) => c.id === payload.conversationId) ? prev : [{ id: payload.conversationId, title: trimmed.slice(0, 52) }, ...prev]);
        }
        throw new Error(payload?.error || `Falha na conversa (HTTP ${response.status}).`);
      }
      if (!response.body) throw new Error("Este navegador não conseguiu abrir o fluxo de resposta.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let complete = false;
      while (!complete) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() || "";
        for (const evt of events) {
          const dataLine = evt.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          let item: any;
          try { item = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (item.type === "meta" && item.conversationId) {
            gotMeta = true; setActiveConversationId(item.conversationId);
            if (!activeConversationId) loadConversations().catch(() => undefined);
          }
          if (item.type === "delta") {
            setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, content: m.content + item.text } : m));
          }
          if (item.type === "error") throw new Error(item.error || "A resposta foi interrompida.");
          if (item.type === "done") complete = true;
        }
      }
      if (!gotMeta) throw new Error("A resposta da IA foi interrompida antes de iniciar.");
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, streaming: false, content: m.content || "A IA não retornou texto." } : m));
      await loadConversations().catch(() => undefined);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Erro inesperado na conversa.";
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, streaming: false, content: m.content || `Não consegui responder. ${messageText}` } : m));
      setPageError(messageText);
      if (!gotMeta) setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    } finally { setSending(false); }
  }

  async function generateImage(prompt: string) {
    setImageBusy(true); setPageError(""); setClassifyResult("");
    const trimmed = prompt.trim();
    try {
      const data = await apiJson("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: trimmed, conversationId: activeConversationId, improvePrompt }) });
      const conversationId = data.conversationId as string;
      setActiveConversationId(conversationId);
      setMessages((prev) => [...prev, { id: `generated-user-${Date.now()}`, role: "user", content: `Gerar imagem: ${trimmed}` }, { id: `generated-${Date.now()}`, role: "assistant", content: `Imagem gerada. ${data.enhancedPrompt !== trimmed ? "O prompt foi aprimorado automaticamente." : ""}`, metadata: { type: "image", imageUrl: data.imageUrl, prompt: trimmed, enhancedPrompt: data.enhancedPrompt } }]);
      setInput(""); setMode("chat"); await loadConversations().catch(() => undefined);
    } catch (error) {
      const apiError = error as Error & { data?: { conversationId?: string } };
      if (apiError.data?.conversationId) {
        setActiveConversationId(apiError.data.conversationId);
        await loadConversations().catch(() => undefined);
        await openConversation(apiError.data.conversationId).catch(() => undefined);
      }
      setPageError(error instanceof Error ? error.message : "Erro na geração de imagem.");
    }
    finally { setImageBusy(false); }
  }

  async function classifyImage(file: File) {
    setImageBusy(true); setPageError(""); setClassifyResult("");
    try {
      const form = new FormData(); form.append("image", file);
      const data = await apiJson("/api/classify-image", { method: "POST", body: form });
      setClassifyResult(data.classification);
      setMessages((prev) => [...prev, { id: `classification-${Date.now()}`, role: "assistant", content: `**Análise da imagem**\n\n${data.classification}` }]);
      setMode("chat");
    } catch (error) { setPageError(error instanceof Error ? error.message : "Não foi possível analisar a imagem."); }
    finally { setImageBusy(false); setSelectedFileName(""); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function classifyLanguage(text: string) {
    setImageBusy(true); setPageError("");
    try {
      const data = await apiJson("/api/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const output = data.language == null ? JSON.stringify(data.result, null, 2) : String(data.language);
      setMessages((prev) => [...prev, { id: `language-${Date.now()}`, role: "assistant", content: `**Idioma detectado**\n\n${output}` }]);
      setInput(""); setMode("chat");
    } catch (error) { setPageError(error instanceof Error ? error.message : "Falha ao classificar idioma."); }
    finally { setImageBusy(false); }
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (mode === "chat") return sendChat(input);
    if (mode === "image") { if (input.trim()) await generateImage(input); return; }
    if (mode === "language") { if (input.trim()) await classifyLanguage(input); return; }
    if (mode === "classify") { fileRef.current?.click(); return; }
  }
  function onTextareaKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSubmit(); }
  }

  if (!authChecked) return <main className="loading-screen"><div className="brand-mark large"><Sparkles size={25} /></div><span className="pulse-dot" /> Preparando a Shyna AI…</main>;

  if (!user) return <>
    <main className="auth-page">
      <div className="auth-ambient ambient-a" /><div className="auth-ambient ambient-b" />
      <div className="auth-brand"><div className="brand-mark"><Sparkles size={23} /></div><span>shyna<span className="brand-ai"> ai</span></span></div>
      <section className="auth-card">
        <div className="auth-glyph"><Sparkles size={23} /></div>
        <p className="eyebrow">SEU ESPAÇO DE IA</p>
        <h1>{authMode === "login" ? "Bom ter você de volta." : "Crie seu espaço."}</h1>
        <p className="muted auth-copy">{authMode === "login" ? "Entre para continuar suas conversas." : "Um nome e uma senha. Sem precisar de e-mail."}</p>
        <form className="auth-form" onSubmit={handleAuth}>
          <label htmlFor="username">Nome de usuário</label>
          <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} placeholder="seu_nome" required />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={authMode === "register" ? 8 : 1} maxLength={72} placeholder={authMode === "register" ? "Pelo menos 8 caracteres" : "Sua senha"} required />
          {authError && <div className="inline-error"><AlertCircle size={16} />{authError}</div>}
          <button className="primary-button auth-submit" type="submit" disabled={authLoading}>{authLoading ? <span className="spinner" /> : <>{authMode === "login" ? "Entrar na Shyna" : "Criar conta"}<ArrowUp size={17} /></>}</button>
        </form>
        <div className="auth-switch">{authMode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "Criar conta" : "Entrar"}</button></div>
        <p className="auth-legal">Ao continuar, você concorda com os <a href="/terms">Termos de uso</a> e a <a href="/cookies">Política de cookies</a>.</p>
      </section>
      <div className="auth-foot"><span><ShieldCheck size={14} /> Senhas protegidas por hash</span><span>Shyna AI · versão inicial</span></div>
    </main>
    {cookieBanner && <CookieBanner onChoice={(v) => { saveConsent(v); setCookieBanner(false); }} />}
  </>;

  return <main className={`app-shell ${theme === "light" ? "theme-light" : ""}`}>
    {sidebarOpen && <button className="mobile-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top">
        <a className="brand" href="/" aria-label="Shyna AI início"><span className="brand-mark"><Sparkles size={20} /></span><span>shyna<span className="brand-ai"> ai</span></span></a>
        <button className="icon-button collapse-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><PanelLeftClose size={18} /></button>
      </div>
      <button className="new-chat-button" onClick={newChat}><Plus size={19} strokeWidth={2.3} /><span>Nova conversa</span><kbd>⌘ K</kbd></button>
      <div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" />{search && <button onClick={() => setSearch("")} aria-label="Limpar busca"><X size={14} /></button>}</div>
      <div className="sidebar-section-label">RECENTES <span>{visibleConversations.length}</span></div>
      <nav className="conversation-list" aria-label="Conversas recentes">
        {visibleConversations.length === 0 ? <div className="empty-conversations">{search ? "Nenhum resultado para a busca." : "Suas conversas aparecerão aqui."}</div> : visibleConversations.map((c) => <div key={c.id} className={`conversation-row ${activeConversationId === c.id ? "selected" : ""}`}>
          <button className="conversation-open" onClick={() => void openConversation(c.id)}><MessageSquare size={16} /><span className="conversation-title">{c.title || "Nova conversa"}</span></button>
          <button className="conversation-delete" aria-label={`Excluir ${c.title}`} title="Excluir conversa" onClick={() => void deleteConversation(c.id)}><Trash2 size={14} /></button>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="sidebar-action danger-action" onClick={() => void clearAllConversations()}><Trash2 size={16} /><span>Limpar conversas</span></button>
        <div className="sidebar-divider" />
        <button className="sidebar-action" onClick={() => void savePref({ theme: theme === "dark" ? "light" : "dark" })}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span><span className={`toggle ${theme === "light" ? "on" : ""}`}><span /></span></button>
        <button className="sidebar-action" onClick={() => setShowAccountMenu((v) => !v)}><Settings2 size={17} /><span>Preferências</span><ChevronDown size={14} className={showAccountMenu ? "rotate-180" : ""} /></button>
        {showAccountMenu && <div className="preferences-panel">
          <label className="preference-line"><span><WandSparkles size={15} /> Melhorar prompts de imagem</span><input type="checkbox" checked={improvePrompt} onChange={(e) => void savePref({ improveImagePrompts: e.target.checked })} /></label>
          <a href="/terms"><ShieldCheck size={14} /> Termos de uso</a>
          <a href="/cookies"><CircleHelp size={14} /> Cookies e privacidade</a>
        </div>}
        <button className="sidebar-action" onClick={() => setCookieBanner(true)}><ShieldCheck size={17} /><span>Preferências de cookies</span></button>
        <div className="user-profile">
          <div className="avatar"><UserRound size={18} /></div>
          <div className="user-details"><strong>{user.username}</strong><span>Conta pessoal</span></div>
          <button className="icon-button logout-button" onClick={() => void logout()} title="Sair" aria-label="Sair"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>

    <section className="main-panel">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="topbar-title"><MessageSquare size={17} /><span>{activeConversationId ? conversations.find((c) => c.id === activeConversationId)?.title || "Conversa" : mode === "image" ? "Criar imagem" : mode === "classify" ? "Analisar imagem" : mode === "language" ? "Classificar idioma" : "Conversa com Shyna AI"}</span><span className="status-pill"><span /> IA pronta</span></div>
        <div className="topbar-right"><span className="secure-label"><ShieldCheck size={14} /> Privado</span><div className="top-avatar">{user.username.slice(0, 1).toUpperCase()}</div><span className="top-user-name">{user.username}</span></div>
      </header>

      <div className="content-scroll" key={`${activeConversationId || "new"}-${mode}`}>
        {messages.length === 0 ? <div className="welcome-state">
          <div className="welcome-logo"><div className="brand-mark large"><Sparkles size={28} /></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /></div>
          <p className="eyebrow">INTELIGÊNCIA CRIATIVA, DO SEU JEITO</p>
          <h1>{mode === "image" ? "O que vamos imaginar?" : mode === "classify" ? "Vamos entender uma imagem." : mode === "language" ? "Qual idioma você quer detectar?" : <>Olá, {user.username}.<br /><span>O que vamos explorar hoje?</span></>}</h1>
          <p className="welcome-copy">Converse, explore ideias, transforme descrições em imagens ou analise o que você enviar.</p>
          <div className="suggestion-grid">
            <button onClick={() => { setMode("chat"); setInput("Me ajude a transformar uma ideia em um plano prático."); textareaRef.current?.focus(); }}><span className="suggestion-icon violet"><Sparkles size={18} /></span><span><strong>Explorar uma ideia</strong><small>Transforme pensamentos em planos</small></span><ArrowUp size={15} /></button>
            <button onClick={() => { setMode("image"); setInput("Uma paisagem cinematográfica ao entardecer, luz suave e detalhes realistas"); textareaRef.current?.focus(); }}><span className="suggestion-icon green"><ImagePlus size={18} /></span><span><strong>Criar uma imagem</strong><small>Descreva o que quer visualizar</small></span><ArrowUp size={15} /></button>
            <button onClick={() => { setMode("classify"); fileRef.current?.click(); }}><span className="suggestion-icon amber"><FileImage size={18} /></span><span><strong>Analisar uma imagem</strong><small>Identifique objetos e elementos visuais</small></span><ArrowUp size={15} /></button>
            <button onClick={() => { setMode("language"); setInput(""); textareaRef.current?.focus(); }}><span className="suggestion-icon blue"><Globe2 size={18} /></span><span><strong>Detectar idioma</strong><small>Identifique o idioma de um texto</small></span><ArrowUp size={15} /></button>
          </div>
        </div> : <div className="message-thread">
          {messages.map((m) => <article key={m.id} className={`message-row ${m.role === "user" ? "user-message" : "assistant-message"}`}>
            {m.role === "assistant" ? <div className="message-avatar ai-avatar"><Sparkles size={16} /></div> : <div className="message-avatar user-avatar">{user.username.slice(0, 1).toUpperCase()}</div>}
            <div className="message-body">
              <div className="message-name">{m.role === "assistant" ? "Shyna AI" : "Você"}{m.streaming && <span className="typing-label"><i /> escrevendo</span>}</div>
              {m.metadata?.imageUrl && <div className="generated-image-wrap"><img src={m.metadata.imageUrl} alt={m.metadata.prompt || "Imagem gerada pela Shyna AI"} loading="lazy" /><div className="image-caption"><ImagePlus size={14} />{m.metadata.enhancedPrompt ? "Prompt otimizado" : "Imagem gerada"}</div></div>}
              <div className={`message-content ${m.streaming ? "content-streaming" : ""}`}>{renderSimpleMarkdown(m.content)}{m.streaming && <span className="stream-cursor" />}</div>
              {m.metadata?.type === "image" && m.metadata.enhancedPrompt && <details className="prompt-details"><summary>Ver prompt usado</summary><p>{m.metadata.enhancedPrompt}</p></details>}
              {m.role === "assistant" && !m.streaming && <div className="message-tools"><button title="Copiar resposta" onClick={() => navigator.clipboard?.writeText(m.content).catch(() => undefined)}><Check size={14} /> Copiar texto</button></div>}
            </div>
          </article>)}
          <div ref={endRef} />
        </div>}
      </div>

      <div className="composer-area">
        {pageError && <div className="error-banner"><AlertCircle size={16} /><span>{pageError}</span><button onClick={() => setPageError("")} aria-label="Fechar erro"><X size={14} /></button></div>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setSelectedFileName(file.name); void classifyImage(file); } }} />
        {mode === "classify" && <div className="selected-file-row"><FileImage size={16} /><span>{selectedFileName || "Escolha uma imagem para analisar com Gemini"}</span><button onClick={() => fileRef.current?.click()} disabled={imageBusy}>Escolher arquivo</button></div>}
        <div className="composer-box">
          <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onTextareaKey} disabled={sending || imageBusy} placeholder={mode === "image" ? "Descreva a imagem que você quer criar…" : mode === "language" ? "Digite ou cole um texto para detectar o idioma…" : mode === "classify" ? "Selecione uma imagem acima para começar…" : "Escreva uma mensagem para a Shyna AI…"} aria-label="Mensagem" />
          <div className="composer-actions">
            <div className="tool-chips">
              <button className={`tool-chip ${mode === "chat" ? "active" : ""}`} onClick={() => setMode("chat")}><MessageSquare size={14} /> Chat</button>
              <button className={`tool-chip ${mode === "image" ? "active" : ""}`} onClick={() => setMode("image")}><ImagePlus size={14} /> Imagem</button>
              <button className={`tool-chip ${mode === "classify" ? "active" : ""}`} onClick={() => { setMode("classify"); setSelectedFileName(""); }}><FileImage size={14} /> Analisar imagem</button>
              <button className={`tool-chip ${mode === "language" ? "active" : ""}`} onClick={() => setMode("language")}><Globe2 size={14} /> Idioma</button>
            </div>
            <button className="send-button" disabled={sending || imageBusy || (mode !== "classify" && !input.trim())} onClick={() => void handleSubmit()} aria-label={mode === "image" ? "Gerar imagem" : mode === "classify" ? "Escolher imagem" : mode === "language" ? "Detectar idioma" : "Enviar mensagem"}>
              {sending || imageBusy ? <span className="spinner" /> : mode === "image" ? <WandSparkles size={18} /> : mode === "classify" ? <FileImage size={18} /> : mode === "language" ? <Globe2 size={18} /> : <ArrowUp size={19} />}
            </button>
          </div>
        </div>
        {mode === "image" && <p className="prompt-improve-note"><WandSparkles size={13} /> {improvePrompt ? "A Shyna pode aprimorar seu prompt antes de gerar." : "Melhoria automática desativada nas preferências."} <button onClick={() => void savePref({ improveImagePrompts: !improvePrompt })}>{improvePrompt ? "Desativar" : "Ativar"}</button></p>}
        <p className="composer-footnote">A Shyna AI pode cometer erros. Confira informações importantes antes de agir. <a href="/terms">Termos</a></p>
      </div>
    </section>
    {cookieBanner && <CookieBanner onChoice={(v) => { saveConsent(v); setCookieBanner(false); }} />}
  </main>;
}

function renderSimpleMarkdown(text: string) {
  // Renderizador visual simples, sem interpretar HTML ou executar conteúdo da resposta.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part.split("\n").map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{line}</span>)}</span>;
  });
}

function CookieBanner({ onChoice }: { onChoice: (choice: "accepted" | "essential") => void }) {
  return <div className="cookie-banner" role="dialog" aria-label="Preferências de cookies">
    <div className="cookie-icon"><ShieldCheck size={19} /></div>
    <div className="cookie-copy"><strong>Sua privacidade importa</strong><p>Usamos apenas cookies essenciais para manter sua sessão e lembrar sua escolha de cookies. Não há rastreamento publicitário neste protótipo.</p><a href="/cookies">Saiba mais sobre cookies</a></div>
    <div className="cookie-buttons"><button className="secondary-button" onClick={() => onChoice("essential")}>Somente essenciais</button><button className="primary-button" onClick={() => onChoice("accepted")}><Check size={15} /> Entendi</button></div>
  </div>;
}
