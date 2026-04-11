"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface EfeitoCena {
  tipo: "banco" | "stable_audio";
  tag?: string;
  prompt?: string;
  weight: number;
}

interface CenaMin {
  id: string;
  numero: string;
  efeitos_sonoros: EfeitoCena[] | string | null;
}

interface BancoEfeito {
  id: string;
  tag: string;
  categoria: string;
  descricao: string | null;
  duracao: number | null;
  arquivo_url: string | null;
  fonte: string | null;
  uso_count: number;
}

interface TagResumo {
  tag: string;
  usadaEm: string[];
  existeNoBanco: boolean;
  variantes: BancoEfeito[];
}

const CATEGORIAS = ["ambiente", "corpo", "objeto", "musical", "trilha"] as const;

type Modo = "upload" | "substituir";

export default function EfeitosNecessarios({ videoId }: { videoId: string }) {
  const [cenas, setCenas] = useState<CenaMin[]>([]);
  const [banco, setBanco] = useState<BancoEfeito[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("upload");
  const [uploading, setUploading] = useState(false);
  const [substituindo, setSubstituindo] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const [form, setForm] = useState({
    tag: "",
    categoria: "ambiente" as (typeof CATEGORIAS)[number],
    descricao: "",
    fonte: "manual",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const [tagEscolhida, setTagEscolhida] = useState<string>("");

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: cData }, { data: bData }] = await Promise.all([
      supabase
        .from("cenas")
        .select("id,numero,efeitos_sonoros")
        .eq("video_id", videoId)
        .is("opcao_id", null)
        .order("ordem", { ascending: true }),
      supabase.from("banco_efeitos").select("*").order("tag", { ascending: true }),
    ]);

    setCenas((cData || []) as CenaMin[]);
    setBanco((bData || []) as BancoEfeito[]);
    setLoading(false);
  }

  const tags: TagResumo[] = (() => {
    const mapa = new Map<string, TagResumo>();
    for (const c of cenas) {
      const efs: EfeitoCena[] =
        typeof c.efeitos_sonoros === "string"
          ? JSON.parse(c.efeitos_sonoros)
          : c.efeitos_sonoros || [];
      for (const ef of efs) {
        if (ef.tipo !== "banco" || !ef.tag) continue;
        if (!mapa.has(ef.tag)) {
          const variantes = banco.filter((b) => b.tag === ef.tag);
          mapa.set(ef.tag, {
            tag: ef.tag,
            usadaEm: [],
            existeNoBanco: variantes.length > 0,
            variantes,
          });
        }
        mapa.get(ef.tag)!.usadaEm.push(c.numero);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => {
      if (a.existeNoBanco !== b.existeNoBanco) return a.existeNoBanco ? 1 : -1;
      return a.tag.localeCompare(b.tag);
    });
  })();

  const faltando = tags.filter((t) => !t.existeNoBanco).length;

  const tagsBancoAgrupadas = (() => {
    const mapa = new Map<string, BancoEfeito[]>();
    for (const b of banco) {
      if (!mapa.has(b.tag)) mapa.set(b.tag, []);
      mapa.get(b.tag)!.push(b);
    }
    const unicas = Array.from(mapa.entries()).map(([tag, vars]) => ({
      tag,
      categoria: vars[0].categoria,
      descricao: vars[0].descricao,
      variantes: vars,
      usoTotal: vars.reduce((s, v) => s + (v.uso_count || 0), 0),
    }));
    unicas.sort((a, b) => {
      if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
      if (a.usoTotal !== b.usoTotal) return a.usoTotal - b.usoTotal;
      return a.tag.localeCompare(b.tag);
    });
    return unicas;
  })();

  const previewUrl = (() => {
    if (!tagEscolhida) return null;
    const grupo = tagsBancoAgrupadas.find((g) => g.tag === tagEscolhida);
    return grupo?.variantes[0]?.arquivo_url || null;
  })();

  function abrir(tag: string, modoInicial: Modo) {
    const mesmoAberto = expandida === tag;
    setExpandida(mesmoAberto ? null : tag);
    setModo(modoInicial);
    setForm({ tag, categoria: "ambiente", descricao: "", fonte: "manual" });
    setTagEscolhida("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function medirDuracao(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration || 0);
      audio.onerror = () => resolve(0);
      audio.src = URL.createObjectURL(file);
    });
  }

  async function enviarUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo mp3");
      return;
    }
    if (!form.tag.trim()) {
      toast.error("Tag obrigatória");
      return;
    }
    setUploading(true);
    try {
      const duracao = await medirDuracao(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.tag}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("banco-efeitos")
        .upload(path, file, { upsert: false, contentType: "audio/mpeg" });

      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from("banco-efeitos").getPublicUrl(path);

      const { error: insErr } = await supabase.from("banco_efeitos").insert({
        tag: form.tag.trim(),
        categoria: form.categoria,
        descricao: form.descricao.trim() || null,
        duracao: duracao || null,
        arquivo_url: urlData.publicUrl,
        fonte: form.fonte.trim() || "manual",
        licenca: "livre",
      });

      if (insErr) throw new Error(insErr.message);

      toast.success(`Efeito "${form.tag}" adicionado`);
      setExpandida(null);
      fetchAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro no upload";
      toast.error(msg);
    }
    setUploading(false);
  }

  async function enviarSubstituicao(tagAntiga: string) {
    if (!tagEscolhida) {
      toast.error("Escolha uma tag do banco");
      return;
    }
    if (tagEscolhida === tagAntiga) {
      toast.error("Tag escolhida é igual à faltante");
      return;
    }
    setSubstituindo(true);
    try {
      let cenasAtualizadas = 0;
      for (const c of cenas) {
        const efs: EfeitoCena[] =
          typeof c.efeitos_sonoros === "string"
            ? JSON.parse(c.efeitos_sonoros)
            : c.efeitos_sonoros || [];
        let mudou = false;
        const novos = efs.map((ef) => {
          if (ef.tipo === "banco" && ef.tag === tagAntiga) {
            mudou = true;
            return { ...ef, tag: tagEscolhida };
          }
          return ef;
        });
        if (mudou) {
          const { error } = await supabase
            .from("cenas")
            .update({ efeitos_sonoros: novos })
            .eq("id", c.id);
          if (error) throw new Error(error.message);
          cenasAtualizadas++;
        }
      }
      toast.success(`"${tagAntiga}" → "${tagEscolhida}" em ${cenasAtualizadas} cena(s)`);
      setExpandida(null);
      fetchAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao substituir";
      toast.error(msg);
    }
    setSubstituindo(false);
  }

  async function removerDoVideo(tagRemover: string) {
    if (!confirm(`Remover "${tagRemover}" de todas as cenas deste vídeo?`)) return;
    setRemovendo(true);
    try {
      let cenasAtualizadas = 0;
      for (const c of cenas) {
        const efs: EfeitoCena[] =
          typeof c.efeitos_sonoros === "string"
            ? JSON.parse(c.efeitos_sonoros)
            : c.efeitos_sonoros || [];
        const filtrados = efs.filter(
          (ef) => !(ef.tipo === "banco" && ef.tag === tagRemover)
        );
        if (filtrados.length !== efs.length) {
          const { error } = await supabase
            .from("cenas")
            .update({ efeitos_sonoros: filtrados })
            .eq("id", c.id);
          if (error) throw new Error(error.message);
          cenasAtualizadas++;
        }
      }
      toast.success(`"${tagRemover}" removido de ${cenasAtualizadas} cena(s)`);
      setExpandida(null);
      fetchAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao remover";
      toast.error(msg);
    }
    setRemovendo(false);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Carregando efeitos...
        </CardContent>
      </Card>
    );
  }

  if (tags.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Nenhum efeito do banco requisitado por este vídeo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Efeitos necessários{" "}
            <span className="text-xs text-muted-foreground font-normal">
              ({tags.length} tags · {faltando} faltando)
            </span>
          </h2>
        </div>

        <div className="space-y-2">
          {tags.map((t) => {
            const aberto = expandida === t.tag;
            return (
              <div
                key={t.tag}
                className={`rounded border ${
                  t.existeNoBanco ? "border-border" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="flex items-center justify-between p-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm">{t.existeNoBanco ? "✓" : "✗"}</span>
                    <code className="text-xs font-mono text-foreground truncate">{t.tag}</code>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      cenas {t.usadaEm.join(", ")} ·{" "}
                      {t.existeNoBanco ? `${t.variantes.length} variante(s)` : "sem arquivo"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removerDoVideo(t.tag)}
                      disabled={removendo}
                      title="Remover esta tag de todas as cenas do vídeo"
                    >
                      🗑️
                    </Button>
                    {!t.existeNoBanco && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrir(t.tag, "substituir")}
                      >
                        {aberto && modo === "substituir" ? "Fechar" : "Substituir"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => abrir(t.tag, "upload")}>
                      {aberto && modo === "upload"
                        ? "Fechar"
                        : t.existeNoBanco
                        ? "+ variante"
                        : "Upload"}
                    </Button>
                  </div>
                </div>

                {aberto && modo === "upload" && t.variantes.length > 0 && (
                  <div className="px-2 pb-2 space-y-1">
                    {t.variantes.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 text-xs bg-muted/40 rounded p-2"
                      >
                        <span className="text-muted-foreground w-16 shrink-0">{v.categoria}</span>
                        <span className="text-muted-foreground w-12 shrink-0">
                          {v.duracao ? v.duracao.toFixed(1) + "s" : "—"}
                        </span>
                        <span className="text-muted-foreground w-16 shrink-0">
                          uso {v.uso_count}
                        </span>
                        {v.arquivo_url && (
                          <audio controls src={v.arquivo_url} className="h-8 flex-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {aberto && modo === "upload" && (
                  <div className="px-2 pb-3 space-y-2 border-t border-border pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Tag</label>
                        <Input
                          value={form.tag}
                          onChange={(e) => setForm({ ...form, tag: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Categoria</label>
                        <select
                          value={form.categoria}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              categoria: e.target.value as (typeof CATEGORIAS)[number],
                            })
                          }
                          className="w-full h-8 text-xs rounded border border-border bg-background px-2"
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Descrição</label>
                      <Textarea
                        value={form.descricao}
                        onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                        className="text-xs min-h-[50px]"
                        placeholder="Ex: passos lentos em piso de madeira rangendo"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Fonte</label>
                        <Input
                          value={form.fonte}
                          onChange={(e) => setForm({ ...form, fonte: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="freesound, pixabay, manual..."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Arquivo MP3</label>
                        <Input
                          ref={fileRef}
                          type="file"
                          accept="audio/mpeg,audio/mp3,.mp3"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandida(null)}
                        disabled={uploading}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={enviarUpload} disabled={uploading}>
                        {uploading ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>
                )}

                {aberto && modo === "substituir" && (
                  <div className="px-2 pb-3 space-y-2 border-t border-border pt-2">
                    <p className="text-xs text-muted-foreground">
                      Substituir <code className="text-foreground">{t.tag}</code> por uma tag
                      existente no banco. Aplica a <b>todas as cenas deste vídeo</b> que usam{" "}
                      <code className="text-foreground">{t.tag}</code>.
                    </p>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        Tag do banco (menos usadas primeiro)
                      </label>
                      <select
                        value={tagEscolhida}
                        onChange={(e) => setTagEscolhida(e.target.value)}
                        className="w-full h-8 text-xs rounded border border-border bg-background px-2"
                      >
                        <option value="">— escolher —</option>
                        {(() => {
                          const grupos: Record<string, typeof tagsBancoAgrupadas> = {};
                          for (const g of tagsBancoAgrupadas) {
                            if (!grupos[g.categoria]) grupos[g.categoria] = [];
                            grupos[g.categoria].push(g);
                          }
                          return Object.entries(grupos).map(([cat, gs]) => (
                            <optgroup key={cat} label={cat}>
                              {gs.map((g) => (
                                <option key={g.tag} value={g.tag}>
                                  {g.tag} (uso {g.usoTotal})
                                  {g.descricao ? ` — ${g.descricao.slice(0, 40)}` : ""}
                                </option>
                              ))}
                            </optgroup>
                          ));
                        })()}
                      </select>
                    </div>

                    {previewUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Prévia:</span>
                        <audio controls src={previewUrl} className="h-8 flex-1" />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandida(null)}
                        disabled={substituindo}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => enviarSubstituicao(t.tag)}
                        disabled={substituindo || !tagEscolhida}
                      >
                        {substituindo ? "Substituindo..." : "Substituir em todas as cenas"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
