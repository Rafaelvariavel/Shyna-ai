import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(file));

const blockedFiles = /(^|\/)(\.env|\.env\.(local|production|development|test)|credentials\.json|secrets?\.(json|ya?ml))$/i;
const secretPatterns = [
  /gsk_[A-Za-z0-9]{20,}/,
  /AQ\.[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{30,}/,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  /(?:AWS_SECRET_ACCESS_KEY|GEMINI_API|GROQ(?:2)?_API|IMAGENS_API|IDIOMAS_API)\s*[:=]\s*["']?(?!\$\{|<|troque|coloque|gere)[^\s"']{16,}/i,
  /-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----/,
];
const dangerousPatterns = [
  /curl\s+[^\n|]+\|\s*(?:ba)?sh/i,
  /(?:eval|exec)\s*\(\s*(?:atob|Buffer\.from)/i,
];

const failures = [];
for (const file of tracked) {
  if (blockedFiles.test(file)) failures.push(`${file}: arquivo de credenciais não deve ser versionado`);
  const text = readFileSync(file, "utf8");
  if (!file.endsWith(".example") && secretPatterns.some((pattern) => pattern.test(text))) {
    failures.push(`${file}: possível segredo real encontrado`);
  }
  if (dangerousPatterns.some((pattern) => pattern.test(text))) {
    failures.push(`${file}: padrão de execução remota/perigosa encontrado`);
  }
}

if (failures.length) {
  console.error("Falha na verificação de segurança:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verificação de segurança concluída: ${tracked.length} arquivos rastreados, sem segredos ou padrões bloqueados.`);
