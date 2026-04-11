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
