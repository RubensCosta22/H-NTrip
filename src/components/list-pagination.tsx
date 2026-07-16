import Link from "next/link";

export function ListPagination({ page, total, pageSize, pathname, params }: { page: number; total: number; pageSize: number; pathname: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (target: number) => { const query = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value) query.set(key, value); query.set("page", String(target)); return `${pathname}?${query}`; };
  return <nav className="list-pagination" aria-label="Paginação"><Link aria-disabled={page <= 1} href={page > 1 ? href(page - 1) : href(1)}>Anterior</Link><span>Página {page} de {pages}</span><Link aria-disabled={page >= pages} href={page < pages ? href(page + 1) : href(pages)}>Próxima</Link></nav>;
}
