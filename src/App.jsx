import { useMemo, useState } from 'react';

const API_URL = 'https://publica.cnpj.ws/cnpj/';

const formatValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('capital')) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'string') {
    const str = value.trim();
    if (!str) return '—';
    if (/^\d{8}$/.test(str)) return `${str.slice(0, 2)}/${str.slice(2, 4)}/${str.slice(4, 8)}`;
    if (/^\d{5}-?\d{3}$/.test(str)) return str.replace(/(\d{5})(\d{3})/, '$1-$2');
    if (/^\d{14}$/.test(str)) return str.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (/^\d{8}$/.test(str.replace(/\D/g, '')) && /\d{4}-\d{2}-\d{2}/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(str)) return str.slice(0, 10);
    return str;
  }
  return String(value);
};

const countFilledFields = (obj, path = '') => {
  if (obj === null || obj === undefined) return 0;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countFilledFields(item, path), 0);
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce((total, [key, value]) => {
      const nextPath = path ? `${path}.${key}` : key;
      if (value === null || value === undefined || value === '') return total;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return total + countFilledFields(value, nextPath);
      }
      return total + 1;
    }, 0);
  }
  return 0;
};

function JsonTree({ value, title = '', level = 0 }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">—</span>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="ml-2 space-y-2 border-l border-slate-800 pl-3">
        {value.map((item, index) => (
          <div key={`${title}-${index}`}>
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">[{index}]</div>
            <div className="mt-1">
              <JsonTree value={item} title={`${title}[${index}]`} level={level + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, child]) => (
          <div key={`${title}-${key}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{key}</p>
            <div className="mt-2">
              <JsonTree value={child} title={key} level={level + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="break-words text-sm text-slate-100">{formatValue(value, title)}</p>;
}

function App() {
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const maskCnpj = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 12) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4');
    }
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleaned = cnpjInput.replace(/\D/g, '');
    if (cleaned.length !== 14) {
      setError('Informe um CNPJ com 14 dígitos.');
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    setData(null);
    setShowRawJson(false);
    setCopied(false);
    try {
      const response = await fetch(`${API_URL}${cleaned}`);
      if (!response.ok) throw new Error('CNPJ não encontrado ou serviço indisponível.');
      const payload = await response.json();
      setData(payload);
      setCnpj(cleaned);
    } catch (err) {
      setError(err.message || 'Erro inesperado ao consultar o CNPJ.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const summary = useMemo(() => {
    if (!data) return null;
    const estabelecimento = data?.estabelecimento || data;
    const telefone = estabelecimento?.telefone1
      ? `(${estabelecimento.ddd1 || ''}) ${estabelecimento.telefone1}`.trim()
      : '—';
    const inscricoes = Array.isArray(estabelecimento?.inscricoes_estaduais)
      ? estabelecimento.inscricoes_estaduais
          .map((item) => `${item?.inscricao_estadual || '—'}${item?.estado?.sigla ? ` (${item.estado.sigla})` : ''}`)
          .join(' • ')
      : '—';
    return {
      razaoSocial: data?.razao_social || estabelecimento?.razao_social || '—',
      fantasia: estabelecimento?.nome_fantasia || '—',
      situacao: estabelecimento?.situacao_cadastral || data?.situacao_cadastral || '—',
      endereco: [estabelecimento?.tipo_logradouro, estabelecimento?.logradouro, estabelecimento?.numero, estabelecimento?.complemento]
        .filter(Boolean)
        .join(', ') || '—',
      cidadeUf: [estabelecimento?.cidade?.nome, estabelecimento?.estado?.sigla].filter(Boolean).join(' / ') || '—',
      cnae: data?.atividade_principal?.descricao || estabelecimento?.atividade_principal?.descricao || '—',
      telefone,
      email: estabelecimento?.email || '—',
      inscricoes,
    };
  }, [data]);

  const filledCount = useMemo(() => countFilledFields(data), [data]);

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/50 backdrop-blur">
          <div className="border-b border-slate-800 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-fuchsia-500/10 p-6 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Consulta pública</p>
                <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Consulta de CNPJ</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
                  Consulte rapidamente os dados cadastrais de qualquer empresa diretamente pela API pública do CNPJ.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  API pública disponível
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <form className="flex flex-col gap-4 lg:flex-row" onSubmit={handleSubmit}>
              <label className="flex-1">
                <span className="mb-2 block text-sm font-medium text-slate-300">CNPJ</span>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-base outline-none ring-0 transition focus:border-cyan-400"
                  inputMode="numeric"
                  maxLength={18}
                  onChange={(event) => setCnpjInput(maskCnpj(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  value={cnpjInput}
                />
              </label>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={loading}
                type="submit"
              >
                {loading ? 'Consultando...' : 'Consultar'}
              </button>
            </form>
            {error ? <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p> : null}
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-slate-300">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
              <span>Buscando dados...</span>
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Resumo</p>
                    <h2 className="text-2xl font-semibold text-white">{summary?.razaoSocial}</h2>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
                    {summary?.situacao}
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Nome fantasia</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.fantasia}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Endereço</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.endereco}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Cidade / UF</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.cidadeUf}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">CNAE</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.cnae}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Telefone</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.telefone}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">E-mail</p>
                    <p className="mt-2 text-base font-medium text-slate-100">{summary?.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Ações</p>
                    <h3 className="text-xl font-semibold text-white">Visualização</h3>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">
                    {filledCount} campos preenchidos
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <button className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-cyan-400" onClick={() => setShowRawJson((prev) => !prev)} type="button">
                    {showRawJson ? 'Ocultar' : 'Ver'} JSON bruto
                  </button>
                  <button className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-cyan-400" onClick={handleCopy} type="button">
                    {copied ? 'JSON copiado!' : 'Copiar JSON'}
                  </button>
                </div>
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                  <p className="font-medium text-slate-200">Inscrições estaduais</p>
                  <p className="mt-2">{summary?.inscricoes}</p>
                </div>
              </div>
            </section>

            {showRawJson ? (
              <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">JSON bruto</p>
                    <h3 className="text-xl font-semibold text-white">Dados completos da API</h3>
                  </div>
                </div>
                <pre className="max-h-[420px] overflow-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs leading-6 text-slate-300">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dados dinâmicos</p>
                  <h3 className="text-xl font-semibold text-white">Estrutura completa do JSON</h3>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">
                  {filledCount} campos preenchidos
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <JsonTree value={data} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default App;
