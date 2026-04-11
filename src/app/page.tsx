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
        `/api/webhook?path=premissa/selecionar`,
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
                {p.reddit_url && (
                  <>
                    <span>•</span>
                    <a href={p.reddit_url} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 underline">Reddit</a>
                  </>
                )}
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
