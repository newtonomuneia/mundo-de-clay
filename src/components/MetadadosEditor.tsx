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
