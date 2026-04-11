"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface EfeitoSonoro {
  tipo: "banco" | "stable_audio";
  tag?: string;
  prompt?: string;
  weight: number;
}

interface Cena {
  id: string;
  video_id: string;
  numero: string;
  ordem: number;
  narracao: string;
  emocao: string;
  duracao_estimada: number;
  tipo_cena: string;
  personagem_presente: boolean;
  continuidade: boolean;
  perspectiva: string;
  transicao_entrada: string;
  angulo: string | null;
  abertura: string | null;
  iluminacao: string | null;
  foreground: string | null;
  midground: string | null;
  background: string | null;
  paleta_cores: string | null;
  prompt_flux: string | null;
  prompt_movimento_wan: string | null;
  redux_strength: number | null;
  som_ambiente: string | null;
  efeitos_sonoros: EfeitoSonoro[] | string;
  imagem_url: string | null;
  imagem_status: string;
  nota_correcao: string | null;
}

interface Video {
  id: string;
  titulo: string | null;
  formato: string | null;
  sinopse: string | null;
  tom: string | null;
  caption: string | null;
  arco_narrativo: string | null;
  texto_final_tela: string | null;
  thumbnail_prompt: string | null;
  thumbnail_url: string | null;
  num_cenas: number | null;
  duracao_estimada: number | null;
}

// Master image URL - upload para Supabase Storage bucket 'imagens' com path 'mestre/clay.png'
const MASTER_IMAGE_URL = "";

export default function ImagensPage() {
  const params = useParams();
  const videoId = params.videoId as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [cenas, setCenas] = useState<Cena[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "storyboard">("grid");
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [editingCenas, setEditingCenas] = useState<Set<string>>(new Set());
  const [editForms, setEditForms] = useState<Record<string, Partial<Cena>>>({});
  const [regenerando, setRegenerando] = useState(false);
  const storyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoId) fetchData();
  }, [videoId]);

  async function fetchData() {
    const { data: vData } = await supabase
      .from("videos")
      .select("id,titulo,formato,sinopse,tom,caption,arco_narrativo,texto_final_tela,thumbnail_prompt,thumbnail_url,num_cenas,duracao_estimada")
      .eq("id", videoId)
      .single();

    if (vData) setVideo(vData);

    const { data: cData } = await supabase
      .from("cenas")
      .select("*")
      .eq("video_id", videoId)
      .is("opcao_id", null)
      .order("ordem", { ascending: true });

    if (cData) {
      setCenas(
        cData.map((c: Cena) => ({
          ...c,
          efeitos_sonoros:
            typeof c.efeitos_sonoros === "string"
              ? JSON.parse(c.efeitos_sonoros)
              : c.efeitos_sonoros || [],
        }))
      );
    }
    setLoading(false);
  }

  // --- Contadores ---
  const totalCenas = cenas.length;
  const aprovadas = cenas.filter((c) => c.imagem_status === "aprovada").length;
  const geradas = cenas.filter((c) => c.imagem_status === "gerada").length;
  const pendentes = cenas.filter((c) => c.imagem_status === "pendente").length;
  const todasAprovadas = aprovadas === totalCenas && totalCenas > 0;
  const duracaoTotal = cenas.reduce((s, c) => s + (c.duracao_estimada || 0), 0);

  // --- Ações globais ---

