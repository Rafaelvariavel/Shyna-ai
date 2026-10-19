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
    notice: "Este é um projeto experimental sem cadastro ou login. Antes de abrir o serviço ao público, revise os termos para refletir sua operação, identidade jurídica, provedores e legislação aplicável.",
    sections: [
      { title: "1. Sobre a Shyna AI", text: "A Shyna AI é uma interface experimental para conversas com inteligência artificial, geração de imagens, classificação de idiomas e análise de imagens. Algumas funções dependem de serviços externos e podem ficar indisponíveis ou ter limites de uso." },
      { title: "2. Acesso sem conta", text: "Não é necessário criar conta, informar e-mail ou definir senha. O histórico é guardado no armazenamento local deste navegador. Limpar os dados locais pode apagar o histórico, que não é sincronizado entre dispositivos. Evite salvar informações confidenciais." },
      { title: "3. Uso aceitável", text: "Não utilize o serviço para atividades ilegais, fraude, assédio, violação de direitos de terceiros, invasão de sistemas, distribuição de malware ou tentativas de contornar limites de segurança e uso dos provedores. Não envie dados pessoais ou confidenciais desnecessários." },
      { title: "4. Resultados gerados por IA", text: "Respostas e imagens podem conter erros, informações incompletas ou conteúdo inesperado. Verifique informações importantes de forma independente. Você deve avaliar os direitos, licenças e permissões aplicáveis antes de publicar ou comercializar conteúdo gerado." },
      { title: "5. Dados e histórico", text: "Conversas e preferências ficam no armazenamento local deste navegador; o app não conecta a um banco de dados para salvá-las. Limpar os dados do navegador pode apagar o histórico. As mensagens enviadas ao chat e os prompts de imagem/análise são encaminhados aos provedores externos necessários para processar cada pedido. Evite inserir informações sensíveis." },
      { title: "6. Serviços de terceiros", text: "O processamento pode usar Groq, Google Gemini e APIs de classificação de idioma e geração de imagens configuradas pelo operador. Cada provedor tem seus próprios termos, limites, práticas de tratamento de dados e disponibilidade." },
      { title: "7. Limites e disponibilidade", text: "O serviço é fornecido conforme disponibilidade, sem garantia de funcionamento ininterrupto. O operador pode limitar solicitações abusivas ou desativar recursos para proteger os visitantes, os custos e a infraestrutura." },
      { title: "8. Alterações e contato", text: "Estes termos podem ser atualizados conforme o projeto evoluir. Antes do lançamento público, publique uma forma real de contato e identifique o responsável pelo serviço, quando aplicável." },
    ],
  },
  cookies: {
    title: "Política de cookies",
    eyebrow: "CONTROLE DE PRIVACIDADE",
    icon: "cookies",
    notice: "Este protótipo não utiliza cookies de autenticação nem instala cookies de publicidade ou análise. Um cookie opcional lembra a escolha feita no aviso de cookies.",
    sections: [
      { title: "1. Cookies utilizados", text: "shyna_cookie_consent: cookie de preferência que registra se você dispensou o aviso usando “Entendi” ou escolheu “Somente essenciais”. Ele dura até um ano e não contém nome, senha nem histórico de conversa. O aplicativo não utiliza cookie de login." },
      { title: "2. Cookies de terceiros", text: "O app não instala deliberadamente cookies publicitários. Solicitações a provedores externos para chat, classificação ou geração podem seguir as políticas técnicas desses provedores. A tipografia visual pode carregar fontes do Google Fonts." },
      { title: "3. Como alterar sua escolha", text: "Você pode limpar os cookies nas configurações do navegador. Dentro do app, abra “Preferências de cookies” para exibir novamente o aviso e registrar outra escolha. Desativar o cookie de preferência apenas fará o aviso aparecer novamente." },
      { title: "4. Histórico e preferências", text: "Conversas e preferências são salvas no armazenamento local deste navegador, não em um banco de dados remoto nem no cookie de consentimento. O usuário deve evitar enviar dados sensíveis no chat. Para uma operação pública, o responsável deve fornecer um canal de solicitação de acesso ou exclusão de dados e revisar a política conforme a LGPD." },
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
