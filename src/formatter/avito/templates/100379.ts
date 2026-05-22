import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100379.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100379 — «Шлёпанцы и сланцы» (мужская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100379,
  nodeName: "Шлёпанцы и сланцы",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Шлёпанцы и сланцы"],
  sizeValues: snapshot.externalValues.Size,
});
