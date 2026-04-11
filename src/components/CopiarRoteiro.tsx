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

  function copiar() {
    const texto = gerarTexto();
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    toast.success("Roteiro copiado para a área de transferência");
  }

  return (
    <Button size="sm" variant="outline" onClick={copiar}>
      📋 Copiar roteiro completo
    </Button>
  );
}
