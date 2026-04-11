#!/bin/bash
# =====================================================
# SETUP FRONTEND — O Mundo de Clay
# Módulo 02 — Seleção de Premissa + Edição de Roteiro
# =====================================================
# Rodar na VPS dentro do diretório ~/mundo-de-clay
# =====================================================

set -e
echo "🎬 Configurando frontend O Mundo de Clay..."

# ----- .env.local -----
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://vngtopghlmgqjaibqiyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ3RvcGdobG1ncWphaWJxaXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mzk4ODYsImV4cCI6MjA4OTExNTg4Nn0.T1jtgbqbUmglkz6d2vewQjEpNzYvC6vZMAo2leMP68w
NEXT_PUBLIC_N8N_WEBHOOK_BASE=https://prosperidade-n8n.yc5mic.easypanel.host/webhook
ENVEOF
echo "✅ .env.local"

# ----- src/lib/supabase.ts -----
cat > src/lib/supabase.ts << 'EOF'
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
EOF
echo "✅ src/lib/supabase.ts"

# ----- src/lib/types.ts -----
cat > src/lib/types.ts << 'EOF'
export interface Premissa {
  id: string;
  premissa: string;
  padrao_tematico: string;
  padrao_numero: number;
  fonte: string;
  upvotes: number;
  status: string;
  video_id: string | null;
  created_at: string;
  reddit_url: string | null;
}

export interface Video {
  id: string;
  premissa_id: string;
  titulo: string | null;
  status: string;
  modulo_atual: string;
  formato: string | null;
  created_at: string;
}

export interface RoteiroOpcao {
  id: string;
  video_id: string;
  opcao_numero: number;
  status: string;
  titulo: string | null;
  caption: string | null;
  descricao_youtube: string | null;
  hashtags: string[] | null;
  tags: string[] | null;
  thumbnail_prompt: string | null;
  texto_final_tela: string | null;
  formato: string | null;
  sinopse: string | null;
  arco_narrativo: string | null;
  tom: string | null;
}

export interface EfeitoSonoro {
  tipo: "banco" | "stable_audio";
  tag?: string;
  prompt?: string;
  weight: number;
}

export interface Cena {
  id: string;
  video_id: string;
  opcao_id: string | null;
  numero: string;
  ordem: number;
  narracao: string | null;
  emocao: string | null;
  duracao_estimada: number | null;
  som_ambiente: string | null;
  efeitos_sonoros: EfeitoSonoro[] | string;
  visual: string | null;
  movimento: string | null;
  tipo_cena: string | null;
  continuidade: boolean;
  personagem_presente: boolean;
  perspectiva: string | null;
  transicao_entrada: string | null;
  hook_tipo: string | null;
}
EOF
echo "✅ src/lib/types.ts"

# ----- src/app/layout.tsx -----
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "O Mundo de Clay — Studio",
  description: "Pipeline de produção de horror claymation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        <header className="border-b border-zinc-800 px-6 py-4">
          <a href="/" className="text-lg font-semibold text-zinc-100 hover:text-zinc-300">
            🎬 O Mundo de Clay — Studio
          </a>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
EOF
echo "✅ src/app/layout.tsx"

