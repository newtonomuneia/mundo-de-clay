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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const EMOCOES = ["calma", "neutra", "tensa", "suspense", "panico"];
const TIPOS_CENA = ["personagem", "ambiente", "ameaca"];
const TRANSICOES = ["dip_to_black", "corte_seco"];
const PERSPECTIVAS = ["terceira_pessoa", "primeira_pessoa"];

interface Props {
  cena: Cena;
  onUpdate: () => void;
}

export function CenaEditor({ cena, onUpdate }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cena.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
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

  async function inserirCenaDepois() {
    const novaOrdem = cena.ordem + 1;

    const { data: cenasPosteriores } = await supabase
      .from("cenas")
      .select("id, ordem")
      .eq("opcao_id", cena.opcao_id)
      .gte("ordem", novaOrdem)
      .order("ordem", { ascending: false });

    if (cenasPosteriores) {
      for (const c of cenasPosteriores) {
        await supabase
          .from("cenas")
          .update({ ordem: c.ordem + 1, numero: String(c.ordem + 1) })
          .eq("id", c.id);
      }
    }

    const { error } = await supabase.from("cenas").insert({
      video_id: cena.video_id,
      opcao_id: cena.opcao_id,
      numero: String(novaOrdem),
      ordem: novaOrdem,
      narracao: "",
      emocao: "neutra",
      duracao_estimada: 4.5,
      tipo_cena: "personagem",
      personagem_presente: true,
      perspectiva: "terceira_pessoa",
      transicao_entrada: "dip_to_black",
      continuidade: false,
      visual: "",
      movimento: "",
      som_ambiente: "",
      efeitos_sonoros: [],
    });

    if (error) {
      toast.error("Erro ao inserir cena");
    } else {
      toast.success(`Cena inserida após #${cena.numero}`);
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
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
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
      <div ref={setNodeRef} style={style}>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span {...attributes} {...listeners} className="text-sm font-mono text-zinc-500 cursor-grab active:cursor-grabbing select-none">
                  ⠿ #{cena.numero}
                </span>
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
              <Button size="sm" variant="ghost" onClick={() => setEditando(true)} className="text-xs cursor-pointer">
                Editar
              </Button>
            </div>
            <p className="text-sm text-zinc-200 mb-1">&quot;{cena.narracao}&quot;</p>
            <p className="text-xs text-zinc-500 mb-1">Visual: {cena.visual}</p>
            <p className="text-xs text-zinc-500 mb-1">Movimento: {cena.movimento}</p>
            <div className="text-xs text-zinc-500">
              Efeitos: {efx.map((e: EfeitoSonoro, i: number) => (
                <span key={i} className="mr-2">
                  [{e.tipo === "banco" ? e.tag : e.prompt} w:{e.weight}]
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-zinc-400">Editando cena #{cena.numero}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={inserirCenaDepois} className="text-xs cursor-pointer">
                + Inserir cena depois
              </Button>
              <Button size="sm" variant="destructive" onClick={deletarCena} className="text-xs cursor-pointer">
                Deletar
              </Button>
            </div>
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
              <Button size="sm" variant="outline" onClick={addEfeito} className="text-xs cursor-pointer">
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
                <Button size="sm" variant="ghost" onClick={() => removeEfeito(idx)} className="text-xs text-red-400 cursor-pointer">
                  ✕
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={salvar} className="cursor-pointer">Salvar cena</Button>
            <Button size="sm" variant="outline" onClick={() => setEditando(false)} className="cursor-pointer">Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
