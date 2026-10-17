import { notFound } from "next/navigation";
import { ArrowLeft, Cookie, ShieldCheck, Sparkles } from "lucide-react";

type LegalSection = { title: string; text: string };
type LegalPageData = {
  title: string;
  eyebrow: string;
  notice: string;
  icon: "terms" | "cookies";
  sections: LegalSection[];
};

const pages: Record<string, LegalPageData> = {
  terms: {
    title: "Termos de uso",
    eyebrow: "TRANSPARÊNCIA E SEGURANÇA",
    icon: "terms",
    notice: "Estes termos são um modelo inicial. Antes de abrir o serviço ao público, revise-os para refletir sua operação, identidade jurídica, provedores e legislação aplicável.",
    sections: [
      { title: "1. Sobre a Shyna AI", text: "A Shyna AI é uma interface experimental para conversas com inteligência artificial, geração de imagens, classificação de idiomas e análise de imagens. Algumas funções dependem de serviços externos e podem ficar indisponíveis ou ter limites de uso." },
      { title: "2. Conta e segurança", text: "Você é responsável por manter sua senha em sigilo e por toda atividade realizada na sua conta. Use uma senha única e forte. O cadastro deste protótipo utiliza nome de usuário e senha, sem verificação de e-mail nem recuperação automática de conta." },
      { title: "3. Uso aceitável", text: "Não utilize o serviço para atividades ilegais, fraude, assédio, violação de direitos de terceiros, invasão de sistemas, distribuição de malware ou tentativas de contornar limites de segurança e uso dos provedores. Não envie dados pessoais ou confidenciais desnecessários." },
      { title: "4. Resultados gerados por IA", text: "Respostas e imagens podem conter erros, informações incompletas ou conteúdo inesperado. Verifique informações importantes de forma independente. Você deve avaliar os direitos, licenças e permissões aplicáveis antes de publicar ou comercializar conteúdo gerado." },
      { title: "5. Dados e histórico", text: "O nome de usuário, hash da senha, conversas e preferências podem ser armazenados no banco de dados Neon configurado pelo operador. Não guardamos a senha em texto puro. Conversas podem incluir prompts e respostas enviados a provedores externos para processar o pedido. Evite inserir informações sensíveis." },
      { title: "6. Serviços de terceiros", text: "O processamento pode usar Groq, Google Gemini e APIs de classificação de idioma e geração de imagens configuradas pelo operador. Cada provedor tem seus próprios termos, limites, práticas de tratamento de dados e disponibilidade." },
      { title: "7. Limites e disponibilidade", text: "O serviço é fornecido conforme disponibilidade, sem garantia de funcionamento ininterrupto. O operador pode limitar solicitações, suspender contas abusivas ou desativar recursos para proteger usuários, custos e infraestrutura." },
      { title: "8. Alterações e contato", text: "Estes termos podem ser atualizados conforme o projeto evoluir. Antes do lançamento público, publique uma forma real de contato e identifique o responsável pelo serviço, quando aplicável." },
    ],
  },
  cookies: {
    title: "Política de cookies",
    eyebrow: "CONTROLE DE PRIVACIDADE",
    icon: "cookies",
    notice: "Este protótipo não instala cookies de publicidade ou análise. O cookie de sessão é necessário para manter sua conta autenticada.",
    sections: [
      { title: "1. Cookies utilizados", text: "shyna_session: cookie HTTP-only, SameSite=Lax, com duração de até sete dias, usado para manter a sessão autenticada. Em produção, é marcado como Secure quando o site usa HTTPS. shyna_cookie_consent: cookie de preferência que registra se você dispensou o aviso usando “Entendi” ou escolheu “Somente essenciais”. Ele dura até um ano e não contém nome, senha nem histórico de conversa." },
      { title: "2. Cookies de terceiros", text: "O app não instala deliberadamente cookies publicitários. Solicitações a provedores externos para chat, classificação ou geração podem seguir as políticas técnicas desses provedores. A tipografia visual pode carregar fontes do Google Fonts." },
      { title: "3. Como alterar sua escolha", text: "Você pode limpar os cookies nas configurações do navegador. Dentro do app, abra “Preferências de cookies” para exibir novamente o aviso e registrar outra escolha. Bloquear cookies essenciais pode impedir o login." },
      { title: "4. Histórico e preferências", text: "Conversas e preferências são armazenadas no banco de dados Neon do operador, não no cookie de consentimento. O usuário deve evitar enviar dados sensíveis no chat. Para uma operação pública, o responsável deve fornecer um canal de solicitação de acesso ou exclusão de dados e revisar a política conforme a LGPD." },
      { title: "5. Revisão antes do lançamento", text: "Confirme esta política com base nos provedores realmente ativados, no domínio final e nas ferramentas de análise ou publicidade que eventualmente venham a ser instaladas. Não anuncie práticas de privacidade que não correspondam à implementação real." },
    ],
  },
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = pages[slug];
  if (!data) notFound();
  return (
    <main className="legal-page"><div className="legal-wrap">
      <header className="legal-head">
        <a className="brand" href="/"><span className="brand-mark"><Sparkles size={19} /></span><span>shyna<span className="brand-ai"> ai</span></span></a>
        <a className="legal-back" href="/"><ArrowLeft size={14} /> Voltar ao app</a>
      </header>
      <article className="legal-content">
        <p className="eyebrow">{data.eyebrow}</p>
        <h1>{data.title}</h1>
        <p className="updated">Versão inicial · 17 de outubro de 2026</p>
        <div className="legal-notice">
          {data.icon === "terms" ? <ShieldCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> : <Cookie size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />}
          {data.notice}
        </div>
        {data.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}
      </article>
    </div></main>
  );
}