# ----- src/app/page.tsx (Tela 1 — Premissas) -----
cat > src/app/page.tsx << 'PAGEOF'
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Premissa } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PremissasPage() {
  const [premissas, setPremissas] = useState<Premissa[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState<string | null>(null);

  useEffect(() => {
    fetchPremissas();
  }, []);

  async function fetchPremissas() {
    const { data, error } = await supabase
      .from("premissas")
      .select("*")
      .eq("status", "disponível")
      .order("upvotes", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar premissas");
      console.error(error);
    } else {
      setPremissas(data || []);
    }
    setLoading(false);
  }

  async function selecionarPremissa(premissaId: string) {
    setGerando(premissaId);
    toast.info("Gerando roteiros... aguarde ~30s");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE}/premissa/selecionar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ premissa_id: premissaId }),
        }
      );

      const data = await res.json();

      if (data.success && data.video_id) {
        toast.success("Roteiros gerados!");
        window.location.href = `/roteiro/${data.video_id}`;
      } else {
        toast.error(data.erro || "Erro ao gerar roteiros");
        setGerando(null);
      }
    } catch (err) {
      toast.error("Erro de conexão com n8n");
      console.error(err);
      setGerando(null);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando premissas...</p>;
  }

  if (premissas.length === 0) {
    return <p className="text-zinc-400">Nenhuma premissa disponível. Rode o Módulo 01 primeiro.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Selecionar Premissa</h1>
      <div className="grid gap-4">
        {premissas.map((p) => (
          <Card key={p.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium text-zinc-100 leading-snug">
                  {p.premissa}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {p.upvotes} ▲
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mb-3">
                <span>{p.padrao_tematico}</span>
                <span>•</span>
                <span>r/{p.fonte}</span>
                <span>•</span>
                <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <Button
                size="sm"
                onClick={() => selecionarPremissa(p.id)}
                disabled={gerando !== null}
              >
                {gerando === p.id ? "Gerando..." : "Selecionar"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
PAGEOF
echo "✅ src/app/page.tsx"

# ----- src/app/roteiro/[videoId]/page.tsx (Tela 2 — Roteiro) -----
mkdir -p src/app/roteiro/\[videoId\]

cat > 'src/app/roteiro/[videoId]/page.tsx' << 'ROTEOF'
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RoteiroOpcao, Cena } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MetadadosEditor } from "@/components/MetadadosEditor";
import { CenaEditor } from "@/components/CenaEditor";
import { CopiarRoteiro } from "@/components/CopiarRoteiro";

export default function RoteiroPage() {
  const params = useParams();
  const videoId = params.videoId as string;

  const [opcoes, setOpcoes] = useState<RoteiroOpcao[]>([]);
  const [cenasPorOpcao, setCenasPorOpcao] = useState<Record<string, Cena[]>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [aprovando, setAprovando] = useState(false);

  useEffect(() => {
    if (videoId) fetchData();
  }, [videoId]);

  async function fetchData() {
    const { data: opcoesData, error: opcoesErr } = await supabase
      .from("roteiro_opcoes")
      .select("*")
      .eq("video_id", videoId)
      .order("opcao_numero", { ascending: true });

    if (opcoesErr) {
      toast.error("Erro ao carregar opções");
      console.error(opcoesErr);
      setLoading(false);
      return;
    }

    setOpcoes(opcoesData || []);
    if (opcoesData && opcoesData.length > 0) {
      setActiveTab(opcoesData[0].id);
    }

    const cenasMap: Record<string, Cena[]> = {};
    for (const opcao of opcoesData || []) {
      const { data: cenasData } = await supabase
        .from("cenas")
        .select("*")
        .eq("opcao_id", opcao.id)
        .order("ordem", { ascending: true });

      cenasMap[opcao.id] = (cenasData || []).map((c: Cena) => ({
        ...c,
        efeitos_sonoros:
          typeof c.efeitos_sonoros === "string"
            ? JSON.parse(c.efeitos_sonoros)
            : c.efeitos_sonoros,
      }));
    }

    setCenasPorOpcao(cenasMap);
    setLoading(false);
  }

  async function aprovarOpcao(opcaoId: string) {
    setAprovando(true);
    toast.info("Aprovando roteiro...");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE}/roteiro/aprovar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoId, opcao_id: opcaoId }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("Roteiro aprovado! Módulo 03 iniciado.");
      } else {
        toast.error(data.erro || "Erro ao aprovar");
      }
    } catch (err) {
      toast.error("Erro de conexão com n8n");
      console.error(err);
    }
    setAprovando(false);
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando roteiros...</p>;
  }

  if (opcoes.length === 0) {
    return <p className="text-zinc-400">Nenhuma opção de roteiro encontrada para este vídeo.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Roteiro</h1>
        <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Voltar às premissas
        </a>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 mb-6">
          {opcoes.map((op) => (
            <TabsTrigger key={op.id} value={op.id} className="text-sm">
              Opção {op.opcao_numero} — {op.titulo || "Sem título"}
              {op.formato && (
                <span className="ml-2 text-xs opacity-60">
                  ({op.formato})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {opcoes.map((opcao) => (
          <TabsContent key={opcao.id} value={opcao.id} className="space-y-6">
            <CopiarRoteiro opcao={opcao} cenas={cenasPorOpcao[opcao.id] || []} />

            <MetadadosEditor opcao={opcao} onUpdate={fetchData} />

            <div>
              <h2 className="text-lg font-semibold mb-4">
                Cenas ({(cenasPorOpcao[opcao.id] || []).length})
              </h2>
              <div className="space-y-4">
                {(cenasPorOpcao[opcao.id] || []).map((cena) => (
                  <CenaEditor
                    key={cena.id}
                    cena={cena}
                    onUpdate={fetchData}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Button
                onClick={() => aprovarOpcao(opcao.id)}
                disabled={aprovando}
                className="bg-green-700 hover:bg-green-600"
              >
                {aprovando ? "Aprovando..." : "Aprovar e continuar →"}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
ROTEOF
echo "✅ src/app/roteiro/[videoId]/page.tsx"

# ----- src/components/MetadadosEditor.tsx -----
mkdir -p src/components

cat > src/components/MetadadosEditor.tsx << 'EOF'
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoteiroOpcao } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  opcao: RoteiroOpcao;
  onUpdate: () => void;
}

export function MetadadosEditor({ opcao, onUpdate }: Props) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    titulo: opcao.titulo || "",
    sinopse: opcao.sinopse || "",
    arco_narrativo: opcao.arco_narrativo || "",
    tom: opcao.tom || "",
    formato: opcao.formato || "shorts",
    caption: opcao.caption || "",
    descricao_youtube: opcao.descricao_youtube || "",
    hashtags: (opcao.hashtags || []).join(", "),
    tags: (opcao.tags || []).join(", "),
    thumbnail_prompt: opcao.thumbnail_prompt || "",
    texto_final_tela: opcao.texto_final_tela || "",
  });

  async function salvar() {
    const { error } = await supabase
      .from("roteiro_opcoes")
      .update({
        titulo: form.titulo,
        sinopse: form.sinopse,
        arco_narrativo: form.arco_narrativo,
        tom: form.tom,
        formato: form.formato,
        caption: form.caption,
        descricao_youtube: form.descricao_youtube,
        hashtags: form.hashtags.split(",").map((h) => h.trim()).filter(Boolean),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        thumbnail_prompt: form.formato === "shorts" ? null : form.thumbnail_prompt,
        texto_final_tela: form.texto_final_tela,
      })
      .eq("id", opcao.id);

    if (error) {
      toast.error("Erro ao salvar");
      console.error(error);
    } else {
      toast.success("Metadados salvos");
      setEditando(false);
      onUpdate();
    }
  }

  if (!editando) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{opcao.titulo || "Sem título"}</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{opcao.formato}</Badge>
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                Editar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-300">
          <p><span className="text-zinc-500">Sinopse:</span> {opcao.sinopse}</p>
          <p><span className="text-zinc-500">Arco:</span> {opcao.arco_narrativo}</p>
          <p><span className="text-zinc-500">Tom:</span> {opcao.tom}</p>
          <p><span className="text-zinc-500">Caption:</span> {opcao.caption}</p>
          <p><span className="text-zinc-500">Texto final:</span> {opcao.texto_final_tela}</p>
          <p><span className="text-zinc-500">Hashtags:</span> {(opcao.hashtags || []).join(", ")}</p>
          {opcao.formato === "longo" && opcao.thumbnail_prompt && (
            <p><span className="text-zinc-500">Thumbnail:</span> {opcao.thumbnail_prompt}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Editando Metadados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-zinc-400">Título</label>
          <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Sinopse</label>
          <Textarea value={form.sinopse} onChange={(e) => setForm({ ...form, sinopse: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={2} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Arco Narrativo</label>
          <Input value={form.arco_narrativo} onChange={(e) => setForm({ ...form, arco_narrativo: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Tom</label>
          <Input value={form.tom} onChange={(e) => setForm({ ...form, tom: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Formato</label>
          <select
            value={form.formato}
            onChange={(e) => setForm({ ...form, formato: e.target.value })}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="shorts">Shorts</option>
            <option value="longo">Longo</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400">Caption</label>
          <Textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={2} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Descrição YouTube</label>
          <Textarea value={form.descricao_youtube} onChange={(e) => setForm({ ...form, descricao_youtube: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={3} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Hashtags (separadas por vírgula)</label>
          <Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Tags (separadas por vírgula)</label>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        {form.formato === "longo" && (
          <div>
            <label className="text-xs text-zinc-400">Thumbnail Prompt</label>
            <Textarea value={form.thumbnail_prompt} onChange={(e) => setForm({ ...form, thumbnail_prompt: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={2} />
          </div>
        )}
        <div>
          <label className="text-xs text-zinc-400">Texto Final de Tela</label>
          <Input value={form.texto_final_tela} onChange={(e) => setForm({ ...form, texto_final_tela: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={salvar}>Salvar</Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
EOF
echo "✅ src/components/MetadadosEditor.tsx"

# ----- src/components/CenaEditor.tsx -----
cat > src/components/CenaEditor.tsx << 'EOF'
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Cena, EfeitoSonoro } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const EMOCOES = ["calma", "neutra", "tensa", "suspense", "panico"];
const TIPOS_CENA = ["personagem", "ambiente", "ameaca"];
const TRANSICOES = ["dip_to_black", "corte_seco"];
const PERSPECTIVAS = ["terceira_pessoa", "primeira_pessoa"];

interface Props {
  cena: Cena;
  onUpdate: () => void;
}

export function CenaEditor({ cena, onUpdate }: Props) {
  const [editando, setEditando] = useState(false);
  const efx = Array.isArray(cena.efeitos_sonoros)
    ? cena.efeitos_sonoros
    : typeof cena.efeitos_sonoros === "string"
    ? JSON.parse(cena.efeitos_sonoros)
    : [];

  const [form, setForm] = useState({
    narracao: cena.narracao || "",
    emocao: cena.emocao || "neutra",
    visual: cena.visual || "",
    movimento: cena.movimento || "",
    som_ambiente: cena.som_ambiente || "",
    tipo_cena: cena.tipo_cena || "personagem",
    continuidade: cena.continuidade,
    personagem_presente: cena.personagem_presente,
    perspectiva: cena.perspectiva || "terceira_pessoa",
    transicao_entrada: cena.transicao_entrada || "dip_to_black",
    duracao_estimada: cena.duracao_estimada || 4,
    hook_tipo: cena.hook_tipo || "",
    efeitos_sonoros: efx as EfeitoSonoro[],
  });

  async function salvar() {
    const { error } = await supabase
      .from("cenas")
      .update({
        narracao: form.narracao,
        emocao: form.emocao,
        visual: form.visual,
        movimento: form.movimento,
        som_ambiente: form.som_ambiente,
        tipo_cena: form.tipo_cena,
        continuidade: form.continuidade,
        personagem_presente: form.personagem_presente,
        perspectiva: form.perspectiva,
        transicao_entrada: form.transicao_entrada,
        duracao_estimada: form.duracao_estimada,
        hook_tipo: form.hook_tipo || null,
        efeitos_sonoros: form.efeitos_sonoros,
      })
      .eq("id", cena.id);

    if (error) {
      toast.error("Erro ao salvar cena");
      console.error(error);
    } else {
      toast.success(`Cena ${cena.numero} salva`);
      setEditando(false);
      onUpdate();
    }
  }

  async function deletarCena() {
    if (!confirm(`Deletar cena ${cena.numero}?`)) return;
    const { error } = await supabase.from("cenas").delete().eq("id", cena.id);
    if (error) {
      toast.error("Erro ao deletar");
    } else {
      toast.success(`Cena ${cena.numero} deletada`);
      onUpdate();
    }
  }

  function addEfeito() {
    setForm({
      ...form,
      efeitos_sonoros: [
        ...form.efeitos_sonoros,
        { tipo: "banco", tag: "", weight: 0.5 },
      ],
    });
  }

  function removeEfeito(idx: number) {
    setForm({
      ...form,
      efeitos_sonoros: form.efeitos_sonoros.filter((_, i) => i !== idx),
    });
  }

  function updateEfeito(idx: number, field: string, value: string | number) {
    const updated = [...form.efeitos_sonoros];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setForm({ ...form, efeitos_sonoros: updated });
  }

  const emocaoColor: Record<string, string> = {
    calma: "bg-blue-900/40 text-blue-300",
    neutra: "bg-zinc-700/40 text-zinc-300",
    tensa: "bg-yellow-900/40 text-yellow-300",
    suspense: "bg-orange-900/40 text-orange-300",
    panico: "bg-red-900/40 text-red-300",
  };

  if (!editando) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-zinc-500">#{cena.numero}</span>
              <Badge className={`text-xs ${emocaoColor[cena.emocao || "neutra"]}`}>
                {cena.emocao}
              </Badge>
              <Badge variant="outline" className="text-xs">{cena.tipo_cena}</Badge>
              <Badge variant="outline" className="text-xs">
                {cena.transicao_entrada === "dip_to_black" ? "⬛ fade" : "✂️ corte"}
              </Badge>
              {cena.continuidade && <Badge variant="outline" className="text-xs">CONT</Badge>}
              <span className="text-xs text-zinc-500">{cena.duracao_estimada}s</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)} className="text-xs">
              Editar
            </Button>
          </div>
          <p className="text-sm text-zinc-200 mb-1">"{cena.narracao}"</p>
          <p className="text-xs text-zinc-500 mb-1">Visual: {cena.visual}</p>
          <p className="text-xs text-zinc-500 mb-1">Movimento: {cena.movimento}</p>
          <div className="text-xs text-zinc-500">
            Efeitos: {efx.map((e: EfeitoSonoro, i: number) => (
              <span key={i} className="mr-2">
                [{e.tipo === "banco" ? e.tag : e.prompt?.slice(0, 30) + "..."} w:{e.weight}]
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-700">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-zinc-400">Editando cena #{cena.numero}</span>
          <Button size="sm" variant="destructive" onClick={deletarCena} className="text-xs">
            Deletar
          </Button>
        </div>

        <div>
          <label className="text-xs text-zinc-400">Narração</label>
          <Textarea value={form.narracao} onChange={(e) => setForm({ ...form, narracao: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={2} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-zinc-400">Emoção</label>
            <select value={form.emocao} onChange={(e) => setForm({ ...form, emocao: e.target.value })} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100">
              {EMOCOES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Tipo cena</label>
            <select value={form.tipo_cena} onChange={(e) => setForm({ ...form, tipo_cena: e.target.value })} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100">
              {TIPOS_CENA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Transição</label>
            <select value={form.transicao_entrada} onChange={(e) => setForm({ ...form, transicao_entrada: e.target.value })} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100">
              {TRANSICOES.map((t) => <option key={t} value={t}>{t === "dip_to_black" ? "⬛ Dip to Black" : "✂️ Corte Seco"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Duração (s)</label>
            <Input type="number" step="0.5" value={form.duracao_estimada} onChange={(e) => setForm({ ...form, duracao_estimada: parseFloat(e.target.value) })} className="bg-zinc-800 border-zinc-700" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-zinc-400">Perspectiva</label>
            <select value={form.perspectiva} onChange={(e) => setForm({ ...form, perspectiva: e.target.value })} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100">
              {PERSPECTIVAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={form.continuidade} onChange={(e) => setForm({ ...form, continuidade: e.target.checked })} />
              Continuidade
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={form.personagem_presente} onChange={(e) => setForm({ ...form, personagem_presente: e.target.checked })} />
              Clay presente
            </label>
          </div>
          {cena.ordem === 1 && (
            <div>
              <label className="text-xs text-zinc-400">Hook tipo</label>
              <select value={form.hook_tipo} onChange={(e) => setForm({ ...form, hook_tipo: e.target.value })} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100">
                <option value="">—</option>
                <option value="acao">ação</option>
                <option value="pergunta">pergunta</option>
                <option value="afirmacao">afirmação</option>
                <option value="cenario">cenário</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-zinc-400">Visual (inglês)</label>
          <Textarea value={form.visual} onChange={(e) => setForm({ ...form, visual: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={3} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Movimento (inglês)</label>
          <Textarea value={form.movimento} onChange={(e) => setForm({ ...form, movimento: e.target.value })} className="bg-zinc-800 border-zinc-700" rows={2} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Som ambiente (português)</label>
          <Input value={form.som_ambiente} onChange={(e) => setForm({ ...form, som_ambiente: e.target.value })} className="bg-zinc-800 border-zinc-700" />
        </div>

        <Separator className="bg-zinc-800" />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-400">Efeitos Sonoros</label>
            <Button size="sm" variant="outline" onClick={addEfeito} className="text-xs">
              + Adicionar efeito
            </Button>
          </div>
          {form.efeitos_sonoros.map((ef, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-end">
              <div className="w-28">
                <select
                  value={ef.tipo}
                  onChange={(e) => updateEfeito(idx, "tipo", e.target.value)}
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100"
                >
                  <option value="banco">banco</option>
                  <option value="stable_audio">stable_audio</option>
                </select>
              </div>
              <div className="flex-1">
                {ef.tipo === "banco" ? (
                  <Input
                    placeholder="tag"
                    value={ef.tag || ""}
                    onChange={(e) => updateEfeito(idx, "tag", e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-xs"
                  />
                ) : (
                  <Input
                    placeholder="prompt em inglês"
                    value={ef.prompt || ""}
                    onChange={(e) => updateEfeito(idx, "prompt", e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-xs"
                  />
                )}
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={ef.weight}
                  onChange={(e) => updateEfeito(idx, "weight", parseFloat(e.target.value))}
                  className="bg-zinc-800 border-zinc-700 text-xs"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeEfeito(idx)} className="text-xs text-red-400">
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={salvar}>Salvar cena</Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
EOF
echo "✅ src/components/CenaEditor.tsx"

# ----- src/components/CopiarRoteiro.tsx -----
cat > src/components/CopiarRoteiro.tsx << 'EOF'
"use client";

import { RoteiroOpcao, Cena, EfeitoSonoro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  opcao: RoteiroOpcao;
  cenas: Cena[];
}

export function CopiarRoteiro({ opcao, cenas }: Props) {
  function gerarTexto() {
    const efxStr = (efx: EfeitoSonoro[] | string) => {
      const arr = typeof efx === "string" ? JSON.parse(efx) : efx;
      return (arr || [])
        .map((e: EfeitoSonoro) =>
          e.tipo === "banco"
            ? `banco:${e.tag} (w:${e.weight})`
            : `stable_audio:"${e.prompt}" (w:${e.weight})`
        )
        .join(", ");
    };

    let texto = `TÍTULO: ${opcao.titulo || "—"}
FORMATO: ${opcao.formato || "—"}
SINOPSE: ${opcao.sinopse || "—"}
ARCO: ${opcao.arco_narrativo || "—"}
TOM: ${opcao.tom || "—"}
CAPTION: ${opcao.caption || "—"}
TEXTO FINAL: ${opcao.texto_final_tela || "—"}
HASHTAGS: ${(opcao.hashtags || []).join(", ")}
TAGS: ${(opcao.tags || []).join(", ")}`;

    if (opcao.formato === "longo" && opcao.thumbnail_prompt) {
      texto += `\nTHUMBNAIL: ${opcao.thumbnail_prompt}`;
    }

    texto += `\n\n--- CENAS ---\n`;

    for (const c of cenas) {
      const flags = [
        c.tipo_cena,
        c.transicao_entrada === "dip_to_black" ? "fade" : "corte",
        c.continuidade ? "CONT" : "",
        c.personagem_presente ? "Clay" : "sem Clay",
        c.perspectiva,
      ]
        .filter(Boolean)
        .join(" | ");

      texto += `
CENA ${c.numero} | ${c.emocao} | ${c.duracao_estimada}s | ${flags}
Narração: "${c.narracao}"
Visual: ${c.visual}
Movimento: ${c.movimento}
Som ambiente: ${c.som_ambiente}
Efeitos: ${efxStr(c.efeitos_sonoros)}
`;
    }

    return texto;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(gerarTexto());
      toast.success("Roteiro copiado para a área de transferência");
    } catch {
      toast.error("Erro ao copiar — tente selecionar manualmente");
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={copiar}>
      📋 Copiar roteiro completo
    </Button>
  );
}
EOF
echo "✅ src/components/CopiarRoteiro.tsx"

echo ""
echo "🎬 Setup completo! Próximos passos:"
echo "  1. npm run dev -- -p 3000 -H 0.0.0.0"
echo "  2. Acesse http://SEU-IP-VPS:3000 no navegador"
