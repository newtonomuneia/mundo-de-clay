"use client";
import EfeitosNecessarios from "@/components/EfeitosNecessarios";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface EfeitoSonoro {
  tipo: string;
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
  duracao_real: number | null;
  tipo_cena: string;
  imagem_url: string | null;
  video_url: string | null;
  video_status: string;
  efeito_url: string | null;
  efeito_status: string;
  tts_url: string | null;
  tts_status: string;
  prompt_movimento_wan: string | null;
  efeitos_sonoros: EfeitoSonoro[] | string | null;
  nota_correcao: string | null;
  personagem_presente: boolean;
  continuidade: boolean;
  redux_strength: number | null;
  angulo: string | null;
  abertura: string | null;
  iluminacao: unknown;
  paleta_cores: unknown;
  foreground: string | null;
  midground: string | null;
  background: string | null;
  prompt_flux: string | null;
  transicao_entrada: string | null;
}

interface Video {
  id: string;
  titulo: string | null;
  formato: string | null;
  sinopse: string | null;
  tom: string | null;
  num_cenas: number | null;
  geracao_efeitos_status: string | null;
  geracao_animacao_status: string | null;
  texto_final_tela: string | null;
}

const EMOCAO_COLORS: Record<string, string> = {
  calma: "bg-blue-900/60 text-blue-300 border-blue-700",
  neutra: "bg-zinc-700/60 text-zinc-300 border-zinc-600",
  tensa: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  suspense: "bg-purple-900/60 text-purple-300 border-purple-700",
  panico: "bg-red-900/60 text-red-300 border-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-zinc-700/60 text-zinc-400 border-zinc-600",
  gerada: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  aprovada: "bg-green-900/60 text-green-300 border-green-700",
  rejeitada: "bg-red-900/60 text-red-300 border-red-700",
  faltando: "bg-orange-900/60 text-orange-300 border-orange-700",
};

function parseEfeitos(efx: EfeitoSonoro[] | string | null): EfeitoSonoro[] {
  if (!efx) return [];
  if (typeof efx === "string") {
    try { return JSON.parse(efx); } catch { return []; }
  }
  return efx;
}

