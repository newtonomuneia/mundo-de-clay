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
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

export default function RoteiroPage() {
  const params = useParams();
  const videoId = params.videoId as string;

  const [opcoes, setOpcoes] = useState<RoteiroOpcao[]>([]);
  const [cenasPorOpcao, setCenasPorOpcao] = useState<Record<string, Cena[]>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [aprovando, setAprovando] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent, opcaoId: string) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const cenas = cenasPorOpcao[opcaoId] || [];
    const oldIndex = cenas.findIndex((c) => c.id === active.id);
    const newIndex = cenas.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(cenas, oldIndex, newIndex);

const renumbered = reordered.map((c, i) => ({ ...c, ordem: i + 1, numero: String(i + 1) }));
    setCenasPorOpcao((prev) => ({ ...prev, [opcaoId]: renumbered }));

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("cenas")
        .update({ ordem: i + 1, numero: String(i + 1) })
        .eq("id", reordered[i].id);
    }
  }

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
    if (opcoesData && opcoesData.length > 0 && !activeTab) {
      setActiveTab(opcoesData[0].id);
    }

    const cenasMap: Record<string, Cena[]> = {};
    for (const opcao of opcoesData || []) {
let cenasQuery = supabase
        .from("cenas")
        .select("*")
        .eq("video_id", videoId)
        .order("ordem", { ascending: true });
      if (opcao.status === "aprovada") {
        cenasQuery = cenasQuery.is("opcao_id", null);
      } else {
        cenasQuery = cenasQuery.eq("opcao_id", opcao.id);
      }
      const { data: cenasData } = await cenasQuery;
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
        `/api/webhook?path=roteiro/aprovar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoId, opcao_id: opcaoId }),
        }
      );

      const data = await res.json();

      if (data.success) {
toast.success("Roteiro aprovado! Redirecionando...");
        setTimeout(() => {
          window.location.href = `/imagens/${videoId}`;
        }, 1500);
      } else {
        toast.error(data.erro || "Erro ao aprovar");
      }
    } catch (err) {
      toast.error("Erro de conexão com n8n");
      console.error(err);
    }
    setAprovando(false);
  }

  async function adicionarCena(opcaoId: string) {
    const cenas = cenasPorOpcao[opcaoId] || [];
    const maxOrdem = cenas.length > 0 ? Math.max(...cenas.map((c) => c.ordem)) : 0;

    const { error } = await supabase.from("cenas").insert({
      video_id: videoId,
      opcao_id: opcaoId,
      numero: String(maxOrdem + 1),
      ordem: maxOrdem + 1,
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
      toast.error("Erro ao adicionar cena");
    } else {
      toast.success("Cena adicionada");
      fetchData();
    }
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
        <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
          ← Voltar às premissas
        </a>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 mb-6">
          {opcoes.map((op) => (
            <TabsTrigger key={op.id} value={op.id} className="text-sm cursor-pointer">
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Cenas ({(cenasPorOpcao[opcao.id] || []).length})
                </h2>
                <button
                  onClick={() => adicionarCena(opcao.id)}
                  className="text-sm bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-md hover:bg-zinc-700 cursor-pointer"
                >
                  + Adicionar cena
                </button>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, opcao.id)}>
                <SortableContext items={(cenasPorOpcao[opcao.id] || []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {(cenasPorOpcao[opcao.id] || []).map((cena) => (
                      <CenaEditor
                        key={cena.id}
                        cena={cena}
                        onUpdate={fetchData}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Button
                onClick={() => aprovarOpcao(opcao.id)}
                disabled={aprovando}
                className="bg-green-700 hover:bg-green-600 cursor-pointer"
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
