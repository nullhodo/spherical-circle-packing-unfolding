import type { ProjectionMethod } from "../types/sketch";

interface ProjectionOption {
  value: ProjectionMethod;
  label: string;
  description: string;
}

export const PROJECTION_OPTIONS: ProjectionOption[] = [
  {
    value: "winkel",
    label: "ヴィンケル図法 (Winkel Tripel)",
    description: "面積・形状・距離の歪みを均等に折衷した世界標準投影法",
  },
  {
    value: "mercator",
    label: "メルカトル図法 (Mercator)",
    description: "正角図法。角度を保存し直線航路を描く円筒投影",
  },
  {
    value: "azimuthal",
    label: "正距方位図法 (Azimuthal Equidistant)",
    description: "中心からの距離と方位が正確な円形投影",
  },
  {
    value: "orthographic2d",
    label: "正射図法 2D (Orthographic Planar)",
    description: "無限遠から地球を直交投影したような立体感ある円盤",
  },
  {
    value: "mollweide",
    label: "モルワイデ図法 (Mollweide)",
    description: "正積図法。全球を楕円形に収め面積比率を正確に保存",
  },
];