export default function PreviewPage() {
  const params = useParams();
  const videoId = params.videoId as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [cenas, setCenas] = useState<Cena[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [notaForms, setNotaForms] = useState<Record<string, string>>({});
  const [editingNotas, setEditingNotas] = useState<Set<string>>(new Set());
  const [regenerando, setRegenerando] = useState(false);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const playAllRef = useRef(false);

  useEffect(() => {
    if (videoId) fetchData();
  }, [videoId]);

  async function fetchData() {
    const { data: vData } = await supabase
      .from("videos")
      .select("id,titulo,formato,sinopse,tom,num_cenas,geracao_efeitos_status,geracao_animacao_status,texto_final_tela")
      .eq("id", videoId)
      .single();
    if (vData) setVideo(vData);

    const { data: cData } = await supabase
      .from("cenas")
      .select("*")
      .eq("video_id", videoId)
      .is("opcao_id", null)
      .order("ordem", { ascending: true });
    if (cData) setCenas(cData as Cena[]);
    setLoading(false);
  }

  const totalCenas = cenas.length;
  const cenasNormais = cenas.filter((c) => c.tipo_cena !== "texto");
  const aprovadas = cenasNormais.filter(
    (c) => c.video_status === "aprovada" && c.efeito_status === "aprovada"
  ).length;
const pendentes = cenasNormais.filter(
    (c) => c.video_status === "pendente" || c.efeito_status === "pendente"
  ).length;  
const todasAprovadas =
    cenas.every(
      (c) =>
        c.tipo_cena === "texto" ||
        (c.video_status === "aprovada" && c.efeito_status === "aprovada")
    ) && totalCenas > 0;
  const duracaoTotal = cenas.reduce(
    (s, c) => s + (c.tipo_cena === "texto" ? c.duracao_estimada || 3 : 5),
    0
  );

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  function playCena(cenaId: string) {
    const vid = videoRefs.current[cenaId];
    const aud = audioRefs.current[cenaId];
    if (vid) { vid.currentTime = 0; vid.play().catch(() => {}); }
    if (aud) {
      aud.currentTime = 0;
      aud.play().catch(() => {});
      const onEnd = () => { if (vid) vid.pause(); aud.removeEventListener("ended", onEnd); };
      aud.addEventListener("ended", onEnd);
    }
  }

  function stopCena(cenaId: string) {
    const vid = videoRefs.current[cenaId];
    const aud = audioRefs.current[cenaId];
    if (vid) { vid.pause(); vid.currentTime = 0; }
    if (aud) { aud.pause(); aud.currentTime = 0; }
  }

  async function playAll() {
    setPlayingAll(true);
    playAllRef.current = true;
    for (const cena of cenas) {
      if (!playAllRef.current) break;
      setPlayingIndex(cena.ordem);
      const dur = cena.tipo_cena === "texto" ? (cena.duracao_estimada || 3) : 5;
      if (cena.tipo_cena === "texto") {
        await new Promise<void>((resolve) => setTimeout(resolve, dur * 1000));
      } else {
        const vid = videoRefs.current[cena.id];
        const aud = audioRefs.current[cena.id];
        if (vid) { vid.currentTime = 0; vid.play().catch(() => {}); }
        if (aud) { aud.currentTime = 0; aud.play().catch(() => {}); }
        await new Promise<void>((resolve) => {
          if (aud && aud.src) {
            const onEnd = () => { aud.removeEventListener("ended", onEnd); if (vid) vid.pause(); resolve(); };
            aud.addEventListener("ended", onEnd);
          } else {
            setTimeout(() => { if (vid) vid.pause(); resolve(); }, dur * 1000);
          }
        });
      }
    }
    setPlayingAll(false);
    setPlayingIndex(-1);
    playAllRef.current = false;
  }

  function stopAll() {
    playAllRef.current = false;
    setPlayingAll(false);
    setPlayingIndex(-1);
    Object.values(videoRefs.current).forEach((v) => { if (v) { v.pause(); v.currentTime = 0; } });
    Object.values(audioRefs.current).forEach((a) => { if (a) { a.pause(); a.currentTime = 0; } });
  }

async function toggleStatusModulo(cena: Cena, modulo: "efeito" | "video") {
    const campo = `${modulo}_status` as "efeito_status" | "video_status";
    const atual = cena[campo];
    // Ciclo: aprovada → pendente → gerada → aprovada
    let novo: string;
    if (atual === "aprovada") novo = "pendente";
    else if (atual === "pendente") novo = "gerada";
    else novo = "aprovada"; // gerada ou qualquer outro

    const { error } = await supabase
      .from("cenas")
      .update({ [campo]: novo })
      .eq("id", cena.id);

    if (error) {
      toast.error(`Erro ao atualizar ${modulo}`);
      return;
    }
    toast.success(`${modulo}: ${novo}`);
    fetchData();
  }  

async function aprovarCena(cenaId: string) {
    await supabase.from("cenas").update({ video_status: "aprovada", efeito_status: "aprovada" }).eq("id", cenaId);
    toast.success("Cena aprovada");
    fetchData();
  }

  async function rejeitarCena(cenaId: string) {
    await supabase.from("cenas").update({ video_status: "pendente", efeito_status: "pendente" }).eq("id", cenaId);
    toast.info("Cena marcada para regeneração");
    fetchData();
  }

  function toggleNota(cenaId: string, currentNota: string | null) {
    const newSet = new Set(editingNotas);
    if (newSet.has(cenaId)) {
      newSet.delete(cenaId);
    } else {
      newSet.add(cenaId);
      setNotaForms((prev) => ({ ...prev, [cenaId]: currentNota || "" }));
    }
    setEditingNotas(newSet);
  }

  async function salvarNota(cenaId: string) {
    const nota = notaForms[cenaId] || "";
    await supabase.from("cenas").update({
      nota_correcao: nota || null,
      video_status: "pendente",
      efeito_status: "pendente",
    }).eq("id", cenaId);
    const newSet = new Set(editingNotas);
    newSet.delete(cenaId);
    setEditingNotas(newSet);
    toast.success("Nota salva. Cena marcada para regeneração.");
    fetchData();
  }

  function copiarCena(cena: Cena) {
    const efxArr = parseEfeitos(cena.efeitos_sonoros);
    const txt = [
      `CENA ${cena.numero} | ${cena.emocao} | ${cena.tipo_cena} | ${cena.tipo_cena === "texto" ? cena.duracao_estimada + "s" : "5s"}`,
      `Narração: "${cena.narracao || "—"}"`,
      `Duração real: ${cena.duracao_real ? cena.duracao_real.toFixed(1) + "s" : "—"}`,
      `Ângulo: ${cena.angulo || "—"} | Abertura: ${cena.abertura || "—"}`,
      `Iluminação: ${typeof cena.iluminacao === "string" ? cena.iluminacao : JSON.stringify(cena.iluminacao) || "—"}`,
      `Foreground: ${cena.foreground || "—"}`,
      `Midground: ${cena.midground || "—"}`,
      `Background: ${cena.background || "—"}`,
      `Paleta: ${typeof cena.paleta_cores === "string" ? cena.paleta_cores : JSON.stringify(cena.paleta_cores) || "—"}`,
      `Redux strength: ${cena.redux_strength ?? "N/A"}`,
      `Continuidade: ${cena.continuidade} | Personagem: ${cena.personagem_presente}`,
      `Transição: ${cena.transicao_entrada || "—"}`,
      `Prompt FLUX: ${cena.prompt_flux || "—"}`,
      `Movimento WAN: ${cena.prompt_movimento_wan || "—"}`,
      `Efeitos: ${efxArr.map((e: EfeitoSonoro) => (e.tipo === "banco" ? "banco:" + e.tag : "stable_audio:" + e.prompt) + " (w:" + e.weight + ")").join(", ") || "—"}`,
      cena.nota_correcao ? `Nota de correção: ${cena.nota_correcao}` : "",
      `\n[Descreva o problema aqui]`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(txt);
    toast.success("Cena copiada para clipboard");
  }


async function aprovarEContinuar() {
    // No preview, "aprovar e continuar" = aprovar tudo + disparar montagem (M08)
    // O botão só está habilitado quando todas as cenas já têm os 4 status aprovada,
    // então o loop de update normalmente não tem o que fazer — só garante consistência.
    for (const c of cenasNormais) {
      if (
        c.video_status !== "aprovada" ||
        c.efeito_status !== "aprovada"
      ) {
        await supabase.from("cenas").update({
          video_status: "aprovada",
          efeito_status: "aprovada",
        }).eq("id", c.id);
      }
    }

    toast.info("Disparando montagem final...");
    try {
      await fetch(`/api/webhook?path=montagem/disparar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      toast.success("Montagem iniciada! Acompanhe no n8n. O vídeo final aparecerá no bucket videos-finais.");
    } catch {
      toast.error("Erro ao disparar montagem");
    }
  }

    async function regenerarPendentes() {
    setRegenerando(true);
    toast.info("Disparando regeneração...");
    try {
      const res = await fetch(`/api/webhook?path=preview/regenerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Processando ${data.cenas_com_nota} cena(s). Recarregue em alguns minutos.`);
      } else {
        toast.error("Erro ao disparar regeneração");
      }
    } catch {
      toast.error("Erro de conexão com n8n");
    }
    setRegenerando(false);
  }


  function toggleDetails(cenaId: string) {
    const newSet = new Set(expandedDetails);
    if (newSet.has(cenaId)) newSet.delete(cenaId);
    else newSet.add(cenaId);
    setExpandedDetails(newSet);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500">Carregando...</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-red-400">Vídeo não encontrado.</p>
      </div>
    );
  }

  const efeitosOk = video.geracao_efeitos_status === "concluido";
  const animacaoOk = video.geracao_animacao_status === "concluido";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-3xl mx-auto">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');`}</style>

      {/* HEADER */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-1">
          {video.titulo || "Sem título"}{" "}
          <span className="text-zinc-500 text-base font-normal">— Preview</span>
        </h1>
        <p className="text-sm text-zinc-500 mb-3">{video.sinopse || ""}</p>
        <div className="flex flex-wrap gap-3 text-sm justify-center">
          <span className="text-zinc-400">
            Cenas: <span className="text-zinc-200">{totalCenas}</span>
          </span>
          <Separator orientation="vertical" className="h-5 bg-zinc-700" />
          <span className="text-green-400">Aprovadas: {aprovadas}/{cenasNormais.length}</span>
          <Separator orientation="vertical" className="h-5 bg-zinc-700" />
          <span className="text-zinc-400">
            Duração total: <span className="text-zinc-200">{formatDuration(duracaoTotal)}</span>
          </span>
        </div>
        {!efeitosOk && (
          <div className="mt-3 px-3 py-2 rounded bg-yellow-900/30 border border-yellow-800 text-yellow-300 text-sm">
            ⏳ Aguardando efeitos sonoros...
          </div>
        )}
        {!animacaoOk && (
          <div className="mt-3 px-3 py-2 rounded bg-yellow-900/30 border border-yellow-800 text-yellow-300 text-sm">
            ⏳ Aguardando animação WAN...
          </div>
        )}
      </div>

<EfeitosNecessarios videoId={videoId} />      
{/* CONTROLE DE REPRODUÇÃO */}
      <div className="mb-4 flex gap-2 justify-center">
        {!playingAll ? (
          <Button onClick={playAll} variant="outline" size="sm" className="cursor-pointer" disabled={!efeitosOk || !animacaoOk}>
            ▶ Tocar tudo em sequência
          </Button>
        ) : (
          <Button onClick={stopAll} variant="outline" size="sm" className="cursor-pointer text-red-400 border-red-800">
            ■ Parar reprodução
          </Button>
        )}
      </div>

      {/* LISTA DE CENAS */}
      <div className="space-y-4">
        {cenas.map((cena) => {
          const isTexto = cena.tipo_cena === "texto";
          const isPlaying = playingIndex === cena.ordem;
          const showDetails = expandedDetails.has(cena.id);
          const isEditingNota = editingNotas.has(cena.id);
          const efxArr = parseEfeitos(cena.efeitos_sonoros);
          const cenaAprovada = isTexto || (cena.video_status === "aprovada" && cena.efeito_status === "aprovada");

          return (
            <Card
              key={cena.id}
              className={`bg-zinc-900 border-zinc-800 ${isPlaying ? "ring-1 ring-purple-500/50" : ""}`}
            >
              <CardContent className="pt-4">
                {isTexto ? (
                  /* === CENA DE TEXTO === */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span className="text-sm font-semibold text-zinc-200">Tela Final</span>
                      <Badge variant="outline" className="text-xs bg-zinc-700/60 text-zinc-300 border-zinc-600">texto</Badge>
                      <Badge variant="outline" className="text-xs bg-green-900/60 text-green-300 border-green-700">aprovada</Badge>
                      <span className="text-xs text-zinc-500" style={{ marginLeft: "8px" }}>{cena.duracao_estimada || 3}s</span>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#000",
                        aspectRatio: video.formato === "longo" ? "16/9" : "9/16",
                        maxHeight: "300px",
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        border: "1px solid #3f3f46",
                      }}
                    >
<span
  style={{
    fontFamily: "'Creepster', cursive",
    color: "#fff",
    fontSize: video.formato === "longo" ? "18px" : "14px",
    textAlign: "center",
    padding: "16px",
    lineHeight: "1.4",
    maxWidth: "90%",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    display: "block",
  }}
>
  {cena.narracao}
</span>
                    </div>
                  </div>
                ) : (
                  /* === CENA NORMAL === */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {/* Badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                      <span className="text-sm font-semibold text-zinc-200">Cena {cena.numero}</span>
                      <Badge variant="outline" className={`text-xs ${EMOCAO_COLORS[cena.emocao] || EMOCAO_COLORS.neutra}`}>
                        {cena.emocao}
                      </Badge>
<Badge
                        variant="outline"
                        className={`text-xs cursor-pointer hover:brightness-125 ${STATUS_COLORS[cena.video_status] || STATUS_COLORS.pendente}`}
                        onClick={() => toggleStatusModulo(cena, "video")}
                        title="Clique para alternar (aprovada → pendente → gerada)"
                      >
                        vídeo: {cena.video_status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs cursor-pointer hover:brightness-125 ${STATUS_COLORS[cena.efeito_status] || STATUS_COLORS.pendente}`}
                        onClick={() => toggleStatusModulo(cena, "efeito")}
                        title="Clique para alternar (aprovada → pendente → gerada)"
                      >
                        efeito: {cena.efeito_status}
                      </Badge>
                      {cena.personagem_presente && (
                        <Badge variant="outline" className="text-xs bg-indigo-900/40 text-indigo-300 border-indigo-700">Clay</Badge>
                      )}
                      {cena.continuidade && (
                        <Badge variant="outline" className="text-xs bg-cyan-900/40 text-cyan-300 border-cyan-700">CONT</Badge>
                      )}
                      <span className="text-xs text-zinc-500">5s</span>
                    </div>

                    {/* Player de vídeo */}
                    {cena.video_url ? (
                      <div style={{ width: "100%", marginBottom: "12px" }}>
                        <video
                          ref={(el) => { videoRefs.current[cena.id] = el; }}
                          src={cena.video_url}
                          style={{
                            maxHeight: "400px",
                            aspectRatio: video.formato === "longo" ? "16/9" : "9/16",
                            objectFit: "contain",
                            backgroundColor: "#000",
                            borderRadius: "8px",
                            border: "1px solid #3f3f46",
                            display: "block",
                            margin: "0 auto",
                          }}
                          preload="metadata"
                          muted
                          playsInline
                        />
                        {cena.efeito_url && (
                          <audio ref={(el) => { audioRefs.current[cena.id] = el; }} src={cena.efeito_url} preload="none" />
                        )}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "center" }}>
                          <Button size="sm" variant="outline" className="cursor-pointer text-xs" onClick={() => playCena(cena.id)}>
                            ▶ Play (vídeo + áudio)
                          </Button>
                          <Button size="sm" variant="outline" className="cursor-pointer text-xs text-zinc-500" onClick={() => stopCena(cena.id)}>
                            ■ Stop
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          aspectRatio: video.formato === "longo" ? "16/9" : "9/16",
                          maxHeight: "300px",
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#27272a",
                          borderRadius: "8px",
                          border: "1px solid #3f3f46",
                          color: "#52525b",
                          fontSize: "14px",
                          marginBottom: "12px",
                        }}
                      >
                        Vídeo não gerado
                      </div>
                    )}

                    {/* Narração */}
                    <p style={{ fontSize: "14px", color: "#d4d4d8", marginBottom: "8px", lineHeight: "1.6", textAlign: "center" }}>
                      &quot;{cena.narracao}&quot;
                    </p>

                    {/* Efeitos */}
                    {efxArr.length > 0 && (
                      <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "12px", textAlign: "center" }}>
                        Efeitos:{" "}
                        {efxArr.map((e, i) => (
                          <span key={i} style={{
                            display: "inline-block", marginRight: "8px", padding: "2px 6px",
                            backgroundColor: "#27272a", borderRadius: "4px", border: "1px solid #3f3f46",
                          }}>
                            {e.tag || e.prompt} <span style={{ color: "#52525b" }}>w:{e.weight}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Nota existente */}
                    {cena.nota_correcao && !isEditingNota && (
                      <div style={{
                        marginBottom: "12px", padding: "8px 12px", borderRadius: "6px",
                        backgroundColor: "rgba(120, 53, 15, 0.2)", border: "1px solid rgba(120, 53, 15, 0.5)",
                        color: "#fcd34d", fontSize: "12px", textAlign: "center", width: "100%",
                      }}>
                        Nota: {cena.nota_correcao}
                      </div>
                    )}

                    {/* Detalhes colapsáveis */}
                    <button
                      onClick={() => toggleDetails(cena.id)}
                      style={{
                        fontSize: "12px", color: "#52525b", marginBottom: "8px",
                        cursor: "pointer", background: "none", border: "none",
                      }}
                    >
                      {showDetails ? "▼ Ocultar detalhes" : "▶ Ver detalhes técnicos"}
                    </button>

                    {showDetails && (
                      <div style={{
                        fontSize: "12px", color: "#71717a", marginBottom: "12px", padding: "12px",
                        backgroundColor: "rgba(39, 39, 42, 0.5)", borderRadius: "6px",
                        border: "1px solid #3f3f46", width: "100%", textAlign: "left",
                      }}>
                        <p><span style={{ color: "#a1a1aa" }}>Movimento WAN:</span> {cena.prompt_movimento_wan || "—"}</p>
                        <p><span style={{ color: "#a1a1aa" }}>Ângulo:</span> {cena.angulo || "—"} | <span style={{ color: "#a1a1aa" }}>Abertura:</span> {cena.abertura || "—"}</p>
                        <p><span style={{ color: "#a1a1aa" }}>Redux:</span> {cena.redux_strength ?? "N/A"} | <span style={{ color: "#a1a1aa" }}>Continuidade:</span> {String(cena.continuidade)}</p>
                        <p><span style={{ color: "#a1a1aa" }}>Transição:</span> {cena.transicao_entrada || "—"}</p>
                        {cena.prompt_flux && (
                          <details style={{ marginTop: "4px" }}>
                            <summary style={{ cursor: "pointer", color: "#a1a1aa" }}>Prompt FLUX</summary>
                            <pre style={{ marginTop: "4px", fontSize: "11px", whiteSpace: "pre-wrap", color: "#52525b" }}>{cena.prompt_flux}</pre>
                          </details>
                        )}
                      </div>
                    )}

                    {/* Ações */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                      {!cenaAprovada && (
                        <Button size="sm" variant="outline" onClick={() => aprovarCena(cena.id)}
                          className="text-xs cursor-pointer text-green-400 border-green-800 hover:bg-green-900/30">
                          ✓ Aprovar
                        </Button>
                      )}
                      {cenaAprovada && !isTexto && (
                        <Button size="sm" variant="outline" onClick={() => rejeitarCena(cena.id)}
                          className="text-xs cursor-pointer text-zinc-500 border-zinc-700">
                          Desfazer aprovação
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleNota(cena.id, cena.nota_correcao)}
                        className="text-xs cursor-pointer">
                        {isEditingNota ? "Cancelar nota" : "Nota de correção"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copiarCena(cena)}
                        className="text-xs cursor-pointer text-zinc-400 border-zinc-700">
                        Copiar cena
                      </Button>
                    </div>

                    {/* Formulário nota */}
                    {isEditingNota && (
                      <div style={{
                        marginTop: "12px", padding: "12px", borderRadius: "6px",
                        backgroundColor: "rgba(39, 39, 42, 0.5)", border: "1px solid #3f3f46", width: "100%",
                      }}>
                        <label style={{ fontSize: "12px", color: "#a1a1aa", display: "block", marginBottom: "4px" }}>
                          Descreva o que precisa mudar (movimento, efeito, narração...):
                        </label>
                        <Textarea
                          value={notaForms[cena.id] || ""}
                          onChange={(e) => setNotaForms((prev) => ({ ...prev, [cena.id]: e.target.value }))}
                          className="bg-zinc-800 border-zinc-700 text-sm"
                          rows={3}
                          placeholder="Ex: Movimento muito sutil, quero mais rotação da cabeça. Efeito de respiração alto demais."
                        />
                        <div style={{ marginTop: "8px", textAlign: "center" }}>
                          <Button size="sm" onClick={() => salvarNota(cena.id)} className="cursor-pointer">
                            Salvar nota e marcar para regeneração
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

{/* BARRA DE AÇÕES GLOBAIS */}
      <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #27272a", display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <Button onClick={regenerarPendentes} disabled={regenerando || pendentes === 0} variant="outline" className="cursor-pointer">
          {regenerando ? "Disparando..." : `Regenerar pendentes (${pendentes})`}
        </Button>
        <Button
          onClick={aprovarEContinuar}
          disabled={!todasAprovadas}
          className="bg-green-700 hover:bg-green-600 cursor-pointer disabled:bg-zinc-700 disabled:hover:bg-zinc-700"
        >
          Aprovar e continuar →
        </Button>
      </div>
</div>
  );
}
