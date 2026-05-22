import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100396.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100396 — «Шлёпанцы и сланцы» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100396,
  nodeName: "Шлёпанцы и сланцы",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Шлёпанцы и сланцы"],
  sizeValues: snapshot.externalValues.Size,
});
