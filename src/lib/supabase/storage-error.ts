export function describeStorageUploadError(message: string, kind: "arquivo" | "foto") {
  const normalized = message.toLowerCase();
  if (normalized.includes("mime type") || normalized.includes("content type")) {
    return `O formato da ${kind} foi recusado pelo armazenamento.`;
  }
  if (normalized.includes("maximum allowed size") || normalized.includes("too large")) {
    return `A ${kind} excede o limite permitido pelo armazenamento.`;
  }
  if (normalized.includes("row-level security") || normalized.includes("unauthorized")) {
    return "Sua sessão não tem permissão para este envio. Entre novamente e tente de novo.";
  }
  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return "O armazenamento privado ainda não está disponível.";
  }
  return `Não foi possível enviar a ${kind}. Detalhe: ${message.slice(0, 160)}`;
}