async function aprovarEContinuar() {
    // 1. Aprova todas as cenas que ainda não estão aprovadas
    for (const c of cenas) {
      if (c.imagem_status !== "aprovada") {
        await supabase.from("cenas").update({ imagem_status: "aprovada" }).eq("id", c.id);
      }
    }

    // 2. Chama o webhook de decisão de próxima tela
    toast.info("Avançando pipeline...");
    try {
      const res = await fetch(`/api/webhook?path=pipeline/avancar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const data = await res.json();
      if (data.success && data.proximaTela) {
        window.location.href = data.proximaTela;
      } else {
        toast.error(data.erro || "Erro ao avançar pipeline");
      }
    } catch {
      toast.error("Erro de conexão com n8n");
    }
  }

  async function regenerarPendentes() {
    setRegenerando(true);
    toast.info("Disparando regeneração...");
    try {
      const res = await fetch(`/api/webhook?path=imagens/regenerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const data = await res.json();
      if (data.success || data.prompt_id) {
        toast.success("Pod ligando. Imagens serão geradas em breve.");
      } else {
        toast.error(data.erro || "Erro ao disparar regeneração");
      }
    } catch {
      toast.error("Erro de conexão com n8n");
    }
    setRegenerando(false);
  }


  // --- Ações por cena ---
  async function aprovarCena(cenaId: string) {
    await supabase.from("cenas").update({ imagem_status: "aprovada" }).eq("id", cenaId);
    toast.success("Imagem aprovada");
    fetchData();
  }

  async function resetarCena(cenaId: string) {
    await supabase.from("cenas").update({ imagem_status: "pendente" }).eq("id", cenaId);
    toast.info("Cena marcada para regeneração");
    fetchData();
  }

  function toggleEdit(cenaId: string, cena: Cena) {
    const newSet = new Set(editingCenas);
    if (newSet.has(cenaId)) {
      newSet.delete(cenaId);
    } else {
      newSet.add(cenaId);
      setEditForms((prev) => ({
        ...prev,
        [cenaId]: {
          prompt_flux: cena.prompt_flux || "",
          prompt_movimento_wan: cena.prompt_movimento_wan || "",
          redux_strength: cena.redux_strength,
          som_ambiente: cena.som_ambiente || "",
          efeitos_sonoros: Array.isArray(cena.efeitos_sonoros)
            ? cena.efeitos_sonoros
            : [],
          nota_correcao: cena.nota_correcao || "",
          personagem_presente: cena.personagem_presente,
          tipo_cena: cena.tipo_cena || "personagem",
        },
      }));
    }
    setEditingCenas(newSet);
  }

  async function salvarEdicao(cenaId: string) {
    const form = editForms[cenaId];
    if (!form) return;

    const { error } = await supabase
      .from("cenas")
      .update({
        prompt_movimento_wan: form.prompt_movimento_wan,
        som_ambiente: form.som_ambiente,
        efeitos_sonoros: form.efeitos_sonoros,
        nota_correcao: (form.nota_correcao as string) || null,
        personagem_presente: form.personagem_presente,
        tipo_cena: form.tipo_cena,
        redux_strength: form.personagem_presente ? (form.redux_strength || 0.7) : null,
        imagem_status: "pendente",
      })
      .eq("id", cenaId);

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Salvo — marcado para regeneração");
      const newSet = new Set(editingCenas);
      newSet.delete(cenaId);
      setEditingCenas(newSet);
      fetchData();
    }
  }

  async function uploadManual(cenaId: string, cenaNumero: string, file: File) {
    const path = `${videoId}/cena_${cenaNumero}.png`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, file, { upsert: true });

    if (upErr) {
      toast.error("Erro no upload: " + upErr.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("imagens").getPublicUrl(path);

urlData.publicUrl = urlData.publicUrl + '?t=' + Date.now();

    await supabase
      .from("cenas")
      .update({ imagem_url: urlData.publicUrl, imagem_status: "gerada" })
      .eq("id", cenaId);

    toast.success(`Imagem da cena ${cenaNumero} enviada`);
    fetchData();
  }

  // --- Helpers de edição de efeitos ---
  function updateFormField(cenaId: string, field: string, value: unknown) {
    setEditForms((prev) => ({
      ...prev,
      [cenaId]: { ...prev[cenaId], [field]: value },
    }));
  }

  function updateEfeito(cenaId: string, idx: number, field: string, value: string | number) {
    const efx = [...((editForms[cenaId]?.efeitos_sonoros as EfeitoSonoro[]) || [])];
    (efx[idx] as unknown as Record<string, unknown>)[field] = value;
    updateFormField(cenaId, "efeitos_sonoros", efx);
  }

  function addEfeito(cenaId: string) {
    const efx = [...((editForms[cenaId]?.efeitos_sonoros as EfeitoSonoro[]) || [])];
    efx.push({ tipo: "banco", tag: "", weight: 0.5 });
    updateFormField(cenaId, "efeitos_sonoros", efx);
  }

  function removeEfeito(cenaId: string, idx: number) {
    const efx = ((editForms[cenaId]?.efeitos_sonoros as EfeitoSonoro[]) || []).filter((_, i) => i !== idx);
    updateFormField(cenaId, "efeitos_sonoros", efx);
  }

  // --- Status colors ---
  const statusConfig: Record<string, { color: string; label: string }> = {
    pendente: { color: "bg-yellow-900/40 text-yellow-300", label: "Pendente" },
    gerada: { color: "bg-blue-900/40 text-blue-300", label: "Gerada" },
    aprovada: { color: "bg-green-900/40 text-green-300", label: "Aprovada" },
  };

  const emocaoColor: Record<string, string> = {
    calma: "text-blue-300",
    neutra: "text-zinc-300",
    tensa: "text-yellow-300",
    suspense: "text-orange-300",
    panico: "text-red-300",
  };

  if (loading) return <p className="text-zinc-400">Carregando...</p>;
  if (!video) return <p className="text-zinc-400">Vídeo não encontrado.</p>;

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Aprovação de Imagens</h1>
        <div className="flex gap-3 items-center">
          <a href={`/roteiro/${videoId}`} className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
            ← Roteiro
          </a>
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
            Premissas
          </a>
        </div>
      </div>

      {/* INFORMAÇÕES DO ROTEIRO */}
      <Card className="bg-zinc-900 border-zinc-800 mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-zinc-100">{video.titulo || "Sem título"}</h2>
            <Badge variant="outline">{video.formato}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-400">
            <p><span className="text-zinc-500">Sinopse:</span> {video.sinopse}</p>
            <p><span className="text-zinc-500">Tom:</span> {video.tom}</p>
            <p><span className="text-zinc-500">Arco:</span> {video.arco_narrativo}</p>
            <p><span className="text-zinc-500">Caption:</span> {video.caption}</p>
            <p><span className="text-zinc-500">Texto final:</span> {video.texto_final_tela}</p>
            <p><span className="text-zinc-500">Duração total:</span> {duracaoTotal.toFixed(1)}s ({totalCenas} cenas)</p>
          </div>
        </CardContent>
      </Card>

      {/* PROGRESSO + REFERÊNCIA + CONTROLES */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {/* Contador de progresso */}
          <div className="text-sm">
            <span className="text-green-400 font-semibold">{aprovadas}</span>
            <span className="text-zinc-500">/{totalCenas} aprovadas</span>
            {geradas > 0 && <span className="text-blue-400 ml-2">({geradas} geradas)</span>}
            {pendentes > 0 && <span className="text-yellow-400 ml-2">({pendentes} pendentes)</span>}
          </div>

          {/* Imagem mestre como referência */}
          {MASTER_IMAGE_URL && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Ref:</span>
              <img src={MASTER_IMAGE_URL} alt="Clay master" className="h-10 w-8 object-cover rounded border border-zinc-700" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle view */}
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            className="text-xs cursor-pointer"
          >
            Grid
          </Button>
          <Button
            size="sm"
            variant={viewMode === "storyboard" ? "default" : "outline"}
            onClick={() => setViewMode("storyboard")}
            className="text-xs cursor-pointer"
          >
            Storyboard
          </Button>
        </div>
      </div>

      {/* STORYBOARD VIEW */}
      {viewMode === "storyboard" && (
        <div ref={storyboardRef} className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-thin">
          {cenas.map((c) => (
            <div key={c.id} className={`flex-shrink-0 ${video?.formato === "longo" ? "w-48" : "w-32"}`}>
              <div className="relative">
                {c.imagem_url ? (
                  <img src={c.imagem_url} alt={`Cena ${c.numero}`} className={`${video?.formato === "longo" ? "w-48 h-28" : "w-32 h-56"} object-cover rounded border border-zinc-700`} />
                ) : (
                  <div className={`${video?.formato === "longo" ? "w-48 h-28" : "w-32 h-56"} bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center text-zinc-600 text-xs`}>
                    Sem imagem
                  </div>
                )}
                <div className="absolute top-1 left-1">
                  <Badge className={`text-[10px] ${statusConfig[c.imagem_status]?.color || ""}`}>
                    {c.numero}
                  </Badge>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">{c.narracao}</p>
              <p className="text-[10px] text-zinc-600">{c.duracao_estimada}s</p>
            </div>
          ))}
        </div>
      )}

      {/* GRID VIEW */}
      <div className={viewMode === "storyboard" ? "" : ""}>
        <div className="space-y-4">
          {cenas.map((cena) => {
            const isEditing = editingCenas.has(cena.id);
            const isExpanded = expandedPrompts.has(cena.id);
            const status = statusConfig[cena.imagem_status] || statusConfig.pendente;
            const efx = Array.isArray(cena.efeitos_sonoros) ? cena.efeitos_sonoros : [];
            const form = editForms[cena.id] || {};
            return (
              <Card key={cena.id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-4">
                  {/* HEADER DA CENA */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-zinc-500">#{cena.numero}</span>
                      <Badge className={status.color}>{status.label}</Badge>
                      <Badge variant="outline" className="text-xs">{cena.tipo_cena}</Badge>
                      <span className={`text-xs ${emocaoColor[cena.emocao] || ""}`}>{cena.emocao}</span>
                      <span className="text-xs text-zinc-500">{cena.duracao_estimada}s</span>
                      {cena.continuidade && <Badge variant="outline" className="text-[10px]">CONT</Badge>}
                      {cena.personagem_presente && <Badge variant="outline" className="text-[10px]">Clay</Badge>}
                      <span className="text-xs text-zinc-600">
                        {cena.transicao_entrada === "dip_to_black" ? "⬛ fade" : "✂️ corte"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {cena.imagem_status !== "aprovada" && (
                        <Button size="sm" onClick={() => aprovarCena(cena.id)} className="text-xs bg-green-700 hover:bg-green-600 cursor-pointer">
                          Aprovar
                        </Button>
                      )}
                      {cena.imagem_status === "aprovada" && (
                        <Button size="sm" variant="outline" onClick={() => resetarCena(cena.id)} className="text-xs cursor-pointer">
                          Resetar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleEdit(cena.id, cena)} className="text-xs cursor-pointer">
                        {isEditing ? "Cancelar" : "Editar"}
                      </Button>
                    </div>
                  </div>

                  {/* CONTEÚDO: IMAGEM + INFO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* IMAGEM */}
                    <div className="md:col-span-1">
                      {cena.imagem_url ? (
                        <img
                          src={cena.imagem_url}
                          alt={`Cena ${cena.numero}`}
                          className="w-full rounded border border-zinc-700 cursor-pointer"
                          onClick={() => window.open(cena.imagem_url!, "_blank")}
                        />
                      ) : (
                        <div className={`w-full ${video?.formato === "longo" ? "aspect-video" : "aspect-[9/16]"} bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center text-zinc-600 text-sm`}>
                          Pendente
                        </div>
                      )}
                      {/* Upload manual */}
                      <input
                        id={`upload-${cena.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadManual(cena.id, cena.numero, file);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => document.getElementById(`upload-${cena.id}`)?.click()}
                        className="text-xs mt-2 w-full cursor-pointer"
                      >
                        Upload manual
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const efxArr = Array.isArray(cena.efeitos_sonoros) ? cena.efeitos_sonoros : [];
                          const txt = [
                            `CENA ${cena.numero} | ${cena.emocao} | ${cena.tipo_cena} | ${cena.duracao_estimada}s`,
                            `Narração: "${cena.narracao}"`,
                            `Ângulo: ${cena.angulo || "—"} | Abertura: ${cena.abertura || "—"}`,
                            `Iluminação: ${typeof cena.iluminacao === "string" ? cena.iluminacao : JSON.stringify(cena.iluminacao) || "—"}`,
                            `Foreground: ${cena.foreground || "—"}`,
                            `Midground: ${cena.midground || "—"}`,
                            `Background: ${cena.background || "—"}`,
                            `Paleta: ${typeof cena.paleta_cores === "string" ? cena.paleta_cores : JSON.stringify(cena.paleta_cores) || "—"}`,
                            `Redux strength: ${cena.redux_strength ?? "N/A"}`,
                            `Continuidade: ${cena.continuidade} | Personagem: ${cena.personagem_presente} | Perspectiva: ${cena.perspectiva}`,
                            `Transição: ${cena.transicao_entrada}`,
                            `Prompt FLUX: ${cena.prompt_flux || "—"}`,
                            `Movimento WAN: ${cena.prompt_movimento_wan || "—"}`,
                            `Som ambiente: ${cena.som_ambiente || "—"}`,
                            `Efeitos: ${efxArr.map((e: EfeitoSonoro) => e.tipo === "banco" ? "banco:" + e.tag + " (w:" + e.weight + ")" : 'stable_audio:"' + e.prompt + '" (w:' + e.weight + ")").join(", ") || "—"}`,
                            cena.nota_correcao ? `Nota de correção: ${cena.nota_correcao}` : ""
                          ].join("\n");
                          const ta = document.createElement("textarea");
                          ta.value = txt;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                          toast.success("Cena copiada");
                        }}
                        className="text-xs mt-1 w-full cursor-pointer"
                      >
                        📋 Copiar cena
                      </Button>
                    </div>

                    {/* INFO */}
                    <div className="md:col-span-2 space-y-2">
                      <p className="text-sm text-zinc-200">&quot;{cena.narracao}&quot;</p>

                      {/* Direção artística resumida */}
                      <div className="text-xs text-zinc-500 space-y-0.5">
                        <p><span className="text-zinc-600">Ângulo:</span> {cena.angulo || "—"} | <span className="text-zinc-600">Abertura:</span> {cena.abertura || "—"}</p>
                        <p><span className="text-zinc-600">Iluminação:</span> {typeof cena.iluminacao === 'string' ? cena.iluminacao : JSON.stringify(cena.iluminacao) || "—"}</p>
                        <p><span className="text-zinc-600">Paleta:</span> {typeof cena.paleta_cores === 'string' ? cena.paleta_cores : JSON.stringify(cena.paleta_cores) || "—"}</p>
                        {cena.redux_strength !== null && (
                          <p><span className="text-zinc-600">Redux strength:</span> {cena.redux_strength}</p>
                        )}
                      </div>

                      {/* Prompt FLUX colapsável */}
                      <div>
                        <button
                          onClick={() => {
                            const newSet = new Set(expandedPrompts);
                            isExpanded ? newSet.delete(cena.id) : newSet.add(cena.id);
                            setExpandedPrompts(newSet);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                          {isExpanded ? "▼ Ocultar prompt FLUX" : "▶ Ver prompt FLUX"}
                        </button>
                        {isExpanded && (
                          <p className="text-xs text-zinc-500 mt-1 bg-zinc-800 p-2 rounded break-all">
                            {cena.prompt_flux}
                          </p>
                        )}
                      </div>

                      {/* Movimento WAN */}
                      <p className="text-xs text-zinc-500">
                        <span className="text-zinc-600">Movimento WAN:</span> {cena.prompt_movimento_wan || "—"}
                      </p>

                      {/* Nota de correção pendente */}
                      {!isEditing && cena.nota_correcao && (
                        <div className="text-xs bg-yellow-900/20 border border-yellow-800/30 rounded p-2">
                          <span className="text-yellow-400 font-semibold">Nota de correção:</span>{" "}
                          <span className="text-yellow-300">{cena.nota_correcao}</span>
                        </div>
                      )}

                      {/* Efeitos sonoros (somente leitura) */}
                      {!isEditing && (
                        <div className="text-xs text-zinc-500">
                          <span className="text-zinc-600">Som ambiente:</span> {cena.som_ambiente || "—"}
                          <div className="mt-0.5">
                            <span className="text-zinc-600">Efeitos:</span>{" "}
                            {efx.map((e: EfeitoSonoro, i: number) => (
                              <span key={i} className="mr-2">
                                [{e.tipo === "banco" ? e.tag : e.prompt} w:{e.weight}]
                              </span>
                            ))}
                            {efx.length === 0 && "—"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MODO EDIÇÃO */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                      <div>
                        <label className="text-xs text-zinc-400">Prompt FLUX</label>
                        <Textarea
                          value={(form.prompt_flux as string) || ""}
                          onChange={(e) => updateFormField(cena.id, "prompt_flux", e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-xs"
                          rows={5}
                        />
                      </div>
                      {/* Nota de correção */}
                      <div>
                        <label className="text-xs text-zinc-400">Nota de Correção (Claude reescreve o prompt automaticamente)</label>
                        <Textarea
                          value={(form.nota_correcao as string) || ""}
                          onChange={(e) => updateFormField(cena.id, "nota_correcao", e.target.value)}
                          placeholder="Ex: Clay está duplicado, cenário muito vazio, iluminação muito escura..."
                          className="bg-zinc-800 border-zinc-700 text-xs"
                          rows={2}
                        />
                        <p className="text-[10px] text-zinc-600 mt-1">Se preenchido, o Claude reescreve o prompt antes de regenerar. Deixe vazio para usar o prompt como está.</p>
                      </div>

                      {/* Tipo de cena + Personagem presente */}
                      <div className="flex items-center gap-6 py-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400">Tipo:</label>
                          <select
                            value={(form.tipo_cena as string) || "personagem"}
                            onChange={(e) => {
                              updateFormField(cena.id, "tipo_cena", e.target.value);
                              if (e.target.value === "personagem") {
                                updateFormField(cena.id, "personagem_presente", true);
                                if (!form.redux_strength) updateFormField(cena.id, "redux_strength", 0.7);
                              } else {
                                updateFormField(cena.id, "personagem_presente", false);
                                updateFormField(cena.id, "redux_strength", null);
                              }
                            }}
                            className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
                          >
                            <option value="personagem">personagem</option>
                            <option value="ambiente">ambiente</option>
                            <option value="ameaca">ameaça</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={form.personagem_presente as boolean}
                            onChange={(e) => {
                              updateFormField(cena.id, "personagem_presente", e.target.checked);
                              if (!e.target.checked) {
                                updateFormField(cena.id, "redux_strength", null);
                              } else if (!form.redux_strength) {
                                updateFormField(cena.id, "redux_strength", 0.7);
                              }
                            }}
                          />
                          Clay presente na cena (usa Redux com referência)
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-zinc-400">Prompt Movimento WAN</label>
                          <Textarea
                            value={(form.prompt_movimento_wan as string) || ""}
                            onChange={(e) => updateFormField(cena.id, "prompt_movimento_wan", e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-xs"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400">Redux Strength ({form.personagem_presente ? "0.70-0.90" : "N/A"})</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.70"
                              max="0.90"
                              step="0.01"
                              value={form.redux_strength ?? 0.7}
                              onChange={(e) => updateFormField(cena.id, "redux_strength", parseFloat(e.target.value))}
                              className="flex-1"
                              disabled={!form.personagem_presente}
                            />
                            <span className="text-xs text-zinc-300 w-10">
                              {form.redux_strength !== null && form.redux_strength !== undefined
                                ? (form.redux_strength as number).toFixed(2)
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-zinc-800" />

                      {/* Efeitos sonoros editáveis */}
                      <div>
                        <label className="text-xs text-zinc-400">Som Ambiente</label>
                        <Input
                          value={(form.som_ambiente as string) || ""}
                          onChange={(e) => updateFormField(cena.id, "som_ambiente", e.target.value)}
                          className="bg-zinc-800 border-zinc-700 text-xs"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-zinc-400">Efeitos Sonoros</label>
                          <Button size="sm" variant="outline" onClick={() => addEfeito(cena.id)} className="text-xs cursor-pointer">
                            + Efeito
                          </Button>
                        </div>
                        {((form.efeitos_sonoros as EfeitoSonoro[]) || []).map((ef, idx) => (
                          <div key={idx} className="flex gap-2 mb-2 items-end">
                            <div className="w-28">
                              <select
                                value={ef.tipo}
                                onChange={(e) => updateEfeito(cena.id, idx, "tipo", e.target.value)}
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
                                  onChange={(e) => updateEfeito(cena.id, idx, "tag", e.target.value)}
                                  className="bg-zinc-800 border-zinc-700 text-xs"
                                />
                              ) : (
                                <Input
                                  placeholder="prompt em inglês"
                                  value={ef.prompt || ""}
                                  onChange={(e) => updateEfeito(cena.id, idx, "prompt", e.target.value)}
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
                                onChange={(e) => updateEfeito(cena.id, idx, "weight", parseFloat(e.target.value))}
                                className="bg-zinc-800 border-zinc-700 text-xs"
                              />
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeEfeito(cena.id, idx)} className="text-xs text-red-400 cursor-pointer">
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => salvarEdicao(cena.id)} className="cursor-pointer">
                          Salvar e marcar para regeneração
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleEdit(cena.id, cena)} className="cursor-pointer">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* THUMBNAIL (se longo) */}
      {video.formato === "longo" && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Thumbnail</h2>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="Thumbnail" className="w-full rounded border border-zinc-700" />
                  ) : (
                    <div className="w-full aspect-video bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center text-zinc-600">
                      Pendente
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 text-sm text-zinc-400">
                  <p><span className="text-zinc-500">Prompt:</span> {video.thumbnail_prompt || "—"}</p>
                  <p className="mt-1"><span className="text-zinc-500">Resolução:</span> 1280×720 (16:9)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BARRA DE AÇÕES GLOBAIS */}
      <div className="mt-6 pt-4 border-t border-zinc-800 flex gap-3 flex-wrap">
        <Button
          onClick={regenerarPendentes}
          disabled={regenerando || pendentes === 0}
          variant="outline"
          className="cursor-pointer"
        >
          {regenerando ? "Disparando..." : `Regenerar pendentes (${pendentes})`}
        </Button>
<Button onClick={aprovarEContinuar} className="cursor-pointer">
  Aprovar e continuar →
</Button>
      </div>
    </div>
  );
}
